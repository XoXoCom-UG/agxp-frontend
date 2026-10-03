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

/** How far back to look. One document per project survives the filter below,
 *  so MAX_DOCS is a ceiling on projects, not on versions. */
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

  // Only the newest document per project. Every regeneration used to show up
  // as its own entry, which turned three projects into nineteen rows — Patryk
  // on 2026-10-02: "Ich denke, das ist to much. Eins reicht, immer das
  // aktuellste reicht." The query is already ordered newest first, so the
  // first one seen for a project IS the current one.
  const seen = new Set<string>();
  const out: AgentDocument[] = [];
  for (const m of msgs ?? []) {
    const content = m.content as string;
    const p = parseMarkers(content);
    // The marker is the reliable signal; looksLikeDocument is the fallback for
    // the replies where the model forgot to write one.
    if (!p.doc && !looksLikeDocument(p.text)) continue;
    const project = m.project_id as string;
    if (seen.has(project)) continue;
    seen.add(project);
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
