import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateMessages, cleanLabel, cleanMemory, stripMarkerSyntax, ownPath,
  MAX_MESSAGES, MAX_USER_CHARS, MAX_ASSISTANT_CHARS, MAX_TOTAL_CHARS,
} from "./chat-input.ts";

test("accepts a normal conversation", () => {
  const r = validateMessages([{ role: "user", content: "Hallo" }, { role: "assistant", content: "Hi" }]);
  assert.equal(r.ok, true);
});

test("rejects anything that is not a non-empty list", () => {
  for (const bad of [undefined, null, "x", {}, []]) {
    const r = validateMessages(bad);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test("rejects an unknown role or non-string content", () => {
  for (const bad of [
    [{ role: "system", content: "x" }],
    [{ role: "user", content: 42 }],
    [{ role: "user" }],
    [null],
  ]) {
    const r = validateMessages(bad);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test("too many messages is 413", () => {
  const many = Array.from({ length: MAX_MESSAGES + 1 }, () => ({ role: "user", content: "x" }));
  const r = validateMessages(many);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 413);
});

test("a user message has a lower cap than an assistant one", () => {
  const u = validateMessages([{ role: "user", content: "x".repeat(MAX_USER_CHARS + 1) }]);
  assert.equal(u.ok, false);
  const a = validateMessages([{ role: "assistant", content: "x".repeat(MAX_USER_CHARS + 1) }, { role: "user", content: "ok" }]);
  assert.equal(a.ok, true);
  const tooLong = validateMessages([{ role: "assistant", content: "x".repeat(MAX_ASSISTANT_CHARS + 1) }]);
  assert.equal(tooLong.ok, false);
});

test("the total is capped even when each message is fine", () => {
  const n = Math.ceil(MAX_TOTAL_CHARS / MAX_ASSISTANT_CHARS) + 1;
  const big = Array.from({ length: n }, () => ({ role: "assistant", content: "x".repeat(MAX_ASSISTANT_CHARS) }));
  const r = validateMessages(big);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 413);
});

test("cleanLabel removes marker syntax, control characters and extra space", () => {
  assert.equal(cleanLabel("Max [[DOC: x]]\n\tMeier", 60), "Max DOC: x Meier");
  assert.equal(cleanLabel("a\u0000b", 60), "a b");
});

test("cleanLabel bounds the length and ignores non-strings", () => {
  assert.equal(cleanLabel("x".repeat(100), 10).length, 10);
  assert.equal(cleanLabel(undefined, 10), "");
  assert.equal(cleanLabel({ toString: () => "x" }, 10), "");
});

test("cleanMemory keeps strings only, cleaned, capped by count and length", () => {
  const out = cleanMemory(["a [[MEMORY: b]]", 3, null, "", "x".repeat(500)], 20, 180);
  assert.deepEqual(out, ["a MEMORY: b", "x".repeat(180)]);
  assert.equal(cleanMemory(Array.from({ length: 50 }, (_, i) => `m${i}`)).length, 20);
  assert.deepEqual(cleanMemory("nope"), []);
});

test("stripMarkerSyntax keeps line breaks", () => {
  assert.equal(stripMarkerSyntax("a [[CHOICES: x]]\nb"), "a CHOICES: x\nb");
});

test("an attachment path must sit in the caller's own folder", () => {
  const me = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";
  assert.equal(ownPath(`${me}/proj/file.pdf`, me), true);
  assert.equal(ownPath(`${other}/proj/file.pdf`, me), false);
});

test("a path that climbs out, doubles a slash or is too short is refused", () => {
  const me = "11111111-1111-1111-1111-111111111111";
  assert.equal(ownPath(`${me}/../${"2".repeat(8)}/proj/file.pdf`, me), false);
  assert.equal(ownPath(`${me}/./proj/file.pdf`, me), false);
  assert.equal(ownPath(`${me}//file.pdf`, me), false);
  assert.equal(ownPath(`${me}/file.pdf`, me), false);
  assert.equal(ownPath("", me), false);
});
