import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeAiOn, fakeConsultantReply, fakeStartPlan } from "./dev-fake-ai.ts";
import { deliverableFor, optimizeMethodsPrompt, discussMethodPrompt, skipStationPrompt } from "./deliverables.ts";
import { parseMarkers } from "./message-markers.ts";
import { TYPE_CATALOG } from "./agent-types.ts";

const d = deliverableFor("consultant", "general");

test("the pretend assistant can never be on outside next dev", () => {
  assert.equal(fakeAiOn({ NODE_ENV: "production" }), false);
  assert.equal(fakeAiOn({ NODE_ENV: "production", AGXP_FAKE_AI: "1" }), false);
  assert.equal(fakeAiOn({ NODE_ENV: "test" }), false);
  assert.equal(fakeAiOn({ NODE_ENV: "development" }), true, "no key: pretend");
  assert.equal(fakeAiOn({ NODE_ENV: "development", ANTHROPIC_API_KEY: "sk" }), false, "a real key is used");
  assert.equal(fakeAiOn({ NODE_ENV: "development", ANTHROPIC_API_KEY: "sk", AGXP_FAKE_AI: "1" }), true);
});

test("the pretend start plan is a valid plan of the catalog", () => {
  const plan = fakeStartPlan(TYPE_CATALOG.consultant)!;
  assert.equal(plan.kind, "general");
  assert.ok(plan.methods.length >= 3);
});

test("the first message gets a draft without TOPIC or PROGRESS, and offers the interview", () => {
  const r = fakeConsultantReply(["I lead a team and want to roll out a new tool."], d);
  assert.match(r, /Optimize all methods/);
  assert.ok(!/\[\[TOPIC/.test(r) && !/\[\[PROGRESS/.test(r));
});

test("optimize starts the interview and each answer moves one station on", () => {
  const first = "I lead a team and want to roll out a new tool.";
  const r1 = fakeConsultantReply([first, optimizeMethodsPrompt()], d);
  assert.match(r1, new RegExp(`\\[\\[TOPIC: 1/${d.stations.length} `));
  const r2 = fakeConsultantReply([first, optimizeMethodsPrompt(), "about ten people"], d);
  assert.match(r2, new RegExp(`\\[\\[TOPIC: 2/${d.stations.length} `));
  const r3 = fakeConsultantReply([first, optimizeMethodsPrompt(), skipStationPrompt("x")], d);
  assert.match(r3, new RegExp(`\\[\\[TOPIC: 2/${d.stations.length} `));
  // a clicked choice starts it too
  assert.match(fakeConsultantReply([first, "Optimize all methods"], d), /\[\[TOPIC: 1\//);
});

test("opening a method discusses it without moving the interview", () => {
  const r = fakeConsultantReply(["my idea", discussMethodPrompt(d.stations[1].label)], d);
  assert.ok(r.includes(d.stations[1].label));
  assert.ok(!/\[\[TOPIC/.test(r) && !/\[\[PROGRESS/.test(r));
});

test("asking for the document gives a marked document", () => {
  const r = fakeConsultantReply(["my idea", d.generatePrompt], d);
  assert.ok(r.startsWith(`[[DOC: ${d.title}]]`));
  assert.ok(parseMarkers(r).text.includes(d.stations[0].label));
});
