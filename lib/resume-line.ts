import { parseMarkers } from "./message-markers.ts";

/**
 * One line that says where a project stands, for "Pick up where you left off"
 * (2026-11-27): the consultant's open question, or that the document is ready.
 * A name and "2 days ago" do not tell anyone what they were in the middle of.
 *
 * Relative imports only: the tests run under plain node.
 */
export type ResumeLine = { kind: "question" | "doc" | "said"; text: string };

const MAX = 90;

function cut(s: string): string {
  if (s.length <= MAX) return s;
  const head = s.slice(0, MAX);
  const space = head.lastIndexOf(" ");
  return `${head.slice(0, space > 40 ? space : MAX).trimEnd()}…`;
}

/** Markdown and lists out, one line in. */
function plain(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#>|]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function resumeLine(lastAgentMessage: string): ResumeLine | null {
  const p = parseMarkers(lastAgentMessage);
  if (p.doc) return { kind: "doc", text: p.doc };
  const text = plain(p.text);
  if (!text) return null;
  // The last question the consultant asked is what the person owes it.
  const questions = text.match(/[^.!?]*\?/g);
  const q = questions?.[questions.length - 1]?.trim();
  if (q && q.length > 8) return { kind: "question", text: cut(q) };
  return { kind: "said", text: cut(text) };
}
