import { createClient } from "@/lib/supabase";
import { loadEntitlement, QuotaError } from "@/lib/entitlement";
import { typesFor, templateFor } from "@/lib/agent-types";
import { seedLevels } from "@/lib/mascot-level";

export type AgentType = "consultant" | "coach";

export interface Method {
  id: string;
  skill_id: string;
  name: string;
  is_primary: boolean;
  description: string | null;
}

export interface AgentProject {
  id: string;
  agent_id: string;
  name: string;
  summary: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  avatar_placeholder: string | null;
  tagline: string | null;
  description: string | null;
  expertise: string | null;
  knowledge_level: string;
  /** Who made it; null for the seeded catalog. Only the creator may archive it. */
  created_by: string | null;
  /**
   * Set when the user archived it (Ana, 2026-10-01: archive, not delete).
   * An archived agent leaves the picker and frees its slot, but stays on the
   * projects it worked on and can be restored from the Agent Dashboard.
   */
  archived_at: string | null;
  created_at: string;
  /** The highest level it has reached, 1-5 (lib/agent-level.ts). Missing
   *  before migration 0031, which reads as 1. */
  level_reached: number;
  methods: Method[];
  primaryMethods: Method[];
  secondaryMethods: Method[];
  last_projects: AgentProject[];
}

/**
 * Loads every agent plus its known methods and last projects in three
 * queries (not N+1) and stitches them together client-side.
 */
export async function listAgents(): Promise<Agent[]> {
  const supabase = createClient();

  const [{ data: agents, error: agentsErr }, { data: agentMethods, error: amErr }, { data: projects, error: projErr }] =
    await Promise.all([
      supabase.from("agents")
        // "*" rather than a column list: archived_at only exists once
        // migration 0006 has run, and naming it before then would fail the
        // whole page instead of just showing nothing as archived.
        .select("*")
        .order("created_at", { ascending: true }),
      supabase.from("agent_methods").select("agent_id, methods(id, skill_id, name, is_primary, description)"),
      supabase.from("agent_projects").select("id, agent_id, name, summary, created_at").order("created_at", { ascending: false }),
    ]);

  if (agentsErr) throw agentsErr;
  if (amErr) throw amErr;
  if (projErr) throw projErr;

  return assemble(agents ?? [], agentMethods ?? [], projects ?? []);
}

type AgentRow = Omit<Agent, "methods" | "primaryMethods" | "secondaryMethods" | "last_projects">;
type MethodLink = { agent_id: string; methods: unknown };

/** The rows of the three queries, stitched into agents. */
function assemble(agents: AgentRow[], agentMethods: MethodLink[], projects: AgentProject[]): Agent[] {
  const methodsByAgent = new Map<string, Method[]>();
  for (const row of agentMethods ?? []) {
    const m = row.methods as unknown as Method | Method[] | null;
    const method = Array.isArray(m) ? m[0] : m;
    if (!method) continue;
    const list = methodsByAgent.get(row.agent_id) ?? [];
    list.push(method);
    methodsByAgent.set(row.agent_id, list);
  }

  const projectsByAgent = new Map<string, AgentProject[]>();
  for (const p of projects ?? []) {
    const list = projectsByAgent.get(p.agent_id) ?? [];
    list.push(p);
    projectsByAgent.set(p.agent_id, list);
  }

  // Every face reads its level from this store; fill it before any renders.
  seedLevels(agents);

  return agents.map(a => {
    const methods = methodsByAgent.get(a.id) ?? [];
    // A consultant leads with ITS type's primary methods, not with whatever the
    // shared row says: the method sheet has the same method primary for one
    // type and secondary for another (Stakeholder Map, Impact Mapping,
    // Governance Model), and methods.is_primary can only hold one answer.
    const tpl = a.type === "consultant" ? templateFor(a) : null;
    const isPrimary = (m: Method) => (tpl ? tpl.primary.includes(m.name) : m.is_primary);
    return {
      ...a,
      archived_at: a.archived_at ?? null,
      level_reached: a.level_reached ?? 1,
      methods,
      primaryMethods: methods.filter(isPrimary),
      secondaryMethods: methods.filter(m => !isPrimary(m)),
      last_projects: (projectsByAgent.get(a.id) ?? []).slice(0, 3),
    };
  });
}

/** One agent, read on its own — not the whole list to pick one out of it. */
export async function getAgent(id: string): Promise<Agent | null> {
  const supabase = createClient();
  const [{ data: rows, error: agentErr }, { data: links, error: amErr }, { data: projects, error: projErr }] =
    await Promise.all([
      supabase.from("agents").select("*").eq("id", id),
      supabase.from("agent_methods").select("agent_id, methods(id, skill_id, name, is_primary, description)").eq("agent_id", id),
      supabase.from("agent_projects").select("id, agent_id, name, summary, created_at").eq("agent_id", id)
        .order("created_at", { ascending: false }).limit(3),
    ]);
  if (agentErr) throw agentErr;
  if (amErr) throw amErr;
  if (projErr) throw projErr;
  return assemble(rows ?? [], links ?? [], projects ?? [])[0] ?? null;
}

/**
 * Archives an agent the user created, or brings it back (archived = false).
 * Returns the new archived_at.
 *
 * Archive, not delete (Ana, 2026-10-01): the cap of four per type needs a way
 * to free a slot, but an agent's history and what it learned stay. RLS does
 * not answer a forbidden UPDATE with an error — it filters the row out and
 * reports success — so the row is read back, and "nothing changed" becomes an
 * error describeDbError() turns into the fix (migration 0006).
 */
export async function setAgentArchived(id: string, archived: boolean): Promise<string | null> {
  const supabase = createClient();
  const archivedAt = archived ? new Date().toISOString() : null;
  const { data, error } = await supabase.from("agents")
    .update({ archived_at: archivedAt }).eq("id", id).select("id");
  if (error) {
    // The column is missing: migration 0006 has not run yet.
    if (error.code === "42703" || error.code === "PGRST204") throw { code: "AGXP_ARCHIVE_DENIED", message: error.message };
    throw error;
  }
  if (!data?.length) throw { code: "AGXP_ARCHIVE_DENIED", message: "The database did not allow changing this agent." };
  return archivedAt;
}

export async function listAllMethods(): Promise<Method[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("methods").select("id, skill_id, name, is_primary, description").order("name");
  if (error) throw error;
  return data ?? [];
}

/** Creates a new agent and links it to the given methods (first one marked primary-of-choice is up to the caller's `methodIds` order — actual primary/secondary is whatever the shared `methods` row already says). */
export async function createAgent(input: {
  type: AgentType;
  name: string;
  description: string;
  tagline?: string;
  methodIds: string[];
}): Promise<Agent> {
  // Every agent is the user's own, and what a plan allows is a number of
  // TYPES and a number of agents per type. This is the clear message; the
  // database trigger from migration 0014 is what actually enforces it.
  //
  // The plan, the count of this type and the session go out together. They
  // used to go one after another — the plan as four queries in a row, then
  // every agent with all its methods just to count one type, then the auth
  // server — and Create sat on its spinner for all of it.
  const supabase = createClient();
  let mineQuery = supabase.from("agents").select("id", { count: "exact", head: true })
    .eq("type", input.type).is("archived_at", null);
  mineQuery = input.tagline ? mineQuery.eq("tagline", input.tagline) : mineQuery.is("tagline", null);
  // Consultants count against the plan's total as well (the Assistant does not).
  const totalQuery = supabase.from("agents").select("id", { count: "exact", head: true })
    .eq("type", "consultant").is("archived_at", null);
  const [{ plan }, { count: mine, error: countErr }, { count: total }, { data: sessionData }] = await Promise.all([
    loadEntitlement(),
    mineQuery,
    input.type === "consultant" ? totalQuery : Promise.resolve({ count: 0 }),
    supabase.auth.getSession(),
  ]);
  if (countErr) throw countErr;
  if (input.type === "consultant" && (total ?? 0) >= plan.maxAgents) {
    throw new QuotaError(
      `The ${plan.label} plan covers ${plan.maxAgents} ${plan.maxAgents === 1 ? "consultant" : "consultants"}. ` +
      `Archive one to free the place${plan.id === "free" ? ", or move to a bigger plan" : ""}.`,
    );
  }
  const types = typesFor(input.type, plan);
  if (input.tagline && !types.some(t => t.sub === input.tagline)) {
    throw new QuotaError(
      `The ${plan.label} plan covers ${plan.agentTypes} type of ${input.type} per role. ` +
      `A bigger plan opens the other types.`,
    );
  }
  if ((mine ?? 0) >= plan.agentsPerType) {
    throw new QuotaError(
      `You already have ${mine} of this type, which is what the ${plan.label} plan allows. ` +
      `Archive one to free the place${plan.id === "free" ? ", or move to a bigger plan" : ""}.`,
    );
  }

  // The session this browser holds; the insert policy checks created_by
  // against the verified token, so a round trip to the auth server adds nothing.
  const createdBy = sessionData.session?.user?.id;
  if (!createdBy) throw new Error("Nicht angemeldet.");

  const { data: agent, error } = await supabase
    .from("agents")
    .insert({
      type: input.type,
      name: input.name,
      description: input.description || null,
      tagline: input.tagline || null,
      avatar_placeholder: input.name.split(/\s+/).map(w => w[0]).join("").slice(0, 3).toUpperCase(),
      knowledge_level: "New",
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.methodIds.length) {
    const { error: linkErr } = await supabase
      .from("agent_methods")
      .insert(input.methodIds.map(method_id => ({ agent_id: agent.id, method_id })));
    if (linkErr) throw linkErr;
  }

  const created = await getAgent(agent.id);
  if (!created) throw new Error("Agent wurde erstellt, konnte aber nicht geladen werden.");
  return created;
}
