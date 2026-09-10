export interface TopicMarker {
  /** 1-based station the agent is currently working on. */
  index: number;
  total: number;
  label: string;
}

/** Something the agent learned that also holds in the user's future projects. */
export interface MemoryNote {
  /** branche | systeme | budget | entscheidung | widerstand | vorliebe | note */
  kind: string;
  fact: string;
}

export interface ParsedMessage {
  text: string;
  choices: string[];
  progress: number | null;
  /** Which interview station the agent is on ([[TOPIC: 3/8 Pain points]]). */
  topic: TopicMarker | null;
  /** Set when this message IS the finished deliverable ([[DOC: Change Plan]]). */
  doc: string | null;
  /** Lessons the agent wants to carry into later projects ([[MEMORY: ...]]). */
  memories: MemoryNote[];
}

/**
 * Strips the markers the system prompt asks the model to append
 * ([[CHOICES: ...]], [[PROGRESS: NN]], [[TOPIC: n/N Label]], [[DOC: Title]])
 * and returns them as structured data. Markers are stored verbatim in the DB
 * (the raw model reply) — parsing happens only at render time, so history
 * reloads recompute everything the same way.
 */
export function parseMarkers(raw: string): ParsedMessage {
  let text = raw;
  let choices: string[] = [];
  let progress: number | null = null;
  let topic: TopicMarker | null = null;
  let doc: string | null = null;

  const choicesMatch = text.match(/\[\[CHOICES:\s*([\s\S]*?)\]\]/i);
  if (choicesMatch) {
    choices = choicesMatch[1].split("|").map(s => s.trim()).filter(Boolean);
    text = text.replace(choicesMatch[0], "");
  }

  const progressMatch = text.match(/\[\[PROGRESS:\s*(\d{1,3})\s*\]\]/i);
  if (progressMatch) {
    progress = Math.max(0, Math.min(100, parseInt(progressMatch[1], 10)));
    text = text.replace(progressMatch[0], "");
  }

  const topicMatch = text.match(/\[\[TOPIC:\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*([^\]]*)\]\]/i);
  if (topicMatch) {
    const total = Math.max(1, parseInt(topicMatch[2], 10));
    topic = {
      index: Math.max(1, Math.min(total, parseInt(topicMatch[1], 10))),
      total,
      label: topicMatch[3].trim(),
    };
    text = text.replace(topicMatch[0], "");
  }

  const docMatch = text.match(/\[\[DOC:\s*([^\]]*)\]\]/i);
  if (docMatch) {
    doc = docMatch[1].trim() || null;
    text = text.replace(docMatch[0], "");
  }

  // Unlike the others, MEMORY can appear more than once in one answer.
  const memories: MemoryNote[] = [];
  const raws = text.match(/\[\[MEMORY:\s*[^\]]*\]\]/gi) ?? [];
  for (const raw of raws) {
    const inner = raw.replace(/^\[\[MEMORY:\s*/i, "").replace(/\]\]$/, "");
    const parts = inner.split("|");
    const fact = (parts.length > 1 ? parts.slice(1).join("|") : parts[0]).trim();
    const kind = parts.length > 1 ? parts[0].trim().toLowerCase() : "note";
    if (fact) memories.push({ kind, fact });
    text = text.replace(raw, "");
  }

  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return { text, choices, progress, topic, doc, memories };
}

/** Escapes a string for use inside a RegExp. */
function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The model occasionally forgets the [[DOC: ...]] marker and just answers with
 * the whole document. The user's rule is that the deliverable must NEVER show
 * up as chat text, so a reply that is plainly the document gets treated as one
 * even without the marker.
 *
 * Two signals, either is enough:
 *  - it opens with the deliverable's own H1 ("# Transformation Concept"), or
 *  - it is long and built out of several "##" sections.
 *
 * Still deliberately strict on the second one: a normal turn that happens to
 * use a heading must not be swallowed into a document card, because that would
 * hide the agent's question.
 */
export function looksLikeDocument(text: string, title?: string): boolean {
  if (title && new RegExp(`^#\\s*${reEscape(title)}\\s*$`, "im").test(text)) return true;
  const sections = text.match(/^##\s+\S/gm)?.length ?? 0;
  return text.length > 1200 && sections >= 3;
}
