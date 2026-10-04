"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { AgentType } from "@/lib/agents";
import { IconArrowUp, IconAttach, IconStop, IconX, IconDoc } from "@/components/layout/agxp-icons";
import { ACCEPT_ATTR, uploadProjectFile, removeProjectFile, fileMarker } from "@/lib/project-files";
import type { FileRef } from "@/lib/message-markers";

/** The two 30px buttons beside the text, and the gaps between them. */
const BUTTON_W = 30;
const GAP_W = 6;
/** Slack before the text counts as not fitting on the one row. */
const FIT_SLACK = 10;
/** The textarea grows with what you write between these, then scrolls. */
const MIN_H = 30;
const MAX_H = 220;

/**
 * The prompt bar: the text, then paper clip and send — on one row while the
 * text fits, the text on top and the two buttons under it, right-aligned,
 * once it doesn't. Both buttons sit on the right (Ana, 2026-09-28): the clip
 * is a thing you do to the message you are writing, so it belongs with Send,
 * not on the far side of it. No border; the surface and its shadow do the
 * work.
 *
 * The textarea is never disabled while an answer is on its way. Disabling it
 * threw focus to the page after every message, so each reply had to be
 * clicked back into; now only sending is held until the answer lands, and
 * the send button becomes Stop in the meantime.
 */
export function ChatComposer({ role, sending, canSend, projectId, inputRef, onSend, onStop, onAttentiveChange }: {
  role: AgentType;
  sending: boolean;
  /** False until the history is in. */
  canSend: boolean;
  /** Where attachments are filed. Absent before the project exists, which is
   *  also when there is nothing to attach them to — the clip stays off. */
  projectId?: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSend: (text: string) => void;
  onStop: () => void;
  /** The agent looks at the composer while you are writing to it. */
  onAttentiveChange: (attentive: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileRef[]>([]);
  const [uploading, setUploading] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  /** One line fits beside the buttons; once it doesn't, the text takes the
   *  whole width and the buttons drop to their own row underneath. */
  const [wide, setWide] = useState(false);
  const who = role === "coach" ? "coach" : "consultant";
  // A file on its own is a message: "here, look at this" needs no sentence.
  const ready = (!!input.trim() || files.length > 0) && !sending && canSend && uploading === 0;
  const canAttach = !!projectId && !sending;

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
    // The markers ride along in the message text, so an attachment is saved,
    // reloaded and re-sent by the same path everything else uses. Nothing
    // downstream needs to know the composer did this.
    const text = [input.trim(), ...files.map(fileMarker)].filter(Boolean).join("\n");
    setInput("");
    setFiles([]);
    setFileError(null);
    onSend(text);
  }

  async function pick(list: FileList | null) {
    if (!list?.length || !projectId) return;
    setFileError(null);
    const chosen = Array.from(list);
    setUploading(n => n + chosen.length);
    for (const file of chosen) {
      try {
        const ref = await uploadProjectFile(projectId, file);
        setFiles(prev => [...prev, ref]);
      } catch (e) {
        setFileError((e as Error).message);
      } finally {
        setUploading(n => n - 1);
      }
    }
    // Lets the same file be picked again after it was removed.
    if (pickRef.current) pickRef.current.value = "";
  }

  function drop(ref: FileRef) {
    setFiles(prev => prev.filter(f => f.path !== ref.path));
    // It was uploaded the moment it was chosen, so taking the chip away has
    // to take the object with it or the bucket fills with files no message
    // ever mentions.
    void removeProjectFile(ref.path).catch(() => { /* a stray object, not the user's problem */ });
  }

  return (
    <div className={`chat-input pb${wide ? " is-wide" : ""}`}>
      <span ref={measureRef} className="pb-measure" aria-hidden="true">{input}</span>

      {(files.length > 0 || uploading > 0 || fileError) && (
        <div className="pb-files">
          {files.map(f => (
            <span key={f.path} className="pb-chip" title={f.name}>
              <IconDoc size={11} />
              <b>{f.name}</b>
              <button type="button" onClick={() => drop(f)} aria-label={`Remove ${f.name}`}>
                <IconX size={10} />
              </button>
            </span>
          ))}
          {uploading > 0 && (
            <span className="pb-chip is-busy">
              <IconDoc size={11} />
              <b>{uploading === 1 ? "Uploading…" : `Uploading ${uploading}…`}</b>
            </span>
          )}
          {fileError && <span className="pb-file-error" role="alert">{fileError}</span>}
        </div>
      )}

      <div ref={controlsRef} className="pb-grid">
        <textarea ref={inputRef} className="pb-input" rows={1} value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => onAttentiveChange(true)}
          onBlur={() => onAttentiveChange(false)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
          }}
          aria-label={`Message your ${who}`}
          placeholder={`Ask your ${who}…`} />
        {/* aria-disabled rather than disabled while it cannot be used, so it
            stays focusable and the tooltip can say why. */}
        <input ref={pickRef} type="file" className="visually-hidden" multiple
          accept={ACCEPT_ATTR} tabIndex={-1} aria-hidden="true"
          onChange={e => pick(e.target.files)} />
        <button type="button" className="pb-btn pb-attach"
          aria-disabled={!canAttach || undefined}
          data-tooltip={canAttach ? "Attach a file" : sending ? "Wait for the answer" : "Not available yet"}
          aria-label="Attach a file"
          onClick={() => { if (canAttach) pickRef.current?.click(); }}>
          <IconAttach size={16} />
        </button>
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
