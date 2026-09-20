import { LEVEL_ORDER, levelFor, type KnowledgeLevel } from "@/lib/agent-progress";

/**
 * mascot-evolution.ts — how the mascot's look grows with the agent.
 *
 * Ana built the three visual stages and left the note that only the storage
 * in this file would need to change once real progress existed. It already
 * did: lib/agent-progress.ts derives a level from how many of *this user's*
 * projects the agent has worked on. So the stages now read from that instead
 * of a localStorage counter that went up once per message.
 *
 * Why it matters: the agent card prints "Medium · 4 projects together" right
 * next to the mascot. With a per-message counter those two disagreed — three
 * messages in a fresh browser lit up every ring, and the same agent looked
 * brand new on another machine. evolutionFor() and every caller are unchanged.
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

/** "New" | "Medium" | "High" -> the 1-3 the visual stages are written against. */
export function stageFor(level: KnowledgeLevel): number {
  return LEVEL_ORDER.indexOf(level) + 1;
}

/** The stage this agent has earned with this user, from its project count. */
export function stageForProjects(projects: number): number {
  return stageFor(levelFor(projects));
}
