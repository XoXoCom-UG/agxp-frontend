/**
 * The pieces every consultant document is built from — the types of a document
 * and the sections and stations all nine consultant types share.
 *
 * Split out of deliverables.ts so that the documents (lib/consultant-documents.ts)
 * and the method library (lib/method-library.ts) can use them without importing
 * the file that imports them. deliverables.ts re-exports the three types.
 */

/** One stop of the interview — the agent stays here until it really understands it. */
export interface Station {
  /** Short label for the progress rail. The UI is English throughout. */
  label: string;
  /** What the agent has to find out here — goes verbatim into the system prompt. */
  goal: string;
  /** What happens at this stop, in a line the user can read beside the step.
   *  Shown in the Methods panel; never sent to the model. */
  note?: string;
}

/** One `##` section of the finished document, with what it has to contain. */
export interface DocSection {
  title: string;
  must: string;
}

export interface Deliverable {
  /** Document title, also the marker value: [[DOC: Transformation Concept]]. */
  title: string;
  /** One line under the title, in the document header. */
  subtitle: string;
  stations: Station[];
  sections: DocSection[];
  /** What the rail's generate button sends as the user's message. */
  generatePrompt: string;
  /** Same, for a full rebuild once a version already exists. */
  regeneratePrompt: string;
}

/** The Knowledge Check, as a station: three questions, one per answer. */
export const knowledgeCheck = (topic: string, terms: string, ask3: string): Station => ({
  label: "Knowledge check",
  note: "Three quick questions set the level of everything after.",
  goal:
    `Wissens-Check, bevor es inhaltlich losgeht: DREI kurze Multiple-Choice-Fragen zum Thema ${topic}, ` +
    `eine pro Antwort, jede mit CHOICES. Frage 1: bisherige Erfahrung (noch nie / einmal / mehrmals). ` +
    `Frage 2: welche Begriffe der Nutzer kennt (${terms}, keinen davon) — diese Frage MIT CHOICES+, ` +
    `weil mehrere Begriffe gleichzeitig bekannt sein können. Frage 3: ${ask3}. Danach stufst ` +
    `du ein — Einsteiger, Fortgeschritten oder Experte —, sagst die Stufe in EINEM Satz mit dem Grund ` +
    `und merkst sie dir: sie bestimmt Wortwahl, Länge des Lexikons und die Zahl der Nachfragen für den ` +
    `Rest des Gesprächs. Einsteiger bekommen kürzere Fragen und mehr Erklärung, Experten weniger.`,
});

export const SEC_LEVEL: DocSection = {
  title: "Wissensstand",
  must:
    "Ein `agxp-level` Block mit genau einer Zeile: die Stufe (`Einsteiger`, `Fortgeschritten` oder " +
    "`Experte`) und der Grund in einem Satz — aus den drei Fragen des Wissens-Checks. Danach genau " +
    "1 Bullet: wie dieser Stand Wortwahl, Länge des Lexikons und Tiefe der Sektionen bestimmt hat.",
};

// Agreed with Patryk on 2026-10-02. The Lexicon comes first because the first
// thing separating a beginner from an expert is the vocabulary (00:22:22), and
// the whole concept is unreadable until that is fixed.
export const SEC_LEXICON: DocSection = {
  title: "Lexikon",
  must:
    "Ein `agxp-lexicon` Block mit JEDEM Fachbegriff und Fremdwort, das weiter unten im Dokument " +
    "vorkommt, nach Thema geclustert; jedes Thema bekommt zusätzlich eine eigene Zeile " +
    "`Thema | * | Erklärung`, die in einem Satz sagt, was das Thema bedeutet. Die Länge richtet sich " +
    "nach dem Wissensstand: Einsteiger bekommen jeden Begriff, Experten nur das Neue oder Fachfremde. " +
    "Davor genau 2 Bullets: die Geschäftshypothese (der Mehrwert in einem Satz) und wofür das Ganze " +
    "verwendet wird (was wofür eingesetzt wird).",
};

// Patryk, 2026-10-09: "das ist keine Management Summary, sondern eine Abfolge
// der Todos". A summary says what is done, why, and what it is worth — in that
// order, and short enough to read standing up. Ana, 2026-10-16: better
// structured, so it is labelled rows instead of one block of prose. Patryk's
// definition (09.10, 00:43:04) has five parts: what, why, the value expected,
// the biggest risk and the biggest potential — so five rows.
export const SEC_SUMMARY: DocSection = {
  title: "Management Summary",
  must:
    "Ein `agxp-summary` Block mit genau fünf Zeilen, in dieser Reihenfolge, und sonst nichts — kein " +
    "Bullet, kein fetter Satz, keine eigene Überschrift darunter. Zeile `Was`: WAS getan wird, in " +
    "zwei bis drei Sätzen. Zeile `Warum`: WARUM es getan wird — was der heutige Zustand kostet, mit " +
    "Zahl, in ein bis zwei Sätzen. Zeile `Mehrwert`: welcher MEHRWERT erwartet wird, wenn möglich " +
    "beziffert, in ein bis zwei Sätzen. Zeile `Risiko`: das EINE größte Risiko, das dieses Vorhaben " +
    "zum Scheitern bringen kann, in einem Satz, konkret für diesen Fall und nicht allgemein (kein " +
    "\"mangelnde Akzeptanz\" ohne zu sagen, wer was nicht mittragen würde). Zeile `Potenzial`: das EINE " +
    "größte Potenzial, das über das Ziel hinausgeht — was sich aus dem Erreichten noch machen ließe, in " +
    "einem Satz. Risiko und Potenzial sind je EIN Punkt, keine Aufzählung. KEINE Aufzählung der " +
    "Maßnahmen und KEINE Liste von To-dos — die stehen weiter unten; hier steht der Zusammenhang, dort " +
    "stehen die Belege. Wiederhole keine Zahlen, die in den folgenden Sektionen schon als Grafik stehen.",
};

// The closing section every consultant document has: what happens next, by
// whom, by when. Three bullets, because a list of ten is a list nobody starts.
export const SEC_NEXT_STEPS: DocSection = {
  title: "Nächste Schritte",
  must: "Genau 3 Bullets, jedes mit Verantwortlichem, Termin und dem, was danach entschieden werden kann. Kein Visual.",
};

export const glanceSection = (extraRow: string, knowledgeLabel: string): DocSection => ({
  title: "Auf einen Blick",
  must:
    `Ein \`agxp-glance\` Block mit genau diesen Zeilen: Kernproblem, Beschreibung, ${knowledgeLabel}, ` +
    `Empfohlene Richtung, ${extraRow}. Danach ein \`agxp-kpi\` Block mit 4 Kennzahlen aus dem Gespräch ` +
    `(die wichtigsten Eckdaten: Personen, Zeit, Budget, Zielwert). Keine Bullets.`,
});

export const TABLE_RULE =
  "eine normale Markdown-Tabelle mit GENAU diesen Spaltenüberschriften in dieser Reihenfolge";
export const TABLE_LEAD = `E${TABLE_RULE.slice(1)}`;

/** The prompts that start and redo the document — same shape for every type. */
export const promptsFor = (title: string, filledWith: string) => ({
  generatePrompt:
    `Create the complete ${title} now, based on our whole conversation. ` +
    `Graphics and bullets only — no paragraphs: every section leads with its visual block or table, ` +
    `filled with ${filledWith} we discussed. ` +
    `Answer in the language we have been speaking.`,
  regeneratePrompt:
    `Rebuild the complete ${title} from scratch, sharper than the last version: ` +
    `every block and table filled with the real ${filledWith} from our conversation, and no ` +
    `paragraphs. Answer in the language we have been speaking.`,
});
