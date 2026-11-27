"use client";

import { useEffect, useRef, useState } from "react";
import { composeText, stepsOf, type PromptTemplate } from "@/lib/prompt-templates";
import { useT } from "@/lib/language";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconArrow, IconBack, IconCheck } from "@/components/layout/agxp-icons";

/**
 * A template, one question at a time (2026-11-27): the start of a project the
 * way an app's first sign-up goes — a bar that fills, the consultant asking one
 * short question in a speech bubble, a few ready answers to tap and a field for
 * your own, one big button. At the end it shows the message it will start
 * from, and Start.
 *
 * A tapped answer moves on by itself; a typed one with Enter or Continue. Every
 * question may be skipped (the button says so while nothing is chosen): a
 * sentence with an empty blank is simply left out of the message.
 */
export function TemplateWizard({ template, values, onChange, onExit, onStart, error }: {
  template: PromptTemplate;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  /** Back from the first question: to the free text field. */
  onExit: () => void;
  onStart: () => void;
  error: string | null;
}) {
  const tr = useT();
  const steps = stepsOf(template);
  const [at, setAt] = useState(0);
  const [typing, setTyping] = useState(false);
  const ownRef = useRef<HTMLInputElement>(null);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (advance.current) clearTimeout(advance.current); }, []);

  const done = at >= steps.length;
  const step = done ? null : steps[at];
  const value = step ? values[step.id] ?? "" : "";
  const isOption = !!step && step.options.some(o => tr(o) === value);
  const filled = steps.filter(s => (values[s.id] ?? "").trim()).length;
  const pct = Math.round((Math.min(at, steps.length) / steps.length) * 100);
  const message = composeText(template, values, tr);

  const next = () => setAt(i => Math.min(i + 1, steps.length));
  const back = () => { if (at === 0) onExit(); else setAt(i => i - 1); };

  function pick(answer: string) {
    if (!step) return;
    onChange(step.id, answer);
    // A moment to see it chosen, then on to the next question.
    if (advance.current) clearTimeout(advance.current);
    advance.current = setTimeout(next, 280);
  }

  return (
    <div className="wz">
      <div className="wz-top">
        <button type="button" className="wz-back" onClick={back} aria-label={tr("Back")}>
          <IconBack size={16} />
        </button>
        <div className="wz-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
          aria-label={tr("Progress")}>
          <span style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
      </div>

      <div className="wz-ask" key={at}>
        <span className="wz-face" aria-hidden="true">
          <AgentMascot role="consultant" size={72} attentive={typing} mood={done ? "pleased" : null} />
        </span>
        <p className="wz-bubble" aria-live="polite">
          {done
            ? tr(message ? "Great, that's enough to start. This is what I'll work from:" : "Tell me at least one thing, then we can start.")
            : tr(step!.ask)}
        </p>
      </div>

      {step && (
        <div className="wz-body" key={`b${at}`}>
          {step.options.length > 0 && (
            <div className="wz-options" role="radiogroup" aria-label={tr(step.ask)}>
              {step.options.map(o => {
                const label = tr(o);
                const on = value === label;
                return (
                  <button key={o} type="button" role="radio" aria-checked={on}
                    className={`wz-opt${on ? " on" : ""}`} onClick={() => pick(label)}>
                    <span className="wz-opt-t">{label}</span>
                    {on && <IconCheck size={14} />}
                  </button>
                );
              })}
            </div>
          )}
          <input ref={ownRef} className={`wz-own${value && !isOption ? " on" : ""}`} maxLength={400}
            placeholder={tr(step.options.length ? "Or write your own" : "Write your answer")}
            aria-label={tr(step.ask)}
            value={isOption ? "" : value}
            onFocus={() => setTyping(true)} onBlur={() => setTyping(false)}
            onChange={e => onChange(step.id, e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); next(); } }} />
        </div>
      )}

      {done && (
        <div className="wz-body">
          {message
            ? <blockquote className="wz-summary">{message}</blockquote>
            : null}
          {error && <p className="pp-error" role="alert">{error}</p>}
        </div>
      )}

      <div className="wz-foot">
        {done ? (
          <>
            <button type="button" className="pp-link" onClick={() => setAt(0)}>{tr("Change an answer")}</button>
            <button type="button" className="wz-go" onClick={message ? onStart : () => setAt(0)}>
              {tr(message ? "Start" : "Answer a question")}<IconArrow size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="wz-count">{tr("{n} of {total}", { n: at + 1, total: steps.length })}</span>
            <button type="button" className={`wz-go${value.trim() ? "" : " is-quiet"}`} onClick={next}>
              {tr(value.trim() ? "Continue" : "Skip this one")}<IconArrow size={14} />
            </button>
          </>
        )}
      </div>
      {/* How much is known so far, for screen readers: the bar says it to the eye. */}
      <span className="visually-hidden">{tr("{n} answered", { n: filled })}</span>
    </div>
  );
}
