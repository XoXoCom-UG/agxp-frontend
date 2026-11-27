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

/**
 * The step-by-step start (2026-11-27, "pas cu pas, ca la înscrierea în
 * Duolingo"): every blank of a template becomes one screen — the consultant
 * asks one question, the person taps a ready answer or types their own.
 *
 * The answers are written to drop straight into the template's sentence
 * ("My role is {role}" + "Head of IT"), lower case where the sentence goes on
 * around them. A blank without an entry here still gets a screen, asked with
 * its hint and with no ready answers.
 */
export interface TemplateStep {
  /** The question the consultant asks, one short line. */
  ask: string;
  /** Ready answers, 3-5, each one a phrase that reads right inside the sentence. */
  options: string[];
}

const ROLE_STEP: TemplateStep = {
  ask: "What is your role?",
  options: ["Head of IT", "project manager", "managing director", "team lead", "consultant"],
};

export const TEMPLATE_STEPS: Record<string, Record<string, TemplateStep>> = {
  "it-project": {
    role: ROLE_STEP,
    what: { ask: "What do you want to implement?", options: ["a new CRM", "an ERP system", "a new HR tool", "a data platform", "an AI assistant"] },
    goal: { ask: "What should it help you with?", options: ["save time", "cut costs", "win more customers", "make fewer mistakes", "see our numbers in one place"] },
    who: { ask: "Who is involved?", options: ["the IT team", "sales", "management", "the whole company", "an outside partner"] },
    when: { ask: "By when does it have to be done?", options: ["the end of this month", "the end of this quarter", "the end of the year", "the middle of next year"] },
  },
  "it-company": {
    role: ROLE_STEP,
    company: { ask: "What kind of company is it?", options: ["a mid-sized company", "a start-up", "a large corporation", "a public authority"] },
    what: { ask: "What do you want to roll out?", options: ["Microsoft 365", "a new ERP system", "an AI assistant for everyone", "a new way of working"] },
    departments: { ask: "Which departments are affected?", options: ["all of them", "sales and marketing", "finance and HR", "production and logistics"] },
    worry: { ask: "What worries you most?", options: ["that people won't use it", "the budget", "the timeline", "data protection"] },
  },
  "ai-use-case": {
    role: ROLE_STEP,
    task: { ask: "What should the AI do?", options: ["answer customer questions", "write offers", "sort incoming emails", "summarise documents"] },
    users: { ask: "Who would use it?", options: ["our support team", "sales", "every employee", "our customers"] },
    data: { ask: "What data do you have?", options: ["emails and documents", "a CRM", "Excel sheets", "almost nothing yet"] },
    first: { ask: "What would a good first result be?", options: ["a working demo", "one team using it", "time saved every week", "a clear yes or no"] },
  },
  "idea": {
    idea: { ask: "What is your idea?", options: ["an app", "an online shop", "a service for companies", "a new product"] },
    "for": { ask: "Who is it for?", options: ["small businesses", "families", "students", "companies like mine"] },
    exists: { ask: "How do people solve this today?", options: ["doing it by hand", "using Excel", "paying an agency", "not at all"] },
    step: { ask: "What would your first step be?", options: ["talking to customers", "building a prototype", "finding a co-founder", "working that out"] },
  },
  "team-change": {
    team: { ask: "Which team do you lead?", options: ["the sales team", "the IT team", "a department of about 20 people", "the whole company"] },
    when: { ask: "From when does it change?", options: ["next month", "the start of next quarter", "January", "a date we still have to set"] },
    change: { ask: "What will change for them?", options: ["work with a new tool", "work in new teams", "follow a new process", "work more from home"] },
    fear: { ask: "What do people fear?", options: ["losing their job", "more work", "not keeping up", "losing control"] },
  },
  "no-idea": {
    role: ROLE_STEP,
    problem: { ask: "What is the problem?", options: ["too much manual work", "projects run late", "we lose customers", "the team is overloaded"] },
  },
};

/** One screen per blank, in the order the sentences ask for them. */
export function stepsOf(template: PromptTemplate): ({ id: string; hint: string } & TemplateStep)[] {
  return fieldsOf(template).map(id => {
    const hint = template.hints[id] ?? id;
    const step = TEMPLATE_STEPS[template.id]?.[id];
    return { id, hint, ask: step?.ask ?? hint, options: step?.options ?? [] };
  });
}

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
