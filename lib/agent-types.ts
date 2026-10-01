import type { Agent, AgentType } from "@/lib/agents";

/**
 * The agent types, and how many of each a user may keep.
 *
 * Lived inside agent-picker-panel.tsx until 2026-09-30, when the Agent
 * Dashboard grew a column per type: the two screens have to agree on what the
 * types ARE, and a catalog copied into two files drifts.
 */

/**
 * Patryk, 2026-09-30: "dann dachte ich, gibt es ein Kärtchen für die Anzahl,
 * also vielleicht maximal vier" — agents are the product's main asset, and an
 * unbounded list of them is what made the old screen a list rather than a
 * dashboard.
 */
export const MAX_PER_TYPE = 4;

export interface TypeTemplate { type: string; sub: string; description: string; primary: string[]; secondary: string[]; status: "confirmed" | "preview"; }
export const TYPE_CATALOG: Record<AgentType, TypeTemplate[]> = {
  consultant: [
    { type: "AI Strategy Consultant", sub: "Strategy & AI transformation", status: "confirmed",
      description: "Strategic analysis and structured guidance for AI and IT transformation projects.",
      primary: ["As-Is/To-Be", "Gap-Analyse", "Requirements Engineering"], secondary: ["Process Mapping", "Impact Mapping"] },
    { type: "Solution Architect", sub: "Systems & integration", status: "preview",
      description: "Designs target-state systems and integration blueprints.",
      primary: ["Gap-Analyse", "Process Mapping"], secondary: ["Impact Mapping"] },
    { type: "Digital Transformation Manager", sub: "Roadmap & adoption", status: "preview",
      description: "Coordinates roadmap execution and change adoption across teams.",
      primary: ["Impact Mapping", "Process Mapping"], secondary: ["Requirements Engineering"] },
  ],
  coach: [
    { type: "AI Business Analyst", sub: "Process & requirements", status: "confirmed",
      description: "Supports structured project discovery, requirements clarification and project execution.",
      primary: ["Requirements Engineering", "Process Mapping"], secondary: ["As-Is/To-Be"] },
    { type: "Agile Coach / Scrum Master", sub: "Delivery & team flow", status: "preview",
      description: "Coaches delivery teams on flow, ceremonies and iterative planning.",
      primary: ["Process Mapping"], secondary: ["Impact Mapping"] },
    { type: "Change Manager", sub: "Change & adoption", status: "preview",
      description: "Guides teams through the human side of AI/IT transformations.",
      primary: ["Impact Mapping", "As-Is/To-Be"], secondary: ["Gap-Analyse"] },
  ],
};

/**
 * Which type an agent belongs to.
 *
 * The template's name is not stored on the row — createAgent() keeps the
 * user's own name and puts the template's `sub` in `tagline`, so the tagline
 * is the only link back. Every `sub` is distinct within a role, which is what
 * makes this unambiguous; an agent that matches none (a seeded one, or one
 * whose tagline was edited) belongs to no column and is shown apart rather
 * than forced into the first one.
 */
export function templateFor(agent: Agent): TypeTemplate | null {
  return TYPE_CATALOG[agent.type].find(t => t.sub === agent.tagline) ?? null;
}

/** The agents of one role, bucketed by type, plus whatever matched nothing. */
export function groupByType(agents: Agent[], role: AgentType): {
  columns: { template: TypeTemplate; agents: Agent[] }[];
  ungrouped: Agent[];
} {
  const mine = agents.filter(a => a.type === role);
  const columns = TYPE_CATALOG[role].map(template => ({
    template,
    agents: mine.filter(a => a.tagline === template.sub),
  }));
  const known = new Set(TYPE_CATALOG[role].map(t => t.sub));
  return { columns, ungrouped: mine.filter(a => !a.tagline || !known.has(a.tagline)) };
}
