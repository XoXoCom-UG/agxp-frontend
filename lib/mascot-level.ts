"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase";
import { cleanLevel, levelFromWork, MAX_LEVEL as MAX, type AgentWork } from "@/lib/agent-level";

/**
 * mascot-level.ts — what every face on screen reads its level from.
 *
 * The rule lives in lib/agent-level.ts; the highest level an agent reached is
 * stored on the agent itself (agents.level_reached, migration 0031), so it is
 * the same on every browser and survives deleting a project. This file is the
 * live copy of those numbers: listAgents() fills it as it loads, and a reply
 * that earns a level raises it, so the mascot in the chat, the card on the
 * dashboard and the picker all change together. It is a store read through
 * useSyncExternalStore (the pattern of lib/chat-split.ts): no effect-and-
 * setState round trip, and a face mounted before the news arrives still
 * catches up.
 *
 * It only ever goes up. A smaller number — a stale read, a count that lost a
 * deleted project — is ignored.
 */

export const MAX_MASCOT_LEVEL = MAX;

/** Replaced, never mutated, so a snapshot is stable until the data changes. */
let levels: Record<string, number> = {};
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}

/** Raises the live level of agents; returns the ids that actually went up
 *  beyond a level that was already known (a first sighting is not a rise). */
function raise(next: Record<string, number>): string[] {
  const merged = { ...levels };
  const rose: string[] = [];
  let changed = false;
  for (const [id, raw] of Object.entries(next)) {
    const level = cleanLevel(raw);
    const known = merged[id];
    if (known !== undefined && level <= known) continue;
    if (known === undefined && level <= 1) { merged[id] = 1; changed = true; continue; }
    if (known !== undefined) rose.push(id);
    merged[id] = level;
    changed = true;
  }
  if (changed) { levels = merged; emit(); }
  return rose;
}

/** What the database already says — called by listAgents() with the rows it
 *  just read. Nothing is written back; this is the stored value. */
export function seedLevels(rows: { id: string; level_reached?: number | null }[]): void {
  const next: Record<string, number> = {};
  for (const r of rows) next[r.id] = cleanLevel(r.level_reached);
  raise(next);
}

/** Stores a higher level on the agent. Fire-and-forget, like the usage count:
 *  the screen already shows it, and a lost write is made up by the next
 *  reply, which counts the work again. Before migration 0031 the column does
 *  not exist, the update fails, and the level simply lives for this visit. */
function persist(agentId: string, level: number): void {
  createClient().from("agents").update({ level_reached: level }).eq("id", agentId).then(() => {}, () => {});
}

/** The level some counted work earns. Returns true when it is higher than
 *  what the agent had — the moment to celebrate. */
export function applyWork(agentId: string, work: AgentWork): boolean {
  const level = levelFromWork(work);
  const rose = raise({ [agentId]: level }).includes(agentId);
  if (rose) persist(agentId, level);
  return rose;
}

/** Counts this agent's work in the database and raises its level if it earned
 *  one. Resolves to whether it did; a failed count is "no". */
export async function refreshLevel(agentId: string): Promise<boolean> {
  try {
    const { data, error } = await createClient().rpc("agent_work", { p_agent_id: agentId });
    if (error) return false;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return false;
    return applyWork(agentId, { replies: Number(row.replies) || 0, docProjects: Number(row.doc_projects) || 0 });
  } catch {
    return false;
  }
}

/** Every agent's level — for a screen that draws a face per agent. */
export function useMascotLevels(): Record<string, number> {
  return useSyncExternalStore(subscribe, () => levels, () => levels);
}

/** The level one agent has reached; level 1 when there is no agent yet. */
export function useMascotLevel(agentId: string | null | undefined): number {
  const all = useMascotLevels();
  return agentId ? all[agentId] ?? 1 : 1;
}
