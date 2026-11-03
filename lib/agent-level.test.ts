import { test } from "node:test";
import assert from "node:assert/strict";
import {
  levelFromWork, experienceFor, nextStepFor, cleanLevel, FIRST_CONVERSATION_REPLIES, MAX_LEVEL,
} from "./agent-level.ts";

test("a new agent is level 1", () => {
  assert.equal(levelFromWork({ replies: 0, docProjects: 0 }), 1);
  assert.equal(levelFromWork({ replies: FIRST_CONVERSATION_REPLIES - 1, docProjects: 0 }), 1);
});

test("a first real conversation is level 2", () => {
  assert.equal(levelFromWork({ replies: FIRST_CONVERSATION_REPLIES, docProjects: 0 }), 2);
  assert.equal(levelFromWork({ replies: 40, docProjects: 0 }), 2);
});

test("chatting never goes past 2: only finished documents climb further", () => {
  assert.equal(levelFromWork({ replies: 10_000, docProjects: 0 }), 2);
});

test("documents in different projects climb 3, 4, 5", () => {
  assert.equal(levelFromWork({ replies: 0, docProjects: 1 }), 3);
  assert.equal(levelFromWork({ replies: 12, docProjects: 2 }), 4);
  assert.equal(levelFromWork({ replies: 12, docProjects: 3 }), 5);
  assert.equal(levelFromWork({ replies: 12, docProjects: 9 }), MAX_LEVEL);
});

test("a document straight away skips level 2", () => {
  assert.equal(levelFromWork({ replies: 3, docProjects: 1 }), 3);
});

test("bad numbers do not break the ladder", () => {
  assert.equal(levelFromWork({ replies: NaN, docProjects: -2 }), 1);
  assert.equal(levelFromWork({ replies: 2, docProjects: 1.9 }), 3);
});

test("the experience word follows the level", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(experienceFor), ["New", "Medium", "Medium", "Medium", "High"]);
});

test("every level but the last has a next step", () => {
  assert.deepEqual([1, 2, 3, 4].map(nextStepFor), ["conversation", "first-document", "second-document", "third-document"]);
  assert.equal(nextStepFor(5), null);
});

test("a stored level is clamped to 1-5", () => {
  assert.equal(cleanLevel(undefined), 1);
  assert.equal(cleanLevel(null), 1);
  assert.equal(cleanLevel("4"), 4);
  assert.equal(cleanLevel(0), 1);
  assert.equal(cleanLevel(99), 5);
});
