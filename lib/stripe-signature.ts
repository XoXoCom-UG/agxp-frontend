import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * stripe-signature.ts — is this webhook really from Stripe?
 *
 * The webhook is the ONLY thing that can make an account paid, and it has no
 * user session, so the signature is the whole of its authentication. Stripe
 * signs `${timestamp}.${raw body}` with HMAC-SHA256 under the endpoint's secret
 * and sends `Stripe-Signature: t=…,v1=…[,v1=…]` (more than one v1 while a
 * secret is being rolled). The body must be the RAW bytes as received — parsed
 * and re-serialised JSON would not match.
 *
 * The timestamp is checked too, so a captured request cannot be replayed later
 * (and agxp_stripe_events catches a replay inside the window).
 *
 * Its own module, without "server-only", so the tests can import it.
 */

/** How old a signed request may be, in seconds. Stripe's own default. */
export const TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  let t = NaN;
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") t = Number(v);
    else if (k === "v1") sigs.push(v);
  }
  if (!Number.isFinite(t) || sigs.length === 0) return false;
  if (Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex"), "utf8");
  return sigs.some(s => {
    const got = Buffer.from(s, "utf8");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** Only these statuses pay for a plan. Anything else — past_due, unpaid,
 *  canceled, incomplete, paused — is the free plan until Stripe says active. */
export function statusPays(status: unknown): boolean {
  return status === "active" || status === "trialing";
}
