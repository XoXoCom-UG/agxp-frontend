/**
 * agent-level.ts — when an agent goes up a level (Ana, 2026-11-03).
 *
 * One level, 1-5, earned by work that actually happened with this user — the
 * mascot's face and the "Experience" label are two views of the same number.
 * It is a milestone ladder, not a count of messages, so empty chatter cannot
 * inflate it and a user can be told exactly what the next step is:
 *
 *   1  new
 *   2  a first real conversation (FIRST_CONVERSATION_REPLIES answers)
 *   3  a first finished document
 *   4  a finished document in a second project
 *   5  a finished document in a third project
 *
 * Levels only go up: the highest one reached is stored on the agent
 * (agents.level_reached, migration 0031), so deleting a project or starting a
 * conversation over never takes a level away. What this file decides is only
 * the level the work counted NOW is worth.
 *
 * No imports, on purpose: the tests run it under plain node.
 */

export const MAX_LEVEL = 5;
/** One segment per level, for the little bar next to the word. */
export const LEVELS = [1, 2, 3, 4, 5];
export const FIRST_CONVERSATION_REPLIES = 5;

/** What the agent has done for this user, across all of their projects. */
export interface AgentWork {
  /** Answers it has given. */
  replies: number;
  /** Projects in which it has produced a finished document. */
  docProjects: number;
}

export type Experience = "New" | "Medium" | "High";

export function levelFromWork(work: AgentWork): number {
  const docs = Math.max(0, Math.floor(work.docProjects || 0));
  if (docs >= 3) return 5;
  if (docs === 2) return 4;
  if (docs === 1) return 3;
  return (work.replies || 0) >= FIRST_CONVERSATION_REPLIES ? 2 : 1;
}

/** The words the card, the picker and the agent's own prompt use for a level. */
export function experienceFor(level: number): Experience {
  if (level >= MAX_LEVEL) return "High";
  if (level >= 2) return "Medium";
  return "New";
}

/** What earns the next level, as a key into the German dictionary (lib/i18n.ts). */
export type NextStep = "conversation" | "first-document" | "second-document" | "third-document";

export function nextStepFor(level: number): NextStep | null {
  if (level <= 1) return "conversation";
  if (level === 2) return "first-document";
  if (level === 3) return "second-document";
  if (level === 4) return "third-document";
  return null;
}

/** A level read from storage or the database: a whole number from 1 to 5. */
export function cleanLevel(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(1, Math.min(MAX_LEVEL, n)) : 1;
}
