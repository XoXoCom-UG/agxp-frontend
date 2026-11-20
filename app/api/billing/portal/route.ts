import { NextRequest, NextResponse } from "next/server";
import { caller } from "@/lib/caller-id";
import { ipGate } from "@/lib/ip-gate";
import { takeRateSlot } from "@/lib/entitlement-server";
import { stripe, stripeKey, billingRow, StripeError } from "@/lib/stripe-server";

/**
 * Opens Stripe's customer portal: change plan, update the card, cancel,
 * download invoices. The customer id comes from the caller's own billing row,
 * never from the request, so nobody can open someone else's portal.
 */
export async function POST(req: NextRequest) {
  const crowded = await ipGate(req, "billing");
  if (crowded) return crowded;

  const me = await caller(req);
  if (!me) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!(await takeRateSlot(me.id, "billing", 10, 600))) {
    return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }
  if (!stripeKey()) {
    return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 503 });
  }

  const row = await billingRow(me.id);
  if (!row?.stripe_customer_id) {
    return NextResponse.json({ error: "There is no subscription on this account yet." }, { status: 404 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || req.nextUrl.origin;
  try {
    const session = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
      customer: row.stripe_customer_id,
      return_url: `${site}/dashboard`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/portal] failed:", err instanceof StripeError ? `${err.status} ${err.message}` : err);
    return NextResponse.json({ error: "The subscription page couldn't be opened. Try again in a moment." }, { status: 502 });
  }
}
