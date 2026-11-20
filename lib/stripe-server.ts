import "server-only";
import { serviceClient } from "@/lib/server-db";
import { statusPays } from "@/lib/stripe-signature";
import type { PlanId } from "@/lib/plans";

/**
 * stripe-server.ts — the little of Stripe's API this app uses, and the one
 * function that turns a subscription into a plan.
 *
 * Plain fetch against the REST API rather than the SDK: four calls, form
 * encoded, and no dependency whose API version moves under us.
 *
 * The rules that keep this watertight:
 *   - The PRICE decides the plan, read from Stripe, mapped through env vars
 *     set on the server (STRIPE_PRICE_MID / STRIPE_PRICE_MAX). Nothing the
 *     browser sends can name a plan it did not pay for; an unknown price is
 *     the free plan.
 *   - The webhook never trusts the event's copy of the subscription: it reads
 *     the subscription again from Stripe, so events arriving out of order, or
 *     twice, all end in Stripe's current truth.
 *   - Only `active` and `trialing` pay. A failed renewal (past_due) drops the
 *     account to free at once, and Stripe's retry that succeeds puts it back.
 *   - The user is found by the id this server put on the subscription at
 *     checkout (metadata.user_id, from the verified token), else by the
 *     customer id stored when the customer was created.
 */

const API = "https://api.stripe.com/v1";

export function stripeKey(): string | null {
  return process.env.STRIPE_SECRET_KEY || null;
}

/** Price id → plan. Set on the server, never read from a request. */
export function priceIds(): Record<"mid" | "max", string | null> {
  return {
    mid: process.env.STRIPE_PRICE_MID || null,
    max: process.env.STRIPE_PRICE_MAX || null,
  };
}

export function planForPrice(priceId: string | null | undefined): PlanId {
  if (!priceId) return "free";
  const p = priceIds();
  if (p.max && priceId === p.max) return "max";
  if (p.mid && priceId === p.mid) return "mid";
  return "free";
}

/** Nested params the way Stripe's form encoding wants them: a[b][0][c]=… */
function form(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export class StripeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "StripeError";
  }
}

export async function stripe<T>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const key = stripeKey();
  if (!key) throw new StripeError(500, "STRIPE_SECRET_KEY is not set");
  const body = params ? form(params) : undefined;
  const url = method === "GET" && body ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({})) as { error?: { message?: string } };
  if (!res.ok) throw new StripeError(res.status, data.error?.message ?? res.statusText);
  return data as T;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  metadata?: Record<string, string>;
  items: { data: { price: { id: string }; current_period_end?: number }[] };
  /** Older API versions keep it on the subscription, newer ones on the item. */
  current_period_end?: number;
}

/** The stored billing row of this user, if any. */
export async function billingRow(userId: string): Promise<{ stripe_customer_id: string | null; stripe_subscription_id: string | null; status: string | null } | null> {
  const db = serviceClient();
  if (!db) return null;
  const { data } = await db.from("agxp_billing")
    .select("stripe_customer_id, stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Writes what a subscription means for its account: the billing row, and the
 * plan in agxp_entitlements. Called only from the verified webhook, with a
 * subscription just read back from Stripe.
 *
 * A subscription that does not pay only downgrades the account when it is the
 * account's CURRENT subscription — a second, abandoned checkout expiring must
 * not cancel the one that is paid.
 */
export async function applySubscription(sub: StripeSubscription): Promise<void> {
  const db = serviceClient();
  if (!db) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  let userId = sub.metadata?.user_id ?? null;
  if (!userId) {
    const { data } = await db.from("agxp_billing").select("user_id").eq("stripe_customer_id", sub.customer).maybeSingle();
    userId = (data?.user_id as string | undefined) ?? null;
  }
  if (!userId) {
    console.error("[billing] subscription with no known user:", sub.id);
    return;
  }

  const { data: current } = await db.from("agxp_billing")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  const pays = statusPays(sub.status);
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const paidPlan = planForPrice(priceId);
  if (pays && paidPlan === "free") {
    // Paid, but for a price this server does not know: never guess a plan.
    console.error("[billing] active subscription with an unknown price:", sub.id, priceId);
  }
  const isCurrent = !current?.stripe_subscription_id || current.stripe_subscription_id === sub.id;
  if (!pays && !isCurrent) return;

  const plan: PlanId = pays ? paidPlan : "free";
  const periodEnd = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;

  const { error: billErr } = await db.from("agxp_billing").upsert({
    user_id: userId,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: priceId,
    plan,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (billErr) throw new Error(`billing row: ${billErr.message}`);

  const { error: entErr } = await db.from("agxp_entitlements").upsert({
    user_id: userId,
    plan,
    note: `stripe ${sub.id} ${sub.status}`,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (entErr) throw new Error(`entitlement: ${entErr.message}`);
}
