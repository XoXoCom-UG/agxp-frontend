import type { DraftState } from "./method-draft.ts";

/**
 * Where a project's method draft is kept: this browser, under the account
 * (lib/user-scope.ts drops it on sign-out). Not in the database on purpose —
 * a draft is a convenience; the conversation and the document are the record.
 * One key holds the latest few projects, so storage cannot grow without end.
 */
export const DRAFT_KEY = "agxp.method-drafts";
const KEEP = 20;

type Store = Record<string, DraftState>;

function read(storage: Pick<Storage, "getItem">): Store {
  try {
    const parsed = JSON.parse(storage.getItem(DRAFT_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Store : {};
  } catch {
    return {};
  }
}

/** Only a finished draft is worth keeping. */
export function saveDraft(projectId: string, draft: DraftState, storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage): void {
  if (draft.status !== "ready" || draft.drafts.length === 0) return;
  try {
    const all = read(storage);
    delete all[projectId]; // re-insert last: insertion order is the age
    all[projectId] = draft;
    const ids = Object.keys(all);
    for (const id of ids.slice(0, Math.max(0, ids.length - KEEP))) delete all[id];
    storage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch { /* storage blocked: the draft only lives for this visit */ }
}

export function loadDraft(projectId: string, storage: Pick<Storage, "getItem"> = window.localStorage): DraftState | null {
  const d = read(storage)[projectId];
  return d && d.status === "ready" && Array.isArray(d.drafts) && typeof d.kind === "string" ? d : null;
}
