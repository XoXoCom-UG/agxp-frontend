import { test } from "node:test";
import assert from "node:assert/strict";
import { systemPrompt } from "./agent-prompt.ts";

const prompt = (kind?: string | null, role: "consultant" | "coach" = "consultant") =>
  systemPrompt(role, "Kara", [], undefined, null, kind);

test("each consultant type gets its own document and its own focus", () => {
  assert.match(prompt("strategy"), /Transformation Concept/);
  assert.match(prompt("strategy"), /DEIN SCHWERPUNKT — Strategie/);
  assert.match(prompt("architect"), /Architecture Blueprint/);
  assert.match(prompt("architect"), /DEIN SCHWERPUNKT — Solution Architecture/);
  assert.match(prompt("change"), /Adoption Plan/);
  assert.match(prompt("change"), /DEIN SCHWERPUNKT — Veränderungsmanagement/);
});

test("an unknown or missing type is the Strategy Consultant", () => {
  for (const k of [undefined, null, "", "nope"]) {
    assert.match(prompt(k), /Transformation Concept/, String(k));
    assert.match(prompt(k), /DEIN SCHWERPUNKT — Strategie/, String(k));
  }
});

test("one type's prompt carries nothing of another's document", () => {
  assert.doesNotMatch(prompt("architect"), /Adoption Plan/);
  assert.doesNotMatch(prompt("change"), /Architecture Blueprint/);
});

test("the Coach ignores the type", () => {
  assert.match(prompt("architect", "coach"), /Change Plan/);
  assert.doesNotMatch(prompt("architect", "coach"), /DEIN SCHWERPUNKT/);
});
