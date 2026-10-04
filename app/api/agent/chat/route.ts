import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { AgentType } from "@/lib/agents";
import { DELIVERABLES } from "@/lib/deliverables";
import { systemPrompt, peerPrompt } from "@/lib/agent-prompt";
import { withAttachments } from "@/lib/message-files";
import type { PeerContext } from "@/lib/peer-context";
import { allowanceFor, blocked, recordUsage, peerReadingAllowed } from "@/lib/entitlement-server";

const MODEL = "claude-sonnet-5";

/**
 * Who is calling. This route used to be open to the internet — the proxy only
 * guards /dashboard, and nothing here checked a session — so anyone who knew
 * the URL could send prompts and spend our Anthropic budget. The browser sends
 * its Supabase access token, which is verified against Supabase here.
 */
async function callerId(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

/**
 * A seatbelt against a runaway loop, not a wall: serverless instances don't
 * share memory, so a determined caller spread over instances gets more than
 * this. It does stop one client hammering one instance, which is the realistic
 * accident.
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

interface ChatBody {
  agentType: AgentType;
  agentName: string;
  messages: { role: "user" | "assistant"; content: string }[];
  /** "kind: fact" lines from this agent's earlier projects with this user. */
  memory?: string[];
  /** How many projects the two have done together, which sets the tone. */
  experience?: { level?: string; projects?: number };
  /** What the other agent on this project has been told so far. */
  peer?: PeerContext;
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
  const userId = await callerId(req);
  if (!userId) {
    return fail(401, "unauthorized", "Your session has expired. Sign in again.");
  }
  if (overLimit(userId)) {
    return fail(429, "rate_limited", "Too many messages in a short time. Wait a minute, then try again.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Named here, in the server log, where the person who can fix it looks.
    console.error("[agent/chat] ANTHROPIC_API_KEY is not set");
    return fail(500, "not_configured", "The assistant isn't configured on the server yet.");
  }

  const body = (await req.json().catch(() => null)) as ChatBody | null;
  if (!body?.messages?.length || !body.agentType || !DELIVERABLES[body.agentType]) {
    return fail(400, "bad_request", "The request was incomplete. Reload the page and try again.");
  }

  // What this account is allowed, and what it has already spent. Read before
  // the model call so a user over the ceiling is told rather than billed.
  const allowance = await allowanceFor(userId);
  const hit = blocked(allowance);
  if (hit) return fail(402, hit.kind, hit.message);

  // The free tier sees the Coach read along exactly once. Hiding the feature
  // completely would mean the free user never meets the one thing they would
  // be paying for; after the demonstration it is off until they upgrade.
  const coachTurns = body.messages.filter(m => m.role === "assistant").length;
  const peer = body.agentType === "coach" && !peerReadingAllowed(allowance.plan, coachTurns)
    ? undefined
    : body.peer;

  const anthropic = new Anthropic({ apiKey });

  // Streamed, not awaited whole: the answer used to appear after 15-20 seconds
  // of "is thinking...", which is the single biggest reason the app felt slow.
  // The body is plain text — the client appends every chunk as it lands.
  const sys = systemPrompt(
      body.agentType,
      body.agentName || "dein Agent",
      (body.memory ?? []).filter(m => typeof m === "string").slice(0, 20),
      body.experience,
      allowance.plan.stations,
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
  const bearer = (req.headers.get("authorization") ?? "").slice(7).trim();
  const msgs: Anthropic.MessageParam[] = await withAttachments(body.messages, bearer);

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
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 24_000,
    system,
    messages: msgs,
  });

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        // The response has already started, so there is no status code left to
        // send: the client sees a short (or empty) answer and says so. Log it
        // here, which is where it can actually be read.
        console.error("[agent/chat] stream failed:", err);
      } finally {
        // Did it actually finish? A cap can always be hit, and until now
        // hitting it was silent: the reader got a document that stopped in
        // the middle of a table and nothing said why. One line in the stream
        // is worth more than a correct token count.
        try {
          const done = await stream.finalMessage();
          if (done.stop_reason === "max_tokens") {
            console.warn("[agent/chat] reply hit max_tokens — output truncated");
            controller.enqueue(encoder.encode(
              "\n\n_(Die Antwort wurde abgeschnitten, weil sie die Längengrenze erreicht hat. " +
              "Bitte fordere das Dokument noch einmal an — oder sag mir, welche Sektionen dir reichen.)_",
            ));
          }
        } catch { /* the usage read below logs its own failure */ }

        controller.close();
        // What the request actually cost, from the API rather than an
        // estimate. Deliberately after close(): the user already has their
        // answer, so metering must not be able to delay or break it. A lost
        // count is cheaper than a thrown error on a finished response.
        try {
          const done = await stream.finalMessage();
          const u = done.usage;
          await recordUsage(userId, allowance.periodStart, {
            input: u.input_tokens ?? 0,
            output: u.output_tokens ?? 0,
            cacheRead: u.cache_read_input_tokens ?? 0,
            cacheWrite: u.cache_creation_input_tokens ?? 0,
          });
        } catch (err) {
          console.error("[agent/chat] usage not recorded:", err);
        }
      }
    },
    cancel() {
      // The user navigated away or sent again — stop paying for the rest.
      stream.abort();
    },
  });

  return new Response(out, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Tells proxies not to buffer, which would defeat the whole point.
      "X-Accel-Buffering": "no",
    },
  });
}
