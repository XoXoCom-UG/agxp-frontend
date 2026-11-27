"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Entry } from "@/lib/conversation-state";
import { errorText } from "@/lib/conversation-state";
import {
  isDeliverableCommand, isSkipCommand, skippedStation, isDiscussCommand, discussedMethod, isOptimizeCommand,
  isJumpCommand, isFocusCommand, cockpitStation,
} from "@/lib/deliverables";
import { md } from "@/lib/markdown";
import { streamingText, streamIsDocument } from "@/lib/message-markers";
import { ThinkingOrb } from "@/components/layout/thinking-orb";
import { MessageActions } from "@/components/layout/message-actions";
import { IconArrow, IconCheck, IconDoc, IconRefresh } from "@/components/layout/agxp-icons";
import { useT } from "@/lib/language";
import { CONVERSATION_LIMIT_MESSAGE, upgradeTarget, PLANS } from "@/lib/plans";
import { useEntitlement } from "@/lib/entitlement";
import { startCheckout } from "@/lib/billing";

/**
 * The two ways on when a conversation has reached its plan's ceiling: a new
 * project, or the next plan up through Stripe. Try again is not offered — the
 * same conversation would be refused again.
 */
function ConversationLimitActions() {
  const tr = useT();
  const router = useRouter();
  const { plan } = useEntitlement();
  const next = upgradeTarget(plan.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <div className="me-actions">
        <button className="me-retry" onClick={() => router.push("/dashboard?new=1")}>{tr("Start a new project")}</button>
        {next && (
          <button className="me-retry" disabled={busy} onClick={() => {
            setBusy(true);
            setErr(null);
            startCheckout(next).catch((e: Error) => { setErr(e.message); setBusy(false); });
          }}>
            {tr("Upgrade to {plan}", { plan: PLANS[next].label })}
          </button>
        )}
      </div>
      {err && <div className="me-detail">{err}</div>}
    </>
  );
}

/** "10:24" — shown under each message in the Coach's conversation. */
function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** The suggested answers under the newest reply. Keys 1-3 pick them too
 *  (lib/use-choice-keys.ts), so the order here is the order of the keys.
 *  When more than one answer can be true (multi), a tap ticks instead of
 *  answering, and "Send" answers with every ticked option at once. */
function Choices({ choices, multi, ticked, disabled, onPick, onSendTicked }: {
  choices: string[]; multi: boolean; ticked: string[]; disabled: boolean;
  onPick: (c: string) => void; onSendTicked: () => void;
}) {
  const tr = useT();
  const count = choices.filter(c => ticked.includes(c)).length;
  return (
    <div className={`sugg-list${multi ? " is-multi" : ""}`} role="group" aria-label={tr("Suggested answers")}>
      {multi && <div className="sugg-hint">{tr("Pick one or more")}</div>}
      {choices.map((c, ci) => {
        const on = multi && ticked.includes(c);
        return (
          <button key={`${ci}-${c}`} className={`sugg-item${on ? " is-on" : ""}`} disabled={disabled}
            onClick={() => onPick(c)} aria-pressed={multi ? on : undefined}
            style={{ ["--i" as string]: ci }}>
            {/* No printed number — the keys still pick. */}
            {multi && <span className="sugg-box" aria-hidden="true">{on && <IconCheck size={12} />}</span>}
            <span className="s">{c}</span>
            {!multi && <IconArrow />}
          </button>
        );
      })}
      {multi && (
        <button className="sugg-send" disabled={disabled || count === 0} onClick={onSendTicked}>
          {count > 0 ? tr("Send ({n})", { n: count }) : tr("Send")}
          <IconArrow />
        </button>
      )}
    </div>
  );
}

/**
 * One turn of the conversation, in whichever of its shapes it takes: what
 * the person wrote, a document command, a failed answer, the finished
 * document as a card, or an ordinary answer.
 */
export function ChatMessage({ entry, agentName, docTitle, isNew, isLeaving, isLast, version, sending, busy, onRetry, onPick, ticked = [], onSendTicked, onOpenDoc }: {
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
  /** The options ticked so far, when the question takes several answers. */
  ticked?: string[];
  onSendTicked?: () => void;
  onOpenDoc: (title: string) => void;
}) {
  const tr = useT();
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
    if (isSkipCommand(m.content)) {
      return (
        <div className="msg-command">
          <IconArrow size={11} />
          <span>{tr("You skipped: {label}", { label: skippedStation(m.content) })}</span>
        </div>
      );
    }
    if (isDiscussCommand(m.content)) {
      return (
        <div className="msg-command">
          <IconArrow size={11} />
          <span>{tr("You opened: {label}", { label: discussedMethod(m.content) })}</span>
        </div>
      );
    }
    if (isJumpCommand(m.content) || isFocusCommand(m.content)) {
      return (
        <div className="msg-command">
          <IconArrow size={11} />
          <span>{tr(isJumpCommand(m.content) ? "You started at: {label}" : "You chose first: {label}", { label: cockpitStation(m.content) })}</span>
        </div>
      );
    }
    if (isOptimizeCommand(m.content)) {
      return (
        <div className="msg-command">
          <IconArrow size={11} />
          <span>{tr("You asked to optimize all methods")}</span>
        </div>
      );
    }
    if (isDeliverableCommand(m.content)) {
      return (
        <div className="msg-command">
          <IconRefresh size={11} />
          <span>{tr("You asked for the {title}", { title: docTitle })}</span>
        </div>
      );
    }
    if (entry.isCommand) return null;
    // m.content, not p.text, when there is nothing to strip: a person may
    // legitimately type square brackets, and parsing a plain message would
    // quietly eat them. With an attachment the marker has to come out.
    return (
      <>
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
        {m.column_type === "coach" && <time className="msg-time is-user" dateTime={m.created_at}>{clock(m.created_at)}</time>}
      </>
    );
  }

  if (entry.isError) {
    const atLimit = errorText(m.content) === CONVERSATION_LIMIT_MESSAGE;
    return (
      <div className={`msg-agent msg-error${isLeaving ? " is-leaving" : ""}`} role="alert">
        <div className="me-title">{agentName} couldn&apos;t answer</div>
        <div className="me-detail">{atLimit ? tr(CONVERSATION_LIMIT_MESSAGE) : errorText(m.content)}</div>
        {isLast && atLimit && <ConversationLimitActions />}
        {isLast && !atLimit && (
          <button className="me-retry" onClick={onRetry} disabled={busy}>
            <IconRefresh size={13} />{tr("Try again")}
          </button>
        )}
      </div>
    );
  }

  const cls = `${isNew ? " is-new" : ""}${isLeaving ? " is-leaving" : ""}`;
  const choices = isLast && p.choices.length > 0 && !sending
    ? <Choices choices={p.choices} multi={p.multi} ticked={ticked} disabled={sending}
        onPick={onPick} onSendTicked={onSendTicked ?? (() => {})} />
    : null;
  const actions = (
    <MessageActions text={p.text} agentName={agentName} messageId={m.id}
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
              {version > 1 && `${tr("Version {n}", { n: version })} · `}{tr("{n} sections · {words} words · open to read", { n: sections, words: wordCount(p.text).toLocaleString() })}
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
      {m.column_type === "coach" && <time className="msg-time" dateTime={m.created_at}>{clock(m.created_at)}</time>}
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
  const tr = useT();
  if (!streamText) {
    return (
      <div className="msg-typing"><ThinkingOrb size={26} />
        <span className="shimmer-text">
          {waitingLong ? tr("Still writing. Long answers take a moment.") : tr("{name} is reading what you wrote…", { name: agentName })}
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
            <span className="dc-t">{tr("Writing your {title}…", { title: docTitle })}</span>
            <span className="dc-s">{tr("{n} words so far", { n: wordCount(streamText).toLocaleString() })}</span>
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
