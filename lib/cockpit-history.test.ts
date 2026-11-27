import { test } from "node:test";
import assert from "node:assert/strict";
import { cockpitHistory } from "./cockpit-history.ts";
import { discussMethodPrompt, jumpToStationPrompt, focusStationPrompt } from "./deliverables.ts";

const stations = [{ label: "Goals" }, { label: "Pain points" }, { label: "Stakeholders" }, { label: "Risks" }, { label: "Roadmap" }];
const said = (topic: string) => ({ role: "assistant", content: `Frage? [[TOPIC: ${topic}]] [[PROGRESS: 20]]` });

test("an empty conversation remembers nothing", () => {
  assert.deepEqual(cockpitHistory([], stations), { talked: [], leftOpen: [] });
});

test("talked-through methods come back after a reload, in the agenda's order", () => {
  const h = cockpitHistory([
    { role: "user", content: discussMethodPrompt("Risks") },
    { role: "assistant", content: "Risiken …" },
    { role: "user", content: discussMethodPrompt("Goals") },
    { role: "user", content: discussMethodPrompt("Goals") },
  ], stations);
  assert.deepEqual(h.talked, ["Goals", "Risks"]);
});

test("Start here leaves the stations between where the interview was and the target open", () => {
  const h = cockpitHistory([
    said("1/5 Goals"),
    { role: "user", content: jumpToStationPrompt("Risks", 4, 5) },
    said("4/5 Risks"),
  ], stations);
  assert.deepEqual(h.leftOpen, ["Goals", "Pain points", "Stakeholders"]);
});

test("before the interview began, a jump leaves every station before it open", () => {
  const h = cockpitHistory([{ role: "user", content: jumpToStationPrompt("Stakeholders", 3, 5) }], stations);
  assert.deepEqual(h.leftOpen, ["Goals", "Pain points"]);
});

test("coming back to a station that was left open closes it", () => {
  const h = cockpitHistory([
    { role: "user", content: jumpToStationPrompt("Risks", 4, 5) },
    said("4/5 Risks"),
    said("2/5 Pain points"),
  ], stations);
  assert.deepEqual(h.leftOpen, ["Goals", "Stakeholders"]);
});

test("Only this one first leaves nothing open", () => {
  const h = cockpitHistory([{ role: "user", content: focusStationPrompt("Roadmap", 5, 5) }, said("5/5 Roadmap")], stations);
  assert.deepEqual(h.leftOpen, []);
});

test("a method the agenda does not have is ignored", () => {
  const h = cockpitHistory([{ role: "user", content: discussMethodPrompt("Nonsense") }], stations);
  assert.deepEqual(h.talked, []);
});
