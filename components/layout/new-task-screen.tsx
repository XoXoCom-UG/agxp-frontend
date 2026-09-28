"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProject, createBlankProject, clearAgent, type Project } from "@/lib/projects";
import { listAgents, type Agent, type AgentType } from "@/lib/agents";
import { projectCountsByAgent } from "@/lib/agent-progress";
import type { PanelSnapshot, PeerContext } from "@/lib/peer-context";
import { useChatSplit, broadcastSplit, clampShare, MIN_SHARE, MAX_SHARE } from "@/lib/chat-split";
import { useMediaQuery } from "@/lib/use-media-query";
import { describeDbError } from "@/lib/db-error";
import { AgentNav } from "@/components/layout/agent-nav";
import { AgentPickerPanel } from "@/components/layout/agent-picker-panel";
import { ProjectChatPanel } from "@/components/layout/project-chat-panel";
import { DeliverableView, type DeliverableDoc } from "@/components/layout/deliverable-view";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconSwap, IconAlert, IconX } from "@/components/layout/agxp-icons";

/** Where the Coach is right now: beside the Consultant, or folded into the pill.
 *  Ana, 2026-09-27: the pill docks straight back — no overlay sheet in between. */
type CoachMode = "split" | "min";

const OTHER: Record<AgentType, AgentType> = { coach: "consultant", consultant: "coach" };
const ROLES: AgentType[] = ["consultant", "coach"];
const ROLE_NAME: Record<AgentType, string> = { consultant: "Consultant", coach: "Coach" };
/** The same breakpoint the stylesheet stacks the panels at. */
const STACKED_QUERY = "(max-width:1000px)";

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
  /** The project or the agent list could not be read. Carrying on with empty
   *  data would show "no agents" and, worse, create a fresh project on the
   *  first pick instead of reopening this one — so the screen stops here. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Bumped by Retry to run the load effect again. */
  const [loadAttempt, setLoadAttempt] = useState(0);
  /** Dropping an agent failed; the panel still shows the old one. */
  const [changeError, setChangeError] = useState<{ role: AgentType; message: string } | null>(null);
  /** The stylesheet stacks the panels below 1000px. What counts as "the
   *  conversation you are looking at" depends on it, so JS has to know too. */
  const stacked = useMediaQuery(STACKED_QUERY);
  /** Side by side, both panels are on screen; number-key shortcuts go to the
   *  one the user last clicked or tabbed into. */
  const [lastPanel, setLastPanel] = useState<AgentType>("consultant");
  const uid = useId();
  const tabRefs = useRef<Partial<Record<AgentType, HTMLButtonElement | null>>>({});
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
  /** Manual override of the split: give the Coach the room instead. The two
   *  panels stay where they are — only the widths trade (Ana, 2026-09-27). */
  const [swapped, setSwapped] = useState(false);
  const [coachMode, setCoachMode] = useState<CoachMode>("split");
  /** The Coach is coming back from the pill: its slot eases in instead of
   *  appearing in one frame. Only then — not on first load. */
  const [unfolding, setUnfolding] = useState(false);
  /** The saved preference, shared with the Settings sheet through the store.
   *  While the seam is being dragged, `live` takes over so the panels follow
   *  the pointer without writing to storage on every frame. */
  const savedShare = useChatSplit();
  const [live, setLive] = useState<number | null>(null);
  /** The same value, readable from the pointerup handler without going
   *  through a state updater — broadcasting from inside one updated the
   *  Settings subscriber while this screen was still rendering. */
  const liveRef = useRef<number | null>(null);
  const leadShare = live ?? savedShare;
  const dragging = live !== null;
  const wsRef = useRef<HTMLElement>(null);
  // What each panel is saying about itself. This screen is the only place that
  // can see both conversations, so it is where one is handed to the other.
  const [snaps, setSnaps] = useState<Partial<Record<AgentType, PanelSnapshot>>>({});

  function swapSides() { setSwapped(v => !v); }
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
      // The Consultant is always on the left. When the Coach leads, the lead
      // panel is the right one, so the ratio is taken from the other side.
      const leftFrac = Math.min(0.92, Math.max(0.08, (ev.clientX - box.left) / Math.max(1, box.width)));
      const next = clampShare(coachLeads ? (1 - leftFrac) / leftFrac : leftFrac / (1 - leftFrac));
      liveRef.current = next;
      setLive(next);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      // pointercancel fires when the gesture is taken over (a touch turning
      // into a scroll, the tab losing focus). Without it the listeners stay
      // on and the panels keep resizing on every later mouse move.
      window.removeEventListener("pointercancel", stop);
      endDrag.current = null;
      const v = liveRef.current;
      liveRef.current = null;
      setLive(null);
      if (v !== null) broadcastSplit(v);
    };
    endDrag.current = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  /** The seam is a control, so it works from the keyboard too. */
  function nudgeSplit(step: number) {
    // Arrow right widens the left panel, whichever one is leading.
    const next = clampShare(leadShare + (coachLeads ? -step : step));
    broadcastSplit(next);
  }

  /** Home and End jump to the ends of the range. Home is the narrowest the
   *  left panel gets, so which end of the share that is depends on who leads. */
  function splitToEdge(edge: "start" | "end") {
    const leftNarrow = coachLeads ? MAX_SHARE : MIN_SHARE;
    const leftWide = coachLeads ? MIN_SHARE : MAX_SHARE;
    broadcastSplit(edge === "start" ? leftNarrow : leftWide);
  }

  /** The left (Consultant) panel's width in percent, for the separator's value. */
  function leftPercent(s: number): number {
    return Math.round(((coachLeads ? 1 : s) / (s + 1)) * 100);
  }

  const creating = useRef<Promise<Project> | null>(null);

  function showPane(role: AgentType) {
    setPane(role);
    setUnseen(u => (u[role] ? { ...u, [role]: false } : u));
    // A folded Coach has no slot on screen, so picking its tab would leave
    // the stacked layout blank.
    if (role === "coach" && coachMode === "min") { setUnfolding(true); setCoachMode("split"); }
  }

  /** Arrow keys move between the two tabs, the way a tablist is expected to. */
  function onTabKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = ROLES.indexOf(pane);
    const next = e.key === "ArrowRight" ? ROLES[(i + 1) % ROLES.length]
      : e.key === "ArrowLeft" ? ROLES[(i - 1 + ROLES.length) % ROLES.length]
      : e.key === "Home" ? ROLES[0]
      : e.key === "End" ? ROLES[ROLES.length - 1]
      : null;
    if (!next) return;
    e.preventDefault();
    showPane(next);
    tabRefs.current[next]?.focus();
  }

  /** The lead of the split: the wide one, or the Consultant when the Coach is folded. */
  const leadRole: AgentType = coachMode !== "split" ? "consultant" : swapped ? "coach" : "consultant";
  /** Which conversation the user is actually looking at right now. Stacked,
   *  that is the tab on screen — the split's lead means nothing there. */
  const viewedRole: AgentType = stacked ? pane : leadRole;
  /** Where number-key shortcuts go. Stacked: the visible pane. Side by side:
   *  the panel last touched, unless the Coach is folded away. */
  const keyboardRole: AgentType = stacked ? pane : coachMode === "split" ? lastPanel : "consultant";
  /** Before Start, a chosen Consultant hands the room to the empty Coach seat
   *  — that is the screen asking you to finish the pair. */
  const coachLeads = coachMode === "split"
    && (swapped || (!started && !!project?.consultant_agent_id && !project?.coach_agent_id));

  /** Hands a panel the room and clears its unread mark. */
  function focusPanel(role: AgentType) {
    setUnseen(u => (u[role] ? { ...u, [role]: false } : u));
    setLastPanel(role);
    // Stacked, "the room" is the screen itself: switch to that tab. Swapping
    // the split there would change nothing visible and surprise the user
    // the next time the window is wide.
    if (stacked) setPane(role);
    if (role === "coach" && coachMode === "min") { setUnfolding(true); setCoachMode("split"); return; }
    if (!stacked && role !== leadRole && coachMode === "split") swapSides();
  }

  // The panel calls onActivity from the end of a stream, through the closure
  // it had when the message was sent. Read from a ref so switching tabs while
  // the answer streams still counts against where you are looking now.
  const viewedRef = useRef<AgentType>(viewedRole);
  useEffect(() => { viewedRef.current = viewedRole; }, [viewedRole]);

  function noteActivity(role: AgentType) {
    // Unread means "answered somewhere you weren't looking": the stacked tab
    // you're not on, the narrow half of the split, or the folded-away Coach.
    setUnseen(u => (role === viewedRef.current || u[role] ? u : { ...u, [role]: true }));
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
      .catch(e => { if (alive) setLoadError(describeDbError(e, "Loading this task")); })
      .finally(() => { if (alive) setLoadingData(false); });
    return () => { alive = false; };
  }, [token, projectId, loadAttempt]);

  function retryLoad() {
    setLoadError(null);
    setLoadingData(true);
    setLoadAttempt(n => n + 1);
  }

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
    setChangeError(null);
    try {
      setProject(await clearAgent(project.id, role));
    } catch (e) {
      // Nothing changed on the server, so the panel is right to keep showing
      // the old agent — it just has to say why the click did nothing.
      setChangeError({ role, message: describeDbError(e, `Changing the ${ROLE_NAME[role]}`) });
    }
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
          idle={role !== viewedRole}
          keyboardActive={role === keyboardRole}
          unread={unseen[role]}
          onSnapshot={s => handleSnapshot(role, s)}
          onFocusPanel={() => focusPanel(role)}
          onMinimise={role === "coach" && coachMode === "split" ? () => {
            setUnfolding(false); setCoachMode("min");
            // Stacked, the Coach tab would otherwise point at nothing.
            if (stacked) showPane("consultant");
          } : undefined}
          headExtra={role === "consultant" && foldedCoach ? coachPill(true) : undefined}
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
    return coachLeads ? (role === "consultant" ? 1 : leadShare) : (role === "consultant" ? leadShare : 1);
  }

  const coachAgent = agents.find(a => a.id === project?.coach_agent_id) ?? null;
  const coachSnap = snaps.coach;
  /** The pill only makes sense once there is a Coach with something to say. */
  const foldedCoach = coachMode !== "split" && !!coachAgent && started;
  /** Is the Consultant a live chat, with a head the pill can sit in? */
  const consultantChatting = !!project?.consultant_agent_id && started
    && agents.some(a => a.id === project?.consultant_agent_id);

  /** K1: folded away, the Coach is a hand raised in the Consultant's head,
   *  next to the document button — no gutter of its own above the row, and
   *  nothing over the conversation or the answer buttons. */
  function coachPill(inHead: boolean) {
    const name = coachAgent?.name ?? "The Coach";
    return (
      <button className={`coach-pill${inHead ? " in-head" : ""}${unseen.coach ? " raised" : ""}`}
        onClick={() => focusPanel("coach")}
        aria-label={inHead
          ? `${unseen.coach ? `${name} has something to add. ` : ""}Open ${coachAgent?.name ?? "the Coach"} beside the Consultant`
          : undefined}>
        <span className="cp-face">
          <AgentMascot role="coach" state={coachSnap?.busy ? "thinking" : "idle"} size={30} agentId={coachAgent?.id} />
          {unseen.coach && <span className="cp-dot" aria-hidden="true" />}
        </span>
        <span className="cp-txt">
          <span className="cp-n">
            {unseen.coach ? `${name} has something to add` : coachAgent?.name}
          </span>
          <span className="cp-l">{coachSnap?.lastLine ?? "Your coach is listening in."}</span>
        </span>
      </button>
    );
  }

  if (authLoading || !token || loadingData) return (
    <div className="app is-loading" role="status">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span className="visually-hidden">Loading…</span>
    </div>
  );

  if (loadError) return (
    <div className="app">
      <AgentNav />
      <main className="view-root view-enter" id="main-content" tabIndex={-1}>
        <h1 className="visually-hidden">New task</h1>
        <div className="inline-error is-page" role="alert">
          <IconAlert size={16} />
          <div className="ie-text">
            <p className="ie-title">This task could not be loaded.</p>
            <p className="ie-detail">{loadError}</p>
          </div>
          <button className="btn btn-ghost" onClick={retryLoad}>Retry</button>
        </div>
      </main>
    </div>
  );

  const pctNow = leftPercent(leadShare);
  const pctEdges = [leftPercent(MIN_SHARE), leftPercent(MAX_SHARE)];
  const tabId = (role: AgentType) => `${uid}-tab-${role}`;
  const panelId = (role: AgentType) => `${uid}-panel-${role}`;
  /** Stacked, each slot is the tabpanel of its switcher tab. Side by side
   *  the tabs are hidden, so the slots are plain regions of the page. */
  const slotProps = (role: AgentType) => ({
    id: panelId(role),
    ...(stacked ? { role: "tabpanel" as const, "aria-labelledby": tabId(role) } : {}),
    onPointerDown: () => setLastPanel(role),
    onFocus: () => setLastPanel(role),
  });

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
            so switching never loses a conversation or a half-typed message.
            Roving tabindex: Tab lands on the selected tab, arrows move. */}
        <div className="pane-switch" role="tablist" aria-label="Choose panel" onKeyDown={onTabKey}>
          {ROLES.map(role => {
            const id = role === "coach" ? project?.coach_agent_id : project?.consultant_agent_id;
            const name = agents.find(a => a.id === id)?.name;
            return (
              <button key={role} role="tab" id={tabId(role)} aria-selected={pane === role}
                aria-controls={panelId(role)} tabIndex={pane === role ? 0 : -1}
                ref={el => { tabRefs.current[role] = el; }}
                className={`ps-tab ${pane === role ? "on" : ""}`} onClick={() => showPane(role)}>
                <span className={`role-dot ${role}`} aria-hidden="true" />
                {ROLE_NAME[role]}
                {name && <span className="who">{name}</span>}
                {unseen[role] && <><span className="ps-dot" aria-hidden="true" /><span className="visually-hidden">, new reply</span></>}
              </button>
            );
          })}
        </div>

        {changeError && (
          <div className="inline-error" role="alert">
            <IconAlert size={14} />
            <p className="ie-detail">{changeError.message}</p>
            <button className="btn btn-ghost" onClick={() => changeAgent(changeError.role)}>Retry</button>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => setChangeError(null)}><IconX size={12} /></button>
          </div>
        )}

        {/* Consultant leads (left, wide) — Coach supports (right). Each panel
            sits in a slot that owns the split, so the Coach can fold away
            without ever leaving the tree and remounting. The skip link lands
            here, past the header and the switcher. */}
        <main ref={wsRef} id="main-content" tabIndex={-1}
          className={`workspace${dragging ? " resizing" : ""}`}
          data-active={pane} data-coach={coachMode}
          data-pill={foldedCoach && coachMode === "min" && !consultantChatting ? "float" : undefined}>
          {/* The screen has no visible title — Patryk wanted it clean — but a
              screen reader still needs to know where it is. */}
          <h1 className="visually-hidden">{project?.name && project.name !== "New Project" ? project.name : "New task"}</h1>
          <div className="slot" data-role="consultant" style={{ flexGrow: share("consultant") }} {...slotProps("consultant")}>
            {panelFor("consultant")}
          </div>

          {coachMode === "split" && (
            /* The seam does two jobs: drag it to resize, press the button in
               the middle to hand the room to the other conversation. One
               strip, because two controls on a 16px gap is a coin toss.
               The separator is an empty layer under the strip rather than
               the strip itself: a separator's children are presentational,
               so a button inside one would vanish for screen readers. */
            <div className={`seam${dragging ? " dragging" : ""}`} onPointerDown={startDrag}>
              <div className="seam-handle"
                role="separator" aria-orientation="vertical" tabIndex={0}
                aria-label="Resize the conversations"
                aria-valuenow={pctNow}
                aria-valuemin={Math.min(...pctEdges)} aria-valuemax={Math.max(...pctEdges)}
                aria-valuetext={`Consultant ${pctNow}%, Coach ${100 - pctNow}%`}
                onKeyDown={e => {
                  if (e.key === "ArrowLeft") { e.preventDefault(); nudgeSplit(-0.25); }
                  else if (e.key === "ArrowRight") { e.preventDefault(); nudgeSplit(0.25); }
                  else if (e.key === "Home") { e.preventDefault(); splitToEdge("start"); }
                  else if (e.key === "End") { e.preventDefault(); splitToEdge("end"); }
                }} />
              <span className="seam-rail" aria-hidden="true" />
              <button className={`swap-panels${swapped ? " flipped" : ""}`}
                onPointerDown={e => e.stopPropagation()} onClick={swapSides}
                data-tooltip={swapped ? "Give the Consultant more room" : "Give the Coach more room"}
                aria-label={swapped ? "Give the Consultant more room" : "Give the Coach more room"}>
                <IconSwap size={13} />
              </button>
              <span className="seam-rail" aria-hidden="true" />
            </div>
          )}

          {/* Folded away it is `display:none`, which already takes it out of
              the tab order and the accessibility tree — but it stays mounted,
              so a reply still streaming into it survives the fold. */}
          <div className={`slot coach-slot ${coachMode}${unfolding ? " unfolding" : ""}`} data-role="coach" style={{ flexGrow: share("coach") }} {...slotProps("coach")}>
            {panelFor("coach")}
          </div>

          {/* Only when the Consultant has no chat head to hold it (its agent
              was changed mid-project): then the pill floats in the corner. */}
          {foldedCoach && coachMode === "min" && !consultantChatting && coachPill(false)}
        </main>

      </div>

      {openDoc && <DeliverableView doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </div>
  );
}
