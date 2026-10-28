import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { callerId } from "@/lib/caller-id";
import { ipGate } from "@/lib/ip-gate";
import { allowanceFor, blocked, beginAiCall, settleAiCall, takeRateSlot, type SpentTokens } from "@/lib/entitlement-server";
import { estimateInputTokens, reserveMicroUsd } from "@/lib/cost";
import { triageSystemPrompt, triageUserContent, parseTriageReply } from "@/lib/feedback-triage";

/**
 * Rates one piece of feedback for seriousness (lib/feedback-triage.ts).
 *
 * The browser asks right after a tester sends feedback, and the team's
 * dashboard asks for rows that were never rated ("Rate now"). The request
 * carries only the row's id: the message that is rated is the stored one, the
 * model sees the message and never an attached conversation, and the answer is
 * written with the service role — the tester cannot read or write severity.
 *
 * Who may ask: the owner of the row, or a team member (am_i_team, asked with
 * the caller's own token). The row is claimed with one atomic update of
 * `triaged_at`, so a repeated or parallel call spends nothing twice; a failure
 * gives the claim back, and the dashboard shows the row as "not rated yet".
 *
 * It is a model call, so it goes through the same lease as every other one
 * (migration 0021) and is paid by the account that wrote the feedback. The lease
 * kind is the title's: the same size of request, and the kinds are a closed list
 * in the database.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODELS = ["claude-haiku-5-5", "claude-sonnet-5"];
const MAX_OUTPUT_TOKENS = 120;

const fail = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status });

/** Whether the caller is on the team, by the database's own rule (0012). */
async function isTeam(req: NextRequest): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const auth = req.headers.get("authorization") ?? "";
  if (!url || !key || !auth) return false;
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });
  const { data } = await db.rpc("am_i_team");
  return data === true;
}

export async function POST(req: NextRequest) {
  const crowded = await ipGate(req, "feedback");
  if (crowded) return crowded;

  const userId = await callerId(req);
  if (!userId) return fail(401, "unauthorized", "Your session has expired. Sign in again.");
  if (!(await takeRateSlot(userId, "triage", 40, 600))) {
    return fail(429, "rate_limited", "Too many requests. Try again in a few minutes.");
  }

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!UUID.test(id)) return fail(400, "bad_request", "Bad request.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !serviceKey) {
    console.error("[feedback/triage] SUPABASE_SERVICE_ROLE_KEY is not set");
    return fail(500, "not_configured", "Rating isn't set up on the server.");
  }
  if (!apiKey) return fail(500, "not_configured", "The assistant isn't configured on the server yet.");
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: row, error: readError } = await db
    .from("agxp_feedback").select("user_id, message, severity, triaged_at").eq("id", id).maybeSingle();
  if (readError) {
    console.error("[feedback/triage] read failed:", readError.code, readError.message);
    return fail(500, "server", "Something went wrong on our side.");
  }
  // Not there and not yours look the same, so ids cannot be probed.
  if (!row || (row.user_id !== userId && !(await isTeam(req)))) return NextResponse.json({ rated: false });
  if (row.severity) return NextResponse.json({ rated: true, severity: row.severity });

  // The claim.
  const { data: claimed, error: claimError } = await db
    .from("agxp_feedback").update({ triaged_at: new Date().toISOString() })
    .eq("id", id).is("triaged_at", null).select("id").maybeSingle();
  if (claimError) {
    console.error("[feedback/triage] claim failed:", claimError.code, claimError.message);
    return fail(500, "server", "Something went wrong on our side.");
  }
  if (!claimed) return NextResponse.json({ rated: false }); // another call is on it
  const unclaim = () => db.from("agxp_feedback").update({ triaged_at: null }).eq("id", id);

  // Paid by the account that wrote it, like the rest of its usage.
  const owner = row.user_id as string;
  const allowance = await allowanceFor(owner);
  const hit = blocked(allowance);
  if (hit) { await unclaim(); return fail(402, hit.kind, hit.message); }

  const system = triageSystemPrompt();
  const content = triageUserContent(row.message as string);
  const reserve = 2 * reserveMicroUsd(estimateInputTokens({ chars: system.length + content.length }), MAX_OUTPUT_TOKENS);
  const admitted = await beginAiCall(allowance, owner, "title", reserve);
  if ("hit" in admitted) {
    await unclaim();
    return fail(admitted.status, admitted.status === 429 ? "rate_limited" : admitted.hit.kind, admitted.hit.message);
  }

  const anthropic = new Anthropic({ apiKey });
  const spent: SpentTokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let lastError: unknown = null;
  try {
    for (const model of MODELS) {
      try {
        const res = await anthropic.messages.create({
          model, max_tokens: MAX_OUTPUT_TOKENS, system, messages: [{ role: "user", content }],
        });
        const u = res.usage;
        spent.input += u.input_tokens ?? 0;
        spent.output += u.output_tokens ?? 0;
        spent.cacheRead += u.cache_read_input_tokens ?? 0;
        spent.cacheWrite += u.cache_creation_input_tokens ?? 0;

        const rating = parseTriageReply(res.content.map(b => (b.type === "text" ? b.text : "")).join(""));
        if (!rating) { lastError = new Error("unreadable reply"); continue; }

        const { error: writeError } = await db.from("agxp_feedback")
          .update({ severity: rating.severity, severity_reason: rating.reason || null }).eq("id", id);
        if (writeError) throw writeError;
        return NextResponse.json({ rated: true, severity: rating.severity });
      } catch (err) {
        lastError = err;
      }
    }
    console.error("[feedback/triage] failed:", lastError);
    await unclaim();
    return fail(502, "server", "Rating the feedback failed.");
  } finally {
    settleAiCall(admitted.lease, spent)
      .catch(err => console.error("[feedback/triage] usage not recorded:", err));
  }
}
