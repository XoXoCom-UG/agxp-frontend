"use client";

import { useSyncExternalStore } from "react";

/**
 * How the room is divided between the two conversations.
 *
 * Asked for on 2026-09-26: the seam can be dragged, and the size you like
 * is remembered as a preference rather than being re-dragged every session.
 * Stored as the LEAD panel's share of the row — the one holding the room —
 * so it survives swapping the two sides, which changes who leads but not how
 * lopsided you wanted the split.
 */

const KEY = "agxp.chat-split";
/** Ana, 2026-09-28: "sau măcar să ai un buton în setări de lock, și atunci să
 *  nu poți schimba dimensiunile la chaturi" — the drag is easy to do by
 *  accident while reaching for the swap button, so it can be turned off and
 *  the width set from Settings alone. */
const LOCK_KEY = "agxp.chat-split-locked";

/** Below this the narrow panel stops being a conversation and becomes a strip. */
export const MIN_SHARE = 1;
/** Above this the narrow panel can no longer show a full line of text. */
export const MAX_SHARE = 3.4;
export const DEFAULT_SHARE = 2.3;

export interface SplitPreset { id: string; label: string; hint: string; share: number }

export const SPLIT_PRESETS: SplitPreset[] = [
  { id: "even", label: "Equal", hint: "Both conversations the same width", share: 1 },
  { id: "lead", label: "One leads", hint: "The active one takes about two thirds", share: 2.3 },
  { id: "focus", label: "Focused", hint: "The other one stays as a narrow column", share: 3.2 },
];

export function clampShare(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_SHARE;
  return Math.min(MAX_SHARE, Math.max(MIN_SHARE, v));
}

export function readSplit(): number {
  if (typeof window === "undefined") return DEFAULT_SHARE;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === null ? DEFAULT_SHARE : clampShare(Number(raw));
  } catch {
    // Private mode, blocked storage — the default is a fine answer.
    return DEFAULT_SHARE;
  }
}

export function saveSplit(v: number): void {
  try { window.localStorage.setItem(KEY, String(clampShare(v))); } catch { /* not worth failing over */ }
}

export function readSplitLocked(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(LOCK_KEY) === "1"; } catch { return false; }
}

/** Saves the lock and tells every subscriber, on the same event as the ratio
 *  — one preference about one thing, so one channel. */
export function broadcastSplitLocked(locked: boolean): void {
  try { window.localStorage.setItem(LOCK_KEY, locked ? "1" : "0"); } catch { /* not worth failing over */ }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<number>(SPLIT_EVENT, { detail: readSplit() }));
  }
}

/** Which preset a value corresponds to, for showing the choice as selected. */
export function presetFor(share: number): string | null {
  const hit = SPLIT_PRESETS.find(p => Math.abs(p.share - share) < 0.15);
  return hit ? hit.id : null;
}

/**
 * Settings and the workspace are different React trees, so a change in one
 * has to reach the other without a reload. One event, no store.
 */
export const SPLIT_EVENT = "agxp:split";

export function broadcastSplit(v: number): void {
  saveSplit(v);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<number>(SPLIT_EVENT, { detail: clampShare(v) }));
  }
}

/**
 * The preference as React sees it.
 *
 * localStorage plus a custom event IS an external store, so this is
 * `useSyncExternalStore` rather than an effect that reads it into state:
 * no render-then-correct flicker, no cascading render, and the server
 * snapshot is simply the default. Every subscriber updates together, which
 * is what makes the Settings sheet and the workspace agree without either
 * knowing the other exists.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(SPLIT_EVENT, onChange);
  // Another tab of the same app changed it.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SPLIT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useChatSplit(): number {
  return useSyncExternalStore(subscribe, readSplit, () => DEFAULT_SHARE);
}

/** Booleans are their own snapshot, so this needs no caching the way an
 *  object-valued store would. */
export function useSplitLocked(): boolean {
  return useSyncExternalStore(subscribe, readSplitLocked, () => false);
}
