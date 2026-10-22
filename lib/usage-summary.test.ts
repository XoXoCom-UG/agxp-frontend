import test from "node:test";
import assert from "node:assert/strict";
import { summarise } from "./usage-summary.ts";

const row = (over: Record<string, unknown>) => ({
  user_id: "u1", email: "a@b.de", plan: "max", period_start: "2026-10-01",
  input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, requests: 1, ...over,
});

test("rows of one account add up to one line, biggest spender first", () => {
  const t = summarise([
    row({ user_id: "small", email: "s@x.de", input_tokens: 1000, output_tokens: 100 }),
    row({ user_id: "big", email: "b@x.de", input_tokens: 1_000_000, output_tokens: 100_000, requests: 5 }),
    row({ user_id: "big", email: "b@x.de", period_start: "2026-10-05", input_tokens: 1_000_000, requests: 2 }),
  ], "2026-10-01");
  assert.deepEqual(t.users.map(u => u.email), ["b@x.de", "s@x.de"]);
  assert.equal(t.users[0].requests, 7);
  assert.equal(t.users[0].tokens, 2_100_000);
  assert.equal(t.totalRequests, 8);
});

test("last month's rows are not counted in this month", () => {
  const t = summarise([row({ period_start: "2026-09-28", input_tokens: 5_000_000 })], "2026-10-01");
  assert.equal(t.users.length, 0);
  assert.equal(t.totalUsd, 0);
});

test("the stored cost is used when the row has one, the tokens' price when it does not", () => {
  const t = summarise([
    row({ user_id: "a", output_tokens: 1_000_000, cost_micro_usd: 5_000_000 }),
    row({ user_id: "b", input_tokens: 1_000_000 }),
  ], "2026-10-01");
  assert.equal(t.users.find(u => u.userId === "a")?.usd, 5);
  assert.equal(t.users.find(u => u.userId === "b")?.usd, 2);
  assert.equal(t.totalUsd, 7);
  assert.equal(summarise([], "2026-10-01").totalUsd, 0);
});
