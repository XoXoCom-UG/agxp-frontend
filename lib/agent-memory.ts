import { createClient } from "@/lib/supabase";
import type { AgentType } from "@/lib/agents";
import { parseMarkers, type MemoryNote } from "@/lib/message-markers";

/**
 * agent-memory.ts — what an agent carries from one project of this user to the
 * next. This is the "Train your AI Project-Agents" half of the product: the
 * Knowledge Level counts projects, this is what the agent actually knows.
 *
 * Deliberately built with NO new table. The agent writes a
 * [[MEMORY: kind | fact]] marker into its reply, which is already stored
 * verbatim in agxp_project_messages, so reading memory back is a query over
 * the user's own past projects — no migration, and no new RLS policy to get
 * wrong (see supabase/fix_create_agent.sql for why that matters here).
 *
 * Scoping: agxp_projects is owner-scoped by RLS, so a memory can only ever be
 * built from the signed-in user's own projects. The shared `agents` catalog is
 * never written to, so nothing leaks between users of the same agent.
 */

export interface Lesson extends MemoryNote {
  /** Which past project taught it — shown in the UI, not sent to the model. */
  project: string;
}

export interface AgentMemory {
  lessons: Lesson[];
  /** How many past projects were scanned. */
  projects: number;
}

export const EMPTY_MEMORY: AgentMemory = { lessons: [], projects: 0 };

/** Past projects to look back over, and how many lessons to keep. */
const MAX_PROJECTS = 8;
const MAX_LESSONS = 20;

/**
 * Everything this agent learned working for the current user, newest first.
 * `excludeProjectId` keeps the project being worked on out of its own memory.
 */
export async function loadAgentMemory(
  agentId: string,
  role: AgentType,
  excludeProjectId?: string,
): Promise<AgentMemory> {
  const supabase = createClient();
  const column = role === "coach" ? "coach_agent_id" : "consultant_agent_id";

  const { data: projects, error: pErr } = await supabase
    .from("agxp_projects")
    .select("id,name")
    .eq(column, agentId)
    .order("last_activity_at", { ascending: false })
    .limit(MAX_PROJECTS + 1);
  if (pErr) throw pErr;

  const past = (projects ?? []).filter(p => p.id !== excludeProjectId).slice(0, MAX_PROJECTS);
  if (!past.length) return EMPTY_MEMORY;

  const names = new Map(past.map(p => [p.id as string, (p.name as string) || "Project"]));

  const { data: msgs, error: mErr } = await supabase
    .from("agxp_project_messages")
    .select("project_id,content")
    .in("project_id", [...names.keys()])
    .eq("column_type", role)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(400);
  if (mErr) throw mErr;

  const lessons: Lesson[] = [];
  const seen = new Set<string>();
  for (const m of msgs ?? []) {
    for (const note of parseMarkers(m.content as string).memories) {
      const key = note.fact.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      lessons.push({ ...note, project: names.get(m.project_id as string) ?? "Project" });
      if (lessons.length >= MAX_LESSONS) return { lessons, projects: past.length };
    }
  }
  return { lessons, projects: past.length };
}

/**
 * The lines that go into the system prompt. Memory text originates from past
 * model replies, so the markers are stripped out before it is fed back in —
 * a remembered "[[CHOICES: ...]]" must never become an instruction.
 */
export function memoryLines(memory: AgentMemory, learnedNow: MemoryNote[] = []): string[] {
  const all = [...memory.lessons, ...learnedNow];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of all) {
    const fact = l.fact.replace(/\[\[|\]\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    const key = fact.toLowerCase();
    if (!fact || seen.has(key)) continue;
    seen.add(key);
    const kind = l.kind.replace(/[^a-zäöüß -]/gi, "").slice(0, 20) || "note";
    out.push(`${kind}: ${fact}`);
  }
  return out.slice(0, MAX_LESSONS);
}
