import { createClient } from "@/lib/supabase";

export interface FeedbackRow {
  id: string;
  createdAt: string;
  email: string;
  message: string;
  serious: boolean;
  /** When the email for a serious problem went out; null if it never did. */
  notifiedAt: string | null;
  includeConversation: boolean;
  conversationChars: number;
  page: string | null;
}

interface Raw {
  id: string; created_at: string; email: string | null; message: string; serious: boolean;
  notified_at: string | null; include_conversation: boolean; conversation_chars: number; page: string | null;
}

function failure(message: string, code?: string): Error {
  if (code === "42883" || /team_feedback/.test(message)) {
    return new Error("The feedback view is missing: run supabase/migrations/0025_feedback.sql and 0026_feedback_dashboard.sql in the SQL editor.");
  }
  return new Error(message);
}

/**
 * team-feedback.ts — what testers sent, for the team panel in Settings.
 * Read through team_feedback() (0026), which refuses anyone off the team.
 * Newest first, the conversation left out: it is read on request.
 */
export async function loadTeamFeedback(): Promise<FeedbackRow[]> {
  const { data, error } = await createClient().rpc("team_feedback");
  if (error) throw failure(error.message, error.code);
  return ((data ?? []) as Raw[]).map(r => ({
    id: r.id, createdAt: r.created_at, email: r.email ?? "(deleted account)", message: r.message,
    serious: r.serious, notifiedAt: r.notified_at, includeConversation: r.include_conversation,
    conversationChars: r.conversation_chars, page: r.page,
  }));
}

/** One row's attached conversation. */
export async function loadFeedbackConversation(id: string): Promise<string> {
  const { data, error } = await createClient().rpc("team_feedback_conversation", { p_id: id });
  if (error) throw failure(error.message, error.code);
  return (data as string | null) ?? "";
}
