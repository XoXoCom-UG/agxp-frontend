import { createClient } from "@/lib/supabase";
import { parseMarkers, looksLikeDocument } from "@/lib/message-markers";
import { PLACEHOLDER_PROJECT_NAME } from "@/lib/projects";
import { detectIndustries, rankIndustries } from "@/lib/industry";

/**
 * The numbers on the Agent Dashboard, read from the signed-in user's own
 * projects and conversations.
 *
 * Same principle as agent-memory.ts and agent-documents.ts: everything comes
 * from agxp_projects / agxp_project_messages, which are owner-scoped by RLS,
 * so the shared `agents` catalog never carries one user's usage into another
 * user's view.
 *
 * Tokens are an ESTIMATE: no usage is stored per call, so this counts the
 * conversation text itself at ~4 characters a token. It undercounts what the
 * API bills (the system prompt is resent every turn) but it moves with real
 * work, which is what the tile is for.
 */

/** One of an agent's projects, as its opened card lists them. */
export interface AgentProject {
  id: string;
  name: string;
  /** Last activity in the project. */
  date: string;
  /** The project's own description, else the first thing the user wrote to this agent. */
  summary: string | null;
  /** Title of the newest finished document in it, if any. */
  doc: string | null;
  /** Its industry ("Branche"), when the agent named it or the user's words give it away. */
  industry: string | null;
}

export interface AgentUsage {
  projects: number;
  /** Its projects, newest activity first. */
  projectList: AgentProject[];
  /** The industries of those projects, most frequent first. */
  industries: string[];
  tokens: number;
  /** Answers it has given — what the mascot's level is earned from (lib/mascot-level.ts). */
  replies: number;
  /** Finished deliverables, counted the way agent-documents.ts finds them. */
  docs: number;
}

export interface TeamStats {
  projectsInProgress: number;
  tokens: number;
  /** Tokens per day, oldest first, for the little bar chart on the tile. */
  tokensByDay: number[];
  byAgent: Record<string, AgentUsage>;
}

const CHARS_PER_TOKEN = 4;
const DAYS = 8;
const MAX_MESSAGES = 4000;

export const EMPTY_STATS: TeamStats = { projectsInProgress: 0, tokens: 0, tokensByDay: Array(DAYS).fill(0), byAgent: {} };

function tokensIn(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export async function loadTeamStats(): Promise<TeamStats> {
  const supabase = createClient();
  const { data: projects, error: pErr } = await supabase
    .from("agxp_projects")
    .select("id,name,description,status,coach_agent_id,consultant_agent_id,last_activity_at")
    .order("last_activity_at", { ascending: false });
  if (pErr) throw pErr;
  if (!projects?.length) return EMPTY_STATS;

  const { data: msgs, error: mErr } = await supabase
    .from("agxp_project_messages")
    .select("project_id,column_type,role,content,created_at")
    .in("project_id", projects.map(p => p.id))
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);
  if (mErr) throw mErr;

  const byAgent: Record<string, AgentUsage> = {};
  const agentOf = new Map<string, string>(); // `${project}:${column}` -> agent id
  const cardOf = new Map<string, AgentProject>(); // same key -> that project's card
  // Messages arrive newest first: the last user message seen per project is
  // the first one written.
  const firstAsk = new Map<string, string>();
  // Per project, across both conversations: the newest [[INDUSTRY:]] the
  // agents named, and everything else that can give the industry away.
  const namedIndustry = new Map<string, string>();
  const industryText = new Map<string, string[]>();
  const addText = (projectId: string, text: string) => {
    const list = industryText.get(projectId) ?? [];
    list.push(text);
    industryText.set(projectId, list);
  };
  for (const p of projects) {
    for (const [column, id] of [["coach", p.coach_agent_id], ["consultant", p.consultant_agent_id]] as const) {
      if (!id) continue;
      agentOf.set(`${p.id}:${column}`, id);
      const u = byAgent[id] ??= { projects: 0, projectList: [], industries: [], tokens: 0, replies: 0, docs: 0 };
      u.projects += 1;
      const name = p.name === PLACEHOLDER_PROJECT_NAME ? "Untitled task" : p.name;
      const card: AgentProject = {
        id: p.id, name, date: p.last_activity_at,
        summary: (p.description as string | null)?.trim() || null, doc: null, industry: null,
      };
      u.projectList.push(card);
      cardOf.set(`${p.id}:${column}`, card);
    }
  }

  const dayMs = 86_400_000;
  const today = Math.floor(Date.now() / dayMs);
  const tokensByDay: number[] = Array(DAYS).fill(0);
  let tokens = 0;

  for (const p of projects) if (p.description) addText(p.id, p.description as string);

  for (const m of msgs ?? []) {
    const t = tokensIn(m.content as string);
    tokens += t;
    const age = today - Math.floor(new Date(m.created_at as string).getTime() / dayMs);
    if (age >= 0 && age < DAYS) tokensByDay[DAYS - 1 - age] += t;

    const projectId = m.project_id as string;
    const parsed = m.role === "assistant" ? parseMarkers(m.content as string) : null;
    if (!parsed) addText(projectId, m.content as string);
    else {
      if (parsed.industry && !namedIndustry.has(projectId)) namedIndustry.set(projectId, parsed.industry);
      for (const note of parsed.memories) if (note.kind === "branche") addText(projectId, note.fact);
    }

    const key = `${projectId}:${m.column_type}`;
    const agentId = agentOf.get(key);
    if (!agentId) continue;
    const u = byAgent[agentId];
    const card = cardOf.get(key)!;
    u.tokens += t;
    if (m.role !== "assistant") {
      firstAsk.set(key, m.content as string);
      continue;
    }
    u.replies += 1;
    const p = parsed!;
    const isDoc = !!p.doc || looksLikeDocument(p.text);
    if (isDoc) {
      u.docs += 1;
      card.doc ??= p.doc || card.name;
    }
  }
  for (const [key, text] of firstAsk) {
    const card = cardOf.get(key)!;
    card.summary ??= text.replace(/\s+/g, " ").trim().slice(0, 140) || null;
  }
  for (const [key, card] of cardOf) {
    const projectId = key.slice(0, key.lastIndexOf(":"));
    card.industry = namedIndustry.get(projectId)
      ?? detectIndustries((industryText.get(projectId) ?? []).join("\n"))[0]
      ?? null;
  }
  for (const u of Object.values(byAgent)) {
    u.industries = rankIndustries(u.projectList.flatMap(c => c.industry ? [c.industry] : []));
  }

  return {
    projectsInProgress: projects.filter(p => p.status !== "Completed" && p.status !== "Archived").length,
    tokens,
    tokensByDay,
    byAgent,
  };
}

/** 12400 -> "12.4K", 980 -> "980". */
export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
