import { createClient } from "@/lib/supabase";

// An agent's level is no longer counted from projects: see lib/agent-level.ts.

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
