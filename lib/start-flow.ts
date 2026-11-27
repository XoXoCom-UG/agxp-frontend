import { createClient } from "@/lib/supabase";
import { listAllMethods, createAgent, type Agent } from "@/lib/agents";
import { assignAgent, type Project } from "@/lib/projects";
import { TYPE_CATALOG, kindFor, type TypeTemplate } from "@/lib/agent-types";
import type { StartPlan } from "@/lib/start-plan";
import type { MethodDraft } from "@/lib/method-draft";

/**
 * The client half of the Prompt Pad (meeting 2026-11-20): ask the server which
 * consultant fits, then put the team into the project — the consultant the
 * user already has for that type, or a new one, and an Assistant beside it.
 * Nobody picks from a list; nobody names anything.
 */

export class StartError extends Error {}

/** What the server says the project needs. Throws a StartError with words for the person. */
export async function requestStartPlan(prompt: string): Promise<StartPlan> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new StartError("Your session has expired. Sign in again.");
  let res: Response;
  try {
    res = await fetch("/api/agent/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt }),
    });
  } catch {
    throw new StartError("The connection failed. Check your internet and try again.");
  }
  const json = await res.json().catch(() => null) as (Partial<StartPlan> & { error?: string }) | null;
  if (!res.ok) throw new StartError(json?.error || "Choosing a consultant failed. Try again.");
  if (!json?.kind || !Array.isArray(json.methods)) throw new StartError("Choosing a consultant failed. Try again.");
  return { kind: json.kind, reason: json.reason ?? "", methods: json.methods };
}

/**
 * The first draft of every method of this consultant type, written from the
 * pad's text while the person reads the plan. Throws a StartError on failure;
 * the caller treats that as "no draft", never as something to show.
 */
export async function requestMethodDraft(prompt: string, kind: string): Promise<MethodDraft[]> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new StartError("Your session has expired. Sign in again.");
  const res = await fetch("/api/agent/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt, kind }),
  }).catch(() => null);
  const json = await res?.json().catch(() => null) as { drafts?: MethodDraft[]; error?: string } | null;
  if (!res?.ok || !Array.isArray(json?.drafts)) throw new StartError(json?.error || "The first draft could not be written.");
  return json.drafts;
}

export function templateById(kind: string): TypeTemplate {
  return TYPE_CATALOG.consultant.find(t => t.id === kind) ?? TYPE_CATALOG.consultant[0];
}

/** The consultants the user already has that work as this type. */
export function existingFor(kind: string, agents: Agent[]): Agent[] {
  return agents.filter(a => a.type === "consultant" && !a.archived_at && kindFor(a) === kind);
}

async function make(type: "consultant" | "coach", tpl: TypeTemplate): Promise<Agent> {
  const all = await listAllMethods();
  const methodIds = all.filter(m => tpl.primary.includes(m.name) || tpl.secondary.includes(m.name)).map(m => m.id);
  if (methodIds.length === 0) throw new StartError("None of this type's methods are in the database yet, so it can't be created.");
  return createAgent({ type, name: tpl.type, description: "", tagline: tpl.sub, methodIds });
}

/**
 * Puts the team into the project. `reuse` is a consultant the user already has;
 * without it a new one is made from the plan's type. The Assistant is the
 * user's own when there is one, otherwise a new one — and if that cannot be
 * made (a plan limit) the project simply starts without it: the Assistant is
 * a help, not a precondition.
 */
export async function activateTeam(input: {
  plan: StartPlan;
  reuse: Agent | null;
  agents: Agent[];
  ensureProject: () => Promise<Project>;
}): Promise<{ project: Project; created: Agent[] }> {
  const { plan, reuse, agents, ensureProject } = input;
  const created: Agent[] = [];
  let project = await ensureProject();

  const consultant = reuse ?? await make("consultant", templateById(plan.kind));
  if (!reuse) created.push(consultant);
  project = await assignAgent(project.id, "consultant", consultant.id, "Consultant selected", project);

  try {
    const r = await addAssistant(project, agents);
    project = r.project;
    created.push(...r.created);
  } catch { /* the Assistant tab offers to add it */ }
  return { project, created };
}

/**
 * Puts the user's Assistant into the project: the one they have, otherwise a
 * new one. Throws when neither works (a plan limit), so the caller can say so.
 */
export async function addAssistant(project: Project, agents: Agent[]): Promise<{ project: Project; created: Agent[] }> {
  let assistant: Agent | null = agents.find(a => a.type === "coach" && !a.archived_at) ?? null;
  const created: Agent[] = [];
  if (!assistant) {
    assistant = await make("coach", TYPE_CATALOG.coach[0]);
    created.push(assistant);
  }
  return { project: await assignAgent(project.id, "coach", assistant.id, "Assistant selected", project), created };
}
