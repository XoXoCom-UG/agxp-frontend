/**
 * What the chat route will accept from the browser, and how text the client
 * controls is cleaned before it reaches the system prompt.
 *
 * The route used to check only that `messages` was non-empty. Everything else
 * — roles, lengths, the agent's name, memory lines, the peer's name — went
 * into the prompt as sent. The browser is not a trusted author of any of it:
 * the limits that matter for cost are the token ceiling (server-side, but read
 * BEFORE the call, so one enormous request can overshoot it) and these.
 *
 * Pure functions with no imports, so `npm test` runs them directly.
 */

/** A conversation is resent every turn; 150 messages is far past any real one. */
export const MAX_MESSAGES = 150;
export const MAX_USER_CHARS = 20_000;
/** What the composer lets you type; the rest of MAX_USER_CHARS is room for [[FILE:]] markers. */
export const MAX_COMPOSER_CHARS = 18_000;
/**
 * A finished deliverable runs to ~40k characters, and it is stored as an
 * assistant message that comes back with the history — so the cap for those
 * is not the user's.
 */
export const MAX_ASSISTANT_CHARS = 80_000;
export const MAX_TOTAL_CHARS = 600_000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type Checked =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; status: 400 | 413; error: string };

export function validateMessages(raw: unknown): Checked {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, status: 400, error: "The request was incomplete. Reload the page and try again." };
  }
  if (raw.length > MAX_MESSAGES) {
    return { ok: false, status: 413, error: "This conversation has grown too long. Start a new project to continue." };
  }

  const messages: ChatMessage[] = [];
  let total = 0;
  for (const m of raw) {
    const role = (m as { role?: unknown } | null)?.role;
    const content = (m as { content?: unknown } | null)?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return { ok: false, status: 400, error: "The request was incomplete. Reload the page and try again." };
    }
    const cap = role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS;
    if (content.length > cap) {
      return {
        ok: false,
        status: 413,
        error: role === "user"
          ? `That message is too long. Keep it under ${MAX_USER_CHARS.toLocaleString("en")} characters, or attach it as a file.`
          : "This conversation has grown too long. Start a new project to continue.",
      };
    }
    total += content.length;
    messages.push({ role, content });
  }
  if (total > MAX_TOTAL_CHARS) {
    return { ok: false, status: 413, error: "This conversation has grown too long. Start a new project to continue." };
  }
  return { ok: true, messages };
}

/**
 * A short piece of text the client chose — a name, a role — made safe to
 * place inside a prompt: no marker syntax, no control characters, one line,
 * bounded.
 *
 * `[[` and `]]` go because they are the protocol between the model and the
 * renderer (lib/message-markers.ts); text that carries them into a prompt can
 * teach the model to emit them in the wrong place.
 */
export function cleanLabel(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** The lines of memory the browser sent: strings only, cleaned, bounded. */
export function cleanMemory(list: unknown, maxLines = 20, maxChars = 180): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    const line = cleanLabel(item, maxChars);
    if (line) out.push(line);
    if (out.length >= maxLines) break;
  }
  return out;
}

/** An agent type id: lowercase letters and hyphens, short. Anything else is no type. */
export function cleanKind(value: unknown): string | null {
  return typeof value === "string" && /^[a-z][a-z-]{0,23}$/.test(value) ? value : null;
}

export const AGENT_NAME_MAX = 60;
export const ATTACHMENT_NAME_MAX = 120;

/** Strips marker syntax from free text without flattening its line breaks. */
export function stripMarkerSyntax(text: string): string {
  return text.replace(/\[\[|\]\]/g, "");
}
