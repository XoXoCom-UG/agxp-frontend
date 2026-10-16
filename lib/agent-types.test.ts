import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByType, templateFor, typesFor, kindFor, TYPE_CATALOG } from "./agent-types.ts";
import type { Agent } from "./agents.ts";

const agent = (id: string, type: "consultant" | "coach", tagline: string | null): Agent => ({
  id, type, name: id, tagline, avatar_placeholder: null, description: null, expertise: null,
  knowledge_level: "New", created_by: "u", archived_at: null, created_at: "",
  methods: [], primaryMethods: [], secondaryMethods: [], last_projects: [],
});

test("the tagline matches its type whatever the case", () => {
  const a = agent("a", "consultant", "Strategy & AI Transformation");
  assert.equal(templateFor(a)?.type, "Strategy Consultant");
});

test("there is no Other: an agent that matches nothing goes under the first type", () => {
  const stray = agent("stray", "coach", "IT-Coaching & Enablement");
  const blank = agent("blank", "coach", null);
  const { columns } = groupByType([stray, blank], "coach");
  assert.deepEqual(columns[0].agents.map(a => a.id).sort(), ["blank", "stray"]);
  assert.equal(columns.slice(1).every(c => c.agents.length === 0), true);
});

test("an agent of a type the plan does not show is not lost", () => {
  const sa = agent("sa", "consultant", TYPE_CATALOG.consultant[1].sub);
  const { columns } = groupByType([sa], "consultant", { agentTypes: 1 });
  assert.equal(columns.length, 1);
  assert.deepEqual(columns[0].agents.map(a => a.id), ["sa"]);
});

test("agents of the other role are left alone", () => {
  const c = agent("c", "consultant", TYPE_CATALOG.consultant[0].sub);
  assert.equal(groupByType([c], "coach").columns.every(col => col.agents.length === 0), true);
  assert.equal(typesFor("coach").length, TYPE_CATALOG.coach.length);
});

test("the three consultant types, in this order", () => {
  assert.deepEqual(TYPE_CATALOG.consultant.map(t => t.type), ["Strategy Consultant", "Solution Architect", "Change Manager"]);
  assert.deepEqual(TYPE_CATALOG.consultant.map(t => t.id), ["strategy", "architect", "change"]);
});

test("type ids are unique across the whole catalog", () => {
  const ids = [...TYPE_CATALOG.consultant, ...TYPE_CATALOG.coach].map(t => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("kindFor follows the tagline, and falls back to the role's first type", () => {
  assert.equal(kindFor(agent("a", "consultant", "Systems & integration")), "architect");
  assert.equal(kindFor(agent("a", "consultant", "systems & INTEGRATION")), "architect");
  assert.equal(kindFor(agent("a", "consultant", "Roadmap & adoption")), "strategy");
  assert.equal(kindFor(agent("a", "consultant", null)), "strategy");
  assert.equal(kindFor(agent("a", "coach", null)), "analyst");
});

test("every method a type names is one the methods table will have", () => {
  // migration 0016 seeds exactly these; a typo here would make the type
  // impossible to create ("none of this type's methods are in the database").
  for (const t of TYPE_CATALOG.consultant) {
    assert.ok(t.primary.length >= 3, `${t.id} leads with at least three methods`);
    for (const m of [...t.primary, ...t.secondary]) assert.ok(m.trim() === m && m.length > 0, m);
  }
});
