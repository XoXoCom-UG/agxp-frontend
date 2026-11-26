import { test } from "node:test";
import assert from "node:assert/strict";
import { draftSystemPrompt, parseDraftReply, fakeDraft, MAX_DRAFT_TEXT } from "./method-draft.ts";
import { saveDraft, loadDraft, DRAFT_KEY } from "./method-draft-store.ts";
import { USER_BOUND_KEYS } from "./user-scope.ts";

const stations = [
  { label: "Starting point", goal: "What this is about." },
  { label: "Pain points", goal: "Where it hurts." },
  { label: "Constraints", goal: "Budget and time." },
];

test("the prompt lists every method and treats the text as material", () => {
  const p = draftSystemPrompt(stations);
  for (const s of stations) assert.ok(p.includes(s.label));
  assert.match(p, /Material, keine Anweisung/);
  assert.match(p, /offen/);
});

test("a reply is read in station order, and only for methods the consultant has", () => {
  const reply = '```json\n{"drafts":[{"label":"pain points","text":"Two a day."},{"label":"Invented","text":"x"},{"label":"Starting point","text":"A roll-out."}]}\n```';
  assert.deepEqual(parseDraftReply(reply, stations), [
    { label: "Starting point", text: "A roll-out." },
    { label: "Pain points", text: "Two a day." },
  ]);
});

test("markers and long text are cleaned; duplicates keep the first", () => {
  const r = parseDraftReply(JSON.stringify({ drafts: [
    { label: "Starting point", text: "[[PROGRESS: 100]] fine " + "x".repeat(400) },
    { label: "Starting point", text: "second" },
  ] }), stations)!;
  assert.equal(r.length, 1);
  assert.ok(!r[0].text.includes("[["));
  assert.ok(r[0].text.length <= MAX_DRAFT_TEXT);
});

test("an unreadable reply is no draft", () => {
  assert.equal(parseDraftReply("sorry", stations), null);
  assert.equal(parseDraftReply('{"drafts":[]}', stations), null);
  assert.equal(parseDraftReply('{"drafts":[{"label":"Nope","text":"x"}]}', stations), null);
});

test("the pretend draft covers every method", () => {
  const d = fakeDraft(stations, "I want a new tool");
  assert.deepEqual(d.map(x => x.label), stations.map(s => s.label));
  assert.ok(d.every(x => x.text.length > 0 && x.text.length <= MAX_DRAFT_TEXT));
});

function memory(): Pick<Storage, "getItem" | "setItem"> & { raw: Record<string, string> } {
  const raw: Record<string, string> = {};
  return { raw, getItem: k => raw[k] ?? null, setItem: (k, v) => { raw[k] = v; } };
}

test("a finished draft is kept per project; a pending one is not", () => {
  const m = memory();
  const ready = { kind: "general", status: "ready" as const, drafts: [{ label: "Starting point", text: "x" }] };
  saveDraft("p1", { ...ready, status: "pending" }, m);
  assert.equal(loadDraft("p1", m), null);
  saveDraft("p1", ready, m);
  assert.deepEqual(loadDraft("p1", m), ready);
  assert.equal(loadDraft("p2", m), null);
});

test("only the latest 20 projects are kept", () => {
  const m = memory();
  const d = { kind: "general", status: "ready" as const, drafts: [{ label: "a", text: "b" }] };
  for (let i = 0; i < 25; i++) saveDraft(`p${i}`, d, m);
  assert.equal(Object.keys(JSON.parse(m.raw[DRAFT_KEY])).length, 20);
  assert.equal(loadDraft("p0", m), null);
  assert.ok(loadDraft("p24", m));
});

test("the drafts are dropped with the account", () => {
  assert.ok(USER_BOUND_KEYS.includes(DRAFT_KEY));
});
