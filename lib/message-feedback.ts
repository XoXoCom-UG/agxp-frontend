import { createClient } from "@/lib/supabase";

/**
 * message-feedback.ts — thumbs up / thumbs down on an agent's answer.
 *
 * A real table (migration 0013), not a marker: memory and attachments are
 * written by the model into its own reply, and this is written by the reader
 * about someone else's. Editing a stored assistant message to record an
 * opinion of it would corrupt the one record of what the model actually said.
 *
 * Absence of a row is "no opinion", so clearing a vote deletes it rather
 * than storing a zero.
 */

export type Vote = 1 | -1;

/** Every vote this user has given in a project, by message id. */
export async function loadVotes(messageIds: string[]): Promise<Map<string, Vote>> {
  if (!messageIds.length) return new Map();
  const { data, error } = await createClient()
    .from("agxp_message_feedback")
    .select("message_id,vote")
    .in("message_id", messageIds);
  if (error) return new Map();
  return new Map((data ?? []).map(r => [r.message_id as string, r.vote as Vote]));
}

/** Sets, changes or clears this user's vote. Clearing removes the row. */
export async function setVote(messageId: string, vote: Vote | null): Promise<void> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Your session has expired. Sign in again.");

  if (vote === null) {
    const { error } = await supabase
      .from("agxp_message_feedback")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  // Upsert on the composite key: changing your mind replaces the row rather
  // than adding a second one.
  const { error } = await supabase
    .from("agxp_message_feedback")
    .upsert({ message_id: messageId, user_id: userId, vote }, { onConflict: "message_id,user_id" });
  if (error) throw error;
}
