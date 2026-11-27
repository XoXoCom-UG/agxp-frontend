"use client";

import { useMemo, useState } from "react";
import type { PanelSnapshot } from "@/lib/peer-context";
import type { DeliverableDoc } from "@/components/layout/deliverable-view";
import type { Deliverable } from "@/lib/deliverables";
import type { DraftState } from "@/lib/method-draft";
import { md, handleCodeCopyClick } from "@/lib/markdown";
import { ArtifactActions, versionLine } from "@/components/layout/deliverable-rail";
import { IconArrow, IconCheck, IconChevronDown, IconDoc, IconLock, IconMinimise, IconSpark } from "@/components/layout/agxp-icons";
import { useT } from "@/lib/language";
import { AgentMascot } from "@/components/layout/agent-mascot";

/** How far the interview has to be before the document can be asked for. */
const GENERATE_FROM_PCT = 60;

/**
 * The right-hand side of the workspace, when it is not the Coach.
 *
 * Agreed with Patryk on 2026-10-09 (01:01:46): a newcomer who sees a
 * Consultant on the left and a Coach on the right is asked to understand two
 * agents before doing anything, so the right side opens on what is being
 * BUILT instead, and the Coach is one tab away.
 *
 * Two states, and the first replaces the second (Ana, 2026-10-15):
 *   - while the interview runs: the progress card and every question, always
 *     in view, the one being worked on breathing;
 *   - once the Transformation Concept exists: the questions are gone, the
 *     header carries the version and its actions, and the document itself fills
 *     the panel.
 *
 * Methods that fill in live while the user talks need their own marker in the
 * chat protocol and come in a later phase.
 */
export function MethodsPanel({ tabs, agentId, deliverable, draft, snap, onOpenDoc, onMinimise }: {
  /** Methods or Coach — drawn in the header, inside the card. */
  tabs?: React.ReactNode;
  /** The project's consultant: its face, at its own level, speaks in the Cockpit. */
  agentId?: string | null;
  /** What the Consultant is working toward — its title and its questions. It
   *  depends on the agent's type, so the screen works it out. */
  deliverable: Deliverable;
  /** The first draft of each method, written in the background when the consultant was chosen. */
  draft?: DraftState | null;
  /** What the Consultant's panel last published: progress, document, controls. */
  snap: PanelSnapshot | undefined;
  /** Opens the document in the full reading view. */
  onOpenDoc: (doc: DeliverableDoc) => void;
  onMinimise?: () => void;
}) {
  const tr = useT();
  const d = deliverable;
  const rail = snap?.rail;
  const controls = snap?.controls;
  const doc = rail?.currentDoc ?? null;

  // A plan may cover fewer stations than the full agenda; the agent says how many.
  const stations = d.stations.slice(0, rail?.totalStations ?? d.stations.length);
  // What the plan leaves out: the stations past the ones this conversation has.
  const locked = d.stations.slice(stations.length);
  const finished = !!doc;
  // No method is "in progress" until the interview has begun: it is optional,
  // and the consultant drafts every method before asking anything.
  const nowIdx = finished ? -1 : (rail?.stationIdx ?? -1);

  const html = useMemo(() => (doc ? md(doc.content) : ""), [doc]);
  const draftText = useMemo(() => new Map((draft?.drafts ?? []).map(x => [x.label, x.text])), [draft]);
  const drafting = draft?.status === "pending";
  /** The one method unfolded in the list, and those the consultant has already talked through. */
  const [open, setOpen] = useState<string | null>(null);
  const [talked, setTalked] = useState<Set<string>>(() => new Set());
  /** Stations the interview jumped over with "Start here": open, not done. */
  const [leftOpen, setLeftOpen] = useState<Set<string>>(() => new Set());

  // A draft is half the way, a method the interview has passed is all of it:
  // the bar counts both, the words say which (a draft is not "ready").
  const doneCount = stations.filter((s, i) => i < nowIdx && !leftOpen.has(s.label)).length;
  const drafted = stations.filter((s, i) => i > nowIdx && draftText.has(s.label)).length;
  const fill = Math.round(((doneCount + drafted / 2) / Math.max(1, stations.length)) * 100);
  const countLine = doneCount === 0 && drafted > 0
    ? tr("{n} of {total} drafted", { n: drafted, total: stations.length })
    : tr("{done} of {total} done", { done: doneCount, total: stations.length });
  const pct = snap?.pct ?? 0;
  /** What the consultant says above the list: the one thing to do next. */
  const hint = drafting
    ? tr("I'm writing a first draft of every method…")
    : snap?.busy
      ? tr("One moment, I'm answering in the chat.")
      : nowIdx >= 0 && pct >= GENERATE_FROM_PCT
        ? tr("That's enough for a document. Shall I write it?")
        : nowIdx >= 0
          ? tr("We're on {label}. Answer me in the chat.", { label: stations[nowIdx]?.label ?? "" })
          : draftText.size > 0
            ? tr("Here's a first draft. Open a method, or let me improve all of them.")
            : tr("Open a method and I'll talk it through with you.");

  return (
    <section className={`panel methods-panel${finished ? " is-ready" : ""}`} aria-labelledby="mp-title">
      <header className="mp-head">
        <div className="mp-head-row">
          {tabs}
          {onMinimise && (
            <button className="head-min mp-tool" onClick={onMinimise}
              data-tooltip={tr("Fold away")} aria-label={tr("Fold this panel away")}>
              <IconMinimise size={14} />
            </button>
          )}
        </div>
        <div className="mp-head-txt">
          <h2 id="mp-title" className="mp-title">{tr("Consulting Methods")}</h2>
          {/* Once there is a document: its name and version. */}
          {doc && rail && <p className="mp-sub">{`${d.title} · ${versionLine(rail.version, doc.createdAt, rail.restored, tr)}`}</p>}
        </div>

        {/* Before the document: how far it is, as a bar that fills, and the
            consultant saying in one line what to do next (2026-11-27, the same
            voice as the step-by-step start). */}
        {!finished && (
          <div className="ck-head">
            <div className="ck-progress">
              <div className="wz-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={fill} aria-valuetext={countLine} aria-label={tr("Methods ready")}>
                <span style={{ width: `${Math.max(4, fill)}%` }} />
              </div>
              <span className="ck-count">{countLine}</span>
            </div>
            <div className="ck-say">
              <span className="ck-face" aria-hidden="true">
                <AgentMascot role="consultant" size={40} agentId={agentId} state={snap?.busy || drafting ? "thinking" : "idle"} />
              </span>
              <p className="ck-bubble" aria-live="polite">{hint}</p>
            </div>
          </div>
        )}

        {doc && rail && controls && (
          <div className="mp-actions" data-tour="rail">
            <ArtifactActions
              sending={snap?.busy ?? false}
              versions={rail.versions}
              current={rail.version}
              onOpen={() => onOpenDoc(doc)}
              onRegenerate={controls.regenerate}
              onOpenVersion={controls.openVersion}
              onRestoreVersion={controls.restoreVersion}
            />
          </div>
        )}
      </header>

      <div className="mp-body">
        {/* The methods as one list: a dot and a word for how far each one is,
            its name, and nothing else until it is opened. Opening one only
            shows its draft (no call to the model); under it, three ways in:
            talk it through, start the interview here, or do only this one
            first (2026-11-27). */}
        {!finished && (
          <ul className="ck-list" data-tour="rail">
            {stations.map((s, i) => {
              const passed = i < nowIdx && !leftOpen.has(s.label);
              const state = passed ? "done" : i === nowIdx ? "now" : draftText.has(s.label) ? "draft" : "todo";
              const isOpen = open === s.label;
              const body = draftText.get(s.label) ?? s.note;
              const busy = !controls || (snap?.busy ?? false);
              return (
                <li key={s.label} className={`ck-item ${state}${isOpen ? " open" : ""}`} aria-current={state === "now" ? "step" : undefined}>
                  <button type="button" className="ck-row" aria-expanded={isOpen}
                    disabled={!controls}
                    onClick={() => setOpen(isOpen ? null : s.label)}>
                    <span className="ck-dot" aria-hidden="true">{state === "done" && <IconCheck size={10} />}</span>
                    <span className="ck-label">{s.label}</span>
                    {/* The state in a word, not only a dot: readable at a glance. */}
                    {state !== "todo" && (
                      <span className={`ck-tag ${state}`}>{tr(state === "done" ? "Done" : state === "now" ? "Now" : "Draft")}</span>
                    )}
                    <IconChevronDown size={14} className="ck-chev" />
                    <span className="visually-hidden">{tr(state === "done" ? ", done" : state === "now" ? ", in progress" : state === "draft" ? ", drafted" : ", not yet")}</span>
                  </button>
                  {isOpen && (
                    <div className="ck-more">
                      {drafting && !draftText.has(s.label)
                        ? <span className="mp-step-d is-wait" aria-hidden="true" />
                        : body && <p className="ck-text">{body}</p>}
                      {controls && (
                        <div className="ck-actions">
                          <button type="button" className="sh-btn sh-primary" disabled={busy}
                            onClick={() => { setTalked(t => new Set(t).add(s.label)); controls.discuss(s.label); }}>
                            {tr(talked.has(s.label) ? "Talk it through again" : "Talk it through")}
                          </button>
                          {state !== "now" && (
                            <button type="button" className="sh-btn" disabled={busy}
                              title={tr("The interview continues from here. The steps before stay open.")}
                              onClick={() => {
                                // The stations between where the interview was and here are not done, only left open.
                                setLeftOpen(prev => {
                                  const next = new Set(prev);
                                  for (let k = Math.max(0, nowIdx); k < i; k++) next.add(stations[k].label);
                                  next.delete(s.label);
                                  return next;
                                });
                                controls.jump(s.label, i + 1, stations.length);
                              }}>
                              <IconArrow size={13} />{tr("Start here")}
                            </button>
                          )}
                          {state !== "now" && (
                            <button type="button" className="sh-btn" disabled={busy}
                              title={tr("Only this method now, then back to where you were.")}
                              onClick={() => controls.focus(s.label, i + 1, stations.length)}>
                              {tr("Only this one first")}
                            </button>
                          )}
                          {state === "now" && rail?.canSkip && (
                            <button type="button" className="sh-btn sh-ghost" disabled={busy} onClick={controls.skip}>
                              {tr("Skip this step")}<IconArrow size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {locked.map(s => (
              <li key={s.label} className="ck-item locked">
                <span className="ck-row" aria-disabled="true">
                  <span className="ck-dot" aria-hidden="true"><IconLock size={9} /></span>
                  <span className="ck-label">{s.label}</span>
                  <span className="visually-hidden">{tr(", locked on this plan")}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {doc && (
          <div className="mp-doc" onClick={handleCodeCopyClick}>
            <div className="doc-sheet">
              <div className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
        )}

        {locked.length > 0 && (
          <p className="mp-unlock">
            <IconLock size={12} />
            {finished
              ? tr(locked.length === 1 ? "This is the short version. Unlock the other step and the full document by upgrading." : "This is the short version. Unlock the other {n} steps and the full document by upgrading.", { n: locked.length })
              : tr(locked.length === 1 ? "1 more step unlocks by upgrading." : "{n} more steps unlock by upgrading.", { n: locked.length })}
          </p>
        )}
      </div>

      {/* The way out, always in the same place (2026-11-27): the document can be
          written at any moment, from what is known so far — open points stay
          marked as open. While the interview has not started, improving every
          method leads; once there is enough, the document does. */}
      {!finished && rail && controls && (
        <div className="ck-foot">
          {rail.stationIdx < 0 && (
            <button className="wz-go ck-main" disabled={snap?.busy ?? false} onClick={controls.optimize}>
              <IconSpark size={13} />{tr("Improve all methods")}
            </button>
          )}
          {pct >= GENERATE_FROM_PCT ? (
            <button className="wz-go ck-main" disabled={snap?.busy ?? false} onClick={controls.generate}>
              <IconDoc size={14} />{tr("Create the document")}
            </button>
          ) : (
            <>
              <button className="sh-btn ck-now" disabled={snap?.busy ?? false} onClick={controls.generate}>
                <IconDoc size={14} />{tr("Create the document now")}
              </button>
              <p className="ck-now-note">{tr("With what we have so far. Open points stay marked as open.")}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
