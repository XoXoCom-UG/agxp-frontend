import test from "node:test";
import assert from "node:assert/strict";
import { mustClear, USER_BOUND_KEYS } from "./user-scope.ts";

test("nobody signed in always drops what belongs to an account", () => {
  assert.equal(mustClear("a", null), true);
  assert.equal(mustClear(null, null), true);
});

test("the same account keeps its things, a different one does not", () => {
  assert.equal(mustClear("a", "a"), false);
  assert.equal(mustClear("a", "b"), true);
});

test("data with no recorded owner is not handed to whoever signs in next", () => {
  assert.equal(mustClear(null, "a"), true);
});

test("the project name, the levels and the two tour flags are the user-bound ones", () => {
  assert.deepEqual([...USER_BOUND_KEYS].sort(), ["agxp.chat-tour", "agxp.last-project", "agxp.mascot-replies", "agxp.tour"]);
});
