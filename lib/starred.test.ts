import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStarred } from "./starred.ts";

test("nothing stored means nothing starred", () => {
  assert.equal(parseStarred(null).size, 0);
  assert.equal(parseStarred("").size, 0);
  assert.equal(parseStarred("[]").size, 0);
});

test("a list of ids comes back as a set", () => {
  const s = parseStarred('["a","b","a"]');
  assert.deepEqual([...s].sort(), ["a", "b"]);
});

test("a broken or foreign value is nothing starred, never a throw", () => {
  // A list screen must not blow up because some other code wrote this key,
  // or because a write was cut off halfway.
  assert.equal(parseStarred("not json").size, 0);
  assert.equal(parseStarred('["a",').size, 0);
  assert.equal(parseStarred('{"a":true}').size, 0);
  assert.equal(parseStarred("42").size, 0);
});

test("only real ids survive", () => {
  // JSON can hold nulls and numbers; an id has to be a non-empty string or
  // it would match no project and sit in the set forever.
  const s = parseStarred('["a", null, 7, "", "b", {"id":"c"}]');
  assert.deepEqual([...s].sort(), ["a", "b"]);
});
