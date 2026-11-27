import { createClient } from "@/lib/supabase";

/**
 * How much of this conversation's cost ceiling is used, as a share 0-1
 * (agxp_project_usage, 0034; the ceiling is conversationCeilingUsd in
 * lib/plans.ts). The Cockpit shows it only once it matters, as a share and
 * never in money — the person buys projects, not dollars (2026-11-27).
 * Null when it cannot be read (0034 missing, offline): then nothing is shown.
 */
export async function conversationShare(projectId: string, ceilingUsd: number): Promise<number | null> {
  if (!(ceilingUsd > 0)) return null;
  try {
    const { data, error } = await createClient().from("agxp_project_usage")
      .select("cost_micro_usd").eq("project_id", projectId).maybeSingle();
    if (error) return null;
    const used = Number(data?.cost_micro_usd ?? 0) / 1_000_000;
    return Math.max(0, Math.min(1, used / ceilingUsd));
  } catch {
    return null;
  }
}
