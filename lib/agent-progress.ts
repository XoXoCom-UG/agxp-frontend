import { createClient } from "@/lib/supabase";

export type KnowledgeLevel = "New" | "Medium" | "High";

export const LEVEL_ORDER: KnowledgeLevel[] = ["New", "Medium", "High"];

/**
 * An agent's level is derived from the work it has actually done, not stored
 * — the `agents` row is a shared catalog, so a level written there would be
 * one user's usage leaking into everyone else's view. Counting per user keeps
 * "your agent grew with you" true and needs no extra write permissions.
 */
export function levelFor(projects: number): KnowledgeLevel {
  if (projects >= 3) return "High";
  if (projects >= 1) return "Medium";
  return "New";
}

export function nextLevel(projects: number): { next: KnowledgeLevel | null; remaining: number } {
  if (projects >= 3) return { next: null, remaining: 0 };
  if (projects >= 1) return { next: "High", remaining: 3 - projects };
  return { next: "Medium", remaining: 1 - projects };
}

/** How many of the signed-in user's projects each agent has worked on. */
export async function projectCountsByAgent(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("agxp_projects").select("coach_agent_id, consultant_agent_id");
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    for (const id of [row.coach_agent_id, row.consultant_agent_id]) {
      if (id) counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}
