import type { AgentType } from "@/lib/agents";
import { parseMarkers, type TopicMarker } from "@/lib/message-markers";
import { stripMarkerSyntax } from "@/lib/chat-input";
import type { DeliverableDoc } from "@/components/layout/deliverable-view";

/**
 * What one panel tells the other one about its conversation.
 *
 * Patryk's review (2026-09-25): "bisher kann der Coach nicht lesen, was links
 * passiert" — and he was right. Each panel used to send only its own history,
 * so the two agents worked the same project blind to each other and asked the
 * user the same questions twice.
 */
export interface PeerContext {
  role: AgentType;
  /** The other agent's display name, so this one can cite it by name. */
  name: string;
  /** Plain-text transcript, oldest first, markers already stripped. */
  transcript: string;
  /** How many times the other agent has answered. Drives the nudge below. */
  turns: number;
  /** Finished documents the other agent has produced. A new one is what
   *  triggers the second reader (see REVIEW_PROMPT). */
  docs: number;
}

/**
 * How much of the other conversation travels with every request. This is paid
 * for on each message, by both panels, so it is a budget and not a nicety:
 * the newest turns are the ones that matter, and older ones fall off the top.
 */
const MAX_CHARS = 4000;
const MAX_TURNS = 24;
/** One rambling answer must not eat the whole budget on its own. */
const MAX_PER_TURN = 420;

function shorten(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= MAX_PER_TURN ? t : `${t.slice(0, MAX_PER_TURN - 1).trimEnd()}…`;
}

/**
 * Builds the compact transcript the other agent gets to read.
 *
 * Markers are stripped — `[[CHOICES:]]` and friends are a contract between the
 * model and this app's renderer, and feeding one model's protocol output to
 * another model as conversation is how you teach it to emit markers in the
 * wrong panel.
 */
export function peerTranscript(
  messages: { role: "user" | "assistant"; content: string }[],
  agentName: string,
): string {
  const lines: string[] = [];
  let budget = MAX_CHARS;

  // Walk backwards so that when the budget runs out it is the oldest turns
  // that are dropped, then flip once at the end.
  for (let i = messages.length - 1; i >= 0 && lines.length < MAX_TURNS; i--) {
    const m = messages[i];
    // User turns lose marker syntax as well: a user can type "[[DOC: …]]",
    // and this text goes into the OTHER agent's system prompt.
    const body = shorten(m.role === "assistant" ? parseMarkers(m.content).text : stripMarkerSyntax(m.content));
    if (!body) continue;
    const line = `${m.role === "assistant" ? agentName : "Nutzer"}: ${body}`;
    if (line.length > budget) break;
    budget -= line.length + 1;
    lines.push(line);
  }

  return lines.reverse().join("\n");
}

/**
 * What a chat panel publishes upward on every change.
 *
 * The screen owns these — it is the only place that can see both panels at
 * once, so it is where one conversation is handed to the other agent, and
 * where the folded-away Coach gets the line it shows on its pill.
 */
/** The document rail's state — what the Methods panel draws for the Consultant. */
export interface RailState {
  title: string;
  totalStations: number;
  /** 0-based; -1 before the first answer. */
  stationIdx: number;
  stationLabel: string;
  currentDoc: DeliverableDoc | null;
  /** The version Open shows: the newest, or the one Restore brought back. */
  version: number;
  restored: boolean;
  versions: { version: number; createdAt: string }[];
}

/** What the rail can do. One object per panel, with a stable identity: the
 *  functions inside call whatever the panel currently holds. */
export interface RailControls {
  generate: () => void;
  regenerate: () => void;
  openVersion: (version: number) => void;
  restoreVersion: (version: number) => void;
}

export interface PanelSnapshot {
  name: string;
  transcript: string;
  /** The last thing the agent said here, trimmed for a one-line preview. */
  lastLine: string;
  /** Replies this agent has given — the other panel counts them to decide
   *  when enough has happened to be worth speaking up about. */
  agentTurns: number;
  /** Finished documents produced here. */
  docCount: number;
  /** How far the interview has got, 0-100, and the station it is at. The
   *  Methods panel beside the chat draws both. */
  pct: number;
  station: TopicMarker | null;
  rail: RailState;
  controls: RailControls;
  busy: boolean;
}

/** One line of preview: no markdown, no headings, no wall of text. */
export function previewLine(text: string, max = 120): string {
  const t = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/* ---------------------------------------------------------------------------
   THE COACH SPEAKS UP BY ITSELF

   Asked for on 2026-09-26: reading the other conversation shouldn't only
   make the Coach better at answering — sometimes it should be the reason it
   says something at all, the way a live-support widget surfaces a message
   you didn't ask for.

   Sent as a normal user turn because that is the only way the model sees it,
   but never shown as one: the UI recognises it and draws a quiet line
   instead, and badges the answer that follows.
   --------------------------------------------------------------------------- */

export const READ_ALONG_PROMPT =
  "(Systemhinweis, nicht vom Nutzer geschrieben. Du hast das parallele Gespräch mitgelesen. " +
  "Melde dich EINMAL kurz von selbst: HÖCHSTENS zwei Sätze dazu, was dir dort an der MENSCHLICHEN " +
  "Seite aufgefallen ist — wer Kontrolle abgibt, wer übergangen wird, wo Widerstand entsteht — " +
  "und genau eine Frage dazu. Keine Begrüßung, keine Zusammenfassung des Gesagten, kein Dokument, " +
  "und wiederhole nicht, was der andere Agent ohnehin schon abdeckt.)";

export function isReadAlongCommand(text: string): boolean {
  return text.trim() === READ_ALONG_PROMPT.trim();
}

/**
 * How many replies the other agent gives between two nudges. Every nudge is
 * a paid model call the user did not ask for, so this is deliberately slow:
 * often enough to feel like someone is listening, rare enough that it never
 * feels like a second agent talking over the first.
 */
/* ---------------------------------------------------------------------------
   THE SECOND READER

   Patryk's whole argument for the Lexicon (2026-10-02, 00:33:33) was that
   someone who was not in the conversation gets the printed document and has
   to understand it. But the document is written by the agent that ran the
   interview, and that agent knows everything — it cannot tell what it left
   out, because nothing is missing from where it is standing.

   The other agent can. It has read the conversation but did not write the
   document, which is as close to a stranger as we can get for free, and the
   channel for it already exists.
   --------------------------------------------------------------------------- */

export const REVIEW_PROMPT =
  "(Systemhinweis, nicht vom Nutzer geschrieben. Der andere Agent hat gerade sein Dokument " +
  "fertiggestellt. Lies es als jemand, der beim Gespräch NICHT dabei war: dieser Mensch bekommt " +
  "nur das PDF. Nenne HÖCHSTENS zwei Stellen, an denen so jemand aussteigen würde — ein Begriff " +
  "ohne Erklärung, eine Zahl ohne Bezug, eine Empfehlung ohne Begründung. Keine Lobeshymne, keine " +
  "Zusammenfassung, keine Stilkritik. Wenn das Dokument allein verständlich ist, sag genau das in " +
  "einem Satz. Zwei bis drei Sätze insgesamt, danach eine Frage.)";

export function isReviewCommand(text: string): boolean {
  return text.trim() === REVIEW_PROMPT.trim();
}

export const NUDGE_EVERY = 3;
/** Nothing to read along with before this — the Coach would be guessing. */
export const NUDGE_AFTER = 2;
