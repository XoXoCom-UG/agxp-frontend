import { createClient } from "@/lib/supabase";

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

  return (agents ?? []).map(a => {
    const methods = methodsByAgent.get(a.id) ?? [];
    return {
      ...a,
      archived_at: a.archived_at ?? null,
      methods,
      primaryMethods: methods.filter(m => m.is_primary),
      secondaryMethods: methods.filter(m => !m.is_primary),
      last_projects: (projectsByAgent.get(a.id) ?? []).slice(0, 3),
    };
  });
}

export async function getAgent(id: string): Promise<Agent | null> {
  const agents = await listAgents();
  return agents.find(a => a.id === id) ?? null;
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
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const createdBy = userData.user?.id;
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
