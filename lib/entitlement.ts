"use client";

import { useEffect, useSyncExternalStore } from "react";
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

/** Projects this account started since `start` (YYYY-MM-DD). */
async function countProjectsSince(uid: string, start: string): Promise<number> {
  const { count } = await createClient()
    .from("agxp_projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", uid)
    .gte("created_at", `${start}T00:00:00Z`);
  return count ?? 0;
}

/**
 * One round trip, not four. This used to ask the auth server who the user is
 * (getUser, a network call), then the team flag, then the plan, then the
 * count, each waiting for the one before — and every signed-in screen waits
 * for it behind the beta gate before it draws anything (Ana, 2026-11-19: "e
 * destul de lent"). The session is already in this browser, and the three
 * questions do not depend on each other, so they go out together.
 *
 * The id only says which rows to ask for; RLS answers them from the verified
 * token whatever is sent, so the local session is enough.
 */
export async function readEntitlement(): Promise<Entitlement> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { ...UNKNOWN, loading: false };

  // Every plan counts by the month today; a weekly plan is counted again below.
  const monthStart = periodStart("month");
  const [{ data: team }, { data: ent }, monthCount] = await Promise.all([
    /*
     * Whether to DRAW the team panels. Asked of the database rather than worked
     * out here, so there is one answer and not two that can drift: am_i_team()
     * checks the grant and the company domain together (migration 0012). An
     * error means no — a panel that fails open is not a gate.
     */
    supabase.rpc("am_i_team"),
    supabase.from("agxp_entitlements").select("plan").eq("user_id", uid).maybeSingle(),
    countProjectsSince(uid, monthStart),
  ]);

  const admitted = !INVITE_ONLY || !!ent?.plan;
  const plan = planFor(ent?.plan as string | undefined);
  const start = periodStart(plan.period);
  const used = start === monthStart ? monthCount : await countProjectsSince(uid, start);
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

/*
 * One copy for the whole app. Every component that called useEntitlement()
 * used to read it again for itself: the gate, the badge, the picker, both
 * chat panels — up to six reads of the same four queries when the workspace
 * opened. Now they share one read, and a screen mounted within FRESH_MS of
 * the last one reuses it. A screen mounted later shows what is known while
 * it asks again, so nothing goes blank on the way.
 */
const FRESH_MS = 30_000;
let snapshot: Entitlement = UNKNOWN;
let inflight: Promise<Entitlement> | null = null;
let fetchedAt = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}

/**
 * The shared read. `fresh` skips the cache: the quota check before a new
 * project, and Refresh after a key was redeemed or a plan switched.
 */
export function loadEntitlement(fresh = false): Promise<Entitlement> {
  if (!fresh && inflight && Date.now() - fetchedAt < FRESH_MS) return inflight;
  fetchedAt = Date.now();
  const p = readEntitlement();
  inflight = p;
  p.then(
    e => { if (inflight === p) { snapshot = e; emit(); } },
    () => {
      if (inflight !== p) return;
      // Not cached, so the next screen asks again; what was known stays.
      inflight = null;
      if (snapshot.loading) { snapshot = { ...snapshot, loading: false }; emit(); }
    },
  );
  return p;
}

/** The account changed: what was read belongs to the one before. Called from
 *  the auth provider whenever the signed-in user is not the one it was. */
export function forgetEntitlement(): void {
  inflight = null;
  fetchedAt = 0;
  if (snapshot !== UNKNOWN) { snapshot = UNKNOWN; emit(); }
}

export function useEntitlement(): Entitlement & { refresh: () => void } {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => UNKNOWN);
  useEffect(() => { loadEntitlement().catch(() => {}); }, []);
  // After a key is redeemed, so the gate closes behind the person without a
  // page reload — and every other reader sees the new plan with it.
  return { ...state, refresh: () => { loadEntitlement(true).catch(() => {}); } };
}
