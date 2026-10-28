import { createClient } from "@/lib/supabase";
import { SEVERITIES, type Severity } from "@/lib/feedback-triage";

export interface FeedbackRow {
  id: string;
  createdAt: string;
  email: string;
  message: string;
  /** The tester ticked "serious problem": what sent the email, not the rating. */
  serious: boolean;
  /** When the email for a serious problem went out; null if it never did. */
  notifiedAt: string | null;
  /** The model's rating of the message; null until it has been rated. */
  severity: Severity | null;
  severityReason: string | null;
  includeConversation: boolean;
  conversationChars: number;
  page: string | null;
}

interface Raw {
  id: string; created_at: string; email: string | null; message: string; serious: boolean;
  notified_at: string | null; severity: string | null; severity_reason: string | null;
  include_conversation: boolean; conversation_chars: number; page: string | null;
}

function failure(message: string, code?: string): Error {
  if (code === "42883" || /team_feedback/.test(message)) {
    return new Error("The feedback view is missing: run supabase/migrations/0025, 0026 and 0027 (feedback) in the SQL editor.");
  }
  return new Error(message);
}

/**
 * team-feedback.ts — what testers sent, for the team's feedback dashboard.
 * Read through team_feedback() (0027), which refuses anyone off the team and
 * returns the rows already ordered by seriousness. The conversation is left
 * out: it is read on request.
 */
export async function loadTeamFeedback(): Promise<FeedbackRow[]> {
  const { data, error } = await createClient().rpc("team_feedback");
  if (error) throw failure(error.message, error.code);
  return ((data ?? []) as Raw[]).map(r => ({
    id: r.id, createdAt: r.created_at, email: r.email ?? "(deleted account)", message: r.message,
    serious: r.serious, notifiedAt: r.notified_at,
    severity: (SEVERITIES as readonly string[]).includes(r.severity ?? "") ? (r.severity as Severity) : null,
    severityReason: r.severity_reason, includeConversation: r.include_conversation,
    conversationChars: r.conversation_chars, page: r.page,
  }));
}

/** One row's attached conversation. */
export async function loadFeedbackConversation(id: string): Promise<string> {
  const { data, error } = await createClient().rpc("team_feedback_conversation", { p_id: id });
  if (error) throw failure(error.message, error.code);
  return (data as string | null) ?? "";
}

/** Asks the server to rate a row that was never rated. True when it now has a rating. */
export async function rateFeedback(id: string): Promise<boolean> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;
  try {
    const res = await fetch("/api/feedback/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    const json = (await res.json().catch(() => ({}))) as { rated?: boolean };
    return res.ok && json.rated === true;
  } catch {
    return false;
  }
}
