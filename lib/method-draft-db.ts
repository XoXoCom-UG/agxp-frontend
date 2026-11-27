import { createClient } from "@/lib/supabase";
import type { DraftState, MethodDraft } from "@/lib/method-draft";
import { MAX_DRAFT_TEXT } from "@/lib/method-draft";

/**
 * The method draft in the database (0037_method_drafts.sql), so it follows the
 * project to another computer. The browser copy (method-draft-store.ts) stays
 * as the fast first paint and as the fallback: without 0037 every call here
 * quietly does nothing, and the Cockpit works as it did.
 */

function clean(drafts: unknown): MethodDraft[] {
  if (!Array.isArray(drafts)) return [];
  return drafts
    .filter((d): d is MethodDraft => !!d && typeof d.label === "string" && typeof d.text === "string")
    .map(d => ({ label: d.label.slice(0, 120), text: d.text.replace(/\[\[|\]\]/g, "").slice(0, MAX_DRAFT_TEXT * 2) }));
}

export async function loadDraftRemote(projectId: string): Promise<DraftState | null> {
  try {
    const { data, error } = await createClient().from("agxp_method_drafts")
      .select("kind, drafts, reason").eq("project_id", projectId).maybeSingle();
    if (error || !data) return null;
    const drafts = clean(data.drafts);
    return drafts.length ? { kind: data.kind, status: "ready", drafts, reason: typeof data.reason === "string" ? data.reason : undefined } : null;
  } catch {
    return null;
  }
}

export async function saveDraftRemote(projectId: string, draft: DraftState): Promise<void> {
  if (draft.status !== "ready" || draft.drafts.length === 0) return;
  try {
    await createClient().from("agxp_method_drafts").upsert({
      project_id: projectId, kind: draft.kind, drafts: clean(draft.drafts), reason: draft.reason?.slice(0, 400) ?? null, updated_at: new Date().toISOString(),
    });
  } catch { /* 0037 not applied, or offline: the browser copy still holds it */ }
}
