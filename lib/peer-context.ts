import type { AgentType } from "@/lib/agents";
import { parseMarkers } from "@/lib/message-markers";

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
    const body = shorten(m.role === "assistant" ? parseMarkers(m.content).text : m.content);
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
export interface PanelSnapshot {
  name: string;
  transcript: string;
  /** The last thing the agent said here, trimmed for a one-line preview. */
  lastLine: string;
  /** Replies this agent has given — the other panel counts them to decide
   *  when enough has happened to be worth speaking up about. */
  agentTurns: number;
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
export const NUDGE_EVERY = 3;
/** Nothing to read along with before this — the Coach would be guessing. */
export const NUDGE_AFTER = 2;
