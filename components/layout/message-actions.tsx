"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCopy, IconCheck, IconShare, IconRefresh, IconMail, IconX, IconAlert } from "@/components/layout/agxp-icons";
import { reportAnswer, type ReportReason } from "@/lib/report-answer";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useExit } from "@/lib/use-exit";

/** Clipboard with a fallback for the cases the async API refuses (an
 *  unfocused document, an insecure origin during local testing). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * The quiet row of icons under each of the agent's answers: Copy, Share, Try again,
 * and Report — the way to tell us an answer was wrong or harmful.
 * Try again is only offered on the newest answer — regenerating an older one
 * would have to throw away everything that was said after it.
 */
export function MessageActions({ text, agentName, messageId, onRetry, retryDisabled }: {
  /** The answer as plain text (markers already stripped). */
  text: string;
  /** The stored answer, so a report can point at it. */
  messageId?: string;
  agentName: string;
  /** Omitted on every answer but the latest. */
  onRetry?: () => void;
  retryDisabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  /** Once the icon has swapped, every later swap animates; the first render
   *  of each answer's bar must not. */
  const [swapped, setSwapped] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    if (!(await copyText(text))) return;
    setSwapped(true);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="msg-actions" role="group" aria-label="Answer actions">
      {/* Icons only; the name is in the tooltip and the accessible label. */}
      <button className={`ma-btn${copied ? " is-done" : ""}`} onClick={copy}
        aria-label={copied ? "Copied" : "Copy"} data-tooltip={copied ? "Copied" : "Copy"}>
        {copied
          ? <IconCheck size={14} className="icon-swap" />
          : <IconCopy size={14} className={swapped ? "icon-swap" : undefined} />}
      </button>
      <button className="ma-btn" onClick={() => setSharing(true)} aria-label="Share" data-tooltip="Share">
        <IconShare size={14} />
      </button>
      {onRetry && (
        <button className="ma-btn" onClick={onRetry} disabled={retryDisabled}
          aria-label="Try again" data-tooltip="Try again">
          <IconRefresh size={14} />
        </button>
      )}
      <button className="ma-btn" onClick={() => setReporting(true)}
        aria-label="Report this answer" data-tooltip="Report a problem">
        <IconAlert size={14} />
      </button>
      <span className="visually-hidden" aria-live="polite">{copied ? "Copied to clipboard" : ""}</span>
      {sharing && <ShareDialog text={text} agentName={agentName} onClose={() => setSharing(false)} />}
      {reporting && <ReportDialog text={text} messageId={messageId} onClose={() => setReporting(false)} />}
    </div>
  );
}

function ShareDialog({ text, agentName, onClose }: { text: string; agentName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);
  const [closing, exitThen] = useExit();
  const close = () => exitThen(onClose);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const title = `${agentName} · AgentiX`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") exitThen(onClose); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, exitThen]);

  async function nativeShare() {
    try { await navigator.share({ title, text }); close(); } catch { /* dismissed */ }
  }

  async function copy() {
    if (await copyText(text)) setCopied(true);
  }

  // Mail clients cap the body length; past this the draft simply fails to open.
  const mailBody = text.length > 1800 ? `${text.slice(0, 1800)}…` : text;
  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(mailBody)}`;

  return createPortal(
    <div className={`modal-overlay${closing ? " is-closing" : ""}`}
      onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div ref={ref} className="modal share-modal" role="dialog" aria-modal="true" aria-label="Share this answer">
        <div className="share-head">
          <h2>Share this answer</h2>
          <button className="share-close" onClick={close} aria-label="Close"><IconX size={14} /></button>
        </div>
        <div className="share-preview">{text}</div>
        <div className="share-options">
          {canNativeShare && (
            <button className="share-opt" onClick={nativeShare}>
              <IconShare size={15} /><span>Share via…</span>
            </button>
          )}
          <button className={`share-opt${copied ? " is-done" : ""}`} onClick={copy}>
            {copied ? <IconCheck size={15} className="icon-swap" /> : <IconCopy size={15} />}
            <span>{copied ? "Copied" : "Copy text"}</span>
          </button>
          <a className="share-opt" href={mailto} onClick={close}>
            <IconMail size={15} /><span>Send by email</span>
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "wrong", label: "Wrong or made up" },
  { id: "harmful", label: "Harmful or inappropriate" },
  { id: "other", label: "Something else" },
];

/**
 * Report an answer. What is sent is said on the dialog itself: the reason,
 * the note, and the start of the answer — not the rest of the project.
 */
function ReportDialog({ text, messageId, onClose }: { text: string; messageId?: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);
  const [closing, exitThen] = useExit();
  const close = () => exitThen(onClose);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") exitThen(onClose); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, exitThen]);

  async function send() {
    if (!reason) return;
    setState("sending");
    setError("");
    try {
      await reportAnswer({ messageId, reason, note, excerpt: text });
      setState("sent");
    } catch (e) {
      setState("idle");
      setError((e as Error).message || "The report couldn't be sent. Try again.");
    }
  }

  return createPortal(
    <div className={`modal-overlay${closing ? " is-closing" : ""}`}
      onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div ref={ref} className="modal share-modal" role="dialog" aria-modal="true" aria-label="Report this answer">
        <div className="share-head">
          <h2>Report this answer</h2>
          <button className="share-close" onClick={close} aria-label="Close"><IconX size={14} /></button>
        </div>
        {state === "sent" ? (
          <p className="report-done"><IconCheck size={14} /> Thanks — the team will look at it.</p>
        ) : (
          <>
            <div className="share-options" role="radiogroup" aria-label="What is wrong with it?">
              {REASONS.map(r => (
                <button key={r.id} role="radio" aria-checked={reason === r.id}
                  className={`share-opt${reason === r.id ? " is-done" : ""}`} onClick={() => setReason(r.id)}>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
            <textarea className="report-note" value={note} maxLength={1000} rows={3}
              aria-label="What should it have said? (optional)"
              placeholder="What should it have said? (optional)" onChange={e => setNote(e.target.value)} />
            <p className="report-hint">
              Sent to the AgentiX team with the first lines of this answer. Nothing else from your project.
            </p>
            {error && <p className="ss-error" role="alert">{error}</p>}
            <div className="report-actions">
              <button className="btn btn-hero" disabled={!reason || state === "sending"} onClick={send}>
                {state === "sending" ? "Sending…" : "Send report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
