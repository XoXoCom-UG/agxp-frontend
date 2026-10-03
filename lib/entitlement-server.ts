import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PLANS, DEFAULT_PLAN, planFor, periodStart, type Plan, type LimitHit } from "@/lib/plans";

/**
 * entitlement-server.ts — what this user is allowed, and what they have spent.
 *
 * Server only, and it says so in the first line: everything here runs with
 * the service role key, which bypasses RLS. If this module were ever pulled
 * into a client bundle that key would ship to the browser, so the import of
 * `server-only` is a build-time failure rather than a code review note.
 *
 * Why the service role at all, when the route already has the user's token:
 * the user must not be able to write either table. A plan they can write is a
 * plan they can set to 'max'; a usage counter they can write is a counter
 * they can zero. So the browser may read both and write neither, and these
 * writes go around RLS on purpose.
 */

let cached: SupabaseClient | null = null;

/** Null when the key isn't configured — the caller decides what that means. */
function admin(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export interface Allowance {
  plan: Plan;
  periodStart: string;
  /** Tokens in + out already spent this period. */
  spent: number;
  /** Conversation threads started this period. */
  projects: number;
}

const FREE: Allowance = {
  plan: PLANS[DEFAULT_PLAN],
  periodStart: periodStart(PLANS[DEFAULT_PLAN].period),
  spent: 0,
  projects: 0,
};

/**
 * Reads the plan and what has been spent against it.
 *
 * Three queries rather than one view, because they fail independently and a
 * failure here must not stop someone working. Metering is a business concern;
 * the conversation is the product. If the database is unreachable the user
 * gets their conversation and we lose a count.
 */
export async function allowanceFor(userId: string): Promise<Allowance> {
  const db = admin();
  if (!db) return FREE;

  const { data: ent } = await db
    .from("agxp_entitlements")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();

  // No row means the default plan. Signing up therefore needs no extra write,
  // and a failed insert can never lock someone out of the product.
  const plan = planFor(ent?.plan as string | undefined);
  const start = periodStart(plan.period);

  const [{ data: usage }, { count }] = await Promise.all([
    db.from("agxp_usage")
      .select("input_tokens,output_tokens")
      .eq("user_id", userId)
      .eq("period_start", start)
      .maybeSingle(),
    db.from("agxp_projects")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .gte("created_at", `${start}T00:00:00Z`),
  ]);

  return {
    plan,
    periodStart: start,
    spent: Number(usage?.input_tokens ?? 0) + Number(usage?.output_tokens ?? 0),
    projects: count ?? 0,
  };
}

/**
 * Is this request allowed to run?
 *
 * Only the invisible ceiling is checked here. The project count is enforced
 * where a project is created, not on every message — a user who is already
 * mid-conversation when their allowance rolls over should be able to finish
 * the sentence, not be cut off in the middle of it.
 */
export function blocked(a: Allowance): LimitHit | null {
  if (a.spent < a.plan.tokenCeiling) return null;
  return {
    kind: "tokens",
    plan: a.plan.id,
    message: a.plan.id === "max"
      ? "This account has hit the fair-use ceiling for this month. Get in touch and we'll raise it."
      : "You've used everything your plan allows for this period. It resets at the start of the next one.",
  };
}

export interface SpentTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Adds what a request actually cost.
 *
 * Fire-and-forget by design: the answer has already been streamed to the user
 * by the time this runs, so there is nothing left to fail into. A lost count
 * is cheaper than a thrown error on a finished response.
 */
export async function recordUsage(userId: string, period: string, t: SpentTokens): Promise<void> {
  const db = admin();
  if (!db) return;
  const { error } = await db.rpc("add_usage", {
    p_user: userId,
    p_period: period,
    p_in: t.input,
    p_out: t.output,
    p_cache_read: t.cacheRead,
    p_cache_write: t.cacheWrite,
  });
  if (error) console.error("[usage] could not record:", error.message);
}

/** True once, for the free tier's single demonstration of peer reading. */
export function peerReadingAllowed(plan: Plan, coachTurnsSoFar: number): boolean {
  return plan.peerReading === "full" || coachTurnsSoFar < 1;
}
