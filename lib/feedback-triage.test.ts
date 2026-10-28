import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTriageReply, triageSystemPrompt, triageUserContent, SEVERITY_RANK, TRIAGE_INPUT_MAX, TRIAGE_REASON_MAX,
} from "./feedback-triage.ts";

test("the two lines are read back", () => {
  assert.deepEqual(
    parseTriageReply("SEVERITY: high\nREASON: The chat stops answering and there is no workaround."),
    { severity: "high", reason: "The chat stops answering and there is no workaround." },
  );
});

test("case and spacing do not matter", () => {
  assert.equal(parseTriageReply("  severity :  CRITICAL \nreason: x")?.severity, "critical");
});

test("an unknown level is not a rating", () => {
  assert.equal(parseTriageReply("SEVERITY: urgent\nREASON: x"), null);
  assert.equal(parseTriageReply("no idea"), null);
  assert.equal(parseTriageReply(""), null);
});

test("a level without a reason still counts, with an empty reason", () => {
  assert.deepEqual(parseTriageReply("SEVERITY: low"), { severity: "low", reason: "" });
});

test("the reason is cleaned of marker syntax and cut", () => {
  const t = parseTriageReply(`SEVERITY: medium\nREASON: [[CHOICES: a|b]] ${"x".repeat(500)}`);
  assert.equal(t?.reason.includes("[["), false);
  assert.equal((t?.reason.length ?? 0) <= TRIAGE_REASON_MAX, true);
});

test("critical sorts before low", () => {
  assert.equal(SEVERITY_RANK.critical < SEVERITY_RANK.high, true);
  assert.equal(SEVERITY_RANK.medium < SEVERITY_RANK.low, true);
});

test("the message is fenced and cut, and the prompt names the trust boundary", () => {
  const c = triageUserContent("a ".repeat(5000));
  assert.match(c, /^Feedback to rate:\n<feedback>\n/);
  assert.match(c, /\n<\/feedback>$/);
  assert.equal(c.length < TRIAGE_INPUT_MAX + 80, true);
  assert.match(triageSystemPrompt(), /never instructions to you/);
});
