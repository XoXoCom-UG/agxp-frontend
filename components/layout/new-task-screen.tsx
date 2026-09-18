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
import { DeliverableView, type DeliverableDoc } from "@/components/layout/deliverable-view";
import { IconSwap } from "@/components/layout/agxp-icons";

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
  /** Gates the live chat behind one Start button instead of the panel jumping
   *  into the conversation the moment an agent is picked (Patryk, 2026-09-11;
   *  built this way in Ana's repo). */
  const [started, setStarted] = useState(false);
  /** Manual override of the split: give the Coach the room instead. */
  const [swapped, setSwapped] = useState(false);
  /** True for the length of the swap, so the panels can animate across. */
  const [swapping, setSwapping] = useState(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (swapTimer.current) clearTimeout(swapTimer.current); }, []);

  function swapSides() {
    setSwapped(v => !v);
    setSwapping(true);
    if (swapTimer.current) clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(() => setSwapping(false), 420);
  }
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
      .then(([p, a, counts]) => {
        if (!alive) return;
        setProject(p); setAgents(a); setProjectCounts(counts);
        // Opened from Project History with both agents already on it — the
        // Start gate guards a fresh selection, not a return visit.
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

  /** Drops the assignment so the panel falls back to its picker. */
  async function changeAgent(role: AgentType) {
    if (!project) return;
    setProject(await clearAgent(project.id, role));
  }

  function panelFor(role: AgentType) {
    const assignedId = role === "coach" ? project?.coach_agent_id : project?.consultant_agent_id;
    const assigned = agents.find(a => a.id === assignedId) ?? null;

    // The Consultant leads. Two things hand the room to the Coach: the manual
    // toggle, or — before Start — having picked the Consultant and not the
    // Coach, which is the screen inviting you to finish the pair.
    const consultantOnly = !!project?.consultant_agent_id && !project?.coach_agent_id;
    const coachLeads = swapped || (!started && consultantOnly);
    const grow = coachLeads
      ? (role === "consultant" ? 1 : 2.3)
      : (role === "consultant" ? 2.3 : 1);

    if (project && assigned && started) {
      return (
        <ProjectChatPanel key={role} project={project} role={role} agent={assigned} grow={grow}
          projectCount={projectCounts[assigned.id] ?? 0}
          onActivity={() => noteActivity(role)}
          onOpenDoc={setOpenDoc}
          onChangeAgent={() => changeAgent(role)}
          onProjectNamed={name => setProject(p => p && { ...p, name })} />
      );
    }
    return (
      <AgentPickerPanel key={role} role={role} project={project} agents={agents} grow={grow}
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

  return (
    <div className="app">
      <AgentNav
        startEnabled={!!project?.consultant_agent_id}
        startHint={!started && !!project?.consultant_agent_id && !!project?.coach_agent_id}
        onStart={started ? undefined : () => setStarted(true)} />
      {/* No page title and no description: clicking "New Task" should show the
          two agents and nothing else (Patryk, 2026-09-11 — "wenn es so clean
          ist, weiß der User sofort, was als nächstes zu tun ist"). */}
      <div className="view-root view-enter">
        {/* Only shown once the layout stacks (CSS) — both panels stay mounted,
            so switching never loses a conversation or a half-typed message. */}
        <div className="pane-switch" role="tablist" aria-label="Choose panel">
          {(["consultant", "coach"] as AgentType[]).map(role => {
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

        {/* Consultant leads (left, wide) — Coach supports (right). */}
        <main className={`workspace${swapping ? " swapping" : ""}`} data-active={pane}>
          {panelFor("consultant")}
          <button className={`swap-panels${swapped ? " flipped" : ""}`} onClick={swapSides}
            data-tooltip={swapped ? "Give the Consultant the room" : "Give the Coach the room"}
            aria-label="Change how the room is split">
            <IconSwap size={13} />
          </button>
          {panelFor("coach")}
        </main>

      </div>

      {openDoc && <DeliverableView doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </div>
  );
}
