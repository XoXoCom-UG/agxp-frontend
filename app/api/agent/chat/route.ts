import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { caller } from "@/lib/caller-id";
import { memoryAllowed } from "@/lib/memory-pref";
import type { AgentType } from "@/lib/agents";
import { DELIVERABLES } from "@/lib/deliverables";
import { systemPrompt, peerPrompt } from "@/lib/agent-prompt";
import { withAttachments } from "@/lib/message-files";
import { peerTranscript, type PeerContext } from "@/lib/peer-context";
import { allowanceFor, blocked, beginAiCall, settleAiCall, peerReadingAllowed, takeRateSlot } from "@/lib/entitlement-server";
import { estimateInputTokens, reserveMicroUsd } from "@/lib/cost";
import { validateMessages, cleanLabel, cleanMemory, cleanKind, AGENT_NAME_MAX } from "@/lib/chat-input";
import { loadConversation, peerTurns, saveReply, isProjectId, type StoredTurn } from "@/lib/conversation-server";
import { cutUnfinishedMarker } from "@/lib/conversation-state";
import { bearerOf } from "@/lib/server-db";

const MODEL = "claude-sonnet-5";

/** The reply cap. Why it is this high is explained where it is used. */
const MAX_OUTPUT_TOKENS = 24_000;

/**
 * Two limits with the same numbers. This in-memory one is a cheap first filter
 * that costs no round trip; serverless instances don't share memory, so on its
 * own a caller spread over instances got more than this. takeRateSlot() below
 * counts in the database, which every instance shares, and is the real limit.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function overLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  // Keep the map from growing forever on a long-lived instance.
  if (hits.size > 500) {
    for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k);
  }
  return recent.length > MAX_PER_WINDOW;
}

// The user wants EVERY question to end with pickable options — no free-text
// guessing, no exceptions. This is a hard requirement, not a "when it makes
// sense" suggestion, because the first, softer wording got ignored/skipped
// by the model on open-ended questions.

/**
 * What the browser sends. Note what is NOT here any more: the conversation.
 * The server reads it from the database (lib/conversation-server.ts), so a
 * caller can no longer hand the model replies it never gave.
 */
interface ChatBody {
  /** The project, and with agentType the panel, whose conversation to answer. */
  projectId: string;
  agentType: AgentType;
  /** The agent's type — decides the interview and the document (lib/agent-types.ts). */
  agentKind?: string;
  agentName: string;
  /** "kind: fact" lines from this agent's earlier projects with this user. */
  memory?: string[];
  /** How many projects the two have done together, which sets the tone. */
  experience?: { level?: string; projects?: number };
  /** The other agent on this project, when there is one. Only its role and
   *  name are taken from here; what it was told is read from the database. */
  peer?: Pick<PeerContext, "role" | "name">;
}

/**
 * The other panel's conversation, from the database. The browser only says
 * whether there is another agent and what it is called; the name is cleaned
 * because it ends up inside the system prompt.
 */
function peerFrom(self: AgentType, peer: unknown, other: StoredTurn[]): PeerContext | undefined {
  if (!peer || typeof peer !== "object") return undefined;
  const p = peer as Partial<PeerContext>;
  if ((p.role !== "consultant" && p.role !== "coach") || p.role === self) return undefined;
  const name = cleanLabel(p.name, AGENT_NAME_MAX) || (p.role === "coach" ? "Coach" : "Consultant");
  const turns = peerTurns(other);
  const transcript = peerTranscript(turns, name);
  if (!transcript) return undefined;
  return { role: p.role, name, transcript, turns: turns.filter(t => t.role === "assistant").length, docs: 0 };
}

/** What the request carries, for the reservation — see lib/cost.ts. */
function inputEstimate(system: Anthropic.TextBlockParam[], msgs: Anthropic.MessageParam[]): number {
  let chars = system.reduce((n, b) => n + b.text.length, 0);
  let pdfBytes = 0;
  let images = 0;
  for (const m of msgs) {
    if (typeof m.content === "string") { chars += m.content.length; continue; }
    for (const b of m.content) {
      if (b.type === "text") chars += b.text.length;
      else if (b.type === "image") images++;
      else if (b.type === "document" && b.source.type === "base64") pdfBytes += Math.ceil(b.source.data.length * 3 / 4);
    }
  }
  return estimateInputTokens({ chars, pdfBytes, images });
}

/**
 * Every error the browser can get before the answer starts. The text is what
 * a person may end up reading, so it is plain English and never names an env
 * var or an internal; `code` is what the client actually branches on.
 */
function fail(status: number, code: string, error: string) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(req: NextRequest) {
  const me = await caller(req);
  const userId = me?.id ?? null;
  if (!userId) {
    return fail(401, "unauthorized", "Your session has expired. Sign in again.");
  }
  if (overLimit(userId) || !(await takeRateSlot(userId, "chat", MAX_PER_WINDOW))) {
    return fail(429, "rate_limited", "Too many messages in a short time. Wait a minute, then try again.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Named here, in the server log, where the person who can fix it looks.
    console.error("[agent/chat] ANTHROPIC_API_KEY is not set");
    return fail(500, "not_configured", "The assistant isn't configured on the server yet.");
  }

  const body = (await req.json().catch(() => null)) as ChatBody | null;
  if (!body || typeof body.agentType !== "string" || !DELIVERABLES[body.agentType] || !isProjectId(body.projectId)) {
    return fail(400, "bad_request", "The request was incomplete. Reload the page and try again.");
  }

  // The conversation as it was actually stored, read under the caller's own
  // token: someone else's project id reads as empty and is refused.
  const bearer = bearerOf(req);
  const loaded = await loadConversation(bearer, body.projectId, body.agentType);
  if (!loaded.ok) return fail(loaded.status, "bad_request", loaded.error);

  // Roles, content types and sizes — the same caps as before, now applied to
  // what is in the table. A user can still insert their OWN messages there,
  // so the caps still matter.
  const checked = validateMessages(loaded.conversation.own);
  if (!checked.ok) {
    return fail(checked.status, checked.status === 413 ? "too_large" : "bad_request", checked.error);
  }
  const messages = checked.messages;

  // What this account is allowed, and what it has already spent. Read before
  // the model call so a user over the ceiling is told rather than billed.
  const allowance = await allowanceFor(userId);
  const hit = blocked(allowance);
  if (hit) return fail(402, hit.kind, hit.message);

  // The free tier sees the Coach read along exactly once. Hiding the feature
  // completely would mean the free user never meets the one thing they would
  // be paying for; after the demonstration it is off until they upgrade.
  const coachTurns = messages.filter(m => m.role === "assistant").length;
  const peer = body.agentType === "coach" && !peerReadingAllowed(allowance.plan, coachTurns)
    ? undefined
    : peerFrom(body.agentType, body.peer, loaded.conversation.other);

  const anthropic = new Anthropic({ apiKey });

  // Streamed, not awaited whole: the answer used to appear after 15-20 seconds
  // of "is thinking...", which is the single biggest reason the app felt slow.
  // The body is plain text — the client appends every chunk as it lands.
  const sys = systemPrompt(
      body.agentType,
      cleanLabel(body.agentName, AGENT_NAME_MAX) || "dein Agent",
      // Lernnotizen switched off on the account: none reach the prompt, whatever
      // the browser sends (the privacy settings, lib/memory-pref.ts).
      memoryAllowed(me?.meta) ? cleanMemory(body.memory) : [],
      body.experience,
      allowance.plan.stations,
      // Only a known id is passed on; the rest falls back to the role's default.
      cleanKind(body.agentKind),
  );

  /*
   * Prompt caching. A cache read costs a tenth of a fresh input token, and
   * this app resends the whole history every turn, so without caching the
   * bill grows with the SQUARE of the conversation length.
   *
   * Caching is a PREFIX match and the render order is system then messages,
   * so everything after the first byte that changes misses. That decides the
   * layout below:
   *
   *   block 1  the stable system prompt — role, style, agenda, memory. Does
   *            not change within a conversation, so it is the breakpoint.
   *   block 2  the other agent's transcript. This GROWS every time the other
   *            panel answers, so it must come after the breakpoint. Putting
   *            it in block 1 would invalidate the cache on most turns; moving
   *            it into the last user message would cache more, but it would
   *            also restate the other model's output as something the user
   *            said, which is exactly the framing peerPrompt() exists to
   *            prevent. Safety wins; the saving is smaller and honest.
   *
   * When there is no peer block — a single agent, or the free tier with peer
   * reading spent — nothing volatile sits between the system prompt and the
   * history, so the history gets a breakpoint too and the saving is much
   * larger.
   */
  const peerBlock = peerPrompt(body.agentType, peer);
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: sys, cache_control: { type: "ephemeral" } },
  ];
  if (peerBlock) system.push({ type: "text", text: peerBlock });

  /*
   * Attachments are resolved here, not sent by the client: the message only
   * carries a [[FILE:]] path, and lib/message-files.ts reads it back under
   * the caller's own token so a forged path reaches nothing.
   */
  const msgs: Anthropic.MessageParam[] = await withAttachments(messages, bearer, userId);

  const last = msgs.length - 1;
  if (!peerBlock && last >= 0) {
    // The breakpoint goes on the LAST block of the last message, whatever
    // shape it has. It used to assume a plain string, which an attachment
    // turns into an array — and a cache_control on the wrong thing silently
    // stops the prefix from being reused.
    const m = msgs[last];
    const blocks: Anthropic.ContentBlockParam[] = typeof m.content === "string"
      ? [{ type: "text", text: m.content }]
      : [...m.content];
    const tail = blocks[blocks.length - 1];
    if (tail) {
      blocks[blocks.length - 1] = { ...tail, cache_control: { type: "ephemeral" } } as Anthropic.ContentBlockParam;
      msgs[last] = { role: m.role, content: blocks };
    }
  }

  /*
   * The call is admitted here, after the request is fully built and before a
   * single token is paid for: a lease in the database reserves the worst case
   * this call can cost, so parallel requests see each other (migration 0021).
   * From this point the lease MUST be settled exactly once — by the stream
   * below, or right here if the stream never starts.
   */
  const admitted = await beginAiCall(allowance, userId, "chat", reserveMicroUsd(inputEstimate(system, msgs), MAX_OUTPUT_TOKENS));
  if ("hit" in admitted) return fail(admitted.status, admitted.status === 429 ? "rate_limited" : admitted.hit.kind, admitted.hit.message);
  const lease = admitted.lease;

  /*
   * The cap is not a budget — you are billed for what comes back, not for
   * what you allowed. So it costs nothing to leave real headroom, and
   * leaving none costs a document cut off mid-table.
   *
   * Measured against the current spec: thirteen sections, each a visual plus
   * a lead sentence plus up to eight bullets of up to 35 words, plus the
   * Management Summary. Worst case is about 4,900 words, and German
   * compounds tokenise worse than the usual ratio — call it 8,000 tokens
   * against the old cap of 8,192. A 3% margin is not a margin.
   */
  let stream: ReturnType<typeof anthropic.messages.stream>;
  try {
    stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: msgs,
    });
  } catch (err) {
    console.error("[agent/chat] could not start:", err);
    await settleAiCall(lease, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    return fail(502, "server", "The assistant could not answer right now. Try again.");
  }

  const encoder = new TextEncoder();
  /** The id the reply will be stored under, sent before the first word. */
  const replyId = crypto.randomUUID();
  const projectId = body.projectId;
  const column = body.agentType;
  let cancelled = false;

  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Everything sent to the browser, so the server stores exactly that.
      let sent = "";
      const send = (text: string) => {
        sent += text;
        try { controller.enqueue(encoder.encode(text)); } catch { /* the reader is gone */ }
      };
      /*
       * Usage as the stream reports it, not only from finalMessage(). When the
       * user pressed Stop the stream was aborted, finalMessage() rejected, and
       * close() on the cancelled stream threw before metering ran — so a
       * stopped answer was recorded as costing nothing, input and all. Stop
       * just before the end, every time, and the account was never charged.
       * message_start carries the input side, message_delta the output count.
       */
      const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      try {
        for await (const event of stream) {
          if (event.type === "message_start") {
            const u = event.message.usage;
            usage.input = u.input_tokens ?? 0;
            usage.output = u.output_tokens ?? 0;
            usage.cacheRead = u.cache_read_input_tokens ?? 0;
            usage.cacheWrite = u.cache_creation_input_tokens ?? 0;
          } else if (event.type === "message_delta") {
            usage.output = Math.max(usage.output, event.usage.output_tokens ?? 0);
          } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send(event.delta.text);
          }
        }
      } catch (err) {
        // The response has already started, so there is no status code left to
        // send: the client sees a short (or empty) answer and says so. Log it
        // here, which is where it can actually be read. Stop is not an error.
        if (!cancelled) console.error("[agent/chat] stream failed:", err);
      } finally {
        // Did it actually finish? A cap can always be hit, and until now
        // hitting it was silent: the reader got a document that stopped in
        // the middle of a table and nothing said why. One line in the stream
        // is worth more than a correct token count.
        if (!cancelled) {
          try {
            const done = await stream.finalMessage();
            const u = done.usage;
            usage.input = u.input_tokens ?? usage.input;
            usage.output = u.output_tokens ?? usage.output;
            usage.cacheRead = u.cache_read_input_tokens ?? usage.cacheRead;
            usage.cacheWrite = u.cache_creation_input_tokens ?? usage.cacheWrite;
            if (done.stop_reason === "max_tokens") {
              console.warn("[agent/chat] reply hit max_tokens — output truncated");
              send(
                "\n\n_(Die Antwort wurde abgeschnitten, weil sie die Längengrenze erreicht hat. " +
                "Bitte fordere das Dokument noch einmal an — oder sag mir, welche Sektionen dir reichen.)_",
              );
            }
          } catch { /* the stream failed; what was seen so far is recorded below */ }
        }
        // An aborted stream can end before its last message_delta. A token is
        // rarely shorter than three characters, so this never counts much low.
        usage.output = Math.max(usage.output, Math.ceil(sent.length / 3));

        // Stored BEFORE the stream closes: when the browser sees the end, the
        // reply is in the table, so Try again can always find it to delete.
        // A stopped reply is kept like any other, minus a marker cut in half.
        const reply = cancelled ? cutUnfinishedMarker(sent) : sent;
        if (reply.trim()) await saveReply(replyId, projectId, column, reply);

        try { controller.close(); } catch { /* already cancelled */ }

        // What the request cost. Deliberately after close(): the user already
        // has their answer, so metering must not be able to delay or break it.
        // A lost count is cheaper than a thrown error on a finished response.
        // The same call also gives the lease back.
        try {
          await settleAiCall(lease, usage);
        } catch (err) {
          console.error("[agent/chat] usage not recorded:", err);
        }
      }
    },
    cancel() {
      // The user pressed Stop or navigated away — stop paying for the rest.
      cancelled = true;
      stream.abort();
    },
  });

  return new Response(out, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Where the reply will be stored, so the browser can delete it for Try again.
      "X-Message-Id": replyId,
      "Cache-Control": "no-store",
      // Tells proxies not to buffer, which would defeat the whole point.
      "X-Accel-Buffering": "no",
    },
  });
}
