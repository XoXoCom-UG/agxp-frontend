"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import type { AgentMemory } from "@/lib/agent-memory";
import type { MemoryNote } from "@/lib/message-markers";
import type { Deliverable } from "@/lib/deliverables";
import { methodLabel } from "@/lib/method-labels";
import { levelFor, nextLevel, LEVEL_ORDER } from "@/lib/agent-progress";
import { usePresence, phaseClass } from "@/lib/use-presence";
import { AgentMascot, type MascotState, type MascotMood, type LookTarget } from "@/components/layout/agent-mascot";
import type { DeliverableDoc } from "@/components/layout/deliverable-view";
import { DeliverableRail } from "@/components/layout/deliverable-rail";
import { IconDoc, IconChevronDown, IconMinimise } from "@/components/layout/agxp-icons";

/** How many remembered facts the profile lists before "and N more". */
const LESSONS_SHOWN = 3;

/** What to show in the profile: this session's lessons first (they are the
 *  new thing), then the older ones, deduplicated by fact. */
function shownLessons(learned: MemoryNote[], memory: AgentMemory) {
  const seen = new Set<string>();
  const out: { fact: string; fresh: boolean }[] = [];
  for (const l of [...learned].reverse()) {
    const key = l.fact.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ fact: l.fact, fresh: true });
  }
  for (const l of memory.lessons) {
    const key = l.fact.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ fact: l.fact, fresh: false });
  }
  return out;
}

export interface HeadDocState {
  pct: number;
  stationIdx: number;
  stationLabel: string;
  /** From the agent's own marker — a capped plan has fewer than the agenda. */
  totalStations: number;
  /** The version Open shows — the newest, or the one Restore brought back. */
  currentDoc: DeliverableDoc | null;
  currentVersion: number;
  restored: boolean;
  versions: { version: number; createdAt: string }[];
}

/**
 * The panel's head. Everything about the agent and the document lives behind
 * two small buttons — the panel itself is the conversation and nothing else.
 */
export function ChatHead({
  role, agent, deliverable, mascot, attentive, stuck, headExtra, unread, sending,
  totalProjects, memory, learned, doc,
  onFocusPanel, onMinimise, onChangeAgent, onOpenVersion, onGenerate, onRegenerate, onRestoreVersion,
}: {
  role: AgentType;
  agent: Agent;
  deliverable: Deliverable;
  mascot: { orb: MascotState; mood: MascotMood; lookAt: LookTarget };
  attentive: boolean;
  /** Content has scrolled beneath the head, so it shows its hairline. */
  stuck: boolean;
  headExtra?: React.ReactNode;
  unread: boolean;
  sending: boolean;
  totalProjects: number;
  memory: AgentMemory;
  learned: MemoryNote[];
  doc: HeadDocState;
  onFocusPanel?: () => void;
  onMinimise?: () => void;
  /** Asks first (the panel owns the dialog). */
  onChangeAgent?: () => void;
  onOpenVersion: (version: number) => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onRestoreVersion: (version: number) => void;
}) {
  /** Which head popover is open: the agent profile, or the document. */
  const [pop, setPop] = useState<"agent" | "doc" | null>(null);
  const headRef = useRef<HTMLDivElement>(null);

  // Click anywhere else, or press Escape, and the head popover closes.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (headRef.current && !headRef.current.contains(e.target as Node)) setPop(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setPop(null); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  // Both head popovers play the same scale/fade in and a faster fade out
  // (.t-dropdown in agxp-design.css), instead of one animating and the
  // other vanishing the instant it closes.
  const agentPopPhase = usePresence(pop === "agent");
  const docPopPhase = usePresence(pop === "doc");

  // The agent levels up on the work it has actually done for this user; this
  // project is one of them, so compare against the count without it to know
  // whether joining here is what pushed it up a level.
  const level = levelFor(totalProjects);
  const leveledUp = levelFor(Math.max(0, totalProjects - 1)) !== level;
  const { next, remaining } = nextLevel(totalProjects);
  const lessons = shownLessons(learned, memory);
  const { pct, currentDoc } = doc;
  const ready = pct >= 100;

  return (
    <div className={`chat-head${stuck ? " is-stuck" : ""}`} ref={headRef}>
      <button className="who-btn" aria-expanded={pop === "agent"}
        onClick={() => setPop(p => (p === "agent" ? null : "agent"))}>
        <span className="who-face">
          <AgentMascot role={role} state={mascot.orb} size={56} enter
            attentive={attentive} mood={mascot.mood} agentId={agent.id} lookAt={mascot.lookAt} />
        </span>
        <span className="who-txt">
          <span className="n">{agent.name}</span>
          {/* The role and nothing else. No "waiting", no "thinking", no
              station counter: the mascot and the stream already say whether
              the agent is doing anything, and a second, blue, changing word
              beside the name only added noise (Ana, 2026-09-28). */}
          <span className="r"><span className={`role-dot ${role}`} />
            {role === "coach" ? "Coach" : "Consultant"}
          </span>
        </span>
        <IconChevronDown size={11} />
      </button>

      {headExtra}

      <button data-tour="rail" className={`doc-pill${ready ? " ready" : ""}${currentDoc ? " done" : ""}`}
        style={{ ["--fill" as string]: (currentDoc ? 100 : pct) / 100 }}
        aria-expanded={pop === "doc"} data-tooltip={deliverable.title}
        aria-label={`${deliverable.title}, ${currentDoc ? "ready" : `${pct}% ready`}`}
        onClick={() => setPop(p => (p === "doc" ? null : "doc"))}>
        <IconDoc size={12} />
        <span>{currentDoc ? "ready" : `${pct}%`}</span>
      </button>

      {/* The waiting panel says so itself. The badge is the control —
          clicking it hands this conversation the room and clears the mark,
          so the unread state has somewhere to go other than the seam button. */}
      {unread && onFocusPanel && (
        <button className="head-unread" onClick={onFocusPanel}
          data-tooltip={`Read what ${agent.name} said`}>
          <span className="hu-dot" aria-hidden="true" />New
        </button>
      )}

      {/* The Coach is not always needed and takes room. Folding it away
          leaves the pill, which is anchored high on purpose so it never
          covers the composer. */}
      {onMinimise && (
        <button className="head-min" onClick={onMinimise}
          data-tooltip="Fold away. The Coach keeps listening."
          aria-label="Fold this panel away">
          <IconMinimise size={14} />
        </button>
      )}

      {agentPopPhase !== "closed" && (
        <div className={`popover head-pop t-dropdown${phaseClass(agentPopPhase)}`}
          data-origin="top-left" onClick={e => e.stopPropagation()}>
          <div className="hp-stats">
            <div>
              <span className="lbl">Experience</span>
              <div className="level">
                <b>{level}</b>
                <span className="level-bar">
                  {LEVEL_ORDER.map((l, i) => (
                    <span key={l} className={`level-seg ${i <= LEVEL_ORDER.indexOf(level) ? "on" : ""}`} />
                  ))}
                </span>
                {leveledUp && <span className="level-up">Level up</span>}
              </div>
              {next && <div className="level-hint">{remaining} more project{remaining === 1 ? "" : "s"} to {next}</div>}
            </div>
            <div><span className="lbl">Projects together</span><b>{totalProjects}</b></div>
            {onChangeAgent && (
              <button className="btn btn-hero btn-sm hp-change" onClick={() => { setPop(null); onChangeAgent(); }}>
                Change agent
              </button>
            )}
          </div>
          {agent.tagline && <div className="hp-grp"><span className="lbl">Role</span><div className="val">{agent.tagline}</div></div>}
          {lessons.length > 0 && (
            <div className="hp-grp">
              <span className="lbl">
                Remembers about you
                {learned.length > 0 && <em className="mem-new">+{learned.length} new</em>}
              </span>
              <ul className="plist mem">
                {lessons.slice(0, LESSONS_SHOWN).map(l => (
                  <li key={l.fact} className={l.fresh ? "fresh" : undefined}>{l.fact}</li>
                ))}
                {lessons.length > LESSONS_SHOWN && <li className="muted">and {lessons.length - LESSONS_SHOWN} more</li>}
              </ul>
            </div>
          )}
          {agent.primaryMethods.length > 0 && (
            <div className="hp-grp">
              <span className="lbl">Can help with</span>
              <ul className="plist">
                {[...agent.primaryMethods, ...agent.secondaryMethods].map(m => (
                  <li key={m.id}>{methodLabel(m.name)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {docPopPhase !== "closed" && (
        <div
          className={`popover head-pop artf-pop t-dropdown${phaseClass(docPopPhase)}`}
          data-origin="top-right"
          onClick={e => e.stopPropagation()}
        >
          <DeliverableRail
            title={deliverable.title}
            totalStations={doc.totalStations}
            pct={pct}
            stationIdx={doc.stationIdx}
            stationLabel={doc.stationLabel}
            currentDoc={currentDoc}
            version={doc.currentVersion}
            restored={doc.restored}
            versions={doc.versions}
            sending={sending}
            onOpen={() => { setPop(null); onOpenVersion(doc.currentVersion); }}
            onGenerate={onGenerate}
            onRegenerate={onRegenerate}
            onOpenVersion={v => { setPop(null); onOpenVersion(v); }}
            onRestoreVersion={onRestoreVersion}
          />
        </div>
      )}
    </div>
  );
}
