/**
 * plans.ts — what each plan allows, in one place.
 *
 * Imported by BOTH the API route (which enforces it) and the UI (which shows
 * it), the same way deliverables.ts is, so the limit the server applies and
 * the limit the pricing page promises can't drift apart.
 *
 * Decided with the user on 2026-10-04. Two numbers per plan, only one of them
 * ever shown:
 *
 *   PROJECTS  what the customer buys and sees. A project is one conversation
 *             thread with its two agents. Regenerating the document inside a
 *             project is free — the cost is the interview, not the output,
 *             and people should feel free to retry (Patryk, 2026-09-25).
 *
 *   COST      the invisible backstop, in dollars (lib/cost.ts). Never shown,
 *             never sold. It exists because our cost grows QUADRATICALLY with
 *             conversation length — the whole history is resent every turn —
 *             so one person with a 500-turn conversation can cost more than
 *             their subscription. It bites on abuse and on nothing else.
 *             It used to be a token count that left out cache reads and
 *             writes, which is most of the input once caching is on.
 *
 * The ceilings below are a starting point, not a measurement: a full project
 * is estimated at about $1.26 before prompt caching (~440k input + 38k output
 * at $2/$10 per MTok), and the meeting of 2026-10-16 put a free project at
 * 50–70 cents. Once real usage is in agxp_usage.cost_micro_usd, replace them
 * with what the data says.
 */

export type PlanId = "free" | "mid" | "max";

export interface Plan {
  id: PlanId;
  label: string;
  /** How often the allowance resets. Every plan is monthly now: free was
   *  weekly until the meeting of 2026-10-16 settled on 3 projects a month. */
  period: "week" | "month";
  /** Conversation threads per period. */
  projects: number;
  /** Interview stations the agent is allowed to work through. The free tier
   *  stops at 3 of 8 — the user sees the shape of the product and hits a wall
   *  that explains itself, instead of a counter that cuts them off mid-answer.
   *  It is also what makes the free tier affordable: cost grows with the
   *  square of the conversation, so a third of the turns is far less than a
   *  third of the cost. */
  stations: number | null;
  /** Can the Coach read the Consultant's conversation? */
  peerReading: "demo" | "full";
  /** Does the Coach speak up unprompted? Every nudge is a paid call the user
   *  did not ask for, so it is a paid-plan feature. */
  nudges: boolean;
  /** How many agent TYPES per role the user can see and build, counted from
   *  the top of TYPE_CATALOG (lib/agent-types.ts); null is all of them. */
  agentTypes: number | null;
  /** How many agents of one type the user may keep. Every agent is the user's
   *  own — built from a type, never shared — so this is the whole limit: free
   *  is one of one kind per role, the paid plans are four of each kind. */
  agentsPerType: number;
  /** The invisible ceiling. What this account may cost us per period, in USD. */
  costCeilingUsd: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Free",
    period: "month",
    projects: 3,
    stations: 3,
    // Once. The free user has to SEE the thing they would be paying for, or
    // there is no reason to pay for it — but it stops after the first time.
    peerReading: "demo",
    nudges: false,
    agentTypes: 1,
    agentsPerType: 1,
    // Three capped interviews at ~$0.70 each, with room to retry a document.
    costCeilingUsd: 3,
  },
  mid: {
    id: "mid",
    label: "Mid",
    period: "month",
    projects: 15,
    stations: null,
    peerReading: "full",
    nudges: true,
    agentTypes: null,
    agentsPerType: 4,
    costCeilingUsd: 25,
  },
  max: {
    id: "max",
    label: "Max",
    period: "month",
    // Sold as unlimited; the ceiling below is what actually stops a runaway.
    projects: Number.MAX_SAFE_INTEGER,
    stations: null,
    peerReading: "full",
    nudges: true,
    agentTypes: null,
    agentsPerType: 4,
    costCeilingUsd: 60,
  },
};

export const DEFAULT_PLAN: PlanId = "free";

/**
 * Invite only, while the product is in beta.
 *
 * With this true, an account with no row in agxp_entitlements has not been
 * admitted: it can sign in and see the app shell, and the chat route refuses
 * to spend anything on it. Redeeming a beta key writes the row.
 *
 * Flip this to false on the day sign-up opens to everyone; a missing row
 * then means the free plan again, which is what the rest of the code already
 * assumes. It is the only line that has to change.
 */
export const INVITE_ONLY = true;

/**
 * Until the plans are properly ready (Ana, 2026-10-15), every INVITED account
 * gets the Max plan, whatever its row says. The rows are not touched, so
 * turning this off restores each account's real plan.
 *
 * Invited means it has a row in agxp_entitlements, which only redeeming a key
 * (or the team) writes. An account with no row stays on free even while this
 * is on: otherwise the day INVITE_ONLY goes false, every scripted sign-up
 * would arrive with Max's $60 instead of free's $3.
 *
 * This is the app's half. The database enforces its own copy of two limits —
 * projects (0008) and agents per type (0014) — in agxp_plan_limits, and
 * migration 0015 raised the Free and Mid rows to Max's numbers to match. Turning
 * this off means setting those rows back too; 0015 has the statement.
 *
 * Note what Max means for cost: the per-account ceiling is the only limit
 * left, and it is $60 a month. MONTHLY_BUDGET_USD below is what stops the
 * total, however many accounts there are.
 */
export const EVERYONE_IS_MAX = true;

/**
 * The most the whole app may spend on the model in one calendar month (UTC),
 * across every account together. When the month's recorded cost reaches it,
 * every route that calls the model refuses until the 1st.
 *
 * Patryk, 2026-10-16: 3,000–5,000 € a month at the start, and as managing
 * director he is personally liable for costs that put the company at risk —
 * "kostenmäßig muss es wasserdicht sein". We start at $1,000 (Tudor,
 * 2026-10-17), well under that range, and raise it once agxp_usage shows
 * what real users cost. Raising it is a business decision
 * that should go through a commit, which is why it is not an env var.
 *
 * This is our half. The other half is a monthly spend limit on the Anthropic
 * Console workspace that owns ANTHROPIC_API_KEY: that one also holds if this
 * code is wrong, the database is down, or the key leaks.
 */
export const MONTHLY_BUDGET_USD = 1_000;

/**
 * The part of MONTHLY_BUDGET_USD that free accounts may use between them.
 *
 * Every free account has its own $3; that stops one person, not ten thousand
 * scripted sign-ups with $3 each. Without a pool of their own they would run
 * the whole budget down and pause the app for invited and paying users too.
 * With it, only the free tier stops (month_spend_free_micro_usd, 0018).
 * "Free" is the stored plan: no entitlement row, or one that says free.
 */
export const FREE_POOL_BUDGET_USD = 250;

/** The plan a stored value names, with an unknown or missing one read as free. */
export function storedPlan(id: string | null | undefined): Plan {
  return PLANS[(id ?? DEFAULT_PLAN) as PlanId] ?? PLANS[DEFAULT_PLAN];
}

/** The plan an account is on, as the app applies it. */
export function planFor(id: string | null | undefined): Plan {
  return EVERYONE_IS_MAX && id ? PLANS.max : storedPlan(id);
}

/** What the plan says about agents, in words: "1 type per role, 1 agent each". */
export function agentsLabel(p: Plan): string {
  const types = p.agentTypes === null ? "every type" : `${p.agentTypes} type per role`;
  return `${types}, up to ${p.agentsPerType} ${p.agentsPerType === 1 ? "agent" : "agents"} of each`;
}

/** "Unlimited" on the page, a real number in the code. */
export function projectsLabel(p: Plan): string {
  return p.projects >= 1000 ? "Unlimited" : String(p.projects);
}

/**
 * The start of the current allowance window, as a UTC date string.
 *
 * Weekly windows start on Monday so "this week" means the same thing to the
 * user and to the database. Monthly windows start on the 1st — not on the
 * signup anniversary, which would need a per-user date and give us no way to
 * aggregate a period across users.
 */
export function periodStart(period: Plan["period"], now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "month") {
    d.setUTCDate(1);
  } else {
    // getUTCDay(): 0 is Sunday, so Monday is 1 and Sunday counts as day 7.
    const dow = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dow);
  }
  return d.toISOString().slice(0, 10);
}

/** What the API route sends back when a limit is hit, and the UI explains. */
export type LimitKind = "projects" | "tokens" | "stations" | "invite" | "budget";

export interface LimitHit {
  kind: LimitKind;
  plan: PlanId;
  /** Shown to the user. Says what ran out and what to do, never a token count. */
  message: string;
}
