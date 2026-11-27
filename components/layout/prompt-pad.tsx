"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Agent } from "@/lib/agents";
import { holdsSlot } from "@/lib/agent-types";
import { useEntitlement } from "@/lib/entitlement";
import { PROMPT_TEMPLATES, composeText, fieldsOf, partsOf, type PromptTemplate } from "@/lib/prompt-templates";
import { requestStartPlan, requestMethodDraft, existingFor, templateById, StartError } from "@/lib/start-flow";
import type { DraftState } from "@/lib/method-draft";
import type { StartPlan } from "@/lib/start-plan";
import { describeDbError } from "@/lib/db-error";
import { useT } from "@/lib/language";
import { useAuth } from "@/lib/auth-context";
import { AgentMascot } from "@/components/layout/agent-mascot";
import {
  IconAlert, IconArrowUp, IconBack, IconCheck, IconNodes, IconChart, IconSpark, IconPencil, IconUsers, IconSearch,
} from "@/components/layout/agxp-icons";

/** How each example looks on the start screen: an icon and what it is for, in a few words. */
const EXAMPLE_LOOK: Record<string, { Icon: typeof IconNodes; line: string }> = {
  "it-project": { Icon: IconNodes, line: "Bring in new software" },
  "it-company": { Icon: IconChart, line: "Roll it out to everyone" },
  "ai-use-case": { Icon: IconSpark, line: "Put AI to work" },
  "idea": { Icon: IconPencil, line: "Test an idea" },
  "team-change": { Icon: IconUsers, line: "Take your people along" },
  "no-idea": { Icon: IconSearch, line: "Find the first step" },
};

/** What happens after Start, in three words each — shown once, under everything. */
const HOW = ["Describe your project", "Your consultant picks the methods", "You get a first draft"];

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
  const { profileName } = useAuth();
  const firstName = profileName.trim().split(/\s+/)[0] ?? "";
  /** The person is writing: the consultant looks at the field. */
  const [typing, setTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>("write");
  const [text, setText] = useState("");
  const [tpl, setTpl] = useState<PromptTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // The field grows with what is written through CSS (field-sizing: content on
  // .pp-area). Measuring scrollHeight in JS read the field before the column had
  // its width and left an empty box 280px tall.

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
            <form className="pp-write" onSubmit={e => { e.preventDefault(); start(); }}
              onFocus={() => setTyping(true)} onBlur={() => setTyping(false)}>
              {/* A face and a hello: the consultant is already here, waiting for the
                  project. It looks at the field while the person writes. */}
              <div className="pp-hello">
                <span className="pp-face" aria-hidden="true">
                  <AgentMascot role="consultant" size={64} attentive={typing} />
                </span>
                {firstName && <p className="pp-hi">{tr("Hi {name},", { name: firstName })}</p>}
                <h2 className="pp-title">{tr(tpl ? tpl.title : "What are you working on?")}</h2>
                <p className="pp-lead">{tr(tpl
                  ? "Fill in the gaps you know. The rest can stay empty."
                  : "Tell me in a sentence. I pick the right consulting methods and draft them for you.")}</p>
              </div>

              <div className={`pp-composer${tpl ? " is-sentence" : ""}`}>
                {tpl ? (
                  /* The template as the message itself, with the blanks to fill in
                     right where they go ("My role is ___ and I want to ___"): the
                     person reads what the consultant will get while writing it,
                     instead of a column of empty grey lines (2026-11-27). */
                  <p className="pp-sentence">
                    {tpl.sentences.map((sentence, n) => (
                      <span key={n}>
                        {partsOf(tr(sentence)).map((part, i) => {
                          if (!part.slot) return <span key={i}>{part.text}</span>;
                          const id = part.slot;
                          const hint = tr(tpl.hints[id] ?? id);
                          const value = values[id] ?? "";
                          return (
                            <input key={i} ref={id === fieldsOf(tpl)[0] ? firstFieldRef : undefined}
                              className={`pp-blank${value.trim() ? " is-filled" : ""}`} maxLength={400}
                              aria-label={hint} placeholder={hint}
                              // Empty: as wide as its hint. Typed into: as wide as the text.
                              size={Math.max(4, value ? value.length + 1 : hint.length)}
                              value={value} onChange={e => { setValues(v => ({ ...v, [id]: e.target.value })); if (error) setError(null); }} />
                          );
                        })}
                        {" "}
                      </span>
                    ))}
                  </p>
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

              {error && (
                <p className="pp-error" role="alert"><IconAlert size={13} />{error}</p>
              )}

              {!tpl && (
                <div className="pp-examples-wrap">
                  <p className="pp-examples-h">{tr("Or start from an example")}</p>
                  <div className="pp-examples" role="group" aria-label={tr("Examples")}>
                    {PROMPT_TEMPLATES.map(t => {
                      const look = EXAMPLE_LOOK[t.id];
                      const Icon = look?.Icon ?? IconSpark;
                      return (
                        <button key={t.id} type="button" className="pp-ex" onClick={() => pick(t)}>
                          <span className="pp-ex-i" aria-hidden="true"><Icon size={16} /></span>
                          <span className="pp-ex-t">{tr(t.title)}</span>
                          {look && <span className="pp-ex-l">{tr(look.line)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!tpl && (
                <ol className="pp-how" aria-label={tr("How it works")}>
                  {HOW.map((h, i) => <li key={h}><span className="pp-how-n">{i + 1}</span>{tr(h)}</li>)}
                </ol>
              )}
            </form>
          )}

          {phase === "working" && (
            <div className="pp-hello">
              <span className="pp-face" aria-hidden="true">
                <AgentMascot role="consultant" size={64} state="thinking" />
              </span>
            </div>
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
