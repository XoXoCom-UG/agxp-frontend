import { createClient } from "@/lib/supabase";
import { parseMarkers, looksLikeDocument } from "@/lib/message-markers";
import type { AgentType } from "@/lib/agents";

/**
 * What Project History shows beside each project: how far it got, how much
 * was said, what came out of it.
 *
 * Read the same way team-stats.ts reads the Agent Dashboard's numbers — from
 * the user's own agxp_project_messages, owner-scoped by RLS, no new table.
 * Progress is the newest [[PROGRESS:]] each agent gave, averaged over the
 * agents on the project; a project nobody has answered in yet has none.
 */

export interface ProjectStats {
  /** 0-100, or null before any agent has reported progress. */
  progress: number | null;
  /** The same figure per agent, which the average above hides: a project at
   *  "50%" can be one conversation finished and one not started. */
  progressBy: Record<AgentType, number | null>;
  /** What the user wrote, across both conversations. */
  messages: number;
  /** Finished documents, counted the way agent-documents.ts finds them. */
  docs: number;
  /** Which conversations produced one: the Consultant's Transformation
   *  Concept, the Coach's Change Plan. */
  docsBy: Record<AgentType, boolean>;
  /** The newest [[INDUSTRY:]] an agent named, if any. */
  industry: string | null;
}

const MAX_MESSAGES = 4000;

export async function loadProjectStats(projectIds: string[]): Promise<Record<string, ProjectStats>> {
  if (projectIds.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from("agxp_project_messages")
    .select("project_id,column_type,role,content")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);
  if (error) throw error;

  const out: Record<string, ProjectStats> = {};
  // Newest first, so the first progress seen per conversation is the current one.
  const latest = new Map<string, number>(); // `${project}:${column}` -> progress
  for (const m of data ?? []) {
    const id = m.project_id as string;
    const s = out[id] ??= {
      progress: null,
      progressBy: { consultant: null, coach: null },
      messages: 0, docs: 0, docsBy: { consultant: false, coach: false }, industry: null,
    };
    if (m.role === "user") { s.messages += 1; continue; }
    const content = m.content as string;
    const parsed = parseMarkers(content);
    const key = `${id}:${m.column_type}`;
    if (parsed.progress !== null && !latest.has(key)) latest.set(key, parsed.progress);
    if (parsed.doc || looksLikeDocument(parsed.text)) {
      s.docs += 1;
      s.docsBy[m.column_type as AgentType] = true;
    }
    if (parsed.industry && !s.industry) s.industry = parsed.industry;
  }

  const sums = new Map<string, { total: number; n: number }>();
  for (const [key, value] of latest) {
    const cut = key.indexOf(":");
    const id = key.slice(0, cut);
    const column = key.slice(cut + 1) as AgentType;
    const acc = sums.get(id) ?? { total: 0, n: 0 };
    acc.total += value; acc.n += 1;
    sums.set(id, acc);
    // Kept alongside the average, not instead of it: the rail and the filters
    // want one number, Home wants to show which half is behind.
    if (out[id]) out[id].progressBy[column] = value;
  }
  for (const [id, { total, n }] of sums) out[id].progress = Math.round(total / n);
  return out;
}
