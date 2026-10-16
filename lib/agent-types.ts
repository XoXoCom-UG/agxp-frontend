import type { Agent, AgentType } from "@/lib/agents";
import type { Plan } from "@/lib/plans";

/**
 * The agent types, and how many of each a user may keep.
 *
 * Lived inside agent-picker-panel.tsx until 2026-09-30, when the Agent
 * Dashboard grew a column per type: the two screens have to agree on what the
 * types ARE, and a catalog copied into two files drifts.
 */

/*
 * How many agents of one type a user may keep, and how many types they see,
 * is a property of the plan — see agentsPerType / agentTypes in lib/plans.ts.
 * Patryk's original cap of four per type (2026-09-30: "dann dachte ich, gibt
 * es ein Kärtchen für die Anzahl, also vielleicht maximal vier") is what the
 * paid plans now carry; the free plan keeps one of one type per role.
 */

export interface TypeTemplate {
  /**
   * Stable key. The chat route and lib/deliverables.ts key off it — the
   * interview, the method set and the name of the document are all decided by
   * the type — so it is never shown and never changes. (`sub`, the tagline on
   * the agent row, is the only thing stored on an agent that points back here.)
   */
  id: string;
  type: string;
  sub: string;
  description: string;
  /** Method names, exactly as the `methods` table spells them (migration 0016). */
  primary: string[];
  secondary: string[];
  status: "confirmed" | "preview";
}

/*
 * The consultant types are three (Ana, 2026-10-16): Strategy Consultant,
 * Solution Architect, Change Manager — each with the methods from the method
 * sheet, and each with a document of its own (lib/deliverables.ts). The
 * Digital Transformation Manager is gone; the Change Manager moved here from
 * the coaches, where it had no method set of its own.
 *
 * `primary` is what the type tile and the agent card lead with; the three core
 * methods every type starts with (Knowledge Check, Lexicon, At a Glance) sit in
 * `secondary` so they do not make the types look alike.
 */
const CORE = ["Knowledge Check", "Lexicon", "At a Glance"];

export const TYPE_CATALOG: Record<AgentType, TypeTemplate[]> = {
  consultant: [
    { id: "strategy", type: "Strategy Consultant", sub: "Strategy & AI transformation", status: "confirmed",
      description: "Where you stand, where you want to be, and whether to build, buy or partner: strategy for AI and IT transformation.",
      primary: ["Gap Analysis + Action Plan", "Build / Buy / Partner Matrix", "SWOT"],
      secondary: ["Market / Opportunity Gaps", "SMART Goals", ...CORE] },
    { id: "architect", type: "Solution Architect", sub: "Systems & integration", status: "confirmed",
      description: "Designs the system behind the idea: components, technology choices, data and ML pipeline, infrastructure and cost.",
      primary: ["Architecture Overview", "Tech Stack Decisions (ADR)", "Non-Functional Requirements"],
      secondary: ["Data & ML Pipeline", "Infrastructure Plan", "Cost Model (TCO)", "Risk Register", ...CORE] },
    { id: "change", type: "Change Manager", sub: "Change & adoption", status: "confirmed",
      description: "Plans the human side of the change: who is affected, what they need to learn, and how adoption is measured.",
      primary: ["Stakeholder Map", "Skill-Gap Analysis", "ADKAR Assessment"],
      secondary: ["Role Matrix", "Training & Communication Plan", "Adoption KPIs", ...CORE] },
  ],
  coach: [
    { id: "analyst", type: "AI Business Analyst", sub: "Process & requirements", status: "confirmed",
      description: "Supports structured project discovery, requirements clarification and project execution.",
      primary: ["Requirements Engineering", "Process Mapping"], secondary: ["As-Is/To-Be"] },
    { id: "agile", type: "Agile Coach / Scrum Master", sub: "Delivery & team flow", status: "preview",
      description: "Coaches delivery teams on flow, ceremonies and iterative planning.",
      primary: ["Process Mapping"], secondary: ["Impact Mapping"] },
  ],
};

/** The types a plan can see and build for a role: the first N of the catalog. */
export function typesFor(role: AgentType, plan?: Pick<Plan, "agentTypes">): TypeTemplate[] {
  const all = TYPE_CATALOG[role];
  return plan?.agentTypes == null ? all : all.slice(0, plan.agentTypes);
}

/**
 * Which type an agent belongs to.
 *
 * The template's name is not stored on the row — createAgent() keeps the
 * user's own name and puts the template's `sub` in `tagline`, so the tagline
 * is the only link back. Every `sub` is distinct within a role, which is what
 * makes this unambiguous. The comparison ignores case: agents made before the
 * types were fixed carry "Strategy & AI Transformation" where the template
 * says "Strategy & AI transformation".
 *
 * An agent that matches none is not shown as a type of its own; groupByType()
 * files it under the role's first type.
 */
const same = (a: string | null | undefined, b: string) => (a ?? "").trim().toLowerCase() === b.toLowerCase();

export function templateFor(agent: Agent): TypeTemplate | null {
  return TYPE_CATALOG[agent.type].find(t => same(agent.tagline, t.sub)) ?? null;
}

/**
 * Which type an agent works as — the key the chat route and the deliverables
 * use. An agent that matches no template works as the role's first type, the
 * same way groupByType() files it, so what is shown and what runs agree.
 */
export function kindFor(agent: Pick<Agent, "type" | "tagline">): string {
  const hit = TYPE_CATALOG[agent.type].find(t => same(agent.tagline, t.sub));
  return (hit ?? TYPE_CATALOG[agent.type][0]).id;
}

/**
 * The agents of one role, bucketed by type.
 *
 * There is no "Other" bucket (Ana and Patryk, 2026-10-09: it should not
 * exist). An agent whose tagline matches none of the types the plan shows — one
 * made before the types were fixed, or of a type the plan no longer covers
 * after a downgrade — goes under the role's first type, so nobody disappears.
 */
export function groupByType(agents: Agent[], role: AgentType, plan?: Pick<Plan, "agentTypes">): {
  columns: { template: TypeTemplate; agents: Agent[] }[];
} {
  const mine = agents.filter(a => a.type === role);
  const visible = typesFor(role, plan);
  const matched = (a: Agent) => visible.some(t => same(a.tagline, t.sub));
  const columns = visible.map((template, i) => ({
    template,
    agents: mine.filter(a => same(a.tagline, template.sub) || (i === 0 && !matched(a))),
  }));
  return { columns };
}
