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
  created_at: string;
  methods: Method[];
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
      supabase.from("agents").select("id, type, name, avatar_placeholder, created_at").order("created_at", { ascending: true }),
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

  return (agents ?? []).map(a => ({
    ...a,
    methods: methodsByAgent.get(a.id) ?? [],
    last_projects: (projectsByAgent.get(a.id) ?? []).slice(0, 2),
  }));
}

export async function getAgent(id: string): Promise<Agent | null> {
  const agents = await listAgents();
  return agents.find(a => a.id === id) ?? null;
}
