"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { planFor, periodStart, type Plan } from "@/lib/plans";

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
  plan: Plan;
  /** Conversation threads started in the current window. */
  projects: number;
  /** Threads left. Infinity on the unlimited plan. */
  projectsLeft: number;
  loading: boolean;
}

const UNKNOWN: Entitlement = {
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

  const { data: ent } = await supabase
    .from("agxp_entitlements")
    .select("plan")
    .eq("user_id", uid)
    .maybeSingle();

  const plan = planFor(ent?.plan as string | undefined);
  const start = periodStart(plan.period);

  const { count } = await supabase
    .from("agxp_projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", uid)
    .gte("created_at", `${start}T00:00:00Z`);

  const used = count ?? 0;
  return {
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

export function useEntitlement(): Entitlement {
  const [state, setState] = useState<Entitlement>(UNKNOWN);
  useEffect(() => {
    let alive = true;
    readEntitlement().then(e => { if (alive) setState(e); }).catch(() => {
      if (alive) setState(s => ({ ...s, loading: false }));
    });
    return () => { alive = false; };
  }, []);
  return state;
}
