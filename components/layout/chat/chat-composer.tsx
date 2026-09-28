"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { AgentType } from "@/lib/agents";
import { IconArrowUp, IconAttach, IconStop } from "@/components/layout/agxp-icons";

/** The two 30px buttons beside the text, and the gaps between them. */
const BUTTON_W = 30;
const GAP_W = 8;
/** Slack before the text counts as not fitting on the one row. */
const FIT_SLACK = 10;
/** The textarea grows with what you write between these, then scrolls. */
const MIN_H = 30;
const MAX_H = 220;

/**
 * The prompt bar: paper clip, the text, send — on one row while the text
 * fits, the text on top and the buttons under it once it doesn't. No border;
 * the surface and its shadow do the work.
 *
 * The textarea is never disabled while an answer is on its way. Disabling it
 * threw focus to the page after every message, so each reply had to be
 * clicked back into; now only sending is held until the answer lands, and
 * the send button becomes Stop in the meantime.
 */
export function ChatComposer({ role, sending, canSend, inputRef, onSend, onStop, onAttentiveChange }: {
  role: AgentType;
  sending: boolean;
  /** False until the history is in. */
  canSend: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSend: (text: string) => void;
  onStop: () => void;
  /** The agent looks at the composer while you are writing to it. */
  onAttentiveChange: (attentive: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const measureRef = useRef<HTMLSpanElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  /** One line fits beside the buttons; once it doesn't, the text takes the
   *  whole width and the buttons drop to their own row underneath. */
  const [wide, setWide] = useState(false);
  const who = role === "coach" ? "coach" : "consultant";
  const ready = !!input.trim() && !sending && canSend;

  // The composer grows with what you write, up to a cap, then scrolls —
  // so a long message stays readable instead of hiding behind one line.
  useLayoutEffect(() => {
    const el = inputRef.current;
    const controls = controlsRef.current;
    const measure = measureRef.current;
    if (!el || !controls || !measure) return;
    const inlineWidth = controls.clientWidth - BUTTON_W * 2 - GAP_W * 2;
    const needsWide = input.includes("\n") || measure.offsetWidth + FIT_SLACK > inlineWidth;
    if (needsWide !== wide) setWide(needsWide);
    el.style.height = "0px";
    const h = el.scrollHeight;
    el.style.height = `${Math.min(Math.max(h, MIN_H), MAX_H)}px`;
    el.style.overflowY = h > MAX_H ? "auto" : "hidden";
  }, [input, wide, inputRef]);

  function submit() {
    if (!ready) return;
    const text = input;
    setInput("");
    onSend(text);
  }

  return (
    <div className={`chat-input pb${wide ? " is-wide" : ""}`}>
      <span ref={measureRef} className="pb-measure" aria-hidden="true">{input}</span>
      <div ref={controlsRef} className="pb-grid">
        {/* Not built yet. Shown rather than hidden so the plan is visible, and
            aria-disabled rather than disabled so it stays focusable and the
            tooltip can say why — a click does nothing. */}
        <button type="button" className="pb-btn pb-attach" aria-disabled="true"
          data-tooltip="Attach a file (coming soon)" aria-label="Attach a file (coming soon)"
          onClick={e => e.preventDefault()}>
          <IconAttach size={16} />
        </button>
        <textarea ref={inputRef} className="pb-input" rows={1} value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => onAttentiveChange(true)}
          onBlur={() => onAttentiveChange(false)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
          }}
          aria-label={`Message your ${who}`}
          placeholder={`Ask your ${who}…`} />
        {sending ? (
          <button key="stop" type="button" className="pb-btn pb-send pb-stop"
            data-tooltip="Stop generating" aria-label="Stop generating" onClick={onStop}>
            <IconStop size={16} />
          </button>
        ) : (
          <button key="send" type="button" className={`pb-btn pb-send${ready ? " can-send" : ""}`}
            data-tooltip="Send message" aria-label="Send message"
            disabled={!ready} onClick={submit}>
            <IconArrowUp size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
