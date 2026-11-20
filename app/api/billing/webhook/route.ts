import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/server-db";
import { verifyStripeSignature } from "@/lib/stripe-signature";
import { stripe, applySubscription, type StripeSubscription } from "@/lib/stripe-server";

/**
 * Stripe → this app. The only door through which an account becomes paid.
 *
 * No session here, so the signature IS the authentication (lib/stripe-signature.ts):
 * an unsigned or wrongly signed request is a 400 and changes nothing. The body
 * is read as raw text because the signature covers the exact bytes.
 *
 * Each event id is recorded first (agxp_stripe_events), so a delivery Stripe
 * repeats is acknowledged and skipped. If applying fails, the id is removed
 * again and a 500 goes back: Stripe then retries, which is what we want.
 *
 * The event's copy of the subscription is not trusted — it is read again from
 * Stripe, so out-of-order events all end in the current state.
 *
 * Events to send to this endpoint (Stripe dashboard → Webhooks):
 *   checkout.session.completed, customer.subscription.created,
 *   customer.subscription.updated, customer.subscription.deleted,
 *   invoice.paid, invoice.payment_failed
 */

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/** The subscription an event is about, if any. */
function subscriptionId(e: StripeEvent): string | null {
  const o = e.data.object;
  if (e.type.startsWith("customer.subscription.")) return typeof o.id === "string" ? o.id : null;
  if (typeof o.subscription === "string") return o.subscription;
  // Newer API versions put an invoice's subscription under parent.subscription_details.
  const parent = o.parent as { subscription_details?: { subscription?: string } } | undefined;
  return parent?.subscription_details?.subscription ?? null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[billing/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const db = serviceClient();
  if (!db) {
    console.error("[billing/webhook] SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const subId = subscriptionId(event);
  if (!subId) return NextResponse.json({ received: true, ignored: event.type });

  // Seen before → done. The primary key makes this one atomic check.
  const { error: seenErr } = await db.from("agxp_stripe_events").insert({ id: event.id, type: event.type });
  if (seenErr) {
    if (seenErr.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    console.error("[billing/webhook] could not record event:", seenErr.message);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  try {
    const sub = await stripe<StripeSubscription>("GET", `/subscriptions/${encodeURIComponent(subId)}`);
    await applySubscription(sub);
  } catch (err) {
    console.error("[billing/webhook] could not apply", event.type, event.id, err);
    // Forget the id so Stripe's retry is not taken for a duplicate.
    await db.from("agxp_stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "apply failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
