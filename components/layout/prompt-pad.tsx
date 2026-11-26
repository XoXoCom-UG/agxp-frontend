"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Agent } from "@/lib/agents";
import { holdsSlot, TYPE_CATALOG } from "@/lib/agent-types";
import { experienceFor, LEVELS } from "@/lib/agent-level";
import { useMascotLevels } from "@/lib/mascot-level";
import { useEntitlement } from "@/lib/entitlement";
import { methodLabel, methodBlurb } from "@/lib/method-labels";
import { PROMPT_TEMPLATES, fillText, nextBlank, partsOf, type PromptTemplate } from "@/lib/prompt-templates";
import { requestStartPlan, requestMethodDraft, existingFor, templateById, StartError } from "@/lib/start-flow";
import type { DraftState } from "@/lib/method-draft";
import { deliverableFor } from "@/lib/deliverables";
import type { StartPlan } from "@/lib/start-plan";
import { describeDbError } from "@/lib/db-error";
import { useT } from "@/lib/language";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { RightTabs, type RightView } from "@/components/layout/right-tabs";
import { IconBack, IconAlert, IconPlus, IconList, IconArrowUp } from "@/components/layout/agxp-icons";

/** What the screen needs to put the team into the project. */
export interface Activation { prompt: string; plan: StartPlan; reuse: Agent | null }

export type PadStage = "write" | "plan";
type View = "write" | "templates" | "glossary" | "choosing" | "plan";

const MAX = 6000;

/**
 * The start screen, in the layout of the Mural of 19.11. (meeting 2026-11-20):
 * the normal workspace, with the left panel's tabs reading "Prompt Pad |
 * Consultant". You say what you want — typed, or from a template — and the app
 * works out which consultant fits and which methods the project needs; the
 * Consultant tab then shows who that is, and you only press Start.
 *
 * Clean on purpose (Patryk: "noch ein Ticken zu bunt", "keine leuchtenden
 * Gimmicks"): greys, hairlines, one solid button.
 */
export function PromptPad({ agents, onActivate, onStage, onDraft }: {
  agents: Agent[];
  /** Puts the team into the project and opens the chat. Throws on failure. */
  onActivate: (a: Activation) => Promise<void>;
  /** Which step this is, for the Cockpit beside it. */
  onStage?: (stage: PadStage) => void;
  /** The first method draft, written in the background once a consultant is chosen. */
  onDraft?: (draft: DraftState | null) => void;
}) {
  const tr = useT();
  const { plan: account } = useEntitlement();
  const levels = useMascotLevels();
  const [view, setView] = useState<View>("write");
  const [text, setText] = useState("");
  const [startPlan, setStartPlan] = useState<StartPlan | null>(null);
  const [reuseId, setReuseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const ready = text.trim().length > 0 && text.length <= MAX;
  // After a template is written in, the first blank is selected, ready to type over.
  const selectBlank = useRef(false);
  useEffect(() => {
    const el = areaRef.current;
    if (!selectBlank.current || view !== "write" || !el) return;
    selectBlank.current = false;
    el.focus();
    const b = nextBlank(el.value, 0);
    if (b) el.setSelectionRange(b[0], b[1]);
  }, [view, text]);
  // The field grows with what is written, like a chat box, up to a ceiling.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [text, view]);
  const onConsultant = view === "plan" && !!startPlan;
  useEffect(() => { onStage?.(onConsultant ? "plan" : "write"); }, [onConsultant, onStage]);

  // The newest draft request: an older one that lands late is dropped.
  const draftRun = useRef(0);
  /** Writes the first draft of every method while the person reads the plan. Never blocks, never shows an error. */
  function beginDraft(prompt: string, kind: string) {
    const run = ++draftRun.current;
    onDraft?.({ kind, status: "pending", drafts: [] });
    requestMethodDraft(prompt, kind)
      .then(drafts => { if (run === draftRun.current) onDraft?.({ kind, status: "ready", drafts }); })
      .catch(() => { if (run === draftRun.current) onDraft?.({ kind, status: "failed", drafts: [] }); });
  }

  async function choose() {
    if (!ready) return;
    setError(null);
    setView("choosing");
    draftRun.current++;
    onDraft?.(null);
    try {
      const plan = await requestStartPlan(text.trim());
      setStartPlan(plan);
      beginDraft(text.trim(), plan.kind);
      // A consultant of this type that the user already has comes first.
      setReuseId(existingFor(plan.kind, agents)[0]?.id ?? null);
      setView("plan");
    } catch (e) {
      setError(e instanceof StartError ? tr(e.message) : describeDbError(e, "Choosing a consultant"));
      setView("write");
    }
  }

  async function start() {
    if (!startPlan || working) return;
    setWorking(true);
    setError(null);
    try {
      await onActivate({ prompt: text.trim(), plan: startPlan, reuse: agents.find(a => a.id === reuseId) ?? null });
    } catch (e) {
      setError(e instanceof StartError ? tr(e.message) : describeDbError(e, "Starting the consultant"));
      setWorking(false);
    }
  }

  const writeTemplate = (t: PromptTemplate) => { setText(fillText(t, tr)); selectBlank.current = true; setView("write"); };
  const back = () => { setError(null); setView("write"); };
  const sub = view === "templates" || view === "glossary";
  const subName = view === "glossary" ? tr("Method Glossary") : tr("Command Prompts");

  // Mural: once there is a consultant its tab leads, and the pad moves behind it.
  const tabs: { id: "pad" | "consultant"; label: string }[] = [
    { id: "pad", label: tr("Prompt Pad") },
    { id: "consultant", label: tr("Consultant") },
  ];
  if (onConsultant) tabs.reverse();
  // Nothing up here until there is a consultant to show.
  const shown = startPlan ? tabs : tabs.filter(t => t.id === "pad");

  return (
    <section className="panel pp" aria-label={tr("Prompt Pad")}>
      <header className="pp-head">
        <div className="rt-tabs" role="group" aria-label={tr("Show on this side")}>
          {shown.map(t => {
            const active = t.id === "consultant" ? onConsultant : !onConsultant;
            const disabled = t.id === "consultant" && !startPlan;
            return (
              <button key={t.id} type="button" className="rt-tab" aria-pressed={active} disabled={disabled}
                onClick={() => { if (t.id === "pad") { setError(null); setView("write"); } else if (startPlan) setView("plan"); }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="pp-body">
        <div className="pp-col" data-view={view}>
          {sub && (
            <button type="button" className="back-link pp-back" onClick={back}>
              <IconBack size={13} />{subName}
            </button>
          )}

          {view === "write" && (
            <>
              <div className="pp-stage">
                <div className="pp-composer">
                  <textarea ref={areaRef} className="pp-area" value={text} maxLength={MAX} rows={3} autoFocus
                    aria-label={tr("Describe your idea or your project")}
                    placeholder={tr("Describe your idea or your project")}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); choose(); }
                      // Tab walks on to the next [blank] a template left; with none left it moves focus as usual.
                      if (e.key === "Tab" && !e.shiftKey) {
                        const b = nextBlank(text, e.currentTarget.selectionEnd);
                        if (b) { e.preventDefault(); e.currentTarget.setSelectionRange(b[0], b[1]); }
                      }
                    }} />
                  <div className="pp-composer-bar">
                    <button type="button" className="pp-chip" onClick={() => setView("templates")}>
                      <IconPlus size={14} />{tr("Command Prompts")}
                    </button>
                    <button type="button" className="pp-chip" onClick={() => setView("glossary")}>
                      <IconList size={14} />{tr("Method Glossary")}
                    </button>
                    <button type="button" className="pp-send" disabled={!ready} onClick={choose}>
                      {tr("Activate Assistant")}<IconArrowUp size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {view === "templates" && (
            <ul className="pp-cards">
              {PROMPT_TEMPLATES.map(t => (
                <li key={t.id}>
                  <button type="button" className="pp-card" onClick={() => writeTemplate(t)}>
                    <span className="pp-card-t">{tr(t.title)}</span>
                    <span className="pp-card-b">
                      {t.sentences.map((sentence, n) => (
                        <span key={n}>
                          {partsOf(tr(sentence)).map((p, i) => p.slot
                            ? <span key={i} className="pp-ph">[{tr(t.hints[p.slot] ?? p.slot)}]</span>
                            : <span key={i}>{p.text}</span>)}
                          {" "}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {view === "glossary" && <Glossary />}

          {view === "choosing" && (
            <div className="pp-wait" role="status">
              <span className="spinner spinner-lg" aria-hidden="true" />
              <p>{tr("Choosing your consultant…")}</p>
            </div>
          )}

          {view === "plan" && startPlan && (
            <PlanCard plan={startPlan} agents={agents} reuseId={reuseId} setReuseId={setReuseId}
              level={(reuseId && levels[reuseId]) || 1}
              canCreate={canCreate(startPlan.kind, agents, account.agentsPerType, account.maxAgents)} working={working} onStart={start} />
          )}

          {error && (
            <div className="inline-error pp-error" role="alert">
              <IconAlert size={14} /><p className="ie-detail">{error}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The right-hand side while there is no chat yet: the same Cockpit | Assistant
 * tabs the workspace will have, and one sentence in the middle (Mural 19.11.).
 */
export function CockpitPlaceholder({ stage, draft }: { stage: PadStage; draft?: DraftState | null }) {
  const tr = useT();
  const [view, setView] = useState<RightView>("methods");
  // Once a consultant is chosen, its methods are already here, with the first
  // draft filling in as it arrives (Mural: "shown directly when the consultant is chosen").
  const stations = stage === "plan" && draft ? deliverableFor("consultant", draft.kind).stations.slice(0, 10) : [];
  const showMethods = view === "methods" && stations.length > 0;
  return (
    <section className="panel methods-panel cp-idle" aria-label={tr("Cockpit")}>
      <header className="mp-head">
        <div className="mp-head-row"><RightTabs view={view} onChange={setView} /></div>
        {showMethods && (
          <div className="mp-head-txt">
            <h2 className="mp-title">{tr("Consulting Methods")}</h2>
            <p className="mp-intro">{draft?.status === "pending" ? tr("Writing a first draft of every method…") : tr("This is your new consultant. Over time it specializes and gets to know you.")}</p>
          </div>
        )}
      </header>
      {showMethods ? (
        <div className="mp-body">
          <DraftList stations={stations} draft={draft!} />
        </div>
      ) : (
        <div className="cp-idle-body">
          <p>{view === "coach"
            ? tr("Your Assistant joins once your consultant has started.")
            : stage === "plan"
              ? tr("This is your new consultant. Over time it specializes and gets to know you.")
              : tr("Your personal consultant is chosen after your first prompt.")}</p>
        </div>
      )}
    </section>
  );
}

/** The methods of the chosen consultant, each with its first draft once there is one. */
function DraftList({ stations, draft }: { stations: { label: string; note?: string }[]; draft: DraftState }) {
  const text = new Map(draft.drafts.map(d => [d.label, d.text]));
  return (
    <ol className="mp-steps">
      {stations.map(s => (
        <li key={s.label} className="mp-step todo">
          <span className="mp-node" aria-hidden="true" />
          <span className="mp-step-t">
            <span className="mp-step-l">{s.label}</span>
            {text.has(s.label)
              ? <span className="mp-step-d">{text.get(s.label)}</span>
              : draft.status === "pending"
                ? <span className="mp-step-d is-wait" aria-hidden="true" />
                : s.note && <span className="mp-step-n">{s.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** May the user make one more consultant of this type? The plan caps both the type and the whole team. */
function canCreate(kind: string, agents: Agent[], perType: number, maxAgents: number): boolean {
  const tpl = templateById(kind);
  const active = agents.filter(a => a.type === "consultant" && !a.archived_at);
  const mine = active.filter(a => holdsSlot(a) && a.tagline === tpl.sub).length;
  return mine < perType && active.length < maxAgents;
}

function PlanCard({ plan, agents, reuseId, setReuseId, level, canCreate, working, onStart }: {
  plan: StartPlan; agents: Agent[]; reuseId: string | null; setReuseId: (id: string | null) => void;
  level: number; canCreate: boolean; working: boolean; onStart: () => void;
}) {
  const tr = useT();
  const tpl = templateById(plan.kind);
  const have = existingFor(plan.kind, agents);
  const reuse = have.find(a => a.id === reuseId) ?? null;
  // Nothing to reuse and no room to make one: say so instead of a Start that fails.
  const stuck = !reuse && !canCreate;
  const lvl = reuse ? level : 1;
  return (
    <>
      <div className="pp-agent">
        <span className="pp-agent-face" aria-hidden="true">
          <AgentMascot role="consultant" size={44} level={lvl} agentId={reuse?.id} />
        </span>
        <div className="pp-agent-txt">
          <p className="pp-agent-name">{reuse ? reuse.name : tpl.type}</p>
          <p className="pp-agent-role">{reuse ? tpl.type : tr("Consultant")}</p>
        </div>
        <div className="pp-agent-xp">
          <span className="lbl">{tr("Experience")}</span>
          <span className="pp-xp"><b>{tr(experienceFor(lvl))}</b>
            <span className="pp-pips" aria-hidden="true">
              {LEVELS.map(n => <i key={n} className={n <= lvl ? "on" : ""} />)}
            </span>
          </span>
        </div>
      </div>

      <div className="pp-methods-card">
        <p className="pp-sub">{plan.reason || tr("This is the list of consulting methods we generated for your consultant:")}</p>
        {plan.reason && <p className="pp-sub-2">{tr("This is the list of consulting methods we generated for your consultant:")}</p>}
        <ul className="pp-methods">
          {plan.methods.map(m => (
            <li key={m}><span>{m}</span><small>{methodLabel(m)}</small></li>
          ))}
        </ul>
      </div>

      {have.length > 0 && canCreate && (
        <div className="pp-choice" role="group" aria-label={tr("Which consultant")}>
          <button type="button" className="pp-pill" aria-pressed={reuse !== null} onClick={() => setReuseId(have[0].id)}>
            {tr("Use {name}", { name: have[0].name })}
          </button>
          <button type="button" className="pp-pill" aria-pressed={reuse === null} onClick={() => setReuseId(null)}>
            {tr("Create a new {type}", { type: tpl.type })}
          </button>
        </div>
      )}
      {stuck && <p className="pp-note">{tr("Your plan has no room for another consultant of this type. Archive one in the Agent Dashboard.")}</p>}

      <button type="button" className="pp-start" disabled={working || stuck} onClick={onStart}>
        {working ? <span className="spinner" aria-hidden="true" /> : tr("Start")}
      </button>
    </>
  );
}

/** Every consulting method the app has, with what it does in plain words. */
function Glossary() {
  const names = useMemo(() => {
    const set = new Set<string>();
    for (const t of TYPE_CATALOG.consultant) for (const m of [...t.primary, ...t.secondary]) set.add(m);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, []);
  return (
    <dl className="pp-gloss">
      {names.map(n => (
        <div key={n}><dt>{n}</dt><dd>{methodBlurb(n)}</dd></div>
      ))}
    </dl>
  );
}
