import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ipGate } from "@/lib/ip-gate";
import { takeRateSlot } from "@/lib/entitlement-server";
import { sendTeamAlert } from "@/lib/send-mail";
import { feedbackAlert, FEEDBACK_ALERT_TO } from "@/lib/feedback-text";

/**
 * The email for feedback a tester marked as a serious problem.
 *
 * The feedback row itself is written by the browser under RLS (0025/0026), which
 * is also why the browser cannot read it back. This route is told only the row's
 * id and takes everything else from the database: the caller must own that row,
 * it must be marked serious, and it is claimed with one atomic update, so a
 * repeated or forged call sends nothing twice and nothing for someone else's row.
 * Whatever is in the request besides the id is ignored — the text of the email
 * is the stored message, never the request's.
 *
 * Losing the email must never lose the feedback: the row is already saved, a
 * failed send puts the claim back, and the team panel flags a serious row that
 * was never mailed.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same shape as the other routes: verify the bearer token against Supabase. */
async function callerId(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

export async function POST(req: NextRequest) {
  const crowded = await ipGate(req, "feedback");
  if (crowded) return crowded;

  const userId = await callerId(req);
  if (!userId) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }
  if (!(await takeRateSlot(userId, "feedback", 10, 600))) {
    return NextResponse.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[feedback/alert] SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json({ error: "Alerts aren't set up on the server." }, { status: 500 });
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // The claim: only the owner's serious row that nobody has mailed about yet.
  const { data: row, error } = await db
    .from("agxp_feedback")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", userId).eq("serious", true).is("notified_at", null)
    .select("message, page, include_conversation")
    .maybeSingle();
  if (error) {
    console.error("[feedback/alert] claim failed:", error.code, error.message);
    return NextResponse.json({ error: "Something went wrong on our side." }, { status: 500 });
  }
  // Not theirs, not serious, or already sent: the same answer, so ids cannot be probed.
  if (!row) return NextResponse.json({ sent: false });

  const { data: user } = await db.auth.admin.getUserById(userId);
  const mail = feedbackAlert({
    email: user?.user?.email ?? "",
    message: row.message as string,
    page: (row.page as string | null) ?? null,
    hasConversation: !!row.include_conversation,
  });
  const result = await sendTeamAlert(FEEDBACK_ALERT_TO, mail);
  if (!result.sent) {
    console.error("[feedback/alert] email not sent:", result.reason);
    // Put the claim back: the panel then shows this row as "not mailed".
    await db.from("agxp_feedback").update({ notified_at: null }).eq("id", id).eq("user_id", userId);
    return NextResponse.json({ sent: false });
  }
  return NextResponse.json({ sent: true });
}
