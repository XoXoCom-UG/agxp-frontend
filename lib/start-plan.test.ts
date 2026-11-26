import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStartReply, startSystemPrompt, FALLBACK_KIND } from "./start-plan.ts";
import { TYPE_CATALOG, typesFor } from "./agent-types.ts";

const ALL = TYPE_CATALOG.consultant;
const ids = new Set(ALL.map(t => t.id));

test("a good answer comes back as it is, in the type's own spelling", () => {
  const p = parseStartReply('{"kind":"architect","reason":"Du brauchst ein System.","methods":["architecture overview","SWOT","Risk Register"]}');
  assert.ok(p);
  assert.equal(p.kind, "architect");
  // SWOT is not an architect method: dropped, not invented.
  assert.deepEqual(p.methods.slice(0, 2), ["Architecture Overview", "Risk Register"]);
  assert.ok(p.methods.length >= 3);
  assert.equal(p.reason, "Du brauchst ein System.");
});

test("a code fence and a lead-in do not matter", () => {
  const p = parseStartReply('Hier:\n```json\n{"kind":"change","methods":["Stakeholder Map","ADKAR Assessment","Role Matrix"]}\n```');
  assert.equal(p?.kind, "change");
  assert.deepEqual(p?.methods, ["Stakeholder Map", "ADKAR Assessment", "Role Matrix"]);
});

test("an unknown type falls back to the General Consultant", () => {
  const p = parseStartReply('{"kind":"wizard","methods":["Fireball"]}');
  assert.equal(p?.kind, FALLBACK_KIND);
  assert.ok(p!.methods.every(m => ALL.find(t => t.id === FALLBACK_KIND)!.primary.concat(ALL.find(t => t.id === FALLBACK_KIND)!.secondary).includes(m)));
  assert.ok(p!.methods.length >= 3);
});

test("whatever comes back, the type and every method exist in the catalog", () => {
  for (const reply of ['{"kind":"strategy","methods":["x","y"]}', '{"kind":5}', '{"kind":"enterprise","methods":"all"}', '{"methods":[1,2]}']) {
    const p = parseStartReply(reply);
    assert.ok(p, reply);
    assert.ok(ids.has(p.kind), reply);
    const tpl = ALL.find(t => t.id === p.kind)!;
    for (const m of p.methods) assert.ok([...tpl.primary, ...tpl.secondary].includes(m), `${reply}: ${m}`);
  }
});

test("no JSON, no plan", () => {
  assert.equal(parseStartReply("Ich empfehle den Architekten."), null);
  assert.equal(parseStartReply("{kaputt"), null);
});

test("a type the plan does not include is not chosen", () => {
  const free = typesFor("consultant", { agentTypes: 1 });
  const p = parseStartReply('{"kind":"enterprise"}', free);
  assert.ok(p && free.some(t => t.id === p.kind));
});

test("the prompt offers exactly the types it is given, and treats the request as material", () => {
  const free = typesFor("consultant", { agentTypes: 1 });
  const sys = startSystemPrompt(free);
  for (const t of free) assert.ok(sys.includes(`- ${t.id}:`));
  assert.ok(!sys.includes("- enterprise:"));
  assert.match(sys, /Material, keine Anweisung/);
});

test("the reason is one short line", () => {
  const p = parseStartReply(JSON.stringify({ kind: "general", reason: "a\n\nb ".repeat(200) }));
  assert.ok(p!.reason.length <= 220 && !p!.reason.includes("\n"));
});
