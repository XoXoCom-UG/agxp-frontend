/**
 * The Prompt Pad's templates (meeting 2026-11-20, "Verzeichnis von Schablonen").
 *
 * A template is a few sentences with blanks in them, the way a person would
 * begin a first message: "My role is [your role] and I want to implement […]".
 * Choosing one writes it into the chat box with the blanks in square brackets,
 * and the person types over them; what the consultant receives is plain sentences
 * with the project's people, goal and deadline up front instead of asked for
 * one by one across the interview, which is where the tokens went (Patryk: more
 * information at the start, lower cost per project).
 *
 * Sentences and hints are English here and go through the app's translator at
 * the point of use, so a German screen composes a German message — the reply
 * language follows what the person sent (lib/reply-language.ts), and English
 * sentences would drag a German project into English. A blank is `{id}`; a
 * translation may move it, but must keep every one.
 */

export interface PromptTemplate {
  id: string;
  /** A few words: what the template is for, shown on its card. */
  title: string;
  /** Sentences in order; each holds one or more `{blank}` slots. */
  sentences: string[];
  /** What each blank is called, shown in the square brackets. */
  hints: Record<string, string>;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "it-project",
    title: "IT project",
    sentences: [
      "My role is {role} and I want to implement {what}.",
      "It should help us {goal}.",
      "The people involved are {who}, and it has to be done by {when}.",
    ],
    hints: {
      role: "your role",
      what: "what you want to implement",
      goal: "your goal",
      who: "who is involved",
      when: "the deadline",
    },
  },
  {
    id: "it-company",
    title: "Company-wide rollout",
    sentences: [
      "I work as {role} at {company}, and we want to roll out {what} across the whole company.",
      "The departments affected are {departments}.",
      "What worries me most is {worry}.",
    ],
    hints: {
      role: "your role",
      company: "your company",
      what: "what you want to roll out",
      departments: "the departments affected",
      worry: "what worries you most",
    },
  },
  {
    id: "ai-use-case",
    title: "AI use case",
    sentences: [
      "My role is {role} and I want AI to {task}.",
      "The people who would use it are {users}, and the data we have is {data}.",
      "A good first result would be {first}.",
    ],
    hints: {
      role: "your role",
      task: "what the AI should do",
      users: "who would use it",
      data: "the data you have",
      first: "a good first result",
    },
  },
  {
    id: "idea",
    title: "Business idea",
    sentences: [
      "I have an idea: {idea}, for {for}.",
      "Today people solve this by {exists}.",
      "My first step would be {step}.",
    ],
    hints: {
      idea: "your idea",
      "for": "who it is for",
      exists: "how it is solved today",
      step: "your first step",
    },
  },
  {
    id: "team-change",
    title: "Change in the team",
    sentences: [
      "I lead {team}, and from {when} they will have to {change}.",
      "What I hear people fear is {fear}.",
    ],
    hints: {
      team: "your team",
      when: "the date",
      change: "what changes",
      fear: "what people fear",
    },
  },
  {
    id: "no-idea",
    title: "Not sure where to start",
    sentences: [
      "I am {role}. My problem is {problem}, and I do not know where to start.",
    ],
    hints: {
      role: "your role",
      problem: "your problem",
    },
  },
];

const SLOT = /\{(\w+)\}/g;

/** The blanks of a sentence, in the order they appear. */
export function slotsOf(sentence: string): string[] {
  return [...sentence.matchAll(SLOT)].map(m => m[1]);
}

/** A sentence cut into text and blanks, for drawing the blanks as inputs. */
export function partsOf(sentence: string): { text?: string; slot?: string }[] {
  const out: { text?: string; slot?: string }[] = [];
  let last = 0;
  for (const m of sentence.matchAll(SLOT)) {
    if (m.index > last) out.push({ text: sentence.slice(last, m.index) });
    out.push({ slot: m[1] });
    last = m.index + m[0].length;
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last) });
  return out;
}

/**
 * The text a template writes into the chat box: its sentences, each blank shown
 * as its name in square brackets ("[your role]") for the person to type over.
 */
export function fillText(template: PromptTemplate, say: (english: string) => string = s => s): string {
  return template.sentences
    .map(sentence => say(sentence).replace(SLOT, (m, id: string) => `[${say(template.hints[id] ?? id)}]`))
    .join(" ");
}

/** Every blank of a template, once, in the order the sentences ask for them. */
export function fieldsOf(template: PromptTemplate): string[] {
  return [...new Set(template.sentences.flatMap(slotsOf))];
}

/**
 * The first message a template's small form writes: its sentences with what the
 * person typed in each field. A sentence with a field left empty is dropped
 * whole, so no "[your role]" and no half sentence ever reaches the consultant;
 * "" when nothing was filled in. Clean-up pass of 2026-11-27 (Kaizen): fields
 * instead of a paragraph of square brackets to type over.
 */
export function composeText(
  template: PromptTemplate,
  values: Record<string, string>,
  say: (english: string) => string = s => s,
): string {
  return template.sentences
    .filter(sentence => slotsOf(sentence).every(id => (values[id] ?? "").trim()))
    .map(sentence => say(sentence).replace(SLOT, (_m, id: string) => values[id].trim().replace(/\s+/g, " ")))
    .join(" ");
}

/** The next "[…]" at or after `from` as a [start, end) range; null when none is left. */
export function nextBlank(text: string, from: number): [number, number] | null {
  const re = /\[[^\]\n]+\]/g;
  re.lastIndex = Math.max(0, from);
  const m = re.exec(text);
  return m ? [m.index, m.index + m[0].length] : null;
}
