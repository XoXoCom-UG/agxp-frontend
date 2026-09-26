"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProject, createBlankProject, clearAgent, type Project } from "@/lib/projects";
import { listAgents, type Agent, type AgentType } from "@/lib/agents";
import { projectCountsByAgent } from "@/lib/agent-progress";
import type { PanelSnapshot, PeerContext } from "@/lib/peer-context";
import { useChatSplit, broadcastSplit, clampShare } from "@/lib/chat-split";
import { AgentNav } from "@/components/layout/agent-nav";
import { AgentPickerPanel } from "@/components/layout/agent-picker-panel";
import { ProjectChatPanel } from "@/components/layout/project-chat-panel";
import { DeliverableView, type DeliverableDoc } from "@/components/layout/deliverable-view";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconSwap, IconX, IconExpand } from "@/components/layout/agxp-icons";

/** Where the Coach is right now. The Consultant always holds the room. */
type CoachMode = "split" | "min" | "sheet";

const OTHER: Record<AgentType, AgentType> = { coach: "consultant", consultant: "coach" };

/**
 * The start screen: a narrow Coach panel beside a wide Consultant panel.
 * Each panel independently shows either the picker or the live conversation,
 * so there is no separate "setup" step and no "Enter Workspace" click.
 *
 * With no `projectId` this is a draft — nothing is written to the database
 * until the user actually picks an agent (`ensureProject`), so abandoned
 * starts don't leave empty projects behind.
 *
 * Agreed with Patryk on 2026-09-25: the two chats share one screen at equal
 * standing, and the Coach can be folded away when it is only taking up room.
 * Three states, one mounted panel — the Coach is never unmounted, so a reply
 * still streaming when you fold it away is still there when you open it.
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
  const [coachMode, setCoachMode] = useState<CoachMode>("split");
  /** The saved preference, shared with the Settings sheet through the store.
   *  While the seam is being dragged, `live` takes over so the panels follow
   *  the pointer without writing to storage on every frame. */
  const savedShare = useChatSplit();
  const [live, setLive] = useState<number | null>(null);
  const leadShare = live ?? savedShare;
  const dragging = live !== null;
  const wsRef = useRef<HTMLElement>(null);
  // What each panel is saying about itself. This screen is the only place that
  // can see both conversations, so it is where one is handed to the other.
  const [snaps, setSnaps] = useState<Partial<Record<AgentType, PanelSnapshot>>>({});
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (swapTimer.current) clearTimeout(swapTimer.current); }, []);

  function swapSides() {
    setSwapped(v => !v);
    setSwapping(true);
    if (swapTimer.current) clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(() => setSwapping(false), 420);
  }
  /**
   * Dragging the seam. The ratio is worked out from where the pointer is in
   * the row rather than from a delta, so it can't drift after a few drags,
   * and it is written to storage once on release instead of on every frame.
   */
  const endDrag = useRef<(() => void) | null>(null);
  // A drag interrupted by an unmount would otherwise leave two window
  // listeners resizing a panel that no longer exists.
  useEffect(() => () => endDrag.current?.(), []);

  function startDrag(e: React.PointerEvent<HTMLElement>) {
    const box = wsRef.current?.getBoundingClientRect();
    if (!box) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      // The lead panel is always the left one: swapping reverses the row, so
      // whoever holds the room is on the left either way.
      const leadFrac = (ev.clientX - box.left) / Math.max(1, box.width);
      setLive(clampShare(leadFrac / Math.max(0.08, 1 - leadFrac)));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      // pointercancel fires when the gesture is taken over (a touch turning
      // into a scroll, the tab losing focus). Without it the listeners stay
      // on and the panels keep resizing on every later mouse move.
      window.removeEventListener("pointercancel", stop);
      endDrag.current = null;
      setLive(v => { if (v !== null) broadcastSplit(v); return null; });
    };
    endDrag.current = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  /** The seam is a control, so it works from the keyboard too. */
  function nudgeSplit(step: number) {
    const next = clampShare(leadShare + step);
    broadcastSplit(next);
  }

  const creating = useRef<Promise<Project> | null>(null);

  function showPane(role: AgentType) {
    setPane(role);
    setUnseen(u => (u[role] ? { ...u, [role]: false } : u));
  }

  /** Which conversation the user is actually looking at right now. */
  const leadRole: AgentType = coachMode !== "split" ? "consultant" : swapped ? "coach" : "consultant";

  /** Hands a panel the room and clears its unread mark. */
  function focusPanel(role: AgentType) {
    setUnseen(u => (u[role] ? { ...u, [role]: false } : u));
    if (role === "coach" && coachMode === "min") { setCoachMode("sheet"); return; }
    if (role !== leadRole && coachMode === "split") swapSides();
  }

  function noteActivity(role: AgentType) {
    // Unread means "answered somewhere you weren't looking": the stacked tab
    // you're not on, the narrow half of the split, or the folded-away Coach.
    setUnseen(u => (role === pane || role === leadRole || u[role] ? u : { ...u, [role]: true }));
  }

  // Stable so the panels' publish effect isn't re-armed on every render.
  const handleSnapshot = useCallback((role: AgentType, s: PanelSnapshot) => {
    setSnaps(prev => {
      const old = prev[role];
        if (old && old.name === s.name && old.transcript === s.transcript
        && old.lastLine === s.lastLine && old.busy === s.busy
        && old.agentTurns === s.agentTurns) return prev;
      return { ...prev, [role]: s };
    });
  }, []);

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

  /** What the agent on the other side of the screen has been told so far. */
  function peerFor(role: AgentType): PeerContext | undefined {
    const other = OTHER[role];
    const s = snaps[other];
    if (!s?.transcript) return undefined;
    return { role: other, name: s.name, transcript: s.transcript, turns: s.agentTurns };
  }

  function panelFor(role: AgentType) {
    const assignedId = role === "coach" ? project?.coach_agent_id : project?.consultant_agent_id;
    const assigned = agents.find(a => a.id === assignedId) ?? null;

    if (project && assigned && started) {
      return (
        <ProjectChatPanel key={role} project={project} role={role} agent={assigned}
          projectCount={projectCounts[assigned.id] ?? 0}
          peer={peerFor(role)}
          idle={role !== leadRole}
          unread={unseen[role]}
          onSnapshot={s => handleSnapshot(role, s)}
          onFocusPanel={() => focusPanel(role)}
          onMinimise={role === "coach" && coachMode === "split" ? () => setCoachMode("min") : undefined}
          onActivity={() => noteActivity(role)}
          onOpenDoc={setOpenDoc}
          onChangeAgent={() => changeAgent(role)}
          onProjectNamed={name => setProject(p => p && { ...p, name })} />
      );
    }
    return (
      <AgentPickerPanel key={role} role={role} project={project} agents={agents}
        ensureProject={ensureProject}
        projectCounts={projectCounts}
        assignedAgent={assigned}
        onChangeAgent={assigned ? () => changeAgent(role) : undefined}
        onAssigned={handleAssigned}
        onAgentCreated={a => setAgents(prev => [...prev, a])} />
    );
  }

  /** How the row is divided. The lead conversation gets the room; before
   *  Start, a chosen Consultant hands it to the empty Coach seat — that is
   *  the screen asking you to finish the pair. */
  function share(role: AgentType): number {
    if (coachMode !== "split") return role === "consultant" ? 1 : 0;
    const consultantOnly = !!project?.consultant_agent_id && !project?.coach_agent_id;
    const coachLeads = swapped || (!started && consultantOnly);
    return coachLeads ? (role === "consultant" ? 1 : leadShare) : (role === "consultant" ? leadShare : 1);
  }

  const coachAgent = agents.find(a => a.id === project?.coach_agent_id) ?? null;
  const coachSnap = snaps.coach;
  /** The pill only makes sense once there is a Coach with something to say. */
  const foldedCoach = coachMode !== "split" && !!coachAgent && started;

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

        {/* Consultant leads (left, wide) — Coach supports (right). Each panel
            sits in a slot that owns the split, so the Coach can become an
            overlay sheet without ever leaving the tree and remounting. */}
        <main ref={wsRef}
          className={`workspace${swapping ? " swapping" : ""}${dragging ? " resizing" : ""}${swapped && coachMode === "split" ? " swapped" : ""}`}
          data-active={pane} data-coach={coachMode}>
          <div className="slot" data-role="consultant" style={{ flexGrow: share("consultant") }}>
            {panelFor("consultant")}
          </div>

          {coachMode === "split" && (
            /* The seam does two jobs: drag it to resize, press the button in
               the middle to swap sides. One strip, because two separate
               controls on a 16px gap is a coin toss every time you aim. */
            <div className={`seam${dragging ? " dragging" : ""}`} onPointerDown={startDrag}
              role="separator" aria-orientation="vertical" tabIndex={0}
              aria-label="Resize the conversations"
              onKeyDown={e => {
                if (e.key === "ArrowLeft") { e.preventDefault(); nudgeSplit(-0.25); }
                if (e.key === "ArrowRight") { e.preventDefault(); nudgeSplit(0.25); }
              }}
              aria-valuenow={Math.round((leadShare / (leadShare + 1)) * 100)} aria-valuemin={50} aria-valuemax={78}>
              <span className="seam-rail" />
              <button className={`swap-panels${swapped ? " flipped" : ""}`}
                onPointerDown={e => e.stopPropagation()} onClick={swapSides}
                data-tooltip={swapped ? "Put the Consultant back on the left" : "Move the Coach to the left"}
                aria-label="Swap the two sides">
                <IconSwap size={13} />
              </button>
              <span className="seam-rail" />
            </div>
          )}

          {coachMode === "sheet" && (
            <button className="coach-scrim" aria-label="Close the Coach"
              onClick={() => setCoachMode("min")} />
          )}

          {/* Folded away it is `display:none`, which already takes it out of
              the tab order and the accessibility tree — but it stays mounted,
              so a reply still streaming into it survives the fold. */}
          <div className={`slot coach-slot ${coachMode}`} data-role="coach" style={{ flexGrow: share("coach") }}>
            {coachMode === "sheet" && (
              <div className="sheet-grip">
                <button className="sg-btn" onClick={() => setCoachMode("split")}
                  data-tooltip="Put the Coach back beside the Consultant">
                  <IconExpand size={12} />Dock
                </button>
                <button className="sg-btn" onClick={() => setCoachMode("min")}
                  data-tooltip="Fold away again" aria-label="Fold the Coach away">
                  <IconX size={12} />
                </button>
              </div>
            )}
            {panelFor("coach")}
          </div>

          {/* K1: folded away, the Coach is a hand raised in the corner. Anchored
              to the top right on purpose (Patryk, 2026-09-25 — "der sollte nur
              ein bisschen weiter oben sein, damit er nicht die Sicht versperrt
              auf den Chat, auf die Buttons"). */}
          {foldedCoach && coachMode === "min" && (
            <button className={`coach-pill${unseen.coach ? " raised" : ""}`}
              onClick={() => focusPanel("coach")}>
              <span className="cp-face">
                <AgentMascot role="coach" state={coachSnap?.busy ? "thinking" : "idle"} size={34} />
                {unseen.coach && <span className="cp-dot" aria-hidden="true" />}
              </span>
              <span className="cp-txt">
                <span className="cp-n">
                  {unseen.coach ? `${coachAgent?.name} möchte etwas sagen` : coachAgent?.name}
                </span>
                <span className="cp-l">{coachSnap?.lastLine ?? "Your coach is listening in."}</span>
              </span>
            </button>
          )}
        </main>

      </div>

      {openDoc && <DeliverableView doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </div>
  );
}
