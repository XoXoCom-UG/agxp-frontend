import { createClient } from "@/lib/supabase";

export type ReportReason = "wrong" | "harmful" | "other";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Flags one of the agent's answers for the team (agxp_reports, 0020). RLS
 * lets a person insert a report about their own answers and read none back.
 * The excerpt is capped here and in the table.
 */
export async function reportAnswer(r: { messageId?: string; reason: ReportReason; note: string; excerpt: string }): Promise<void> {
  const db = createClient();
  const { error } = await db.from("agxp_reports").insert({
    message_id: r.messageId && UUID.test(r.messageId) ? r.messageId : null,
    reason: r.reason,
    note: r.note.trim().slice(0, 1000) || null,
    excerpt: r.excerpt.trim().slice(0, 600) || null,
  });
  if (!error) return;
  if (error.code === "P0001") throw new Error(error.message);
  // Most often: migration 0020 not applied yet, or a reply that is only on screen.
  console.warn("[report] failed:", error.code, error.message);
  throw new Error("The report couldn't be sent. Try again in a moment.");
}
