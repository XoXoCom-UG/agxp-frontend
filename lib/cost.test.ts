import { test } from "node:test";
import assert from "node:assert/strict";
import { costMicroUsd, usd } from "./cost.ts";

test("a million tokens of each kind costs the list price", () => {
  assert.equal(costMicroUsd({ input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 }), usd(2));
  assert.equal(costMicroUsd({ input: 0, output: 1e6, cacheRead: 0, cacheWrite: 0 }), usd(10));
  assert.equal(costMicroUsd({ input: 0, output: 0, cacheRead: 0, cacheWrite: 1e6 }), usd(2.5));
  assert.equal(costMicroUsd({ input: 0, output: 0, cacheRead: 1e6, cacheWrite: 0 }), usd(0.2));
});

test("cached input counts — it is most of the bill once caching is on", () => {
  // A late turn in a long interview: almost everything is a cache read.
  const turn = { input: 300, output: 900, cacheRead: 120_000, cacheWrite: 4_000 };
  const tokensOnly = turn.input * 2 + turn.output * 10;
  assert.ok(costMicroUsd(turn) > 3 * tokensOnly);
});

test("garbage from the API never lowers the total", () => {
  assert.equal(costMicroUsd({ input: -5, output: NaN, cacheRead: Infinity, cacheWrite: 0 }), 0);
});
