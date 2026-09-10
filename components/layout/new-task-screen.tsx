"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProject, createBlankProject, PLACEHOLDER_PROJECT_NAME, type Project } from "@/lib/projects";
import { listAgents, type Agent, type AgentType } from "@/lib/agents";
import { projectCountsByAgent } from "@/lib/agent-progress";
import { AgentNav } from "@/components/layout/agent-nav";
import { AgentPickerPanel } from "@/components/layout/agent-picker-panel";
import { ProjectChatPanel } from "@/components/layout/project-chat-panel";
import { DeliverableView, type DeliverableDoc } from "@/components/layout/deliverable-view";

/**
 * The start screen: a narrow Coach panel beside a wide Consultant panel.
 * Each panel independently shows either the picker or the live conversation,
 * so there is no separate "setup" step and no "Enter Workspace" click.
 *
 * With no `projectId` this is a draft — nothing is written to the database
 * until the user actually picks an agent (`ensureProject`), so abandoned
 * starts don't leave empty projects behind.
 */
export function NewTaskScreen({ projectId }: { projectId?: string }) {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [loadingData, setLoadingData] = useState(true);
  /** The document being read right now, opened from the chat or the rail. */
  const [openDoc, setOpenDoc] = useState<DeliverableDoc | null>(null);
  // Below ~1000px both panels don't fit side by side, so one is on screen at a
  // time. `unseen` marks the hidden one when its agent answers — otherwise you
  // lose half the conversation without noticing.
  const [pane, setPane] = useState<AgentType>("consultant");
  const [unseen, setUnseen] = useState<Record<AgentType, boolean>>({ coach: false, consultant: false });
  const creating = useRef<Promise<Project> | null>(null);

  function showPane(role: AgentType) {
    setPane(role);
    setUnseen(u => (u[role] ? { ...u, [role]: false } : u));
  }

  function noteActivity(role: AgentType) {
    setUnseen(u => (role === pane || u[role] ? u : { ...u, [role]: true }));
  }

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    Promise.all([
      projectId ? getProject(projectId) : Promise.resolve(null),
      listAgents(),
      projectCountsByAgent().catch(() => ({} as Record<string, number>)),
    ])
      .then(([p, a, counts]) => { if (!alive) return; setProject(p); setAgents(a); setProjectCounts(counts); })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingData(false); });
    return () => { alive = false; };
  }, [token, projectId]);

  // An agent that just joined a project may have crossed a level threshold —
  // refresh the counts so the Steckbrief shows it right away.
  function handleAssigned(p: Project) {
    setProject(p);
    projectCountsByAgent().then(setProjectCounts).catch(() => {});
  }

  // Creates the row on first real use and points the URL at it without
  // remounting this screen (a router.push here would throw away panel state).
  async function ensureProject(): Promise<Project> {
    if (project) return project;
    if (!creating.current) {
      creating.current = createBlankProject().then(p => {
        setProject(p);
        window.history.replaceState(null, "", `/dashboard/project/${p.id}`);
        return p;
      });
    }
    return creating.current;
  }

  function panelFor(role: AgentType) {
    const assignedId = role === "coach" ? project?.coach_agent_id : project?.consultant_agent_id;
    const assigned = agents.find(a => a.id === assignedId) ?? null;
    const isPrimary = role === "consultant";

    if (project && assigned) {
      return (
        <ProjectChatPanel key={role} project={project} role={role} agent={assigned} primary={isPrimary}
          projectCount={projectCounts[assigned.id] ?? 0}
          onActivity={() => noteActivity(role)}
          onOpenDoc={setOpenDoc}
          onProjectNamed={name => setProject(p => p && { ...p, name })} />
      );
    }
    return (
      <AgentPickerPanel key={role} role={role} project={project} agents={agents} primary={isPrimary}
        ensureProject={ensureProject}
        projectCounts={projectCounts}
        onAssigned={handleAssigned}
        onAgentCreated={a => setAgents(prev => [...prev, a])} />
    );
  }

  if (authLoading || !token || loadingData) return (
    <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" style={{ width: 24, height: 24, borderColor: "var(--border-strong)", borderTopColor: "var(--primary)" }} />
    </div>
  );

  const named = !!project && project.name !== PLACEHOLDER_PROJECT_NAME;

  return (
    <div className="app">
      <AgentNav projectName={project?.name} projectId={project?.id} />
      <div className="view-root view-enter">
        <div className="page-head">
          <div>
            <h1>{named ? project!.name : "New Task"}</h1>
            <p>Pick a coach and a consultant. They ask the questions, you get the answers.</p>
          </div>
        </div>

        {/* Only shown once the layout stacks (CSS) — both panels stay mounted,
            so switching never loses a conversation or a half-typed message. */}
        <div className="pane-switch" role="tablist" aria-label="Choose panel">
          {(["coach", "consultant"] as AgentType[]).map(role => {
            const id = role === "coach" ? project?.coach_agent_id : project?.consultant_agent_id;
            const name = agents.find(a => a.id === id)?.name;
            return (
              <button key={role} role="tab" aria-selected={pane === role}
                className={`ps-tab ${pane === role ? "on" : ""}`} onClick={() => showPane(role)}>
                <span className={`role-dot ${role}`} />
                {role === "coach" ? "Coach" : "Consultant"}
                {name && <span className="who">{name}</span>}
                {unseen[role] && <span className="ps-dot" aria-label="New reply" />}
              </button>
            );
          })}
        </div>

        {/* Coach supports (narrow, left) — Consultant leads (wide, right). */}
        <main className="workspace" data-active={pane}>
          {panelFor("coach")}
          {panelFor("consultant")}
        </main>

      </div>

      {openDoc && <DeliverableView doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </div>
  );
}
