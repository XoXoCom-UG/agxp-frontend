import "server-only";
import { serviceClient } from "@/lib/server-db";
import { PLANS, DEFAULT_PLAN, INVITE_ONLY, MONTHLY_BUDGET_USD, FREE_POOL_BUDGET_USD, planFor, periodStart, type Plan, type LimitHit } from "@/lib/plans";
import { costMicroUsd, usd, type UsageTokens } from "@/lib/cost";

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

const admin = serviceClient;

export interface Allowance {
  /** False while the product is invite-only and this account has no key. */
  admitted: boolean;
  /** True when production could not read what was spent, and so refuses. */
  unreadable?: boolean;
  plan: Plan;
  periodStart: string;
  /** What this account has cost this period, in micro-USD (lib/cost.ts). */
  spent: number;
  /** What the whole app has cost this calendar month, in micro-USD. */
  monthSpent: number;
  /** What all free accounts together have cost this month — read only for a
   *  free account, 0 otherwise. */
  freePoolSpent: number;
  /** Conversation threads started this period. */
  projects: number;
}

/**
 * What a server that cannot read the database decides.
 *
 * It used to be "generous, not shut" everywhere: a missing service role key
 * let every account through, unmetered. In production that turns a config
 * mistake into unlimited spend that nothing records — the one outcome the
 * budget (Patryk, 2026-10-16) rules out. So production fails CLOSED and says
 * why; development stays open so the app runs without the key.
 */
const FAIL_OPEN = process.env.NODE_ENV !== "production";

function unread(): Allowance {
  return {
    admitted: FAIL_OPEN,
    unreadable: !FAIL_OPEN,
    plan: PLANS[DEFAULT_PLAN],
    periodStart: periodStart(PLANS[DEFAULT_PLAN].period),
    spent: 0,
    monthSpent: 0,
    freePoolSpent: 0,
    projects: 0,
  };
}

/**
 * Reads the plan and what has been spent against it.
 *
 * A read that fails is treated like a missing key: open in development,
 * closed in production. If the database is unreachable the app cannot save a
 * message anyway, so refusing costs the user nothing they would have kept —
 * and an unread counter is a counter that cannot stop anything.
 */
export async function allowanceFor(userId: string): Promise<Allowance> {
  const db = admin();
  if (!db) {
    if (!FAIL_OPEN) console.error("[entitlement] SUPABASE_SERVICE_ROLE_KEY is not set — refusing model calls");
    return unread();
  }

  const { data: ent, error: entError } = await db
    .from("agxp_entitlements")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();

  // No row means two different things depending on the phase. In beta it
  // means "not invited"; once sign-up opens it means the free plan.
  const admitted = !INVITE_ONLY || !!ent?.plan;
  const plan = planFor(ent?.plan as string | undefined);
  const start = periodStart(plan.period);

  const [usageRes, projectsRes, monthRes] = await Promise.all([
    db.from("agxp_usage")
      .select("cost_micro_usd")
      .eq("user_id", userId)
      .eq("period_start", start)
      .maybeSingle(),
    db.from("agxp_projects")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .gte("created_at", `${start}T00:00:00Z`),
    db.rpc("month_spend_micro_usd"),
  ]);

  // The free accounts' shared pool, only when this account draws from it.
  // Read after the plan is known so a paying user never waits on it.
  const pool = admitted && plan.id === "free"
    ? await db.rpc("month_spend_free_micro_usd")
    : { data: 0, error: null };

  const failed = entError ?? usageRes.error ?? monthRes.error ?? pool.error;
  if (failed) {
    // Most often a migration that was never run (0017 adds cost_micro_usd and
    // month_spend_micro_usd). supabase/health_check.sql lists what is missing.
    console.error("[entitlement] could not read usage:", failed.code, failed.message);
    if (!FAIL_OPEN) return unread();
  }

  return {
    admitted,
    plan,
    periodStart: start,
    spent: Number(usageRes.data?.cost_micro_usd ?? 0),
    monthSpent: Number(monthRes.data ?? 0),
    freePoolSpent: Number(pool.data ?? 0),
    projects: projectsRes.count ?? 0,
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
  if (a.unreadable) {
    return {
      kind: "budget",
      plan: a.plan.id,
      message: "AgentiX can't check its usage limits right now, so it isn't answering. Try again later.",
    };
  }
  // The gate that matters while we are invite-only: an account nobody
  // invited must not be able to spend anything, whatever else is true.
  if (!a.admitted) {
    return {
      kind: "invite",
      plan: a.plan.id,
      message: "AgentiX is in closed beta. Enter the key you were given to get started.",
    };
  }
  // The whole app's month, before the account's own ceiling: it is the cap
  // that protects the company, and it applies whatever plan someone is on.
  if (a.monthSpent >= usd(MONTHLY_BUDGET_USD)) {
    console.error("[entitlement] monthly budget reached — refusing model calls until the 1st");
    return {
      kind: "budget",
      plan: a.plan.id,
      message: "AgentiX has reached its usage limit for this month and is paused until the 1st. Sorry for the interruption.",
    };
  }
  // Free accounts together, so a flood of sign-ups stops only the free tier.
  if (a.plan.id === "free" && a.freePoolSpent >= usd(FREE_POOL_BUDGET_USD)) {
    console.warn("[entitlement] free pool spent — free accounts paused until the 1st");
    return {
      kind: "budget",
      plan: a.plan.id,
      message: "The free plan is fully booked for this month. It opens again on the 1st — or upgrade to keep going now.",
    };
  }
  if (a.spent < usd(a.plan.costCeilingUsd)) return null;
  return {
    kind: "tokens",
    plan: a.plan.id,
    message: a.plan.id === "max"
      ? "This account has hit the fair-use ceiling for this month. Get in touch and we'll raise it."
      : "You've used everything your plan allows for this period. It resets at the start of the next one.",
  };
}

export type SpentTokens = UsageTokens;

/**
 * How many calls of one kind an account may have running at once. Two chats
 * because there are two panels, and a user may well type into both; one
 * title, which only ever runs once per project.
 */
const IN_FLIGHT: Record<AiCallKind, number> = { chat: 2, title: 1 };

/**
 * How long a lease outlives a server that died mid-stream. A full document
 * streams in a few minutes; this only has to be longer than that.
 */
const LEASE_TTL_SECONDS = 15 * 60;

export type AiCallKind = "chat" | "title";

/** A model call that has been admitted and must be settled exactly once. */
export interface AiLease {
  id: string;
  userId: string;
  period: string;
}

/**
 * Admits one model call, or says why not — atomically (begin_ai_call,
 * migration 0021).
 *
 * blocked() above reads and decides in the app, which is fine for one request
 * and wrong for twenty sent in the same second: they all read the same spend.
 * This takes a lease in the database instead, where calls in flight count as
 * spent and a per-account cap on parallel calls holds across instances.
 * blocked() still runs first, for the invite and unreadable cases and so the
 * common refusal costs no lock.
 *
 * Without the service role, or when the function is missing, development lets
 * the call through unmetered and production refuses it.
 */
export async function beginAiCall(
  a: Allowance,
  userId: string,
  kind: AiCallKind,
  reserveMicroUsd: number,
): Promise<{ lease: AiLease } | { hit: LimitHit; status: number }> {
  const lease: AiLease = { id: crypto.randomUUID(), userId, period: a.periodStart };
  const db = admin();
  if (!db) return FAIL_OPEN ? { lease } : { hit: unreadableHit(a), status: 402 };

  const { data, error } = await db.rpc("begin_ai_call", {
    p_user: userId,
    p_lease: lease.id,
    p_kind: kind,
    p_period: a.periodStart,
    p_reserve: Math.max(0, Math.ceil(reserveMicroUsd)),
    p_ceiling: usd(a.plan.costCeilingUsd),
    p_max_in_flight: IN_FLIGHT[kind],
    p_is_free: a.plan.id === "free",
    p_free_pool: usd(FREE_POOL_BUDGET_USD),
    p_month_budget: usd(MONTHLY_BUDGET_USD),
    p_ttl_seconds: LEASE_TTL_SECONDS,
  });
  if (error) {
    // Most often migration 0021 not applied yet. supabase/health_check.sql.
    console.error("[lease] could not take:", error.code, error.message);
    return FAIL_OPEN ? { lease } : { hit: unreadableHit(a), status: 402 };
  }

  const plan = a.plan.id;
  switch (data as string) {
    case "ok":
      return { lease };
    case "paused":
      console.warn("[lease] AI calls are paused (agxp_ai_switch)");
      return { status: 503, hit: { kind: "budget", plan, message: "AgentiX is paused for maintenance. Please try again a little later." } };
    case "busy":
      return { status: 429, hit: { kind: "budget", plan, message: "An answer is still being written. Wait for it to finish, then send the next message." } };
    case "month":
      console.error("[lease] monthly budget reached — refusing model calls until the 1st");
      return { status: 402, hit: { kind: "budget", plan, message: "AgentiX has reached its usage limit for this month and is paused until the 1st. Sorry for the interruption." } };
    case "free_pool":
      console.warn("[lease] free pool spent — free accounts paused until the 1st");
      return { status: 402, hit: { kind: "budget", plan, message: "The free plan is fully booked for this month. It opens again on the 1st — or upgrade to keep going now." } };
    default:
      return { status: 402, hit: blocked({ ...a, spent: usd(a.plan.costCeilingUsd) }) ?? unreadableHit(a) };
  }
}

function unreadableHit(a: Allowance): LimitHit {
  return blocked({ ...a, unreadable: true }) as LimitHit;
}

/**
 * Records what the call actually cost and gives its lease back, in one
 * transaction (settle_ai_call). Called exactly once per admitted call, with
 * zeros when the call never reached the model.
 *
 * Fire-and-forget by design: the answer has already been streamed to the user
 * by the time this runs, so there is nothing left to fail into. A lost count
 * is cheaper than a thrown error on a finished response — and a lease that
 * is never settled expires on its own.
 */
export async function settleAiCall(lease: AiLease, t: SpentTokens): Promise<void> {
  const db = admin();
  if (!db) return;
  const { error } = await db.rpc("settle_ai_call", {
    p_lease: lease.id,
    p_user: lease.userId,
    p_period: lease.period,
    p_in: t.input,
    p_out: t.output,
    p_cache_read: t.cacheRead,
    p_cache_write: t.cacheWrite,
    p_cost: costMicroUsd(t),
  });
  if (error) console.error("[usage] could not record:", error.message);
}

/** True once, for the free tier's single demonstration of peer reading. */
export function peerReadingAllowed(plan: Plan, coachTurnsSoFar: number): boolean {
  return plan.peerReading === "full" || coachTurnsSoFar < 1;
}

/**
 * A rate limit every server instance shares (take_rate_slot, migration 0017).
 *
 * The in-memory limiter in each route only counted requests that happened to
 * land on the same instance, so a caller spread over instances got many times
 * the limit. This one counts in the database. The in-memory check stays in
 * front of it as a cheap first filter.
 *
 * Without the service role, development lets the request through and
 * production refuses it — the same rule as allowanceFor().
 */
export async function takeRateSlot(
  userId: string,
  bucket: "chat" | "title" | "redeem" | "account" | "report",
  max: number,
  windowSeconds = 60,
): Promise<boolean> {
  const db = admin();
  if (!db) return FAIL_OPEN;
  const { data, error } = await db.rpc("take_rate_slot", {
    p_user: userId,
    p_bucket: bucket,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) {
    console.error("[rate] could not check:", error.code, error.message);
    return FAIL_OPEN;
  }
  return data === true;
}
