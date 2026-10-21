import { test } from "node:test";
import assert from "node:assert/strict";
import { costMicroUsd, usd, reserveMicroUsd, estimateInputTokens } from "./cost.ts";

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

test("a reservation is never below what the call can cost", () => {
  const input = estimateInputTokens({ chars: 30_000 });
  const reserved = reserveMicroUsd(input, 24_000);
  // The real call caches most of its input and rarely reaches the cap.
  const real = costMicroUsd({ input: 200, output: 3_000, cacheRead: 9_000, cacheWrite: 800 });
  assert.ok(reserved > real);
  assert.equal(reserveMicroUsd(0, 24_000), usd(0.24));
});

test("attachments raise the estimate, garbage does not lower it", () => {
  assert.ok(estimateInputTokens({ chars: 100, pdfBytes: 2_000_000 }) > estimateInputTokens({ chars: 100 }));
  assert.ok(estimateInputTokens({ chars: 100, images: 2 }) >= 3_200);
  assert.equal(estimateInputTokens({ chars: NaN, pdfBytes: -1, images: Infinity }), 0);
});
