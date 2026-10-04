"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { planFor, periodStart, INVITE_ONLY, type Plan } from "@/lib/plans";

/**
 * entitlement.ts — the browser's read-only view of the plan and what is left.
 *
 * RLS lets a user SELECT both tables and write neither, so this can read the
 * real numbers without a server round-trip of its own. Everything it returns
 * is for display and for stopping an action early with a clear message; it is
 * NOT the enforcement. Enforcement lives where it cannot be edited:
 *
 *   - the token ceiling, in app/api/agent/chat/route.ts
 *   - the plan itself, in a table the user has no write policy on
 *
 * A determined person can skip the check below with devtools. What they
 * cannot skip is the ceiling, which is what actually costs us money. The
 * project count is a product rule, and if it ever guards real revenue it
 * wants a database trigger as well — see the note in the migration.
 */

export interface Entitlement {
  /** False while we are invite-only and this account has redeemed no key. */
  admitted: boolean;
  /** The team's switch. Readable here only to decide whether to draw the
   *  controls — every action behind it is checked again in the database. */
  canSwitch: boolean;
  plan: Plan;
  /** Conversation threads started in the current window. */
  projects: number;
  /** Threads left. Infinity on the unlimited plan. */
  projectsLeft: number;
  loading: boolean;
}

const UNKNOWN: Entitlement = {
  // Assume admitted until we know otherwise: flashing the beta gate at an
  // invited tester for a moment on every load would be worse than a blank
  // pause, and nothing can be spent before the read finishes anyway.
  admitted: true,
  canSwitch: false,
  plan: planFor(null),
  projects: 0,
  projectsLeft: planFor(null).projects,
  loading: true,
};

export async function readEntitlement(): Promise<Entitlement> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { ...UNKNOWN, loading: false };

  /*
   * Whether to DRAW the team panels. Asked of the database rather than worked
   * out here, so there is one answer and not two that can drift: am_i_team()
   * checks the grant and the company domain together (migration 0012). An
   * error means no — a panel that fails open is not a gate.
   */
  const { data: team } = await supabase.rpc("am_i_team");

  const { data: ent } = await supabase
    .from("agxp_entitlements")
    .select("plan")
    .eq("user_id", uid)
    .maybeSingle();

  const admitted = !INVITE_ONLY || !!ent?.plan;
  const plan = planFor(ent?.plan as string | undefined);
  const start = periodStart(plan.period);

  const { count } = await supabase
    .from("agxp_projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", uid)
    .gte("created_at", `${start}T00:00:00Z`);

  const used = count ?? 0;
  return {
    admitted,
    canSwitch: team === true,
    plan,
    projects: used,
    projectsLeft: Math.max(0, plan.projects - used),
    loading: false,
  };
}

/** Thrown by createProject when the allowance is spent, so the UI can say so. */
export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaError";
  }
}

export function useEntitlement(): Entitlement & { refresh: () => void } {
  const [state, setState] = useState<Entitlement>(UNKNOWN);
  // Bumped after a key is redeemed, so the gate closes behind the person
  // without a page reload.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    readEntitlement().then(e => { if (alive) setState(e); }).catch(() => {
      if (alive) setState(s => ({ ...s, loading: false }));
    });
    return () => { alive = false; };
  }, [attempt]);
  return { ...state, refresh: () => setAttempt(a => a + 1) };
}
