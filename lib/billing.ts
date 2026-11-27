"use client";

import { createClient } from "@/lib/supabase";

/**
 * billing.ts — the browser's two doors to Stripe. Both ask the server for a
 * URL and go there; neither changes a plan. The plan changes only when
 * Stripe's signed webhook says the subscription is paid.
 */

async function post(path: string, body?: unknown): Promise<string> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({})) as { url?: string; error?: string; code?: string };
  if (json.code === "has_subscription") return openPortal();
  if (!res.ok || !json.url) throw new Error(json.error ?? "Something went wrong. Try again in a moment.");
  return json.url;
}

/** Goes to Stripe Checkout for this plan. Resolves only on failure (the page leaves). */
export async function startCheckout(plan: "mid" | "max"): Promise<void> {
  window.location.assign(await post("/api/billing/checkout", { plan }));
}

/** Stripe's page to change plan, card or cancel. */
export async function openPortal(): Promise<string> {
  const url = await post("/api/billing/portal");
  window.location.assign(url);
  return url;
}

/** This account's subscription as stored, for display. Null when there is none
 *  or the table isn't there yet (migration 0034) — never an error on screen. */
export async function readBilling(): Promise<{ status: string | null; plan: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | null> {
  const supabase = createClient();
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from("agxp_billing")
    .select("status, plan, current_period_end, cancel_at_period_end")
    .eq("user_id", uid)
    .maybeSingle();
  return error ? null : data;
}
