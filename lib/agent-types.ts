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
 * The consultant types are nine (Ana, 2026-10-23, "AgxP – Method Groups per
 * Consultant"): Strategy Consultant, Business Analyst, Digital Transformation
 * Manager, Data Scientist, Product Manager, Solution Architect, Enterprise
 * Architect, Startup CTO and Change Manager — each with ALL the methods the
 * sheet gives it, and each with a document of its own (lib/deliverables.ts).
 * Before that there were three (2026-10-16); the Digital Transformation
 * Manager had been dropped and comes back with its old tagline, so agents made
 * under it find their type again.
 *
 * `primary` is the sheet's "Primary" methods — what the type tile and the agent
 * card lead with. The Strategy Consultant keeps the three it led with before
 * (Build / Buy / Partner is "always" for it, SWOT is what its document is
 * known for). Everything else — Core, Secondary, Closing, New — sits in
 * `secondary`, and the three core methods every type starts with (Knowledge
 * Check, Lexicon, At a Glance) are last so they do not make the types look alike.
 *
 * Which methods are primary is a property of the TYPE, not of the method: the
 * sheet has Stakeholder Map primary for the Change Manager and secondary for
 * the Digital Transformation Manager, Impact Mapping primary for the Product
 * Manager and secondary for the Business Analyst, Governance Model primary for
 * the Enterprise Architect and secondary for the Digital Transformation Manager.
 * methods.is_primary cannot say that, so listAgents() splits an agent's methods
 * by its template (lib/agents.ts).
 */
const CORE = ["Knowledge Check", "Lexicon", "At a Glance"];

export const TYPE_CATALOG: Record<AgentType, TypeTemplate[]> = {
  consultant: [
    { id: "strategy", type: "Strategy Consultant", sub: "Strategy & AI transformation", status: "confirmed",
      description: "Where you stand, where you want to be, and whether to build, buy or partner: strategy for AI and IT transformation.",
      primary: ["Gap Analysis + Action Plan", "Build / Buy / Partner Matrix", "SWOT"],
      secondary: ["Market / Opportunity Gaps", "Competitor Benchmark", "Scenario Planning", "Future Headline",
        "Consultant-Coach Debate", "SMART Goals", ...CORE] },
    { id: "business-analyst", type: "Business Analyst", sub: "Requirements & processes", status: "confirmed",
      description: "Turns a wish into something buildable: today against target, requirements as user stories, edge cases and a shared definition of done.",
      primary: ["As-Is / To-Be", "Gap Analysis + Action Plan", "Requirements (User Stories + MoSCoW)"],
      secondary: ["Impact Mapping", "Process Mapping", "Pain Point Heatmap", "Data Mapping", "Edge Case Hunt",
        "Definition of Done", "SMART Goals", "Risk Register", ...CORE] },
    { id: "transformation", type: "Digital Transformation Manager", sub: "Roadmap & adoption", status: "confirmed",
      description: "Takes an organisation from where it is to AI at work: maturity, which use cases come first, the roadmap, governance and the OKRs that prove it.",
      primary: ["Capability Maturity", "Use-Case Prioritization", "Roadmap"],
      secondary: ["Governance Model", "Stakeholder Map", "AI Use-Case Canvas", "Transformation Pulse Check",
        "Pre-Mortem", "OKRs", "Risk Register", ...CORE] },
    { id: "data-scientist", type: "Data Scientist", sub: "Data & machine learning", status: "confirmed",
      description: "From business question to proof of concept: the ML task, whether the data is good enough, the model options and the threshold for a yes.",
      primary: ["Problem Framing", "Data Readiness", "Model Options"],
      secondary: ["Root Cause Analysis (5 Whys)", "Label Audit", "Human-in-the-Loop Design", "Model Card",
        "Evaluation Metrics", "PoC Experiment Plan", "Risk Register", ...CORE] },
    { id: "product", type: "Product Manager", sub: "Product & users", status: "confirmed",
      description: "Who the product is for, what the first release contains and what stays out, and which assumptions to test before building.",
      primary: ["Personas", "Impact Mapping", "MVP Scope (MoSCoW)"],
      secondary: ["User Journey", "A/B Test Plan", "Jobs-to-be-Done", "Feature Kill List", "Fake Door Test",
        "Retention Hook Map", "Future Headline", "OKRs", "Assumption Tests", ...CORE] },
    { id: "architect", type: "Solution Architect", sub: "Systems & integration", status: "confirmed",
      description: "Designs the system behind the idea: components, technology choices, data and ML pipeline, infrastructure and cost.",
      primary: ["Architecture Overview", "Tech Stack Decisions (ADR)", "Non-Functional Requirements"],
      secondary: ["Data & ML Pipeline", "Infrastructure Plan", "Failure Mode Walkthrough", "Vendor Lock-in Check",
        "Load Story", "Consultant-Coach Debate", "Cost Model (TCO)", "Risk Register", ...CORE] },
    { id: "enterprise", type: "Enterprise Architect", sub: "Enterprise IT & governance", status: "confirmed",
      description: "Fits an AI use case into the company: the systems it touches, the integrations, the rules, compliance and what changes for whom.",
      primary: ["IT Landscape", "Integration Blueprint", "Governance Model"],
      secondary: ["Compliance Check", "AI Model Register", "Shadow AI Scan", "Data Lineage Map", "Change Impact",
        "Risk Register", ...CORE] },
    { id: "startup-cto", type: "Startup CTO", sub: "Startup tech & shipping", status: "confirmed",
      description: "The leanest way to a first user: the business model, the smallest loop worth shipping, a stack that is cheap to leave, and the signals to pivot.",
      primary: ["Lean Canvas", "MVP Core Loop", "Lean Tech Stack"],
      secondary: ["Team Setup", "Pivot Triggers", "Weekly Ship Log", "Hiring Scorecard", "Pre-Mortem",
        "Build-Measure-Learn Milestones", "Tech Debt Log", ...CORE] },
    { id: "change", type: "Change Manager", sub: "Change & adoption", status: "confirmed",
      description: "Plans the human side of the change: who is affected, what they need to learn, how fears are answered and how adoption is measured.",
      primary: ["Stakeholder Map", "Skill-Gap Analysis", "ADKAR Assessment"],
      secondary: ["Role Matrix", "Fear & Myth Board", "Champion Network", "Win Wall",
        "Training & Communication Plan", "Adoption KPIs", ...CORE] },
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

export function templateFor(agent: Pick<Agent, "type" | "tagline">): TypeTemplate | null {
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
