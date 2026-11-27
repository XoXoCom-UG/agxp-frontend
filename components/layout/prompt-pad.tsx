"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Agent } from "@/lib/agents";
import { holdsSlot } from "@/lib/agent-types";
import { useEntitlement } from "@/lib/entitlement";
import { PROMPT_TEMPLATES, composeText, fieldsOf, type PromptTemplate } from "@/lib/prompt-templates";
import { requestStartPlan, requestMethodDraft, existingFor, templateById, StartError } from "@/lib/start-flow";
import type { DraftState } from "@/lib/method-draft";
import type { StartPlan } from "@/lib/start-plan";
import { describeDbError } from "@/lib/db-error";
import { useT } from "@/lib/language";
import { IconAlert, IconArrowUp, IconBack, IconCheck } from "@/components/layout/agxp-icons";

/** What the screen needs to put the team into the project. */
export interface Activation { prompt: string; plan: StartPlan; reuse: Agent | null }

type Phase = "write" | "working" | "full";

const MAX = 6000;
/** What the person sees happen while the consultant is chosen. Cosmetic: the
 *  steps tick on a timer, the real work is the one request behind them. */
const STEPS = ["Reading your project", "Choosing your consultant", "Preparing your methods"];

/**
 * The start screen (meeting 2026-11-20; clean-up pass 2026-11-27, Kaizen:
 * "der User muss nicht viel nachdenken"). One question, one field, one button.
 *
 * - The examples are templates: one opens a few short fields instead of a
 *   paragraph of "[blanks]" to type over, and an empty field never reaches the
 *   consultant (composeText drops its sentence).
 * - There is no screen for choosing the consultant: the app picks the type,
 *   reuses one of that type the person already has or makes a new one, and opens
 *   the chat. Only when the plan has no room left does the person see a choice.
 * - The Cockpit is not drawn beside an empty pad: it appears with the chat,
 *   when it has methods to show.
 */
export function PromptPad({ agents, onActivate, onDraft }: {
  agents: Agent[];
  /** Puts the team into the project and opens the chat. Throws on failure. */
  onActivate: (a: Activation) => Promise<void>;
  /** The first method draft, written in the background once a consultant is chosen. */
  onDraft?: (draft: DraftState | null) => void;
}) {
  const tr = useT();
  const { plan: account } = useEntitlement();
  const [phase, setPhase] = useState<Phase>("write");
  const [text, setText] = useState("");
  const [tpl, setTpl] = useState<PromptTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // The field grows with what is written, like a chat box, up to a ceiling.
  // Measured after layout: on the first frame the column may not have its width
  // yet, and a narrow field reads as tall.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = areaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
    });
    return () => cancelAnimationFrame(id);
  }, [text, tpl, phase]);

  useEffect(() => { if (tpl) firstFieldRef.current?.focus(); }, [tpl]);

  // The steps of the waiting screen, one after the other; the last one stays.
  useEffect(() => {
    if (phase !== "working") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(0);
    const id = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 1100);
    return () => clearInterval(id);
  }, [phase]);

  // The newest draft request: an older one that lands late is dropped.
  const draftRun = useRef(0);
  /** Writes the first draft of every method in the background. Never blocks, never shows an error. */
  function beginDraft(prompt: string, kind: string) {
    const run = ++draftRun.current;
    onDraft?.({ kind, status: "pending", drafts: [] });
    requestMethodDraft(prompt, kind)
      .then(drafts => { if (run === draftRun.current) onDraft?.({ kind, status: "ready", drafts }); })
      .catch(() => { if (run === draftRun.current) onDraft?.({ kind, status: "failed", drafts: [] }); });
  }

  const prompt = tpl ? composeText(tpl, values, tr) : text.trim();

  async function start() {
    if (phase === "working") return;
    // Kept pressable and answered on use, rather than a grey button that says nothing.
    if (!prompt) {
      setError(tr(tpl ? "Fill in at least the first field." : "Write a few words first."));
      (tpl ? firstFieldRef.current : areaRef.current)?.focus();
      return;
    }
    if (prompt.length > MAX) { setError(tr("That is too long. Keep it shorter.")); return; }
    setError(null);
    setPhase("working");
    draftRun.current++;
    onDraft?.(null);
    try {
      const plan = await requestStartPlan(prompt);
      // A consultant of this type that the person already has comes first.
      const reuse = existingFor(plan.kind, agents)[0] ?? null;
      if (!reuse && !canCreate(plan.kind, agents, account.agentsPerType, account.maxAgents)) {
        setPhase("full");
        return;
      }
      beginDraft(prompt, plan.kind);
      await onActivate({ prompt, plan, reuse });
    } catch (e) {
      setError(e instanceof StartError ? tr(e.message) : describeDbError(e, "Starting the consultant"));
      setPhase("write");
    }
  }

  const pick = (t: PromptTemplate) => { setTpl(t); setValues({}); setError(null); };
  const unpick = () => { setTpl(null); setError(null); requestAnimationFrame(() => areaRef.current?.focus()); };

  return (
    <section className="panel pp" aria-label={tr("New task")}>
      <div className="pp-body">
        <div className="pp-col">
          {phase === "write" && (
            <form className="pp-write" onSubmit={e => { e.preventDefault(); start(); }}>
              <h2 className="pp-title">{tr(tpl ? tpl.title : "What are you working on?")}</h2>

              <div className="pp-composer">
                {tpl ? (
                  <div className="pp-fields">
                    {fieldsOf(tpl).map((id, i) => (
                      <label key={id} className="pp-field">
                        <span className="pp-field-l">{tr(tpl.hints[id] ?? id)}</span>
                        <input ref={i === 0 ? firstFieldRef : undefined} className="pp-input" maxLength={400}
                          value={values[id] ?? ""} onChange={e => setValues(v => ({ ...v, [id]: e.target.value }))} />
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea ref={areaRef} className="pp-area" value={text} maxLength={MAX} rows={2} autoFocus
                    aria-label={tr("What are you working on?")}
                    placeholder={tr("A new CRM for our sales team by March")}
                    onChange={e => { setText(e.target.value); if (error) setError(null); }}
                    onKeyDown={e => {
                      // Enter sends, as in every chat; Shift+Enter is a new line.
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); start(); }
                    }} />
                )}
                <div className="pp-composer-bar">
                  {tpl && (
                    <button type="button" className="pp-link" onClick={unpick}>
                      <IconBack size={12} />{tr("Write freely instead")}
                    </button>
                  )}
                  <button type="submit" className="pp-send">
                    {tr("Start")}<IconArrowUp size={15} />
                  </button>
                </div>
              </div>

              {!tpl && (
                <div className="pp-examples" role="group" aria-label={tr("Examples")}>
                  {PROMPT_TEMPLATES.map(t => (
                    <button key={t.id} type="button" className="pp-chip" onClick={() => pick(t)}>{tr(t.title)}</button>
                  ))}
                </div>
              )}

              {error && (
                <p className="pp-error" role="alert"><IconAlert size={13} />{error}</p>
              )}
            </form>
          )}

          {phase === "working" && (
            <ol className="pp-steps" role="status" aria-live="polite">
              {STEPS.map((s, i) => (
                <li key={s} className={i < step ? "done" : i === step ? "now" : "todo"}>
                  <span className="pp-step-dot" aria-hidden="true">
                    {i < step ? <IconCheck size={11} /> : i === step ? <span className="spinner" /> : null}
                  </span>
                  {tr(s)}
                </li>
              ))}
            </ol>
          )}

          {phase === "full" && (
            <div className="pp-full" role="alert">
              <h2 className="pp-title">{tr("Your team is full")}</h2>
              <p className="pp-note">{tr("Archive a consultant to make room for a new one.")}</p>
              <div className="pp-full-actions">
                <Link className="pp-send" href="/dashboard/agents">{tr("Open Agent Dashboard")}</Link>
                <button type="button" className="pp-link" onClick={() => setPhase("write")}>{tr("Back")}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** May the user make one more consultant of this type? The plan caps both the type and the whole team. */
function canCreate(kind: string, agents: Agent[], perType: number, maxAgents: number): boolean {
  const tpl = templateById(kind);
  const active = agents.filter(a => a.type === "consultant" && !a.archived_at);
  const mine = active.filter(a => holdsSlot(a) && a.tagline === tpl.sub).length;
  return mine < perType && active.length < maxAgents;
}
