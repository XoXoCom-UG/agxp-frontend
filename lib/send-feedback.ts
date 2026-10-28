import { createClient } from "@/lib/supabase";
import { listMessages } from "@/lib/projects";
import { FEEDBACK_MAX, formatConversation, pageOf } from "@/lib/feedback-text";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The project the person is looking at, from the address bar. */
export function projectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/dashboard\/project\/([^/?#]+)/);
  return m && UUID.test(m[1]) ? m[1] : null;
}

/**
 * Sends feedback to the team (agxp_feedback, 0025/0026). RLS lets a person
 * insert their own rows and read none back.
 *
 * The conversation is read here, under the person's own token, and only when
 * they ticked the box: without `includeConversation` nothing from the project
 * is read, let alone sent. The table refuses a conversation without the flag too.
 *
 * A serious problem also asks the server to email the team. The row is saved
 * first, and a failed email never fails the feedback: the team panel shows a
 * serious row that was never mailed.
 */
export async function sendFeedback(f: {
  message: string;
  includeConversation: boolean;
  serious: boolean;
  projectId: string | null;
  pathname: string;
}): Promise<void> {
  const message = f.message.trim().slice(0, FEEDBACK_MAX);
  if (!message) throw new Error("Write a few words first.");

  const withConversation = f.includeConversation && !!f.projectId;
  let conversation: string | null = null;
  if (withConversation) {
    try {
      const [consultant, coach] = await Promise.all([
        listMessages(f.projectId!, "consultant"),
        listMessages(f.projectId!, "coach"),
      ]);
      conversation = formatConversation([...consultant, ...coach]) || null;
    } catch {
      throw new Error("The conversation couldn't be read, so nothing was sent. Try again.");
    }
  }

  const db = createClient();
  // The id is made here because the person cannot read the row back (no select
  // policy), and the alert route needs to name it.
  const id = crypto.randomUUID();
  const { error } = await db.from("agxp_feedback").insert({
    id,
    project_id: f.projectId && UUID.test(f.projectId) ? f.projectId : null,
    message,
    serious: f.serious,
    include_conversation: withConversation,
    conversation,
    page: pageOf(f.pathname) || null,
  });
  if (error) {
    if (error.code === "P0001") throw new Error(error.message);
    // Most often: migration 0025 or 0026 not applied yet.
    console.warn("[feedback] failed:", error.code, error.message);
    throw new Error("The feedback couldn't be sent. Try again in a moment.");
  }

  // After the row is saved, two things the server does with it: rate it (for
  // everyone — the dashboard orders by that) and, for a serious one, email the
  // team. Neither is waited for: the person has already been thanked, and a
  // failure leaves the row for the team to see as "not rated" / "email not sent".
  try {
    const { data } = await db.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      const ask = (path: string) => fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
        keepalive: true,
      }).catch(e => console.warn(`[feedback] ${path} failed:`, (e as Error).message));
      void ask("/api/feedback/triage");
      if (f.serious) void ask("/api/feedback/alert");
    }
  } catch (e) {
    console.warn("[feedback] follow-up requests failed:", (e as Error).message);
  }
}
