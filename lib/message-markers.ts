export interface ParsedMessage {
  text: string;
  choices: string[];
  progress: number | null;
}

/**
 * Strips the [[CHOICES: ...]] / [[PROGRESS: NN]] markers the system prompt
 * asks the model to append, and returns them as structured data. Markers are
 * stored verbatim in the DB (the raw model reply) — parsing happens only at
 * render time, so history reloads recompute choices/progress the same way.
 */
export function parseMarkers(raw: string): ParsedMessage {
  let text = raw;
  let choices: string[] = [];
  let progress: number | null = null;

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

  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return { text, choices, progress };
}
