"use client";

import { useMemo } from "react";
import type { Entry } from "@/lib/conversation-state";
import { errorText } from "@/lib/conversation-state";
import { isDeliverableCommand } from "@/lib/deliverables";
import { md } from "@/lib/markdown";
import { streamingText, streamIsDocument } from "@/lib/message-markers";
import { ThinkingOrb } from "@/components/layout/thinking-orb";
import { MessageActions } from "@/components/layout/message-actions";
import { IconArrow, IconDoc, IconRefresh } from "@/components/layout/agxp-icons";

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** The suggested answers under the newest reply. Keys 1-3 pick them too
 *  (lib/use-choice-keys.ts), so the order here is the order of the keys. */
function Choices({ choices, disabled, onPick }: { choices: string[]; disabled: boolean; onPick: (c: string) => void }) {
  return (
    <div className="sugg-list" role="group" aria-label="Suggested answers">
      {choices.map((c, ci) => (
        <button key={c} className="sugg-item" disabled={disabled} onClick={() => onPick(c)}
          style={{ ["--i" as string]: ci }}>
          {/* No printed number — the keys still pick. */}
          <span className="s">{c}</span>
          <IconArrow />
        </button>
      ))}
    </div>
  );
}

/**
 * One turn of the conversation, in whichever of its shapes it takes: what
 * the person wrote, a document command, a failed answer, the finished
 * document as a card, or an ordinary answer.
 */
export function ChatMessage({ entry, agentName, docTitle, isNew, isLeaving, isLast, version, sending, busy, onRetry, onPick, onOpenDoc }: {
  entry: Entry;
  agentName: string;
  docTitle: string;
  /** Arrived after the history loaded, and was not streamed into view. */
  isNew: boolean;
  /** Being replaced by Try again, fading out. */
  isLeaving: boolean;
  /** The newest answer — the only one offering Try again and suggestions. */
  isLast: boolean;
  /** 1-based, for a document card. */
  version: number;
  sending: boolean;
  /** A reply is on its way or one is being replaced; Try again waits. */
  busy: boolean;
  onRetry: () => void;
  onPick: (choice: string) => void;
  onOpenDoc: (title: string) => void;
}) {
  const { m, p } = entry;
  // Rendered once per message text, not on every keystroke in the composer.
  const html = useMemo(
    () => (m.role === "assistant" && !entry.isError && !entry.isDoc ? md(p.text) : ""),
    [m.role, entry.isError, entry.isDoc, p.text],
  );

  if (m.role === "user") {
    // The document buttons send their prompt as a user turn so the model
    // has it. It is a command, not something the person wrote, so it shows
    // as a single line instead of a wall of prompt text in the conversation.
    if (isDeliverableCommand(m.content)) {
      return (
        <div className="msg-command">
          <IconRefresh size={11} />
          <span>You asked for the {docTitle}</span>
        </div>
      );
    }
    if (entry.isCommand) return null;
    // m.content, not p.text, when there is nothing to strip: a person may
    // legitimately type square brackets, and parsing a plain message would
    // quietly eat them. With an attachment the marker has to come out.
    return (
      <div className={`msg-user${isNew ? " is-new" : ""}`}>
        {p.files.length > 0 && (
          <span className="mu-files">
            {p.files.map(f => (
              <span key={f.path} className="mu-chip" title={f.name}>
                <IconDoc size={11} />{f.name}
              </span>
            ))}
          </span>
        )}
        {p.files.length ? p.text : m.content}
      </div>
    );
  }

  if (entry.isError) {
    return (
      <div className={`msg-agent msg-error${isLeaving ? " is-leaving" : ""}`} role="alert">
        <div className="me-title">{agentName} couldn&apos;t answer</div>
        <div className="me-detail">{errorText(m.content)}</div>
        {isLast && (
          <button className="me-retry" onClick={onRetry} disabled={busy}>
            <IconRefresh size={13} />Try again
          </button>
        )}
      </div>
    );
  }

  const cls = `${isNew ? " is-new" : ""}${isLeaving ? " is-leaving" : ""}`;
  const choices = isLast && p.choices.length > 0 && !sending
    ? <Choices choices={p.choices} disabled={sending} onPick={onPick} />
    : null;
  const actions = (
    <MessageActions text={p.text} agentName={agentName}
      onRetry={isLast ? onRetry : undefined} retryDisabled={busy} />
  );

  // A generated document is a document, not a 2000-word chat bubble.
  if (entry.isDoc) {
    const title = p.doc || docTitle;
    const sections = (p.text.match(/^##\s+\S/gm) ?? []).length;
    return (
      <div className={`msg-agent${cls}`}>
        <button className="doc-card" onClick={() => onOpenDoc(title)}>
          <span className="dc-ic"><IconDoc size={17} /></span>
          <span className="dc-txt">
            <span className="dc-t">{title}</span>
            <span className="dc-s">
              {version > 1 && `Version ${version} · `}{sections} sections · {wordCount(p.text).toLocaleString()} words · open to read
            </span>
          </span>
          <IconArrow />
        </button>
        {actions}
        {choices}
      </div>
    );
  }

  return (
    <div className={`msg-agent${entry.isAside ? " aside" : ""}${cls}`}>
      {/* Nobody asked for this one. The card it sits in says so on its own —
          the blue "Read along" label that used to head it is gone with the
          rest of the status words (Ana, 2026-09-28). */}
      <div className="txt" dangerouslySetInnerHTML={{ __html: html }} />
      {actions}
      {choices}
    </div>
  );
}

/**
 * The answer as it is written. A document is not streamed into the chat as a
 * wall of text — it says what it is building instead. Before the first word,
 * the orb and an honest line about what is happening.
 */
export function ChatStreaming({ streamText, agentName, docTitle, waitingLong }: {
  streamText: string;
  agentName: string;
  docTitle: string;
  waitingLong: boolean;
}) {
  if (!streamText) {
    return (
      <div className="msg-typing"><ThinkingOrb size={26} />
        <span className="shimmer-text">
          {waitingLong ? "Still writing. Long answers take a moment." : `${agentName} is reading what you wrote…`}
        </span>
      </div>
    );
  }
  if (streamIsDocument(streamText)) {
    return (
      <div className="msg-agent">
        <div className="doc-card writing">
          <span className="dc-ic"><IconDoc size={17} /></span>
          <span className="dc-txt">
            <span className="dc-t">Writing your {docTitle}…</span>
            <span className="dc-s">{wordCount(streamText).toLocaleString()} words so far</span>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="msg-agent streaming">
      <div className="txt" dangerouslySetInnerHTML={{ __html: md(streamingText(streamText)) }} />
    </div>
  );
}
