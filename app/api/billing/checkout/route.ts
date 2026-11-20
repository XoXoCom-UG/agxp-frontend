import { NextRequest, NextResponse } from "next/server";
import { caller } from "@/lib/caller-id";
import { ipGate } from "@/lib/ip-gate";
import { takeRateSlot } from "@/lib/entitlement-server";
import { serviceClient } from "@/lib/server-db";
import { isPaidPlan } from "@/lib/plans";
import { stripe, stripeKey, priceIds, billingRow, StripeError } from "@/lib/stripe-server";
import { statusPays } from "@/lib/stripe-signature";

/**
 * Starts a Stripe Checkout for a subscription and returns its URL.
 *
 * What the browser may choose is only WHICH plan ("mid" or "max"); the price
 * behind it comes from the server's env, and the account it is for comes from
 * the verified token, written onto the subscription as metadata.user_id. The
 * plan is NOT granted here — only the signed webhook does that, once Stripe
 * says the subscription is paid.
 */

function siteUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const crowded = await ipGate(req, "billing");
  if (crowded) return crowded;

  const me = await caller(req);
  if (!me) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!(await takeRateSlot(me.id, "billing", 10, 600))) {
    return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { plan?: string } | null;
  const plan = body?.plan;
  if (!isPaidPlan(plan)) return NextResponse.json({ error: "Pick a plan." }, { status: 400 });

  const price = priceIds()[plan];
  const db = serviceClient();
  if (!stripeKey() || !price || !db) {
    console.error("[billing/checkout] not configured: STRIPE_SECRET_KEY, STRIPE_PRICE_MID/MAX or the service role is missing");
    return NextResponse.json({ error: "Payments aren't set up yet. Get in touch and we'll move your account." }, { status: 503 });
  }

  try {
    const row = await billingRow(me.id);
    // Already paying: a second checkout would be a second subscription, billed
    // twice. A change of plan goes through the portal instead.
    if (row?.stripe_subscription_id && statusPays(row.status)) {
      return NextResponse.json({ error: "You already have a subscription. Change it under Manage subscription.", code: "has_subscription" }, { status: 409 });
    }

    let customer = row?.stripe_customer_id ?? null;
    if (!customer) {
      // The key makes a double click create one customer, not two.
      const c = await stripe<{ id: string }>("POST", "/customers", {
        email: typeof me.email === "string" ? me.email : undefined,
        metadata: { user_id: me.id },
      }, `agxp-customer-${me.id}`);
      customer = c.id;
      // Stored now, so the next checkout reuses it and the webhook can find the
      // account by customer. Only the customer: no plan, no admission.
      const { error } = await db.from("agxp_billing").upsert(
        { user_id: me.id, stripe_customer_id: customer, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
      if (error) console.error("[billing/checkout] could not store the customer:", error.message);
    }

    const site = siteUrl(req);
    const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      customer,
      client_reference_id: me.id,
      line_items: { 0: { price, quantity: 1 } },
      subscription_data: { metadata: { user_id: me.id } },
      metadata: { user_id: me.id },
      allow_promotion_codes: "true",
      success_url: `${site}/dashboard?billing=success`,
      cancel_url: `${site}/dashboard?billing=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/checkout] failed:", err instanceof StripeError ? `${err.status} ${err.message}` : err);
    return NextResponse.json({ error: "Checkout couldn't be opened. Try again in a moment." }, { status: 502 });
  }
}
