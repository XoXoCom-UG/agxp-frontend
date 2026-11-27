"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { downloadWord } from "@/lib/doc-download";
import { createShare, currentShare, revokeShares, shareUrl } from "@/lib/doc-share";
import { conversationShare } from "@/lib/conversation-usage";
import { useEntitlement } from "@/lib/entitlement";
import { startCheckout } from "@/lib/billing";
import { upgradeTarget } from "@/lib/plans";
import type { PanelSnapshot, RailControls } from "@/lib/peer-context";
import type { DeliverableDoc } from "@/components/layout/deliverable-view";
import type { Deliverable } from "@/lib/deliverables";
import type { DraftState } from "@/lib/method-draft";
import { md, handleCodeCopyClick } from "@/lib/markdown";
import { ArtifactActions, versionLine } from "@/components/layout/deliverable-rail";
import { IconArrow, IconCheck, IconChevronDown, IconDoc, IconLock, IconMinimise, IconSpark, IconRefresh, IconMore, IconPencil, IconDownload, IconPrint, IconShare } from "@/components/layout/agxp-icons";
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
export function MethodsPanel({ tabs, agentId, consultantType, onChangeConsultant, projectId, deliverable, draft, snap, onOpenDoc, onEditDraft, onSkipMethod, onDrawConclusions, conclusionsFailed, onMinimise, onAct }: {
  /** Methods or Coach — drawn in the header, inside the card. */
  tabs?: React.ReactNode;
  /** The project's consultant: its face, at its own level, speaks in the Cockpit. */
  agentId?: string | null;
  /** The consultant's type in words ("Strategy Consultant"), for the line that says why it was chosen. */
  consultantType?: string;
  /** Puts a different consultant on the project. Offered only before the interview began. */
  onChangeConsultant?: () => void;
  /** The open project: a share link belongs to it. */
  projectId?: string | null;
  /** The person corrected one method's draft. Without it the drafts are read-only. */
  onEditDraft?: (label: string, text: string) => void;
  /** Skip a method (true) or bring it back (false). */
  onSkipMethod?: (label: string, skip: boolean) => void;
  /** One short conclusion per method, from what the person has typed so far. */
  onDrawConclusions?: (text: string) => void;
  /** The last "Draw conclusions" did not come back. */
  conclusionsFailed?: boolean;
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
  /** After a button that sends something to the consultant: the screen shows the chat. */
  onAct?: () => void;
}) {
  const tr = useT();
  const d = deliverable;
  const rail = snap?.rail;
  // Every button that makes the consultant answer also calls onAct; opening or
  // restoring a document version does not (the answer is not in the chat).
  const raw = snap?.controls;
  const controls: RailControls | undefined = raw && onAct
    ? {
      ...raw,
      generate: () => { raw.generate(); onAct(); },
      regenerate: () => { raw.regenerate(); onAct(); },
      skip: () => { raw.skip(); onAct(); },
      discuss: l => { raw.discuss(l); onAct(); },
      optimize: () => { raw.optimize(); onAct(); },
      jump: (l, n, t) => { raw.jump(l, n, t); onAct(); },
      focus: (l, n, t) => { raw.focus(l, n, t); onAct(); },
    }
    : raw;
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
  const draftText = useMemo(() => new Map((draft?.drafts ?? []).filter(x => !x.skipped).map(x => [x.label, x.text])), [draft]);
  /** Methods the person chose to leave out. */
  const skipped = useMemo(() => new Set((draft?.drafts ?? []).filter(x => x.skipped).map(x => x.label)), [draft]);
  /** What the conclusions are drawn from: the person's own words in the chat. */
  const userText = rail?.userText ?? "";
  const canConclude = !!onDrawConclusions && !!userText.trim() && draft?.status !== "pending" && !(snap?.busy ?? false);
  const conclude = () => { if (canConclude) onDrawConclusions?.(userText); };
  const drafting = draft?.status === "pending";
  /** The one method unfolded in the list. */
  const [open, setOpen] = useState<string | null>(null);
  /** The one method whose "More ways in" menu is open. */
  const [more, setMore] = useState<string | null>(null);
  // The menu closes on a click elsewhere and on Esc.
  useEffect(() => {
    if (!more) return;
    const onDown = (e: MouseEvent) => { if (!(e.target as Element).closest?.(".ck-more-wrap")) setMore(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMore(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [more]);
  // What the person has done with each method is read from the stored
  // conversation (lib/cockpit-history.ts), so a reload keeps it.
  const talked = useMemo(() => new Set(rail?.talked ?? []), [rail?.talked]);
  const leftOpen = useMemo(() => new Set(rail?.leftOpen ?? []), [rail?.leftOpen]);
  /** With a document: the methods the interview never reached, or jumped over,
   *  and nobody talked through — what the document can only mark as open. */
  const openPoints = finished
    ? stations.filter((s, i) => (i > (rail?.stationIdx ?? -1) || leftOpen.has(s.label)) && !talked.has(s.label)).map(s => s.label)
    : [];

  // A draft is half the way, a method the interview has passed is all of it:
  // the bar counts both, the words say which (a draft is not "ready").
  const doneCount = stations.filter((s, i) => skipped.has(s.label) || (i < nowIdx && !leftOpen.has(s.label))).length;
  const drafted = stations.filter((s, i) => i > nowIdx && !skipped.has(s.label) && draftText.has(s.label)).length;
  const fill = Math.round(((doneCount + drafted / 2) / Math.max(1, stations.length)) * 100);
  const countLine = doneCount === 0 && drafted > 0
    ? tr("{n} of {total} drafted", { n: drafted, total: stations.length })
    : tr("{done} of {total} done", { done: doneCount, total: stations.length });
  // A PROGRESS the model wrote before the interview began says nothing yet.
  const pct = nowIdx >= 0 ? snap?.pct ?? 0 : 0;
  /** What the consultant says above the list: the one thing to do next. */
  const hint = drafting
    ? tr("I'm drawing conclusions from what you wrote…")
    : conclusionsFailed
      ? tr("That didn't work. Try Draw conclusions again in a moment.")
    : snap?.busy
      ? tr("One moment, I'm answering in the chat.")
      : nowIdx >= 0 && pct >= GENERATE_FROM_PCT
        ? tr("That's enough for a document. Shall I write it?")
        : nowIdx >= 0
          ? tr("We're on {label}. Answer me in the chat.", { label: stations[nowIdx]?.label ?? "" })
          : draftText.size > 0
            ? tr("These are my conclusions so far. Open a method to correct it, skip it or talk it through.")
            : tr("Nothing is filled in yet. I can draw conclusions from what you wrote, or we go through it in the chat.");

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
            {/* Which consultant the app chose, and why, in one sentence — with a
                way to choose another before any work has been done (2026-11-27). */}
            {consultantType && draft?.reason && nowIdx < 0 && (
              <p className="ck-why">
                <span className="ck-why-k">{tr("Why {type}", { type: consultantType })}</span>
                <span className="ck-why-t">{draft.reason}</span>
                {onChangeConsultant && (rail?.talked.length ?? 0) === 0 && (
                  <button type="button" className="ck-why-change" onClick={onChangeConsultant}>{tr("Choose another")}</button>
                )}
              </p>
            )}
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
            <DocTools doc={doc} projectId={projectId ?? null} onPrint={() => onOpenDoc({ ...doc, printOnOpen: true })} />
          </div>
        )}
        {/* A document written before every method was talked through says
            which ones are still open, each one click from the conversation. */}
        {doc && controls && openPoints.length > 0 && (
          <div className="ck-open" role="note">
            <p className="ck-open-t">
              {tr(openPoints.length === 1 ? "1 method is still open in this document." : "{n} methods are still open in this document.", { n: openPoints.length })}
            </p>
            <div className="ck-open-list">
              {openPoints.map(l => (
                <button key={l} type="button" className="ck-chip" disabled={snap?.busy ?? false}
                  onClick={() => controls.discuss(l)}>{l}</button>
              ))}
            </div>
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
              const state = skipped.has(s.label) ? "skipped" : passed ? "done" : i === nowIdx ? "now" : draftText.has(s.label) ? "draft" : "todo";
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
                      <span className={`ck-tag ${state}`}
                        title={tr(state === "skipped" ? "You left this method out" : state === "done" ? "Talked through with you in the interview" : state === "now" ? "The interview is on this method now" : "A conclusion from what you wrote")}>
                        {tr(state === "skipped" ? "Skipped" : state === "done" ? "Done" : state === "now" ? "Now" : "Draft")}
                      </span>
                    )}
                    <IconChevronDown size={14} className="ck-chev" />
                    <span className="visually-hidden">{tr(state === "skipped" ? ", skipped" : state === "done" ? ", done" : state === "now" ? ", in progress" : state === "draft" ? ", drafted" : ", not yet")}</span>
                  </button>
                  {isOpen && (
                    <div className="ck-more">
                      {state === "skipped"
                        ? <p className="ck-text">{tr("You skipped this method. It stays out of the document.")}</p>
                        : drafting && !draftText.has(s.label)
                        ? <span className="mp-step-d is-wait" aria-hidden="true" />
                        : draftText.has(s.label) && onEditDraft && !drafting
                          ? <DraftText label={s.label} text={draftText.get(s.label) ?? ""} onSave={t => onEditDraft(s.label, t)} />
                          : body && <p className="ck-text">{body}</p>}
                      {controls && state === "skipped" && onSkipMethod && (
                        <div className="ck-actions">
                          <button type="button" className="sh-btn" onClick={() => onSkipMethod(s.label, false)}>
                            {tr("Bring it back")}
                          </button>
                        </div>
                      )}
                      {controls && state !== "skipped" && (
                        <div className="ck-actions">
                          {/* One clear way in; the others wait behind "More" (2026-11-27). */}
                          <button type="button" className="sh-btn sh-primary" disabled={busy}
                            onClick={() => controls.discuss(s.label)}>
                            {tr(talked.has(s.label) ? "Talk it through again" : "Talk it through")}
                          </button>
                          {state === "now" && rail?.canSkip && (
                            <button type="button" className="sh-btn sh-ghost" disabled={busy} onClick={controls.skip}>
                              {tr("Skip this step")}<IconArrow size={12} />
                            </button>
                          )}
                          {state !== "now" && onSkipMethod && (
                            <button type="button" className="sh-btn sh-ghost" disabled={busy}
                              onClick={() => { onSkipMethod(s.label, true); setOpen(null); }}>
                              {tr("Skip")}
                            </button>
                          )}
                          {state !== "now" && (
                            <div className="ck-more-wrap">
                              <button type="button" className="sh-btn sh-ghost ck-more-btn" disabled={busy}
                                aria-expanded={more === s.label} aria-label={tr("More ways into this method")}
                                onClick={() => setMore(m => (m === s.label ? null : s.label))}>
                                <IconMore size={14} />
                              </button>
                              {more === s.label && (
                                <div className="ck-menu" role="menu">
                                  <button type="button" role="menuitem" className="ck-menu-item"
                                    onClick={() => { setMore(null); controls.jump(s.label, i + 1, stations.length); }}>
                                    <span className="ck-menu-t">{tr("Start the interview here")}</span>
                                    <span className="ck-menu-d">{tr("The interview continues from here. The steps before stay open.")}</span>
                                  </button>
                                  <button type="button" role="menuitem" className="ck-menu-item"
                                    onClick={() => { setMore(null); controls.focus(s.label, i + 1, stations.length); }}>
                                    <span className="ck-menu-t">{tr("Only this one first")}</span>
                                    <span className="ck-menu-d">{tr("Only this method now, then back to where you were.")}</span>
                                  </button>
                                </div>
                              )}
                            </div>
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
          {/* Nothing filled in until the person asks: Draw conclusions first,
              then the interview to improve them (2026-11-27). */}
          {rail.stationIdx < 0 && draftText.size === 0 && onDrawConclusions && (
            <button className="wz-go ck-main" disabled={!canConclude} onClick={conclude}>
              <IconSpark size={13} />{tr(drafting ? "Drawing conclusions…" : "Draw conclusions")}
            </button>
          )}
          {rail.stationIdx < 0 && (draftText.size > 0 || !onDrawConclusions) && (
            <button className="wz-go ck-main" disabled={snap?.busy ?? false} onClick={controls.optimize}>
              <IconSpark size={13} />{tr("Improve all methods")}
            </button>
          )}
          {draftText.size > 0 && onDrawConclusions && (
            <button className="sh-btn sh-ghost ck-again" disabled={!canConclude} onClick={conclude}>
              <IconRefresh size={12} />{tr(drafting ? "Drawing conclusions…" : "Draw conclusions again")}
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
      {projectId && <ConversationMeter projectId={projectId} busy={snap?.busy ?? false} />}
    </section>
  );
}

/**
 * How much room this conversation has left, shown only from half-way on
 * (2026-11-27). The ceiling used to be invisible until the chat refused the
 * next message; now the person sees it coming and can start a new project or
 * upgrade before it is in the way.
 */
function ConversationMeter({ projectId, busy }: { projectId: string; busy: boolean }) {
  const tr = useT();
  const { plan, loading } = useEntitlement();
  const [share, setShare] = useState<number | null>(null);
  // Read again after every answer: busy going back to false is a reply settled.
  useEffect(() => {
    if (busy || loading) return;
    let alive = true;
    conversationShare(projectId, plan.conversationCeilingUsd).then(v => { if (alive) setShare(v); });
    return () => { alive = false; };
  }, [projectId, busy, loading, plan.conversationCeilingUsd]);

  if (share === null || share < 0.5) return null;
  const pct = Math.round(share * 100);
  const next = upgradeTarget(plan.id);
  const full = share >= 1;
  return (
    <div className={`ck-meter${share >= 0.8 ? " is-low" : ""}`} role="status">
      <div className="ck-meter-row">
        <span className="ck-meter-t">
          {full ? tr("This conversation is full.") : tr("This conversation has used {pct}% of its room.", { pct })}
        </span>
        {next && share >= 0.8 && (
          <button type="button" className="ck-meter-up" onClick={() => { startCheckout(next).catch(() => {}); }}>
            {tr("Upgrade")}
          </button>
        )}
      </div>
      <div className="ck-meter-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      {share >= 0.8 && <p className="ck-meter-d">{tr("Write the document soon, or start a new project for the next topic.")}</p>}
    </div>
  );
}

/** One method's draft, which the person can correct in place (2026-11-27). */
function DraftText({ label, text, onSave }: { label: string; text: string; onSave: (text: string) => void }) {
  const tr = useT();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (!editing) {
    return (
      <div className="ck-draft">
        <p className="ck-text">{text}</p>
        <button type="button" className="ck-edit" onClick={() => { setValue(text); setEditing(true); }}
          aria-label={tr("Correct the draft of {label}", { label })} data-tooltip={tr("Correct this")}>
          <IconPencil size={12} />
        </button>
      </div>
    );
  }
  const save = () => {
    const clean = value.replace(/\s+/g, " ").trim().slice(0, 440);
    if (clean && clean !== text) onSave(clean);
    setEditing(false);
  };
  return (
    <form className="ck-draft-edit" onSubmit={e => { e.preventDefault(); save(); }}>
      <textarea ref={ref} className="ck-draft-area" value={value} maxLength={440} rows={3}
        aria-label={tr("Correct the draft of {label}", { label })}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); save(); }
        }} />
      <div className="ck-draft-btns">
        <button type="submit" className="sh-btn sh-primary">{tr("Save")}</button>
        <button type="button" className="sh-btn sh-ghost" onClick={() => setEditing(false)}>{tr("Cancel")}</button>
      </div>
    </form>
  );
}

/** Word, PDF and a read-only link, right under the document (2026-11-27). */
function DocTools({ doc, projectId, onPrint }: { doc: DeliverableDoc; projectId: string | null; onPrint: () => void }) {
  const tr = useT();
  const [word, setWord] = useState<"idle" | "busy" | "failed">("idle");
  const [share, setShare] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "busy" | "copied" | "failed">("idle");
  const messageId = doc.messageId;

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShare(null);
    setShareState("idle");
    if (messageId) currentShare(messageId).then(s => { if (alive && s) setShare(shareUrl(s.token)); }).catch(() => {});
    return () => { alive = false; };
  }, [messageId]);

  async function saveWord() {
    if (word === "busy") return;
    setWord("busy");
    try { await downloadWord(doc); setWord("idle"); } catch { setWord("failed"); }
  }
  async function makeLink() {
    if (!messageId || !projectId || shareState === "busy") return;
    setShareState("busy");
    try {
      const s = await createShare(projectId, messageId);
      const url = shareUrl(s.token);
      setShare(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareState("copied");
    } catch {
      setShareState("failed");
    }
  }
  async function stopLink() {
    if (!messageId) return;
    try { await revokeShares(messageId); setShare(null); setShareState("idle"); } catch { setShareState("failed"); }
  }
  function copyLink() {
    if (!share) return;
    navigator.clipboard.writeText(share).then(() => setShareState("copied")).catch(() => {});
  }

  return (
    <div className="ck-tools">
      <button type="button" className="sh-btn" onClick={saveWord} disabled={word === "busy"}>
        <IconDownload size={13} />{tr(word === "failed" ? "Word failed, try again" : "Word")}
      </button>
      <button type="button" className="sh-btn" onClick={onPrint} data-tooltip={tr("Opens the print window: choose Save as PDF")}>
        <IconPrint size={13} />PDF
      </button>
      {messageId && projectId && (share ? (
        <>
          <button type="button" className="sh-btn" onClick={copyLink}>
            <IconShare size={13} />{tr(shareState === "copied" ? "Link copied" : "Copy link")}
          </button>
          <button type="button" className="sh-btn sh-ghost" onClick={stopLink}>{tr("Stop sharing")}</button>
        </>
      ) : (
        <button type="button" className="sh-btn" onClick={makeLink} disabled={shareState === "busy"}
          data-tooltip={tr("Anyone with the link can read this version. You can stop it any time.")}>
          <IconShare size={13} />{tr(shareState === "failed" ? "Sharing failed, try again" : "Share read-only")}
        </button>
      ))}
    </div>
  );
}
