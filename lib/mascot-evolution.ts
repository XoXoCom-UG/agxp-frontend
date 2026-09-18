"use client";

import { useEffect, useState } from "react";

/**
 * mascot-evolution.ts — the mascot's purely-visual "growth" system.
 *
 * There is no XP yet. `level` (1-3) is a placeholder counter, bumped once
 * per user message in the live chat (see project-chat-panel.tsx) and kept in
 * localStorage per agent id — remembered across reloads, but deliberately
 * NOT a database column: nothing here is real progress, so it doesn't
 * deserve a migration. When real XP exists, only the storage in this file
 * needs to change — evolutionFor() and every caller stay the same.
 */

export interface MascotEvolution {
  /** Antenna ring + glow, pulsing. Same trigger for both personalities. */
  glow: boolean;
  /** A level-3 accessory — which one renders is decided by role in the component. */
  accessory: boolean;
}

const MAX_LEVEL = 3;

/** The mascot's current look at this level (1-3, clamped). */
export function evolutionFor(level: number): MascotEvolution {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.round(level || 1)));
  return { glow: l >= 2, accessory: l >= 3 };
}

const KEY_PREFIX = "agxp-mascot-level:";

function clampLevel(n: number): number {
  return Number.isFinite(n) ? Math.max(1, Math.min(MAX_LEVEL, Math.round(n))) : 1;
}

/** The level stored for this agent, 1-3, defaulting to 1. SSR/storage-safe. */
export function readMascotLevel(agentId: string): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + agentId);
    return raw ? clampLevel(parseInt(raw, 10)) : 1;
  } catch {
    return 1;
  }
}

/** Bumps and persists the level for this agent, capped at 3. Returns the new value. */
export function bumpMascotLevel(agentId: string): number {
  const next = Math.min(MAX_LEVEL, readMascotLevel(agentId) + 1);
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY_PREFIX + agentId, String(next));
  } catch {
    // Storage blocked (private mode, quota) — the level just won't persist.
  }
  return next;
}

/**
 * Read-only, auto-syncing level for passive mounts (agent picker,
 * deliverable view) — shows whatever this agent has reached in the live
 * chat. `project-chat-panel.tsx` does not use this: it owns its own local
 * state so it can react to its own bump instead of only its next render.
 */
export function useMascotLevel(agentId?: string | null): number {
  const [level, setLevel] = useState(1);
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => { if (alive) setLevel(agentId ? readMascotLevel(agentId) : 1); });
    return () => { alive = false; };
  }, [agentId]);
  return level;
}
