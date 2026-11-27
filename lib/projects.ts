import { createClient } from "@/lib/supabase";
import { loadEntitlement, QuotaError } from "@/lib/entitlement";
import type { AgentType } from "@/lib/agents";
import { worthNaming, firstMessageName } from "@/lib/project-title";
import { removeProjectFolder } from "@/lib/project-files";
import { resumeLine, type ResumeLine } from "@/lib/resume-line";

export type ProjectStatus = "Not Started" | "In Progress" | "Completed" | "Archived";

export interface ActivityEntry {
  t: string; // what happened
  d: string; // human date label, e.g. "Just now" or "Jul 18, 2026"
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  /** One of INDUSTRY_LABELS (lib/industry.ts), once the agent knows it. */
  category: string | null;
  type: string;
  status: ProjectStatus;
  coach_agent_id: string | null;
  consultant_agent_id: string | null;
  activity: ActivityEntry[];
  created_at: string;
  last_activity_at: string;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  column_type: AgentType;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

function addActivity(activity: ActivityEntry[], t: string): ActivityEntry[] {
  return [{ t, d: "Just now" }, ...activity].slice(0, 20);
}

// Every project used to require a manual "Create Project" form up front — a
// name, a description, a type — before you could even get to picking agents.
// Patryk's review (2026-09-02): no manual step at all. "New Task" creates a
// blank project silently and drops the user straight into the agent picker;
// the project gets a real name later, from the first message (see
// renameFromFirstMessage below), the way the old Matfit chat did it.
export const PLACEHOLDER_PROJECT_NAME = "New Project";

export async function createBlankProject(): Promise<Project> {
  return createProject({ name: PLACEHOLDER_PROJECT_NAME });
}

/** Backfills the placeholder name from the first message actually sent, once. */
export async function renameFromFirstMessage(project: Project, text: string): Promise<string | null> {
  if (project.name !== PLACEHOLDER_PROJECT_NAME) return null;
  // A greeting is no name; the agent titles the project once it is clear.
  if (!worthNaming(text)) return null;
  const name = firstMessageName(text);
  await renameProject(project.id, name);
  return name;
}

export async function listProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("agxp_projects").select("*").order("last_activity_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

/** The last few projects that have a consultant and a real name, newest first —
 *  "pick up where you left off" on the start screen. Only the columns it shows. */
export type RecentProject = Pick<Project, "id" | "name" | "consultant_agent_id" | "last_activity_at"> & { line: ResumeLine | null };

export async function listRecentProjects(n = 3): Promise<RecentProject[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("agxp_projects")
    .select("id, name, consultant_agent_id, last_activity_at, status")
    .not("consultant_agent_id", "is", null)
    .neq("name", PLACEHOLDER_PROJECT_NAME)
    .neq("status", "Archived")
    .order("last_activity_at", { ascending: false })
    .limit(n);
  if (error) throw error;
  const rows = (data ?? []) as Pick<Project, "id" | "name" | "consultant_agent_id" | "last_activity_at">[];
  // Where each one stands: the consultant's last reply, as one line. A failed
  // read only leaves the line out — the projects themselves are still worth showing.
  const lines = new Map<string, ResumeLine | null>();
  if (rows.length) {
    const { data: msgs } = await supabase.from("agxp_project_messages")
      .select("project_id, content")
      .in("project_id", rows.map(r => r.id))
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(rows.length * 6);
    for (const m of (msgs ?? []) as { project_id: string; content: string }[]) {
      if (!lines.has(m.project_id)) lines.set(m.project_id, resumeLine(m.content));
    }
  }
  return rows.map(r => ({ ...r, line: lines.get(r.id) ?? null }));
}

/** Is there any project that is not archived? A count, not every row with
 *  its activity log — the start screen only needs yes or no. */
export async function hasOpenProjects(): Promise<boolean> {
  const supabase = createClient();
  const { count, error } = await supabase.from("agxp_projects")
    .select("id", { count: "exact", head: true }).neq("status", "Archived");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("agxp_projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Project | null;
}

export async function createProject(input: { name: string; description?: string; type?: string }): Promise<Project> {
  const supabase = createClient();
  // The session this browser already holds, not a round trip to the auth
  // server: the insert policy checks owner_id against the verified token anyway.
  const { data: sessionData } = await supabase.auth.getSession();
  const ownerId = sessionData.session?.user?.id;
  if (!ownerId) throw new Error("Nicht angemeldet.");

  // The visible allowance. This stops the action early and explains why; it
  // is not the cost control — that is the token ceiling in the chat route,
  // which runs server-side and cannot be edited from the browser. Read fresh:
  // a count from half a minute ago may not include the last project.
  const left = await loadEntitlement(true);
  if (left.projectsLeft <= 0) {
    throw new QuotaError(
      left.plan.period === "week"
        ? `You have used all ${left.plan.projects} projects on the ${left.plan.label} plan this week. The allowance resets on Monday.`
        : `You have used all ${left.plan.projects} projects on the ${left.plan.label} plan this month.`,
    );
  }

  const { data, error } = await supabase
    .from("agxp_projects")
    .insert({
      owner_id: ownerId,
      name: input.name,
      description: input.description || null,
      type: input.type || "AI Transformation",
      status: "Not Started",
      activity: [{ t: "Project created", d: "Just now" }],
    })
    .select("*")
    .single();
  if (error) throw error;
  // The badge and the next check count this one; nobody waits for it.
  loadEntitlement(true).catch(() => {});
  return data as Project;
}

/**
 * `known` is the project as the screen already holds it. Reading it again
 * first only fetched the activity log to prepend one line, and put a whole
 * round trip between the click on Select and the panel changing.
 */
export async function assignAgent(projectId: string, column: AgentType, agentId: string, agentActionLabel: string, known?: Project): Promise<Project> {
  const supabase = createClient();
  const project = known?.id === projectId ? known : await getProject(projectId);
  if (!project) throw new Error("Projekt nicht gefunden.");

  const patch: Record<string, unknown> = {
    activity: addActivity(project.activity, agentActionLabel),
    last_activity_at: new Date().toISOString(),
  };
  patch[column === "coach" ? "coach_agent_id" : "consultant_agent_id"] = agentId;
  if (project.status === "Not Started") patch.status = "In Progress";

  const { data, error } = await supabase.from("agxp_projects").update(patch).eq("id", projectId).select("*").single();
  if (error) throw error;
  return data as Project;
}

export async function clearAgent(projectId: string, column: AgentType): Promise<Project> {
  const supabase = createClient();
  const patch: Record<string, unknown> = {};
  patch[column === "coach" ? "coach_agent_id" : "consultant_agent_id"] = null;
  const { data, error } = await supabase.from("agxp_projects").update(patch).eq("id", projectId).select("*").single();
  if (error) throw error;
  return data as Project;
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("agxp_projects").update({ name }).eq("id", projectId);
  if (error) throw error;
}

/**
 * The name and one-line description the agent gave the project
 * ([[TITLE: Name | description]], parsed in lib/message-markers.ts).
 *
 * Patryk, 2026-10-09: the AI should find a good title, not the first 55
 * characters of whatever the user happened to type first.
 */
export async function setProjectTitle(projectId: string, name: string, description: string): Promise<void> {
  const supabase = createClient();
  const patch: { name: string; description?: string } = { name: name.slice(0, 80) };
  // An empty description must not wipe one that is already there.
  if (description) patch.description = description.slice(0, 160);
  const { error } = await supabase.from("agxp_projects").update(patch).eq("id", projectId);
  if (error) throw error;
}

/** The project's category, from the agent's [[INDUSTRY:]] marker. */
export async function setProjectCategory(projectId: string, category: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("agxp_projects").update({ category }).eq("id", projectId);
  if (error) throw error;
}

/**
 * Removes this user's projects that never got a message, except `keep` — the
 * one on screen. Picking an agent creates the row (assignAgent needs it), so a
 * start that is abandoned would otherwise stay in the history and keep counting
 * against the plan. See migration 0013.
 */
export async function discardEmptyProjects(keep?: string | null): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("discard_empty_projects", { keep: keep ?? null });
  if (error) throw error;
  // Since 0030 the ids that went, so their unsent attachments can follow
  // through the Storage API; before it, a count.
  if (Array.isArray(data)) {
    await Promise.all((data as string[]).map(id => removeProjectFolder(id).catch(() => {})));
    return data.length;
  }
  return typeof data === "number" ? data : 0;
}

/** This one project, if it never got a message — called when its screen is left. */
export async function discardEmptyProject(projectId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("discard_empty_project", { target: projectId });
  if (error) throw error;
  if (data === true) await removeProjectFolder(projectId).catch(() => {});
  return data === true;
}

export async function archiveProject(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("agxp_projects").update({ status: "Archived" }).eq("id", projectId);
  if (error) throw error;
}

export async function touchProjectActivity(projectId: string, label: string): Promise<void> {
  const supabase = createClient();
  const project = await getProject(projectId);
  if (!project) return;
  await supabase.from("agxp_projects").update({
    activity: addActivity(project.activity, label),
    last_activity_at: new Date().toISOString(),
  }).eq("id", projectId);
}

export async function listMessages(projectId: string, column: AgentType): Promise<ProjectMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("agxp_project_messages")
    .select("*")
    .eq("project_id", projectId)
    .eq("column_type", column)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectMessage[];
}

/** A message the person wrote. The agent's replies are stored by the chat
 *  route with the service role; RLS refuses them from here (migration 0019). */
export async function addMessage(projectId: string, column: AgentType, role: "user", content: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("agxp_project_messages")
    .insert({ project_id: projectId, column_type: column, role, content })
    .select("id").single();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

/** One message. Allowed by the owner-delete policy (migration 0004). */
export async function deleteMessage(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("agxp_project_messages").delete().eq("id", id);
  if (error) throw error;
}

export async function clearMessages(projectId: string, column: AgentType): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("agxp_project_messages").delete().eq("project_id", projectId).eq("column_type", column);
  if (error) throw error;
}
