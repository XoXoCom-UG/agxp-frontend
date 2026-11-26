import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse, after } from "next/server";
import { callerId } from "@/lib/caller-id";
import { ipGate } from "@/lib/ip-gate";
import { allowanceFor, blocked, beginAiCall, settleAiCall, takeRateSlot, type SpentTokens } from "@/lib/entitlement-server";
import { estimateInputTokens, reserveMicroUsd } from "@/lib/cost";
import { stripMarkerSyntax, cleanKind } from "@/lib/chat-input";
import { deliverableFor } from "@/lib/deliverables";
import { draftSystemPrompt, parseDraftReply, fakeDraft, MAX_DRAFT_METHODS } from "@/lib/method-draft";
import { fakeAiOn } from "@/lib/dev-fake-ai";

/**
 * The first draft of every method (meeting 2026-11-20): started by the Prompt
 * Pad as soon as the consultant is chosen, so it is ready when the person
 * presses Start. Same shape as /api/agent/start and metered the same way — the
 * "title" lease kind and rate bucket, because the lease table only knows 'chat'
 * and 'title' (migration 0021) and this is a small call at the same price.
 */
const MODELS = ["claude-haiku-5-5", "claude-sonnet-5"];
const MAX_PROMPT_CHARS = 6000;
const MAX_OUTPUT_TOKENS = 1500;

const hits = new Map<string, number[]>();
function overLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter(t => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > 10;
}

const fail = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status });

export async function POST(req: NextRequest) {
  const crowded = await ipGate(req, "title");
  if (crowded) return crowded;

  const userId = await callerId(req);
  if (!userId) return fail(401, "unauthorized", "Your session has expired. Sign in again.");
  if (overLimit(userId) || !(await takeRateSlot(userId, "title", 10))) {
    return fail(429, "rate_limited", "Too many requests.");
  }

  const body = (await req.json().catch(() => null)) as { prompt?: unknown; kind?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? stripMarkerSyntax(body.prompt).trim() : "";
  if (!prompt) return fail(400, "bad_request", "Write what you want to do first.");
  if (prompt.length > MAX_PROMPT_CHARS) {
    return fail(413, "bad_request", `That is too long. Keep it under ${MAX_PROMPT_CHARS.toLocaleString("en")} characters.`);
  }
  // The consultant's own agenda; an unknown type is the role's default.
  const stations = deliverableFor("consultant", cleanKind(typeof body?.kind === "string" ? body.kind : "") || null)
    .stations.slice(0, MAX_DRAFT_METHODS).map(s => ({ label: s.label, goal: s.goal }));

  // The pretend assistant of `next dev` (lib/dev-fake-ai.ts): never in production.
  if (fakeAiOn()) {
    await new Promise(r => setTimeout(r, 2500)); // long enough to see it arrive in the background
    return NextResponse.json({ drafts: fakeDraft(stations, prompt) });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(500, "not_configured", "The assistant isn't configured on the server yet.");

  const allowance = await allowanceFor(userId);
  const hit = blocked(allowance);
  if (hit) return fail(402, hit.kind, hit.message);

  const system = draftSystemPrompt(stations);
  const content = `Anfrage des Nutzers:\n\n${prompt}`;
  const reserve = 2 * reserveMicroUsd(estimateInputTokens({ chars: system.length + content.length }), MAX_OUTPUT_TOKENS);
  const admitted = await beginAiCall(allowance, userId, "title", reserve);
  if ("hit" in admitted) {
    return fail(admitted.status, admitted.status === 429 ? "rate_limited" : admitted.hit.kind, admitted.hit.message);
  }

  const anthropic = new Anthropic({ apiKey });
  const spent: SpentTokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let lastError: unknown = null;
  try {
    for (const model of MODELS) {
      try {
        const res = await anthropic.messages.create({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          messages: [{ role: "user", content }],
        });
        const text = res.content.map(b => (b.type === "text" ? b.text : "")).join("");
        const u = res.usage;
        spent.input += u.input_tokens ?? 0;
        spent.output += u.output_tokens ?? 0;
        spent.cacheRead += u.cache_read_input_tokens ?? 0;
        spent.cacheWrite += u.cache_creation_input_tokens ?? 0;

        const drafts = parseDraftReply(text, stations);
        if (drafts) return NextResponse.json({ drafts });
        lastError = new Error("unreadable reply");
      } catch (err) {
        lastError = err;
      }
    }
    // No draft is not an error the person must see: the Cockpit keeps the
    // methods' own descriptions and the consultant still drafts in the chat.
    console.error("[agent/draft] failed:", lastError);
    return fail(502, "server", "The first draft could not be written.");
  } finally {
    after(() => settleAiCall(admitted.lease, spent)
      .catch(err => console.error("[agent/draft] usage not recorded:", err)));
  }
}
