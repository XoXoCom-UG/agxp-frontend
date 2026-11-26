import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse, after } from "next/server";
import { callerId } from "@/lib/caller-id";
import { ipGate } from "@/lib/ip-gate";
import { allowanceFor, blocked, beginAiCall, settleAiCall, takeRateSlot, type SpentTokens } from "@/lib/entitlement-server";
import { estimateInputTokens, reserveMicroUsd } from "@/lib/cost";
import { stripMarkerSyntax } from "@/lib/chat-input";
import { typesFor } from "@/lib/agent-types";
import { startSystemPrompt, parseStartReply, FALLBACK_KIND } from "@/lib/start-plan";
import { fakeAiOn, fakeStartPlan } from "@/lib/dev-fake-ai";

/**
 * The Prompt Pad's request (meeting 2026-11-20): what the user typed in, which
 * consultant type fits and which of its methods the project needs. Small model,
 * a few hundred tokens, a request of its own — the same shape as the title
 * route (app/api/agent/title/route.ts) and metered the same way.
 *
 * It takes the "title" lease kind and rate bucket on purpose: the lease table
 * only knows 'chat' and 'title' (migration 0021), and this is a small naming-
 * sized call at the same price. A kind of its own wants a migration.
 */
const MODELS = ["claude-haiku-5-5", "claude-sonnet-5"];
const MAX_PROMPT_CHARS = 6000;
const MAX_OUTPUT_TOKENS = 500;

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

  // The pretend assistant of `next dev` (lib/dev-fake-ai.ts): never in production.
  if (fakeAiOn()) {
    const plan = fakeStartPlan(typesFor("consultant"));
    if (plan) return NextResponse.json(plan);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(500, "not_configured", "The assistant isn't configured on the server yet.");

  const body = (await req.json().catch(() => null)) as { prompt?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? stripMarkerSyntax(body.prompt).trim() : "";
  if (!prompt) return fail(400, "bad_request", "Write what you want to do first.");
  if (prompt.length > MAX_PROMPT_CHARS) {
    return fail(413, "bad_request", `That is too long. Keep it under ${MAX_PROMPT_CHARS.toLocaleString("en")} characters.`);
  }

  const allowance = await allowanceFor(userId);
  const hit = blocked(allowance);
  if (hit) return fail(402, hit.kind, hit.message);

  // Only what this account's plan can build: a type it cannot have is no answer.
  const types = typesFor("consultant", allowance.plan);
  const system = startSystemPrompt(types);
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

        const plan = parseStartReply(text, types);
        if (plan) return NextResponse.json(plan);
        lastError = new Error("unreadable reply");
      } catch (err) {
        lastError = err;
      }
    }
    console.error("[agent/start] failed:", lastError);
    // A start that cannot be read still has an answer: the simple consultant.
    const fallback = parseStartReply(JSON.stringify({ kind: FALLBACK_KIND }), types);
    return fallback ? NextResponse.json(fallback) : fail(502, "server", "Choosing a consultant failed.");
  } finally {
    after(() => settleAiCall(admitted.lease, spent)
      .catch(err => console.error("[agent/start] usage not recorded:", err)));
  }
}
