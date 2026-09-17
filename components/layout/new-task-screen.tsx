"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProject, createBlankProject, clearAgent, type Project } from "@/lib/projects";
import { listAgents, type Agent, type AgentType } from "@/lib/agents";
import { projectCountsByAgent } from "@/lib/agent-progress";
import { AgentNav } from "@/components/layout/agent-nav";
import { AgentPickerPanel } from "@/components/layout/agent-picker-panel";
import { ProjectChatPanel } from "@/components/layout/project-chat-panel";
import { IconArrow } from "@/components/layout/agxp-icons";
import { usePanelSizeStore } from "@/lib/panel-size-store";

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
  const creating = useRef<Promise<Project> | null>(null);
  // Gates entering the live chat until the Consultant is picked — a single
  // Start button instead of the panel jumping to chat on its own. Coach can
  // join later, mid-conversation, via its own still-independent picker.
  const [started, setStarted] = useState(false);
  const { swapped, toggle: toggleSwap } = usePanelSizeStore();

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    Promise.all([
      projectId ? getProject(projectId) : Promise.resolve(null),
      listAgents(),
      projectCountsByAgent().catch(() => ({} as Record<string, number>)),
    ])
      .then(([p, a, counts]) => {
        if (!alive) return;
        setProject(p); setAgents(a); setProjectCounts(counts);
        // Resuming an already-fully-assigned project (opened from Project
        // History) skips the Start gate — it only guards a fresh selection.
        if (p?.coach_agent_id && p?.consultant_agent_id) setStarted(true);
      })
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

  // "Change agent" (reached from the chat panel's own ⋯ menu, not a popup at
  // selection time — Ana's call, matching v8) drops the assignment so
  // panelFor falls back to the picker for that role.
  async function changeAgent(role: AgentType) {
    if (!project) return;
    setProject(await clearAgent(project.id, role));
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
    // Consultant leads (70%) by default. Two ways that flips to Coach-led:
    // the manual toggle in the Coach chat-head (lib/panel-size-store.ts),
    // or — pre-Start only — Coach growing to invite picking it once the
    // Consultant alone has been chosen. Either way resets to normal the
    // moment the live chat opens (`started`), so the nudge never lingers.
    const consultantOnly = !!project?.consultant_agent_id && !project?.coach_agent_id;
    const coachLeads = swapped || (!started && consultantOnly);
    const flexGrow = coachLeads
      ? (role === "consultant" ? 1 : 2.3)
      : (role === "consultant" ? 2.3 : 1);

    if (project && assigned && started) {
      return (
        <ProjectChatPanel key={role} project={project} role={role} agent={assigned} flexGrow={flexGrow}
          projectCount={projectCounts[assigned.id] ?? 0}
          onProjectNamed={name => setProject(p => p && { ...p, name })}
          onChangeAgent={() => changeAgent(role)} />
      );
    }
    return (
      <AgentPickerPanel key={role} role={role} project={project} agents={agents} flexGrow={flexGrow}
        ensureProject={ensureProject}
        projectCounts={projectCounts}
        assignedAgent={assigned}
        onChangeAgent={assigned ? () => changeAgent(role) : undefined}
        onAssigned={handleAssigned}
        onAgentCreated={a => setAgents(prev => [...prev, a])} />
    );
  }

  if (authLoading || !token || loadingData) return (
    <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" style={{ width: 24, height: 24, borderColor: "var(--border-strong)", borderTopColor: "var(--primary)" }} />
    </div>
  );

  const consultantAssigned = !!project?.consultant_agent_id;

  return (
    <div className="app">
      <AgentNav startEnabled={consultantAssigned} onStart={!started ? () => setStarted(true) : undefined} />
      <div className="view-root view-enter">
        {/* Consultant leads (wide, left) — Coach supports (narrow, right). */}
        <main className="workspace">
          {panelFor("consultant")}
          <button className="icon-btn workspace-swap-btn"
            data-tooltip={swapped ? "Reset panel sizes" : "Give Coach more room"}
            onClick={() => toggleSwap()}>
            <IconArrow style={{ transform: swapped ? "none" : "rotate(180deg)" }} />
          </button>
          {panelFor("coach")}
        </main>
      </div>
    </div>
  );
}
