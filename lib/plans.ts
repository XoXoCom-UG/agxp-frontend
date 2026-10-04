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
 *   TOKENS    the invisible backstop. Never shown, never sold. It exists
 *             because our cost grows QUADRATICALLY with conversation length —
 *             the whole history is resent every turn — so one person with a
 *             500-turn conversation can cost more than their subscription.
 *             It bites on abuse and on nothing else.
 *
 * The ceilings below are a starting point, not a measurement. Nothing in the
 * app recorded token usage before this file existed, so every number here is
 * an estimate from the request shape (~440k input + 38k output for a full
 * project at $2/$10 per MTok ≈ $1.26, before prompt caching). Once a week of
 * real usage is in agxp_usage, replace them with what the data says.
 */

export type PlanId = "free" | "mid" | "max";

export interface Plan {
  id: PlanId;
  label: string;
  /** How often the allowance resets. Free is weekly on purpose: "3 left this
   *  week" is a reason to come back; a paid plan follows the billing cycle. */
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
  /** Agents the user may have assigned across all their projects. */
  agentSlots: number | null;
  /** May the user create their own agents? "Train Your Agent" is the product's
   *  whole pitch, which makes it the strongest thing to put at the top. */
  createAgents: boolean;
  /** The invisible ceiling. Tokens in + out, per period. */
  tokenCeiling: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Free",
    period: "week",
    projects: 3,
    stations: 3,
    // Once. The free user has to SEE the thing they would be paying for, or
    // there is no reason to pay for it — but it stops after the first time.
    peerReading: "demo",
    nudges: false,
    agentSlots: 2,
    createAgents: false,
    tokenCeiling: 300_000,
  },
  mid: {
    id: "mid",
    label: "Mid",
    period: "month",
    projects: 15,
    stations: null,
    peerReading: "full",
    nudges: true,
    agentSlots: 8,
    createAgents: false,
    tokenCeiling: 12_000_000,
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
    agentSlots: null,
    createAgents: true,
    tokenCeiling: 60_000_000,
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

export function planFor(id: string | null | undefined): Plan {
  return PLANS[(id ?? DEFAULT_PLAN) as PlanId] ?? PLANS[DEFAULT_PLAN];
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
export type LimitKind = "projects" | "tokens" | "stations" | "invite";

export interface LimitHit {
  kind: LimitKind;
  plan: PlanId;
  /** Shown to the user. Says what ran out and what to do, never a token count. */
  message: string;
}
