import { createClient } from "@/lib/supabase";
import type { AgentType } from "@/lib/agents";
import { parseMarkers, looksLikeDocument } from "@/lib/message-markers";

/**
 * The deliverables an agent has actually produced for this user.
 *
 * Built the same way agent-memory.ts is, and for the same reason: a finished
 * Transformation Concept is an assistant message carrying a [[DOC:]] marker,
 * already stored verbatim in agxp_project_messages. Reading them back is a
 * query over the user's own projects — no new table, no new RLS policy.
 *
 * agxp_projects is owner-scoped by RLS, so this can only ever return the
 * signed-in user's own documents even though `agents` is a shared catalog.
 */

export interface AgentDocument {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  createdAt: string;
}

/** How far back to look, and how many documents to keep. High enough to be
 *  "all of them" for anyone using this today — the Agent Dashboard lists every
 *  concept an agent wrote and shows the count on the card (lib/team-stats.ts). */
const MAX_PROJECTS = 100;
const MAX_DOCS = 200;
const MAX_MESSAGES = 2000;

export async function loadAgentDocuments(agentId: string, role: AgentType): Promise<AgentDocument[]> {
  const supabase = createClient();
  const column = role === "coach" ? "coach_agent_id" : "consultant_agent_id";

  const { data: projects, error: pErr } = await supabase
    .from("agxp_projects")
    .select("id,name")
    .eq(column, agentId)
    .order("last_activity_at", { ascending: false })
    .limit(MAX_PROJECTS);
  if (pErr) throw pErr;

  const names = new Map((projects ?? []).map(p => [p.id as string, (p.name as string) || "Project"]));
  if (names.size === 0) return [];

  const { data: msgs, error: mErr } = await supabase
    .from("agxp_project_messages")
    .select("id,project_id,content,created_at")
    .in("project_id", [...names.keys()])
    .eq("column_type", role)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);
  if (mErr) throw mErr;

  const out: AgentDocument[] = [];
  for (const m of msgs ?? []) {
    const content = m.content as string;
    const p = parseMarkers(content);
    // The marker is the reliable signal; looksLikeDocument is the fallback for
    // the replies where the model forgot to write one.
    if (!p.doc && !looksLikeDocument(p.text)) continue;
    out.push({
      id: m.id as string,
      projectId: m.project_id as string,
      projectName: names.get(m.project_id as string) ?? "Project",
      title: p.doc || names.get(m.project_id as string) || "Transformation Concept",
      createdAt: m.created_at as string,
    });
    if (out.length >= MAX_DOCS) break;
  }
  return out;
}
