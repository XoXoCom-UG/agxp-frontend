import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  // Shown: the two simple ones and Strategy; the Business Analyst goes under the catalog's first type.
  assert.deepEqual(columns.map(c => c.template.id), ["general", "agentics", "strategy"]);
  assert.deepEqual(columns.find(c => c.template.id === "strategy")!.agents.map(a => a.id), ["sa"]);
});

test("an agent that matches nothing is a Strategy Consultant, not a General one", () => {
  const stray = agent("stray", "consultant", "Something we never had");
  const { columns } = groupByType([stray], "consultant");
  assert.deepEqual(columns.find(c => c.template.id === "strategy")!.agents.map(a => a.id), ["stray"]);
  assert.equal(columns.find(c => c.template.id === "general")!.agents.length, 0);
  assert.equal(kindFor(stray), "strategy");
});

test("an agent of a simple type is found under its own type", () => {
  const g = agent("g", "consultant", "Ideas & first steps");
  assert.equal(kindFor(g), "general");
  assert.equal(templateFor(g)?.type, "General Consultant");
  assert.equal(kindFor(agent("a", "consultant", "AI ideas in plain words")), "agentics");
});

test("agents of the other role are left alone", () => {
  const c = agent("c", "consultant", TYPE_CATALOG.consultant[0].sub);
  assert.equal(groupByType([c], "coach").columns.every(col => col.agents.length === 0), true);
  assert.equal(typesFor("coach").length, TYPE_CATALOG.coach.length);
});

const professional = TYPE_CATALOG.consultant.filter(t => t.tier === "professional");
const recommended = TYPE_CATALOG.consultant.filter(t => t.tier === "recommended");

test("the nine professional consultant types of the method sheet, in the sheet's order", () => {
  assert.deepEqual(professional.map(t => t.type), [
    "Strategy Consultant", "Business Analyst", "Digital Transformation Manager", "Data Scientist", "Product Manager",
    "Solution Architect", "Enterprise Architect", "Startup CTO", "Change Manager",
  ]);
  assert.deepEqual(professional.map(t => t.id), [
    "strategy", "business-analyst", "transformation", "data-scientist", "product",
    "architect", "enterprise", "startup-cto", "change",
  ]);
});

test("the two simple consultants come after the nine in the catalog, so the first type stays Strategy", () => {
  assert.deepEqual(recommended.map(t => t.id), ["general", "agentics"]);
  assert.equal(TYPE_CATALOG.consultant[0].id, "strategy");
  assert.deepEqual(TYPE_CATALOG.consultant.slice(-2).map(t => t.id), ["general", "agentics"]);
  // The Coach has one kind.
  assert.equal(TYPE_CATALOG.coach.every(t => t.tier === "professional"), true);
});

test("the simple consultants are drawn first, and the catalog order is not what is drawn", () => {
  const shown = typesFor("consultant").map(t => t.id);
  assert.deepEqual(shown.slice(0, 2), ["general", "agentics"]);
  assert.equal(shown[2], "strategy");
  assert.equal(shown.length, TYPE_CATALOG.consultant.length);
});

test("a plan limits the professional types, never the simple ones", () => {
  const free = typesFor("consultant", { agentTypes: 1 }).map(t => t.id);
  assert.deepEqual(free, ["general", "agentics", "strategy"]);
  assert.equal(typesFor("consultant", { agentTypes: null }).length, 11);
  // The Coach is unchanged.
  assert.equal(typesFor("coach", { agentTypes: 1 }).length, 1);
});

test("every type id is one the chat route accepts as an agent kind", () => {
  // lib/chat-input.ts cleanKind: lowercase letters and hyphens, up to 24 characters.
  for (const t of [...TYPE_CATALOG.consultant, ...TYPE_CATALOG.coach]) assert.match(t.id, /^[a-z][a-z-]{0,23}$/, t.id);
});

test("taglines are distinct within a role, or an agent could not tell its type", () => {
  for (const role of ["consultant", "coach"] as const) {
    const subs = TYPE_CATALOG[role].map(t => t.sub.toLowerCase());
    assert.equal(new Set(subs).size, subs.length, role);
  }
});

test("type ids are unique across the whole catalog", () => {
  const ids = [...TYPE_CATALOG.consultant, ...TYPE_CATALOG.coach].map(t => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("kindFor follows the tagline, and falls back to the role's first type", () => {
  assert.equal(kindFor(agent("a", "consultant", "Systems & integration")), "architect");
  assert.equal(kindFor(agent("a", "consultant", "systems & INTEGRATION")), "architect");
  assert.equal(kindFor(agent("a", "consultant", "Roadmap & adoption")), "transformation");
  assert.equal(kindFor(agent("a", "consultant", "Something we never had")), "strategy");
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

/*
 * The method sheet, type by type — written out here by hand, from "AgxP – Method
 * Groups per Consultant" Part 1, so that the catalog is checked against the
 * sheet and not against itself. The Solution Architect also keeps the
 * Infrastructure Plan it had before the sheet (it is not on the sheet).
 */
const SHEET: Record<string, string[]> = {
  strategy: ["Knowledge Check", "Lexicon", "At a Glance", "Gap Analysis + Action Plan", "Market / Opportunity Gaps",
    "Build / Buy / Partner Matrix", "Competitor Benchmark", "Scenario Planning", "Future Headline",
    "Consultant-Coach Debate", "SMART Goals", "SWOT"],
  "business-analyst": ["Knowledge Check", "Lexicon", "At a Glance", "As-Is / To-Be", "Gap Analysis + Action Plan",
    "Requirements (User Stories + MoSCoW)", "Impact Mapping", "Process Mapping", "Pain Point Heatmap", "Data Mapping",
    "Edge Case Hunt", "Definition of Done", "SMART Goals", "Risk Register"],
  transformation: ["Knowledge Check", "Lexicon", "At a Glance", "Capability Maturity", "Use-Case Prioritization", "Roadmap",
    "Governance Model", "Stakeholder Map", "AI Use-Case Canvas", "Transformation Pulse Check", "Pre-Mortem", "OKRs",
    "Risk Register"],
  "data-scientist": ["Knowledge Check", "Lexicon", "At a Glance", "Problem Framing", "Data Readiness", "Model Options",
    "Root Cause Analysis (5 Whys)", "Label Audit", "Human-in-the-Loop Design", "Model Card", "Evaluation Metrics",
    "PoC Experiment Plan", "Risk Register"],
  product: ["Knowledge Check", "Lexicon", "At a Glance", "Personas", "Impact Mapping", "MVP Scope (MoSCoW)", "User Journey",
    "A/B Test Plan", "Jobs-to-be-Done", "Feature Kill List", "Fake Door Test", "Retention Hook Map", "Future Headline",
    "OKRs", "Assumption Tests"],
  architect: ["Knowledge Check", "Lexicon", "At a Glance", "Architecture Overview", "Tech Stack Decisions (ADR)",
    "Non-Functional Requirements", "Data & ML Pipeline", "Failure Mode Walkthrough", "Vendor Lock-in Check", "Load Story",
    "Consultant-Coach Debate", "Cost Model (TCO)", "Risk Register", "Infrastructure Plan"],
  enterprise: ["Knowledge Check", "Lexicon", "At a Glance", "IT Landscape", "Integration Blueprint", "Governance Model",
    "Compliance Check", "AI Model Register", "Shadow AI Scan", "Data Lineage Map", "Change Impact", "Risk Register"],
  "startup-cto": ["Knowledge Check", "Lexicon", "At a Glance", "Lean Canvas", "MVP Core Loop", "Lean Tech Stack", "Team Setup",
    "Pivot Triggers", "Weekly Ship Log", "Hiring Scorecard", "Pre-Mortem", "Build-Measure-Learn Milestones", "Tech Debt Log"],
  change: ["Knowledge Check", "Lexicon", "At a Glance", "Stakeholder Map", "Skill-Gap Analysis", "ADKAR Assessment",
    "Role Matrix", "Fear & Myth Board", "Champion Network", "Win Wall", "Training & Communication Plan", "Adoption KPIs"],
};

test("each type carries exactly the methods the sheet gives it", () => {
  for (const t of professional) {
    assert.deepEqual([...t.primary, ...t.secondary].sort(), [...SHEET[t.id]].sort(), t.id);
  }
});

test("the sheet's Primary methods lead each tile", () => {
  const primary: Record<string, string[]> = {
    // The Strategy Consultant keeps the three it led with before the sheet.
    strategy: ["Gap Analysis + Action Plan", "Build / Buy / Partner Matrix", "SWOT"],
    "business-analyst": ["As-Is / To-Be", "Gap Analysis + Action Plan", "Requirements (User Stories + MoSCoW)"],
    transformation: ["Capability Maturity", "Use-Case Prioritization", "Roadmap"],
    "data-scientist": ["Problem Framing", "Data Readiness", "Model Options"],
    product: ["Personas", "Impact Mapping", "MVP Scope (MoSCoW)"],
    architect: ["Architecture Overview", "Tech Stack Decisions (ADR)", "Non-Functional Requirements"],
    enterprise: ["IT Landscape", "Integration Blueprint", "Governance Model"],
    "startup-cto": ["Lean Canvas", "MVP Core Loop", "Lean Tech Stack"],
    change: ["Stakeholder Map", "Skill-Gap Analysis", "ADKAR Assessment"],
  };
  for (const t of professional) assert.deepEqual(t.primary, primary[t.id], t.id);
});

test("a method can be primary for one type and secondary for another, as on the sheet", () => {
  const by = (id: string) => TYPE_CATALOG.consultant.find(t => t.id === id)!;
  assert.ok(by("change").primary.includes("Stakeholder Map"));
  assert.ok(by("transformation").secondary.includes("Stakeholder Map"));
  assert.ok(by("product").primary.includes("Impact Mapping"));
  assert.ok(by("business-analyst").secondary.includes("Impact Mapping"));
  assert.ok(by("enterprise").primary.includes("Governance Model"));
  assert.ok(by("transformation").secondary.includes("Governance Model"));
});

test("every professional type starts with the three core methods, and they never lead", () => {
  for (const t of professional) {
    for (const m of ["Knowledge Check", "Lexicon", "At a Glance"]) {
      assert.ok(t.secondary.includes(m), `${t.id}: ${m}`);
      assert.ok(!t.primary.includes(m), `${t.id}: ${m} must not lead`);
    }
  }
});

test("migration 0024 creates every method of every type, and relinks every tagline", () => {
  // The picker links an agent to `methods` rows by NAME; a name missing from the migration is a type
  // that cannot be created in production.
  const sql = readFileSync(new URL("../supabase/migrations/0024_all_consultant_types.sql", import.meta.url), "utf8");
  const q = (x: string) => x.replace(/'/g, "''");
  for (const t of professional) {
    assert.ok(sql.includes(`'${q(t.sub.toLowerCase())}'`), `${t.id}: tagline`);
    for (const m of [...t.primary, ...t.secondary]) {
      assert.ok(sql.includes(`('${q(m)}',`), `${t.id}: ${m} is not created`);
      assert.ok(sql.includes(`('${q(t.sub.toLowerCase())}', '${q(m)}')`), `${t.id}: ${m} is not linked`);
    }
  }
});

test("migration 0028 creates the methods only the simple consultants have, and no other method is missing", () => {
  const sql0028 = readFileSync(new URL("../supabase/migrations/0028_mainstream_consultants.sql", import.meta.url), "utf8");
  const earlier = ["0016_consultant_methods.sql", "0024_all_consultant_types.sql"]
    .map(f => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8")).join("\n");
  const q = (x: string) => x.replace(/'/g, "''");
  for (const t of recommended) {
    for (const m of [...t.primary, ...t.secondary]) {
      const here = sql0028.includes(`('${q(m)}',`);
      const before = earlier.includes(`('${q(m)}',`);
      assert.ok(here || before, `${t.id}: ${m} is created by no migration`);
    }
  }
  // The ones created here are exactly the methods no earlier migration has.
  const mine = new Set(recommended.flatMap(t => [...t.primary, ...t.secondary]));
  for (const m of mine) {
    if (!earlier.includes(`('${q(m)}',`)) assert.ok(sql0028.includes(`('${q(m)}',`), `${m} must be created in 0028`);
  }
});

test("a simple consultant leads with its own three methods and has few of them", () => {
  for (const t of recommended) {
    assert.equal(t.primary.length, 3, t.id);
    assert.ok(t.primary.length + t.secondary.length <= 10, `${t.id} stays small: that is the point of it`);
    assert.ok(t.secondary.includes("Knowledge Check") && t.secondary.includes("At a Glance"), t.id);
  }
});
