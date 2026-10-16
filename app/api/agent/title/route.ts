import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { callerId } from "@/lib/caller-id";
import { allowanceFor, blocked, recordUsage } from "@/lib/entitlement-server";
import { validateMessages, stripMarkerSyntax } from "@/lib/chat-input";
import { titleSystemPrompt, parseTitleReply } from "@/lib/project-title";

/**
 * Names a project from the start of its conversation: a name, one line, an
 * industry. A request of its own, with the smallest model — it costs a few
 * hundred tokens, and it does not depend on the interview's agent remembering
 * to emit a [[TITLE:]] marker (see lib/project-title.ts).
 */
const MODELS = ["claude-haiku-5-5", "claude-sonnet-5"];

/** Only the opening is needed, and only the start of each turn. */
const MAX_TURNS = 8;
const MAX_CHARS_PER_TURN = 1200;

// A seatbelt, like the chat route's: per instance, enough to stop a loop.
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
  const userId = await callerId(req);
  if (!userId) return fail(401, "unauthorized", "Your session has expired. Sign in again.");
  if (overLimit(userId)) return fail(429, "rate_limited", "Too many requests.");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(500, "not_configured", "The assistant isn't configured on the server yet.");

  const body = (await req.json().catch(() => null)) as { messages?: unknown } | null;
  const checked = validateMessages(body?.messages);
  if (!checked.ok) return fail(checked.status, "bad_request", checked.error);

  const allowance = await allowanceFor(userId);
  const hit = blocked(allowance);
  if (hit) return fail(402, hit.kind, hit.message);

  const transcript = checked.messages
    .slice(0, MAX_TURNS)
    .map(m => `${m.role === "user" ? "Nutzer" : "Agent"}: ${stripMarkerSyntax(m.content).slice(0, MAX_CHARS_PER_TURN)}`)
    .join("\n\n");

  const anthropic = new Anthropic({ apiKey });
  let lastError: unknown = null;
  for (const model of MODELS) {
    try {
      const res = await anthropic.messages.create({
        model,
        max_tokens: 200,
        system: titleSystemPrompt(),
        messages: [{ role: "user", content: `Gesprächsanfang:\n\n${transcript}` }],
      });
      const text = res.content.map(b => (b.type === "text" ? b.text : "")).join("");
      const u = res.usage;
      // After the answer is in hand, and never allowed to fail it.
      recordUsage(userId, allowance.periodStart, {
        input: u.input_tokens ?? 0,
        output: u.output_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
      }).catch(err => console.error("[agent/title] usage not recorded:", err));

      const title = parseTitleReply(text);
      if (!title) return fail(502, "empty", "No name came back.");
      return NextResponse.json(title);
    } catch (err) {
      lastError = err;
    }
  }
  console.error("[agent/title] failed:", lastError);
  return fail(502, "server", "Naming the project failed.");
}
