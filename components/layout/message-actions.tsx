"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCopy, IconCheck, IconShare, IconRefresh, IconMail, IconX } from "@/components/layout/agxp-icons";
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
 * The quiet row of icons under each of the agent's answers: Copy, Share, Try again.
 * Try again is only offered on the newest answer — regenerating an older one
 * would have to throw away everything that was said after it.
 */
export function MessageActions({ text, agentName, onRetry, retryDisabled }: {
  /** The answer as plain text (markers already stripped). */
  text: string;
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
      <span className="visually-hidden" aria-live="polite">{copied ? "Copied to clipboard" : ""}</span>
      {sharing && <ShareDialog text={text} agentName={agentName} onClose={() => setSharing(false)} />}
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
