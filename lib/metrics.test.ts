import test from "node:test";
import assert from "node:assert/strict";
import { usd, pct, groupCount, typeLabel, total, shortDay, mergeGroups } from "./metrics.ts";
import { TYPE_CATALOG } from "./agent-types.ts";

test("money is micro-dollars in, short dollars out", () => {
  assert.equal(usd(0), "$0");
  assert.equal(usd(1_234_560), "$1.23");
  assert.equal(usd(512_400_000), "$512");
  assert.equal(usd(1_250_000_000), "$1,250");
});

test("percent has a dash when there is nothing to divide by", () => {
  assert.equal(pct(1, 4), "25%");
  assert.equal(pct(0, 0), "–");
});

test("a group the database hid never reads as zero", () => {
  assert.equal(groupCount({ n: null, small: true }, 5), "< 5");
  assert.equal(groupCount({ n: 12 }, 5), "12");
});

test("every consultant type is named back from its lower-cased tagline", () => {
  for (const t of TYPE_CATALOG.consultant) assert.equal(typeLabel(t.sub.toLowerCase()), t.type);
  assert.equal(typeLabel(""), "Other / older agents");
});

test("rows with one label merge, and a hidden part never becomes a number", () => {
  const m = mergeGroups([
    { label: "A", g: { n: 9 } },
    { label: "Other", g: { n: 6 } },
    { label: "Other", g: { n: null, small: true } },
    { label: "Tiny", g: { n: null, small: true } },
    { label: "Tiny", g: { n: null, small: true } },
  ]);
  assert.deepEqual(m.map(r => [r.label, r.g.n, r.plus]), [["A", 9, false], ["Other", 6, true], ["Tiny", null, false]]);
});

test("series totals and day labels", () => {
  const s = [
    { d: "2026-11-18", accounts: 1, projects: 2, messages: 3, docs: 0, active: 1 },
    { d: "2026-11-19", accounts: 0, projects: 1, messages: 5, docs: 1, active: 2 },
  ];
  assert.equal(total(s, "messages"), 8);
  assert.equal(shortDay("2026-11-19"), "19 Nov");
});
