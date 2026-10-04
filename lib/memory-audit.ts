import { createClient } from "@/lib/supabase";
import { parseMarkers } from "@/lib/message-markers";

/**
 * memory-audit.ts — is the agent actually learning anything?
 *
 * Memory has no table (see lib/agent-memory.ts): it is a [[MEMORY: kind |
 * fact]] marker the model chooses to write into a reply. "Chooses" is the
 * problem. The instruction can stop working after a prompt change and nothing
 * breaks, nothing errors, no test fails — the agent simply stops remembering
 * and the next project starts from zero. That is invisible from the outside,
 * and it stayed invisible until this file existed.
 *
 * So this counts it: how many of your assistant replies carry a marker, and
 * what those markers actually say. If the rate goes to zero after a prompt
 * change, that is the signal.
 *
 * Scope: every query here is over `agxp_projects` / `agxp_project_messages`,
 * which are owner-scoped by RLS. There is no service role and no admin view —
 * a team member sees their own account, which is the account they test with.
 */

export interface AuditLesson {
  kind: string;
  fact: string;
  role: "consultant" | "coach";
  project: string;
}

export interface MemoryAudit {
  /** Assistant replies looked at. */
  replies: number;
  /** How many of them carried at least one [[MEMORY:]] marker. */
  withMemory: number;
  /** Projects the replies came from. */
  projects: number;
  /** Distinct lessons, newest first. */
  lessons: AuditLesson[];
  /** Replies and markers split by agent, because one side can go quiet alone. */
  byRole: Record<"consultant" | "coach", { replies: number; marked: number }>;
}

export const EMPTY_AUDIT: MemoryAudit = {
  replies: 0, withMemory: 0, projects: 0, lessons: [],
  byRole: { consultant: { replies: 0, marked: 0 }, coach: { replies: 0, marked: 0 } },
};

/** Enough history to see a trend, few enough rows to stay a single round trip. */
const MAX_PROJECTS = 60;
const MAX_MESSAGES = 1500;
const MAX_LESSONS = 60;

export async function loadMemoryAudit(): Promise<MemoryAudit> {
  const supabase = createClient();

  const { data: projects, error: pErr } = await supabase
    .from("agxp_projects")
    .select("id,name")
    .order("last_activity_at", { ascending: false })
    .limit(MAX_PROJECTS);
  if (pErr) throw pErr;
  if (!projects?.length) return EMPTY_AUDIT;

  const names = new Map(projects.map(p => [p.id as string, (p.name as string) || "Project"]));

  const { data: msgs, error: mErr } = await supabase
    .from("agxp_project_messages")
    .select("project_id,content,column_type")
    .in("project_id", [...names.keys()])
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);
  if (mErr) throw mErr;

  const audit: MemoryAudit = {
    ...EMPTY_AUDIT,
    projects: projects.length,
    lessons: [],
    byRole: { consultant: { replies: 0, marked: 0 }, coach: { replies: 0, marked: 0 } },
  };
  const seen = new Set<string>();
  const touched = new Set<string>();

  for (const m of msgs ?? []) {
    const role = m.column_type === "coach" ? "coach" : "consultant";
    audit.replies++;
    audit.byRole[role].replies++;
    touched.add(m.project_id as string);

    const notes = parseMarkers(m.content as string).memories;
    if (!notes.length) continue;
    audit.withMemory++;
    audit.byRole[role].marked++;

    for (const n of notes) {
      const key = n.fact.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key) || audit.lessons.length >= MAX_LESSONS) continue;
      seen.add(key);
      audit.lessons.push({
        kind: n.kind, fact: n.fact, role,
        project: names.get(m.project_id as string) ?? "Project",
      });
    }
  }

  audit.projects = touched.size;
  return audit;
}

/** One in how many replies teaches the agent something, as a percentage. */
export function rate(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}
