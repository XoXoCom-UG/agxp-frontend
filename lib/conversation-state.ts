/**
 * conversation-state.ts — everything the chat panel reads off its message
 * list, computed in one pass and without React.
 *
 * Markers are stored verbatim and re-parsed on render (lib/message-markers.ts).
 * The panel used to call parseMarkers on the same message five or six times
 * per render — for the rail, the version list, the choices, the snapshot, the
 * bubble itself. It now parses each message once, here, and everything else
 * reads the result.
 */

import type { ProjectMessage } from "@/lib/projects";
import { parseMarkers, looksLikeDocument, type ParsedMessage, type TopicMarker } from "@/lib/message-markers";
import { isReadAlongCommand, isReviewCommand } from "@/lib/peer-context";

/** A turn the machine sent, not the person: never shown, never named a project. */
const isUnprompted = (t: string) => isReadAlongCommand(t) || isReviewCommand(t);
import {
  isDeliverableCommand, isDiscussCommand, isOptimizeCommand, isJumpCommand, isFocusCommand, isSkipCommand,
} from "@/lib/deliverables";

/**
 * Has the interview begun? Asked for with a Cockpit button (improve all, start
 * here, only this one first, skip), or the person answered something after
 * their first message — typed, or a choice clicked. Until then the first
 * message is only the project, and the consultant's reply only the draft.
 */
export function interviewHasStarted(messages: { role: string; content: string }[]): boolean {
  let typed = 0;
  for (const m of messages) {
    if (m.role !== "user") continue;
    const t = m.content;
    if (isOptimizeCommand(t) || isJumpCommand(t) || isFocusCommand(t) || isSkipCommand(t)) return true;
    if (!isDeliverableCommand(t) && !isUnprompted(t) && !isErrorLine(t)) typed++;
    if (typed >= 2) return true;
  }
  return false;
}

/** A failed turn is kept in the list (never saved) with this prefix. */
export const ERROR_PREFIX = "Error: ";
export function isErrorLine(content: string): boolean { return content.startsWith(ERROR_PREFIX); }
/** The sentence a failed turn shows — already worded for a person when it was made. */
export function errorText(content: string): string { return content.slice(ERROR_PREFIX.length); }

/** Is this reply the deliverable? The marker says so, or its shape does. */
export function isDocReply(p: ParsedMessage, docTitle: string): boolean {
  return !!p.doc || looksLikeDocument(p.text, docTitle);
}

/** One message, parsed once. */
export interface Entry {
  m: ProjectMessage;
  p: ParsedMessage;
  /** A failed turn that was never saved. */
  isError: boolean;
  /** The finished document (assistant only). */
  isDoc: boolean;
  /** An answer the agent volunteered after reading along (assistant only). */
  isAside: boolean;
  /** A user turn that is really a button press — a document or read-along command. */
  isCommand: boolean;
}

export function parseEntries(messages: ProjectMessage[], docTitle: string): Entry[] {
  return messages.map((m, i) => {
    const parsed = parseMarkers(m.content);
    const assistant = m.role === "assistant";
    const isError = assistant && isErrorLine(m.content);
    const before = messages[i - 1];
    // An answer to a Cockpit button (open a method, improve all) offers where to
    // go next — "Tell me more", "Change it", "Back to the methods" — and only one
    // of those can be taken: one tap sends it, no boxes to tick (clean-up pass
    // 2026-11-27). Every other list stays a multiple choice (Ana, 2026-11-20).
    const afterCockpit = assistant && !!before && before.role === "user"
      && (isDiscussCommand(before.content) || isOptimizeCommand(before.content));
    const p = afterCockpit ? { ...parsed, multi: false } : parsed;
    return {
      m, p, isError,
      isDoc: assistant && !isError && isDocReply(p, docTitle),
      // Both unprompted turns wear the same card: one is the Coach reading
      // along, the other is it reviewing the finished document. Neither was
      // asked for, which is the thing the card is saying.
      isAside: assistant && !!before && before.role === "user" && isUnprompted(before.content),
      isCommand: !assistant && (isDeliverableCommand(m.content) || isUnprompted(m.content)),
    };
  });
}

export interface ConversationState {
  /** Interview progress, 0-100, from the newest PROGRESS marker. */
  pct: number;
  /** The newest TOPIC marker. */
  station: TopicMarker | null;
  /** Every version of the deliverable, oldest first. */
  docs: Entry[];
  /** message id → 1-based version, for the document cards in the list. */
  versionOf: Map<string, number>;
  lastAssistantIdx: number;
  /** What the newest answer offers to pick from. */
  choices: string[];
  /** Those choices take more than one answer ([[CHOICES+: ...]]). */
  multi: boolean;
}

export function deriveConversation(entries: Entry[]): ConversationState {
  // How far the interview has got: the newest assistant message that carries
  // each marker wins, so reloading history rebuilds the same rail.
  let pct: number | null = null;
  let station: TopicMarker | null = null;
  let lastAssistantIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    const { m, p } = entries[i];
    if (m.role !== "assistant") continue;
    if (lastAssistantIdx < 0) lastAssistantIdx = i;
    if (pct === null && p.progress !== null) pct = p.progress;
    if (station === null && p.topic) station = p.topic;
    if (pct !== null && station !== null) break;
  }
  // Each regeneration is a full rebuild, so they are numbered versions.
  const docs = entries.filter(e => e.isDoc);
  const last = lastAssistantIdx >= 0 ? entries[lastAssistantIdx] : null;
  return {
    pct: pct ?? 0,
    station,
    docs,
    versionOf: new Map(docs.map((d, i) => [d.m.id, i + 1])),
    lastAssistantIdx,
    choices: last && !last.isError ? last.p.choices : [],
    multi: !!last && !last.isError && last.p.multi,
  };
}

/**
 * A reply stopped halfway can end inside a marker ("[[CHOICES: a|b"). Saved
 * as it is, that fragment would be on screen for good, since only complete
 * markers are parsed out. Complete ones stay — they are stored verbatim.
 */
export function cutUnfinishedMarker(raw: string): string {
  const open = raw.lastIndexOf("[[");
  if (open >= 0 && raw.indexOf("]]", open) === -1) return raw.slice(0, open).trimEnd();
  return raw.trimEnd();
}
