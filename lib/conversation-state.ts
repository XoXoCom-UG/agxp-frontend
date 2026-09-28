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
import { isReadAlongCommand } from "@/lib/peer-context";
import { isDeliverableCommand } from "@/lib/deliverables";

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
    const p = parseMarkers(m.content);
    const assistant = m.role === "assistant";
    const isError = assistant && isErrorLine(m.content);
    const before = messages[i - 1];
    return {
      m, p, isError,
      isDoc: assistant && !isError && isDocReply(p, docTitle),
      isAside: assistant && !!before && before.role === "user" && isReadAlongCommand(before.content),
      isCommand: !assistant && (isDeliverableCommand(m.content) || isReadAlongCommand(m.content)),
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
  /** Was the newest answer one the agent volunteered? */
  lastIsAside: boolean;
  /** What the newest answer offers to pick from. */
  choices: string[];
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
    lastIsAside: !!last?.isAside,
    choices: last && !last.isError ? last.p.choices : [],
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
