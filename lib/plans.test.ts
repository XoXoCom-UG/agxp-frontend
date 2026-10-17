import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANS, planFor, storedPlan, periodStart, projectsLabel, agentsLabel, EVERYONE_IS_MAX, MONTHLY_BUDGET_USD, FREE_POOL_BUDGET_USD } from "./plans.ts";

test("an unknown or missing plan falls back to free, never to a better one", () => {
  assert.equal(storedPlan(undefined).id, "free");
  assert.equal(storedPlan(null).id, "free");
  assert.equal(storedPlan("").id, "free");
  // The value comes out of a database column. A typo, a renamed plan, or
  // someone's manual edit must not hand out the unlimited tier.
  assert.equal(storedPlan("MAX").id, "free");
  assert.equal(storedPlan("enterprise").id, "free");
  assert.equal(storedPlan("max").id, "max");
});

test("a weekly window starts on Monday, whatever day it is asked", () => {
  // 2026-10-04 is a Sunday; its week started Monday the 28th.
  assert.equal(periodStart("week", new Date("2026-10-04T23:59:00Z")), "2026-09-28");
  assert.equal(periodStart("week", new Date("2026-09-28T00:00:00Z")), "2026-09-28");
  assert.equal(periodStart("week", new Date("2026-09-30T12:00:00Z")), "2026-09-28");
  // Monday rolls the window over rather than extending the old one.
  assert.equal(periodStart("week", new Date("2026-10-05T00:00:01Z")), "2026-10-05");
});

test("a monthly window starts on the 1st", () => {
  assert.equal(periodStart("month", new Date("2026-10-04T10:00:00Z")), "2026-10-01");
  assert.equal(periodStart("month", new Date("2026-10-31T23:59:59Z")), "2026-10-01");
  assert.equal(periodStart("month", new Date("2026-11-01T00:00:00Z")), "2026-11-01");
});

test("the window is computed in UTC, so a late-evening user keeps their allowance", () => {
  // A Berlin user at 01:30 CEST on Monday is still Sunday in UTC. Both must
  // agree with the server, which only ever works in UTC — otherwise the
  // allowance appears to reset a day early for half of Europe.
  const lateSunday = new Date("2026-10-04T23:30:00Z");
  const earlyMonday = new Date("2026-10-05T00:30:00Z");
  assert.equal(periodStart("week", lateSunday), "2026-09-28");
  assert.equal(periodStart("week", earlyMonday), "2026-10-05");
});

test("free is cheap by depth, not only by count", () => {
  const free = PLANS.free;
  // Cost grows with the square of the conversation, so the station cap is
  // what actually makes the tier affordable — three projects at full depth
  // would cost roughly four times three capped ones.
  assert.equal(free.stations, 3);
  assert.equal(free.projects, 3);
  // Monthly since the meeting of 2026-10-16 — three a week was too generous.
  assert.equal(free.period, "month");
});

test("the free tier shows peer reading once, and never nudges", () => {
  assert.equal(PLANS.free.peerReading, "demo");
  assert.equal(PLANS.free.nudges, false);
  // Paid plans get the real thing — it is the most expensive feature and the
  // most distinctive one, which is why it sits on the paid side.
  assert.equal(PLANS.mid.peerReading, "full");
  assert.equal(PLANS.mid.nudges, true);
});

test("unlimited is a label, not an absent ceiling", () => {
  assert.equal(projectsLabel(PLANS.max), "Unlimited");
  assert.equal(projectsLabel(PLANS.mid), "15");
  // With a quadratic cost curve, one runaway conversation can cost more than
  // a subscription. "Unlimited" always has a real number behind it.
  assert.ok(PLANS.max.costCeilingUsd > 0 && Number.isFinite(PLANS.max.costCeilingUsd));
  assert.ok(PLANS.max.costCeilingUsd > PLANS.mid.costCeilingUsd);
  assert.ok(PLANS.mid.costCeilingUsd > PLANS.free.costCeilingUsd);
});

test("the monthly budget is a real number, and no single account can reach it", () => {
  // Patryk, 2026-10-16: 3,000–5,000 € a month, watertight.
  assert.ok(MONTHLY_BUDGET_USD > 0 && MONTHLY_BUDGET_USD <= 3_000);
  for (const p of Object.values(PLANS)) assert.ok(p.costCeilingUsd < MONTHLY_BUDGET_USD);
});

test("agents are limited by type, not by a pool shared across projects", () => {
  // Free: one type of Consultant, one type of Coach, one agent of each.
  assert.equal(PLANS.free.agentTypes, 1);
  assert.equal(PLANS.free.agentsPerType, 1);
  // Paid: every type, four of each (Patryk, 2026-09-30).
  for (const p of [PLANS.mid, PLANS.max]) {
    assert.equal(p.agentTypes, null);
    assert.equal(p.agentsPerType, 4);
  }
});

test("agentsLabel says it in words", () => {
  assert.equal(agentsLabel(PLANS.free), "1 type per role, up to 1 agent of each");
  assert.equal(agentsLabel(PLANS.mid), "every type, up to 4 agents of each");
});

test("while everyone is on Max, an invited account is Max whatever its row holds", () => {
  if (!EVERYONE_IS_MAX) return;
  for (const v of ["free", "mid", "enterprise"]) assert.equal(planFor(v).id, "max");
});

test("an account nobody invited is free, even while everyone is on Max", () => {
  // Otherwise opening sign-up would hand every scripted account Max's ceiling.
  for (const v of [undefined, null, ""]) assert.equal(planFor(v).id, "free");
});

test("free accounts share a pool smaller than the whole budget", () => {
  assert.ok(FREE_POOL_BUDGET_USD > 0 && FREE_POOL_BUDGET_USD < MONTHLY_BUDGET_USD);
});
