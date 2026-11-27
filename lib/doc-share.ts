import { createClient } from "@/lib/supabase";

/**
 * Read-only links to a finished document (0036_doc_shares.sql). The owner
 * makes and stops them under RLS; the page /share/<token> reads them on the
 * server. A share points at the stored agent message, never at text of its own.
 */

export interface DocShare { token: string; createdAt: string }

export function shareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

/** The live link for this document, if there is one. Null also when 0036 is missing. */
export async function currentShare(messageId: string): Promise<DocShare | null> {
  const { data, error } = await createClient().from("agxp_doc_shares")
    .select("token, created_at").eq("message_id", messageId).is("revoked_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return { token: data.token, createdAt: data.created_at };
}

export async function createShare(projectId: string, messageId: string): Promise<DocShare> {
  const existing = await currentShare(messageId);
  if (existing) return existing;
  const { data, error } = await createClient().from("agxp_doc_shares")
    .insert({ project_id: projectId, message_id: messageId })
    .select("token, created_at").single();
  if (error) throw error;
  return { token: data.token, createdAt: data.created_at };
}

/** Stops every live link to this document. */
export async function revokeShares(messageId: string): Promise<void> {
  const { error } = await createClient().from("agxp_doc_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("message_id", messageId).is("revoked_at", null);
  if (error) throw error;
}
