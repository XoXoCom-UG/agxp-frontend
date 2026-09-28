"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * mascot-level.ts — the mascot's 1-5 look, earned one reply at a time.
 *
 * Ana, 2026-09-27: there is no real upgrade system yet, so an agent goes up
 * a level after every answer it gives, until it reaches 5. Counted per
 * agent across all of this browser's projects, so the Agents page, the
 * picker and the chat all show the same face for the same agent.
 *
 * Stored in localStorage as one map, and read through useSyncExternalStore
 * (the same pattern as lib/chat-split.ts): every mascot on screen updates
 * together the moment a reply lands, with no effect-and-setState round trip.
 */

const KEY = "agxp.mascot-replies";
const EVENT = "agxp:mascot-level";
export const MAX_MASCOT_LEVEL = 5;

/** Replies given -> level: 0 replies is level 1, four or more is level 5. */
export function levelFromReplies(replies: number): number {
  return Math.max(1, Math.min(MAX_MASCOT_LEVEL, 1 + Math.floor(replies || 0)));
}

function readRaw(): string {
  if (typeof window === "undefined") return "{}";
  try { return window.localStorage.getItem(KEY) ?? "{}"; } catch { return "{}"; }
}

function readMap(): Record<string, number> {
  try {
    const m = JSON.parse(readRaw());
    return m && typeof m === "object" ? m : {};
  } catch { return {}; }
}

function write(map: Record<string, number>): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* private mode — stays level 1 */ }
  window.dispatchEvent(new Event(EVENT));
}

/** One more answer from this agent. */
export function recordReply(agentId: string): void {
  const map = readMap();
  map[agentId] = (map[agentId] ?? 0) + 1;
  write(map);
}

/** A conversation loaded from history already holds `replies` answers —
 *  the agent is at least that far along, even in a fresh browser. */
export function syncReplies(agentId: string, replies: number): void {
  const map = readMap();
  if ((map[agentId] ?? 0) >= replies) return;
  map[agentId] = replies;
  write(map);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Every agent's reply count. The snapshot is the raw string, so it only
 *  changes identity when the data does. */
export function useMascotReplies(): Record<string, number> {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "{}");
  return useMemo(() => {
    try { return JSON.parse(raw) as Record<string, number>; } catch { return {}; }
  }, [raw]);
}

/** The level one agent has reached; level 1 when there is no agent yet. */
export function useMascotLevel(agentId: string | null | undefined): number {
  const replies = useMascotReplies();
  return agentId ? levelFromReplies(replies[agentId] ?? 0) : 1;
}
