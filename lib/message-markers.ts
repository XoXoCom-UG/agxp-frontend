export interface TopicMarker {
  /** 1-based station the agent is currently working on. */
  index: number;
  total: number;
  label: string;
}

export interface ParsedMessage {
  text: string;
  choices: string[];
  progress: number | null;
  /** Which interview station the agent is on ([[TOPIC: 3/8 Pain points]]). */
  topic: TopicMarker | null;
  /** Set when this message IS the finished deliverable ([[DOC: Change Plan]]). */
  doc: string | null;
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

  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return { text, choices, progress, topic, doc };
}

/**
 * The model occasionally forgets the [[DOC: ...]] marker and just answers with
 * the whole document. A long reply built out of several markdown sections is
 * the deliverable in practice, so treat it as one rather than dumping 2000
 * words into a chat bubble.
 *
 * Deliberately strict: a normal turn that happens to use a heading must NOT
 * be swallowed into a document card, because that would hide the agent's
 * question. Four sections and 1200+ characters is a document, not an answer.
 */
export function looksLikeDocument(text: string): boolean {
  const sections = text.match(/^##\s+\S/gm)?.length ?? 0;
  return text.length > 1200 && sections >= 4;
}
