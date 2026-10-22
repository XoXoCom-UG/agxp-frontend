import { createClient } from "@/lib/supabase";
import { summarise, type TeamUsage, type UsageRow } from "@/lib/usage-summary";

export type { TeamUsage, UserUsage } from "@/lib/usage-summary";

/**
 * team-usage.ts — what each account has spent, for the team panel in Settings.
 *
 * The numbers are the real ones the API reported (agxp_usage, written by
 * add_usage), read through team_usage() (migration 0017), which refuses
 * anyone who is not on the team. Tudor, 2026-10-16: with beta testers coming,
 * "wie viele Tokens der User nutzt" has to be on screen, not in a query.
 */

/** This month's usage, every account. Throws with the database's own message. */
export async function loadTeamUsage(now = new Date()): Promise<TeamUsage> {
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { data, error } = await createClient().rpc("team_usage");
  if (error) {
    if (error.code === "42883" || /team_usage/.test(error.message)) {
      throw new Error("The usage view is missing: run supabase/migrations/0022_usage_for_the_team.sql in the SQL editor.");
    }
    throw new Error(error.message);
  }
  return summarise((data ?? []) as UsageRow[], month);
}
