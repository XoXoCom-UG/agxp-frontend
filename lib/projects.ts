import { createClient } from "@/lib/supabase";
import type { AgentType } from "@/lib/agents";

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

export async function listProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("agxp_projects").select("*").order("last_activity_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("agxp_projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Project | null;
}

export async function createProject(input: { name: string; description?: string; type?: string }): Promise<Project> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const ownerId = userData.user?.id;
  if (!ownerId) throw new Error("Nicht angemeldet.");

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
  return data as Project;
}

export async function assignAgent(projectId: string, column: AgentType, agentId: string, agentActionLabel: string): Promise<Project> {
  const supabase = createClient();
  const project = await getProject(projectId);
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

export async function addMessage(projectId: string, column: AgentType, role: "user" | "assistant", content: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("agxp_project_messages").insert({ project_id: projectId, column_type: column, role, content });
  if (error) throw error;
}

export async function clearMessages(projectId: string, column: AgentType): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("agxp_project_messages").delete().eq("project_id", projectId).eq("column_type", column);
  if (error) throw error;
}
