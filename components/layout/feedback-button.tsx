"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { IconCheck, IconX } from "@/components/layout/agxp-icons";
import { sendFeedback, projectIdFromPath } from "@/lib/send-feedback";
import { useAuth } from "@/lib/auth-context";
import { FEEDBACK_MAX } from "@/lib/feedback-text";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useExit } from "@/lib/use-exit";

/**
 * The tester's way to tell us what is good or broken (sedinta 2026-10-23).
 * A tab on the edge of every signed-in screen; it opens the dialog below.
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="fb-tab" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Feedback
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The conversation may hold trade secrets, so sharing it is a box the person
 * ticks, off by default, and the dialog says exactly what goes with it. With no
 * project open there is nothing to attach and the box is not offered.
 */
function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const projectId = projectIdFromPath(pathname);
  const ref = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useDialogFocus(ref, field);
  const [closing, exitThen] = useExit();
  const close = () => exitThen(onClose);
  const [message, setMessage] = useState("");
  const [withChat, setWithChat] = useState(false);
  const [serious, setSerious] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const doneButton = useRef<HTMLButtonElement>(null);

  // The form's own field is gone once it was sent: put focus on what is left.
  useEffect(() => {
    if (state === "sent") doneButton.current?.focus();
  }, [state]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") exitThen(onClose); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, exitThen]);

  async function send() {
    if (!message.trim() || state === "sending") return;
    setState("sending");
    setError("");
    try {
      await sendFeedback({ message, includeConversation: withChat, serious, projectId, pathname });
      setState("sent");
    } catch (e) {
      setState("idle");
      setError((e as Error).message || "The feedback couldn't be sent. Try again.");
    }
  }

  return createPortal(
    <div className={`modal-overlay${closing ? " is-closing" : ""}`}
      onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div ref={ref} className="modal share-modal" role="dialog" aria-modal="true" aria-label="Send feedback">
        <div className="share-head">
          <h2>Send feedback</h2>
          <button className="share-close" onClick={close} aria-label="Close"><IconX size={14} /></button>
        </div>
        {state === "sent" ? (
          <div className="fb-done" role="status">
            <p className="fb-done-title"><IconCheck size={16} /> Thank you, we got it.</p>
            <p className="fb-done-lead">Here is what happens next:</p>
            <ul className="fb-next">
              <li>The team reads feedback in order of how serious it is, the most serious first.</li>
              {serious && <li>You marked it as a serious problem, so we alert the team straight away.</li>}
              {withChat && projectId && <li>The conversation of this project went with it. Only the team can read it.</li>}
              <li>
                If we have a question, we may write to {user?.email ?? "the email of your account"}.
                We cannot answer every message, but we read all of them and use them to improve AgentiX.
              </li>
            </ul>
            <div className="report-actions">
              <button ref={doneButton} className="btn btn-hero" onClick={close}>Close</button>
            </div>
          </div>
        ) : (
          <>
            <textarea ref={field} className="report-note fb-note" value={message} maxLength={FEEDBACK_MAX} rows={5}
              aria-label="What worked, what didn't, what is missing?"
              placeholder="What worked, what didn't, what is missing?" onChange={e => setMessage(e.target.value)} />
            <label className="fb-check">
              <input type="checkbox" checked={serious} onChange={e => setSerious(e.target.checked)} />
              <span>
                <strong>This is a serious problem</strong>
                <small>Something is broken or blocks you. The team gets an email right away.</small>
              </span>
            </label>
            {/* Always drawn, so it is clear the choice exists; with no project open
                there is nothing to attach and it says so instead of vanishing. */}
            <label className={`fb-check${projectId ? "" : " is-off"}`}>
              <input type="checkbox" checked={projectId ? withChat : false} disabled={!projectId}
                onChange={e => setWithChat(e.target.checked)} />
              <span>
                <strong>Send this project&rsquo;s conversation too</strong>
                <small>
                  {projectId
                    ? "Both chats, so the team can see what happened. They may contain business details."
                    : "Open a project first: there is no conversation to send from here."}
                </small>
              </span>
            </label>
            <p className="report-hint">
              {withChat
                ? "Sent to the AgentiX team: your message and both conversations of this project."
                : "Sent to the AgentiX team: only your message. Nothing from your chats."}
              {serious && " The email carries your message, never the conversation."}
            </p>
            {error && <p className="ss-error" role="alert">{error}</p>}
            <div className="report-actions">
              <button className="btn btn-hero" disabled={!message.trim() || state === "sending"} onClick={send}>
                {state === "sending" ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
