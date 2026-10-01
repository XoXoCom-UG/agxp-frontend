"use client";

import { useSyncExternalStore } from "react";

/**
 * The project you were last working in.
 *
 * Patryk, 2026-09-30: "deshalb sollte da ein Button einfach sein, dass man
 * immer von überall zurückkommt, wo man war als letztes" — from History or
 * the Agent Dashboard there was no way back into the conversation except
 * New Task, which starts over. So the bar carries one button that returns
 * you to it, and explicitly NOT a dropdown: "lieber kein Dropdown, weil das
 * verwirrt."
 *
 * Per browser, like the other view preferences: it is a fact about this tab's
 * session, not about the account.
 */

const KEY = "agxp.last-project";
export const LAST_PROJECT_EVENT = "agxp:last-project";

export interface LastProject { id: string; name: string }

let cachedRaw: string | null = null;
let cached: LastProject | null = null;

export function readLastProject(): LastProject | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { return null; }
  // Same identity while the stored string is unchanged: useSyncExternalStore
  // compares snapshots with Object.is, and a fresh object every read is an
  // infinite render loop.
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const o = raw ? JSON.parse(raw) : null;
    cached = o && typeof o.id === "string" && typeof o.name === "string" ? { id: o.id, name: o.name } : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function rememberProject(p: LastProject): void {
  if (typeof window === "undefined") return;
  const next = JSON.stringify(p);
  try {
    if (window.localStorage.getItem(KEY) === next) return;
    window.localStorage.setItem(KEY, next);
  } catch { return; }
  window.dispatchEvent(new CustomEvent(LAST_PROJECT_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(LAST_PROJECT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LAST_PROJECT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLastProject(): LastProject | null {
  return useSyncExternalStore(subscribe, readLastProject, () => null);
}
