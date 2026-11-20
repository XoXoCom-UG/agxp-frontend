import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyStripeSignature, statusPays, TOLERANCE_SECONDS } from "./stripe-signature.ts";

const SECRET = "whsec_test";
const BODY = '{"id":"evt_1","type":"customer.subscription.updated"}';
const sign = (t: number, body = BODY, secret = SECRET) =>
  createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");

test("a correctly signed body passes", () => {
  const t = 1_700_000_000;
  assert.equal(verifyStripeSignature(BODY, `t=${t},v1=${sign(t)}`, SECRET, t), true);
});

test("any of several v1 signatures may match (secret being rolled)", () => {
  const t = 1_700_000_000;
  assert.equal(verifyStripeSignature(BODY, `t=${t},v1=${"0".repeat(64)},v1=${sign(t)}`, SECRET, t), true);
});

test("a changed body, wrong secret or missing header fails", () => {
  const t = 1_700_000_000;
  assert.equal(verifyStripeSignature(BODY.replace("updated", "deleted"), `t=${t},v1=${sign(t)}`, SECRET, t), false);
  assert.equal(verifyStripeSignature(BODY, `t=${t},v1=${sign(t, BODY, "other")}`, SECRET, t), false);
  assert.equal(verifyStripeSignature(BODY, null, SECRET, t), false);
  assert.equal(verifyStripeSignature(BODY, `t=${t}`, SECRET, t), false);
  assert.equal(verifyStripeSignature(BODY, `t=${t},v1=${sign(t)}`, "", t), false);
});

test("an old signature is refused (replay)", () => {
  const t = 1_700_000_000;
  assert.equal(verifyStripeSignature(BODY, `t=${t},v1=${sign(t)}`, SECRET, t + TOLERANCE_SECONDS + 1), false);
  assert.equal(verifyStripeSignature(BODY, `t=${t},v1=${sign(t)}`, SECRET, t + TOLERANCE_SECONDS), true);
});

test("only active and trialing pay for a plan", () => {
  for (const s of ["active", "trialing"]) assert.equal(statusPays(s), true);
  for (const s of ["past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "paused", undefined, null, ""]) {
    assert.equal(statusPays(s), false, String(s));
  }
});
