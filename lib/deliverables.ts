import type { AgentType } from "@/lib/agents";

/**
 * deliverables.ts — the single source of truth for what each panel is working
 * toward: the Consultant's Transformation Concept and the Coach's Change Plan.
 *
 * Imported by BOTH the API route (to build the system prompt) and the panel UI
 * (to draw the progress rail), so the station count in the prompt and the
 * number of segments on screen can never drift apart.
 */

/** One stop of the interview — the agent stays here until it really understands it. */
export interface Station {
  /** Short label for the progress rail. The UI is English throughout. */
  label: string;
  /** What the agent has to find out here — goes verbatim into the system prompt. */
  goal: string;
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

/**
 * The graphics vocabulary. The renderer for these lives in lib/doc-visuals.ts
 * and draws them in pure CSS, so they survive print/PDF and both themes.
 *
 * The user's call (2026-09-09): the document is graphics plus bullets — "prea
 * mult scris si prea putine grafice". So every section leads with a visual and
 * the prose is gone.
 */
const VISUAL_SPEC =
  "\n\nVISUAL-BLÖCKE — das Dokument besteht aus Grafiken, nicht aus Text. Du schreibst die Daten " +
  "als Fenced Block mit Pipe-getrennten Zeilen; die Oberfläche zeichnet daraus die Grafik. " +
  "Erfinde keine anderen Blocktypen, schreibe keinen Erklärtext in den Block, und packe NIE das " +
  "ganze Dokument in einen Code-Block.\n\n" +
  "1) Kennzahlen-Kacheln — `Label | Wert | good|bad|warn`. Die Einheit gehört ins Label, der Wert " +
  "bleibt kurz (max. 7 Zeichen), sonst bricht die Kachel um. Den Ton nur setzen, wenn die Zahl " +
  "eindeutig gut oder schlecht ist — höchstens bei 2 von 4 Kacheln:\n" +
  "```agxp-kpi\nAufträge pro Tag | 180\nPlanung pro Tour | 12 min\nDiesel pro Monat | 600 € | bad\n" +
  "Lieferscheine weg pro Woche | 8 | bad\n```\n\n" +
  "2) Heute gegen Ziel — `Indikator | heute | ziel | Einheit`. Beide Werte MÜSSEN Zahlen sein, " +
  "sonst wird kein Balken gezeichnet:\n" +
  "```agxp-gap\nPlanung pro Tour | 12 | 3 | min\nLeerkilometer-Touren | 4 | 1 | pro Woche\n```\n\n" +
  "3) Prozesskette — genau zwei Zeilen, `as-is:` und `to-be:`, Schritte mit `|` getrennt. Ein `*` " +
  "am Ende eines Schritts heißt: läuft automatisch:\n" +
  "```agxp-flow\nas-is: E-Mail rein | Excel tippen | Tour bauen | Fahrer anrufen\n" +
  "to-be: Auftrag erkannt* | Tour vorgeschlagen* | Disponent gibt frei | App benachrichtigt*\n```\n\n" +
  "4) Zeitschiene — `Phase | Punkt; Punkt; Punkt`, 3-4 Phasen, chronologisch:\n" +
  "```agxp-roadmap\nsofort | Aufträge zentral sammeln; Lieferscheine per App\n30 Tage | Pilot mit einer Region\n" +
  "90 Tage | Rollout alle Regionen\n```\n\n" +
  "5) Risiko-Register — `Risiko | Wahrscheinlichkeit | Auswirkung | Gegenmaßnahme`. Beide " +
  "Stufen nur `gering`, `mittel` oder `hoch`. Die Gegenmaßnahme gehört MIT in die Zeile, nicht " +
  "in ein Bullet darunter — sonst steht der Risikoname zweimal da:\n" +
  "```agxp-risks\nDisponenten blockieren | hoch | hoch | Pilot mit Freiwilligen, Nutzen früh zeigen\n" +
  "Datenqualität | mittel | mittel | Altdaten vor dem Start einmal bereinigen\n```\n\n" +
  "6) Stakeholder-Board — `Gruppe | Anzahl | Haltung | Einfluss | Sorge`. Haltung ist " +
  "`Unterstützer`, `neutral` oder `skeptisch`, Einfluss `gering|mittel|hoch`, die Sorge möglichst " +
  "im Wortlaut der Betroffenen:\n" +
  "```agxp-stakeholders\nDisponenten | 5 | skeptisch | hoch | \"Kein Computer kennt die B75 besser\"\n```" +
  "\n\n7) Lexikon — `Thema | Begriff | Erklärung`, nach Thema geclustert. Schreibe JEDEN Fachbegriff " +
  "und jedes Fremdwort auf, das im Dokument vorkommt, und erklär ihn in einem Satz, den jemand " +
  "ohne Vorwissen versteht. Auch das THEMA selbst wird erklärt: pro Thema EINE Zeile mit `*` als " +
  "Begriff, direkt vor den Begriffen des Themas, mit einem Satz, was dieses Thema bedeutet:\n" +
  "```agxp-lexicon\nSoftware | * | Alles, was auf dem Rechner oder im Browser läuft, im Gegensatz zu den Geräten selbst\n" +
  "Software | React | Baukasten für Benutzeroberflächen im Browser\n" +
  "Software | API | Schnittstelle, über die zwei Programme miteinander reden\n" +
  "Infrastruktur | * | Die technische Grundlage, auf der die Software betrieben wird\n" +
  "Infrastruktur | Hosting | Der Server, auf dem die Anwendung tatsächlich läuft\n```\n\n" +
  "8) Auf einen Blick — `Zeile | Inhalt`, eine Tabelle statt einer Aufzählung. Mehrere Werte in " +
  "einer Zeile mit `;` trennen, sie werden dann zu einzelnen Chips:\n" +
  "```agxp-glance\nKernproblem | Zwei Freigaben nacheinander kosten zwei von drei Wochen\n" +
  "Beschreibung | Jeder Antrag wartet vier bis fünf Tage bei der Abteilungsleitung\n" +
  "Benötigte Technologien | React; Node; Postgres\n" +
  "Empfohlene Richtung | Erste Freigabe abschaffen, zweite automatisieren\n```\n\n" +
  "9) Gap-Tabelle — `Dimension | heute | ziel | Lücke`, optional mit einer fünften Spalte " +
  "`Aktionsplan`. Anders als agxp-gap nimmt sie WORTE, nicht nur Zahlen. Für die Gap-Analyse über " +
  "Ziele, Reifegrad, Fähigkeiten, Technologien, Menschen und Ressourcen. Der Aktionsplan ist " +
  "nummeriert, nach Priorität, mit `;` getrennt, und nur dort, wo die Sektion ihn verlangt:\n" +
  "```agxp-diff\nReifegrad | Excel und E-Mail | ein System für alle Regionen | kein zentrales System | " +
  "1. Prozess in einem Tool abbilden ; 2. Regionen nacheinander anbinden\n" +
  "Fähigkeiten | niemand kennt React | zwei Entwickler im Team | Schulung oder Einstellung | " +
  "1. Kurs über drei Tage ; 2. einen Bildschirm selbst bauen\n" +
  "Menschen | 5 Disponenten, kein Produktowner | Produktowner benannt | Rolle unbesetzt | " +
  "1. Rolle im ersten Monat besetzen\n```\n\n" +
  "10) SWOT — genau vier Zeilen `stärken:`, `schwächen:`, `chancen:`, `risiken:`, Punkte mit " +
  "`;` getrennt. Bewertet wird DER PLAN, nicht das Unternehmen:\n" +
  "```agxp-swot\nstärken: Prozess ist allen klar; Budget steht\n" +
  "schwächen: kein Entwickler im Haus; Daten liegen in drei Systemen\n" +
  "chancen: gleiche Lösung für die zweite Region; weniger Nachtschichten\n" +
  "risiken: Disponenten blockieren; Freigabe hängt an einer Person\n```\n\n" +
  "11) Wissensstand — genau eine Zeile `Stufe | Grund`. Die Stufe ist `Einsteiger`, `Fortgeschritten` " +
  "oder `Experte`, der Grund ein Satz:\n" +
  "```agxp-level\nEinsteiger | Noch nie eine App gebaut, kennt nur HTML, 20 Tage Zeit\n```\n\n" +
  "12) Management Summary — genau drei Zeilen `Was | Text`, `Warum | Text`, `Mehrwert | Text`:\n" +
  "```agxp-summary\nWas | Die Tourenplanung wird in einem Tool zusammengeführt, das Aufträge erkennt und Touren " +
  "vorschlägt. Die Disponenten geben frei.\n" +
  "Warum | Heute kostet die Planung zwölf Minuten pro Tour und vier Leerkilometer-Touren pro Woche.\n" +
  "Mehrwert | Planung unter drei Minuten pro Tour und rund 600 Euro weniger Diesel im Monat.\n```\n\n" +
  "TABELLEN — wo eine Sektion eine Tabelle verlangt, schreibst du eine normale Markdown-Tabelle mit " +
  "GENAU den genannten Spaltenüberschriften in genau dieser Reihenfolge, ohne Zusatzspalten. Eine " +
  "Skala von 1 bis 5 schreibst du als Quadrate mit Zahl, z. B. `■■□□□ 2`. Verwende keine Emojis.";

/**
 * Is this user message the button, rather than something the person typed?
 *
 * Pressing "Create document" sends generatePrompt as a user turn, because the
 * model needs it in the conversation. But it is an instruction to the machine,
 * not a sentence a consultant wrote, and showing it as a chat bubble put a
 * four-line English command in the middle of a German conversation. The UI
 * renders these as a one-line action instead.
 */
export function isDeliverableCommand(text: string): boolean {
  const t = text.trim();
  return ALL_DELIVERABLES.some(
    d => t === d.generatePrompt.trim() || t === d.regeneratePrompt.trim(),
  );
}

/* ---------------------------------------------------------------------------
   THE CONSULTANT TYPES (Ana, 2026-10-16)

   One document per consultant type, each built from the methods of the method
   sheet — the stations are the questions those methods need answered, the
   sections are their outputs, column for column. Anything the sheet marks as
   not yet wanted (Competitor Benchmark, Scenario Planning, Future Headline,
   Consultant-Coach Debate; the "New" methods of the Change Manager and of the
   Solution Architect) is deliberately not here.

   The three methods every type starts with — Knowledge Check, Lexicon, At a
   Glance — are shared; everything else is the type's own.
   --------------------------------------------------------------------------- */

/** The Knowledge Check, as a station: three questions, one per answer. */
const knowledgeCheck = (topic: string, terms: string, ask3: string): Station => ({
  label: "Knowledge check",
  goal:
    `Wissens-Check, bevor es inhaltlich losgeht: DREI kurze Multiple-Choice-Fragen zum Thema ${topic}, ` +
    `eine pro Antwort, jede mit CHOICES. Frage 1: bisherige Erfahrung (noch nie / einmal / mehrmals). ` +
    `Frage 2: welche Begriffe der Nutzer kennt (${terms}, keinen davon). Frage 3: ${ask3}. Danach stufst ` +
    `du ein — Einsteiger, Fortgeschritten oder Experte —, sagst die Stufe in EINEM Satz mit dem Grund ` +
    `und merkst sie dir: sie bestimmt Wortwahl, Länge des Lexikons und die Zahl der Nachfragen für den ` +
    `Rest des Gesprächs. Einsteiger bekommen kürzere Fragen und mehr Erklärung, Experten weniger.`,
});

const SEC_LEVEL: DocSection = {
  title: "Wissensstand",
  must:
    "Ein `agxp-level` Block mit genau einer Zeile: die Stufe (`Einsteiger`, `Fortgeschritten` oder " +
    "`Experte`) und der Grund in einem Satz — aus den drei Fragen des Wissens-Checks. Danach genau " +
    "1 Bullet: wie dieser Stand Wortwahl, Länge des Lexikons und Tiefe der Sektionen bestimmt hat.",
};

// Agreed with Patryk on 2026-10-02. The Lexicon comes first because the first
// thing separating a beginner from an expert is the vocabulary (00:22:22), and
// the whole concept is unreadable until that is fixed.
const SEC_LEXICON: DocSection = {
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
// structured, so it is three labelled rows instead of one block of prose.
const SEC_SUMMARY: DocSection = {
  title: "Management Summary",
  must:
    "Ein `agxp-summary` Block mit genau drei Zeilen, in dieser Reihenfolge, und sonst nichts — kein " +
    "Bullet, kein fetter Satz, keine eigene Überschrift darunter. Zeile `Was`: WAS getan wird, in " +
    "zwei bis drei Sätzen. Zeile `Warum`: WARUM es getan wird — was der heutige Zustand kostet, mit " +
    "Zahl, in ein bis zwei Sätzen. Zeile `Mehrwert`: welcher MEHRWERT erwartet wird, wenn möglich " +
    "beziffert, in ein bis zwei Sätzen. KEINE Aufzählung der Maßnahmen und KEINE Liste von To-dos — die " +
    "stehen weiter unten; hier steht der Zusammenhang, dort stehen die Belege. Wiederhole keine " +
    "Zahlen, die in den folgenden Sektionen schon als Grafik stehen.",
};

const glanceSection = (extraRow: string, knowledgeLabel: string): DocSection => ({
  title: "Auf einen Blick",
  must:
    `Ein \`agxp-glance\` Block mit genau diesen Zeilen: Kernproblem, Beschreibung, ${knowledgeLabel}, ` +
    `Empfohlene Richtung, ${extraRow}. Danach ein \`agxp-kpi\` Block mit 4 Kennzahlen aus dem Gespräch ` +
    `(die wichtigsten Eckdaten: Personen, Zeit, Budget, Zielwert). Keine Bullets.`,
});

const TABLE_RULE =
  "eine normale Markdown-Tabelle mit GENAU diesen Spaltenüberschriften in dieser Reihenfolge";
const TABLE_LEAD = `E${TABLE_RULE.slice(1)}`;

/** The prompts that start and redo the document — same shape for every type. */
const promptsFor = (title: string, filledWith: string) => ({
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

/* --- Strategy Consultant: the Transformation Concept ---------------------- */

const STRATEGY: Deliverable = {
  title: "Transformation Concept",
  subtitle: "Where you stand today, where you want to be, and how to get there.",
  stations: [
    knowledgeCheck(
      "Strategie und Transformation",
      "Gap-Analyse, SWOT, Build-or-Buy, SMART-Ziele",
      "wie viel Zeit der Nutzer hat (unter 1 Monat / 1-3 Monate / mehr)",
    ),
    { label: "Starting point", goal: "Worum geht es überhaupt? Branche, Unternehmensgröße, Auslöser für das Projekt, wer fragt an und warum jetzt. Daraus entstehen das Kernproblem in einem Satz, die Beschreibung, das benötigte Wissen bzw. die Technologien und die Eckdaten (Personen, Zeit, Budget)." },
    { label: "Goals & target state", goal: "Gap-Analyse, Schritt 1: Was will der Nutzer erreichen? Frag zuerst nach dem ZIEL — wie soll es danach aussehen, woran würde man es merken. Der Soll-Zustand steht vor dem Ist-Zustand." },
    { label: "Current state & gaps", goal: "Gap-Analyse, Schritt 2: Frag nur so viel nach, bis du die 2-3 Dimensionen kennst, die dem Nutzer wichtig sind (Ziele, Reifegrad, Fähigkeiten und Skills, Technologien, Menschen, sonstige Ressourcen). Je Dimension: heute, Ziel, Lücke — und danach die Maßnahmen, nach Priorität geordnet." },
    { label: "Market & opportunity", goal: "NUR wenn der Nutzer veröffentlichen oder verkaufen will — sonst sag in einem Satz, dass du diese Station überspringst, und geh weiter. Beschreibe die heutige Marktlage, benenne das POTENZIAL (was der Markt belohnen würde, nicht was sich der Nutzer wünscht), leite daraus Lücke und Maßnahme ab." },
    { label: "Build, buy or partner", goal: "Welche Fähigkeiten braucht das Vorhaben? Liste sie auf und bewerte je Fähigkeit Selbstbauen, Kaufen und Partnerschaft nach Kosten, Zeit und Kontrolle. Dann eine Empfehlung je Fähigkeit: Standardbausteine kauft man, was das Vorhaben besonders macht, baut man selbst." },
    { label: "SMART goals", goal: "Sammle die Ziele des Nutzers und schreib jedes um, bis es sich mit Ja oder Nein prüfen lässt. Dann Frist und Messung ergänzen: woran, bis wann, wer prüft." },
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("Strategische Option (Build / Buy / Partner)", "Benötigtes Wissen"),
    {
      title: "Gap-Analyse und Aktionsplan",
      must:
        "Ein `agxp-diff` Block mit einer Zeile je Dimension und fünf Spalten: `Dimension | heute | ziel | " +
        "Lücke | Aktionsplan`. Dimensionen: Ziele, Reifegrad, Fähigkeiten und Skills, Technologien, Menschen, " +
        "sonstige Ressourcen — nur die 2-4, über die der Nutzer tatsächlich gesprochen hat; lieber drei " +
        "echte Zeilen als sechs erfundene. Erst das Ziel festlegen, dann heute und Lücke. Der Aktionsplan " +
        "steht IM Block: 1-3 Maßnahmen, nummeriert nach Priorität (`1. … ; 2. …`), mit `;` getrennt. " +
        "Danach höchstens 3 Bullets zur größten Lücke.",
    },
    // Patryk, 2026-10-02 at 01:06:41: a gap analysis compares today against what
    // you WANT, this compares today against what the market would ALLOW. It is
    // conditional because a conversation that never went near the market should
    // say so rather than invent an opportunity.
    {
      title: "Markt- und Chancenlücken",
      must:
        `Nur wenn der Nutzer veröffentlichen oder verkaufen will: ${TABLE_RULE}: Marktlage | Potenzial | ` +
        "Lücke | Maßnahme. 2-4 Zeilen. Potenzial ist, was der Markt belohnen würde — nicht der Wunsch des " +
        "Nutzers, den deckt die Gap-Analyse ab. Lücke ist eine Nachfrage, die heute niemand bedient. " +
        "Wenn im Gespräch nichts über Markt, Kunden oder Wettbewerb vorkam, lass die Tabelle weg und " +
        "schreib genau einen Satz: dass dafür die Angaben fehlen oder das Vorhaben nicht für den Markt " +
        "gedacht ist. Erfinde keine Marktchance.",
    },
    {
      title: "Build / Buy / Partner",
      must:
        `${TABLE_LEAD}: Fähigkeit | Build | Buy | Partner | Empfehlung | Warum. ` +
        "Eine Zeile je benötigter Fähigkeit (3-6). In die Spalten Build, Buy und Partner kommt ein Urteil " +
        "(`geeignet`, `riskant` oder `ungeeignet`) plus 2-4 Wörter Begründung, bewertet nach Kosten, Zeit " +
        "und Kontrolle. Empfehlung ist genau eines von `Build`, `Buy`, `Partner`; `Warum` sagt in einem " +
        "Satz, ob es ein Standardbaustein ist (dann kaufen) oder das, was das Vorhaben besonders macht " +
        "(dann selbst bauen). Danach 2-4 Bullets: was man sich mit der Empfehlung einhandelt und wann sie kippt.",
    },
    {
      title: "SMART-Ziele",
      must:
        `${TABLE_LEAD}: Ziel | Zielwert | Gemessen durch | Frist | Erreicht?. ` +
        "Jedes Ziel muss mit Ja oder Nein beantwortbar sein — \"die App wird genutzt\" ist kein Ziel, " +
        "\"20 Touren pro Woche laufen über die App\" ist eins. 2-4 Zeilen; `Erreicht?` steht zu Beginn " +
        "auf `offen`. Kein Visual.",
    },
    {
      title: "SWOT",
      must:
        "Ein `agxp-swot` Block mit allen vier Feldern, je 2-4 Punkte. Bewertet wird der PLAN, nicht das " +
        "Unternehmen, und jeder Punkt hängt an einer Lücke oder einem Ziel aus den Methoden davor. " +
        "Danach genau 1 Bullet: welche Schwäche zuerst angegangen wird.",
    },
  ],
  ...promptsFor("Transformation Concept", "numbers and names"),
};

/* --- Solution Architect: the Architecture Blueprint ----------------------- */

const ARCHITECT: Deliverable = {
  title: "Architecture Blueprint",
  subtitle: "How the system is built: components, decisions, pipeline, infrastructure and cost.",
  stations: [
    knowledgeCheck(
      "Softwarearchitektur und Betrieb",
      "API, Container, CI/CD, MLOps",
      "wie groß das Team ist und wie viel Zeit es gibt (allein / 2-5 Personen / mehr)",
    ),
    { label: "Starting point", goal: "Worum geht es? Anwendungsfall und Stand (Idee, Prototyp, PoC, schon im Betrieb), die Frage \"Wie baue ich das produktiv, skalierbar und sicher auf?\", erwartete Nutzerzahl, Branche, Team, Budget — und welcher Architekturstil dem Nutzer vorschwebt (Monolith, Serverless, Microservices). Daraus entstehen Kernproblem, Beschreibung, benötigtes Wissen und Eckdaten." },
    { label: "Components", goal: "Architektur-Überblick: Welche Plattformen (Web, Mobil, Backend), welcher Echtzeit-Bedarf, welche externen Dienste? Liste die Komponenten und je Komponente Verantwortung, Technologie und mit wem sie spricht — der Datenfluss ist der rote Faden." },
    { label: "Technology decisions", goal: "Technologie-Entscheidungen (ADR): Je bedeutender Entscheidung eine Zeile — welche Optionen standen zur Wahl, was wurde gewählt, warum, und welche Folge hat das. Bei Cloud, On-Prem oder Hybrid, Framework, Datenbank, Hosting nachfragen." },
    { label: "Quality requirements", goal: "Nichtfunktionale Anforderungen: Welche Qualität erwartet der Nutzer bei Geschwindigkeit, Skalierung, Sicherheit und Verfügbarkeit? Mach jede messbar (\"unter 2 s auf 4G\", \"100 Räume parallel\") und gib die Antwort des Designs darauf." },
    { label: "Data & ML pipeline", goal: "Falls ein Modell trainiert oder produktiv betrieben wird: die Stufen Daten holen, aufbereiten, trainieren, ausliefern (Model Serving) und überwachen (inkl. Drift und Neu-Training) — je Stufe Tool, Frequenz und Verantwortlicher. Ohne Modell: der Datenfluss von der Quelle bis zur Auslieferung. Frag ausdrücklich, wer Monitoring und Data Governance übernimmt." },
    { label: "Infrastructure", goal: "Infrastruktur-Plan: Cloud, On-Prem oder Hybrid — für Hosting, Daten und Modell-Betrieb einzeln. Container und Orchestrierung (Docker, Kubernetes) ja oder nein, welche Umgebungen (Entwicklung, Test, Produktion), wer betreibt es, wie wird es abgesichert." },
    { label: "Costs", goal: "Kostenmodell (TCO): Welche Kostenpositionen gibt es, einmalig und monatlich — Hosting, Dienste und Lizenzen, Training und Betrieb, und die Arbeitszeit der Menschen. Frag nach Annahmen und halte sie fest." },
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("Architekturstil (Monolith / Serverless / Microservices)", "Benötigtes Wissen"),
    {
      title: "Architektur-Überblick",
      must:
        `${TABLE_LEAD}: Komponente | Verantwortung | Technologie | Spricht mit. ` +
        "Eine Zeile je Komponente (4-8), `Spricht mit` nennt die verbundenen Komponenten beim Namen. " +
        "Danach ein Bullet je Hauptdatenfluss (z. B. \"Anfrage → Gateway → Modell-Service → Datenbank\") " +
        "und ein Bullet zum Architekturstil: warum dieser und nicht der nächste.",
    },
    {
      title: "Technologie-Entscheidungen (ADR)",
      must:
        `${TABLE_LEAD}: Nr. | Entscheidung | Optionen | Gewählt | Warum | Konsequenz. ` +
        "Eine Zeile je bedeutender Entscheidung (3-6), nummeriert `ADR-1`, `ADR-2` … Optionen sind mindestens " +
        "zwei. `Konsequenz` nennt, was man sich damit einhandelt — \"–\" nur, wenn es wirklich keine gibt. " +
        "Danach höchstens 3 Bullets: welche Entscheidung am schwersten umzukehren ist.",
    },
    {
      title: "Nichtfunktionale Anforderungen",
      must:
        `${TABLE_LEAD}: Qualität | Anforderung | Messgröße | Design-Antwort. ` +
        "Eine Zeile je Qualität: Performance, Skalierbarkeit, Sicherheit, Verfügbarkeit (und Monitoring, " +
        "wenn ein Modell betrieben wird). Jede Anforderung ist messbar, die Messgröße eine Zahl; die " +
        "Design-Antwort sagt, wie die Architektur sie erfüllt. Danach höchstens 3 Bullets: welche Qualität " +
        "unter Last oder Angriff zuerst bricht.",
    },
    {
      title: "Daten- & ML-Pipeline",
      must:
        `${TABLE_LEAD}: Stufe | Tool | Frequenz | Verantwortlich. ` +
        "Wenn ein Modell trainiert oder betrieben wird: mindestens die Stufen Daten holen, Aufbereiten, " +
        "Trainieren, Ausliefern (Model Serving), Überwachen (Drift) und Neu trainieren (mit Auslöser), " +
        "dazu eine Zeile Governance. Ohne Modell: nur der Datenfluss von der Quelle bis zur Auslieferung, " +
        "und ein Satz, dass keine Modell-Stufen nötig sind. Danach höchstens 3 Bullets: wie ein " +
        "Leistungsabfall bemerkt wird und wer dann handelt.",
    },
    {
      title: "Infrastruktur-Plan",
      must:
        `${TABLE_LEAD}: Bereich | Betriebsart | Technologie | Warum. ` +
        "Bereiche: Hosting und Rechenleistung, Daten, Modell-Betrieb (nur wenn es ein Modell gibt), " +
        "Netz und Sicherheit, Umgebungen (Entwicklung, Test, Produktion). `Betriebsart` ist `Cloud`, " +
        "`On-Prem` oder `Hybrid`. Container und Orchestrierung (Docker, Kubernetes) stehen in `Technologie`, " +
        "wenn sie gewählt wurden. Danach höchstens 3 Bullets: was bei einem Anbieterwechsel zu ändern wäre.",
    },
    {
      title: "Kostenmodell (TCO)",
      must:
        `${TABLE_LEAD}: Kostenposition | Einmalig | Monatlich | Annahme. ` +
        "Eine Zeile je Kostenposition, auch die Arbeitszeit der Menschen (in Stunden), und eine letzte " +
        "Zeile `Summe (Geld)`. Jede Zahl hat eine Annahme — fehlt sie, steht dort `offen: …`. Danach " +
        "höchstens 3 Bullets: welche Position nach dem Start am stärksten wächst.",
    },
    {
      title: "Risiko-Register",
      must:
        "Ein `agxp-risks` Block mit 4-6 Risiken aus der Architektur — die Gegenmaßnahme steht IM Block. " +
        "Prüfe diese typischen Fehlerquellen und nimm auf, was zutrifft: Model-Drift nicht vorgesehen, " +
        "Monitoring zu schwach, Skalierung unterschätzt, Data Governance vergessen, Abhängigkeit von " +
        "einem Anbieter. Risiken kommen aus den Lücken der Sektionen davor. Wiederhole die Gegenmaßnahme " +
        "danach NICHT als Bullet; die Bullets sagen, welches Risiko zuerst angegangen wird und warum.",
    },
  ],
  ...promptsFor("Architecture Blueprint", "components, tools, numbers and costs"),
};

/* --- Change Manager: the Adoption Plan ------------------------------------ */

const CHANGE: Deliverable = {
  title: "Adoption Plan",
  subtitle: "Who is affected, what they need, and how you will know the change is actually used.",
  stations: [
    knowledgeCheck(
      "Veränderungsmanagement",
      "Stakeholder, ADKAR, Widerstand, KPI",
      "welche Rolle der Nutzer im Projekt hat und wie viel Zeit er hat (unter 1 Monat / 1-3 Monate / mehr)",
    ),
    { label: "Starting point", goal: "Welche Veränderung kommt, warum, wer hat sie angestoßen, wann ist Go-live? Branche und Unternehmensgröße. Wie viele Menschen sind betroffen — die ZAHL und die Gruppen. Daraus entstehen Kernproblem, Beschreibung, benötigtes Wissen und Eckdaten." },
    { label: "Stakeholders", goal: "Stakeholder-Landkarte: Wer ist betroffen, wer kann blockieren, wer ist begeistert? Je Gruppe die Größe, das Interesse und den Einfluss (gering, mittel, hoch), die Haltung (Unterstützer, neutral, skeptisch) und welche Rolle sie in der Veränderung bekommt." },
    { label: "Roles", goal: "Rollen-Matrix: NUR wenn sich Aufgaben oder Verantwortung ändern — sonst sag in einem Satz, dass du die Station überspringst. Welche Rollen sind betroffen, wie sieht die Arbeit heute aus, wie danach, und was bleibt gleich? Gerade das Gleichbleibende nimmt die Angst." },
    { label: "Skills", goal: "Fähigkeitslücken: Welche Gruppen sind betroffen? Je Gruppe höchstens 3 arbeitsbezogene Fähigkeiten. Für jede heute und Ziel auf einer Skala von 1 bis 5, dann das Lernformat (Hands-on-Workshop, Coaching, Merkblatt, Herstellerschulung)." },
    { label: "Readiness (ADKAR)", goal: "ADKAR-Einschätzung: Je Gruppe die fünf Stufen Awareness, Desire, Knowledge, Ability, Reinforcement mit 1 bis 5 bewerten. Finde die ERSTE Stufe unter 3 — dort stockt die Veränderung — und ordne nur an dieser Stufe eine Maßnahme zu." },
    { label: "Training & communication", goal: "Schulungs- und Kommunikationsplan: Reihenfolge Warum, Wie, Ergebnisse — erst kommunizieren, vor dem Go-live schulen, danach Ergebnisse teilen. Je Schritt Zeitpunkt, Gruppe, Botschaft oder Schulung, Kanal und Verantwortlicher." },
    { label: "Adoption KPIs", goal: "Adoptions-KPIs: Woran sieht man, dass die Veränderung wirklich genutzt wird? Nutzung messen, nicht Schulungsteilnahme. Je KPI Zielwert, wie gemessen und bis wann." },
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("Betroffene Menschen (Anzahl und Gruppen)", "Benötigtes Wissen"),
    {
      title: "Stakeholder-Landkarte",
      must:
        `${TABLE_LEAD}: Gruppe | Größe | Interesse | Einfluss | Haltung | Einbindung. ` +
        "Eine Zeile je betroffener Gruppe. Interesse und Einfluss sind `gering`, `mittel` oder `hoch`; Haltung " +
        "ist `Unterstützer`, `neutral` oder `skeptisch`. `Einbindung` beginnt mit dem Feld, in das die Gruppe " +
        "fällt — `Eng einbinden` (hoher Einfluss, hohes Interesse), `Zufrieden halten` (hoher Einfluss, " +
        "geringes Interesse), `Informieren` (geringer Einfluss, hohes Interesse) oder `Beobachten` — und sagt " +
        "dann, wie. Danach 2-4 Bullets: wer zuerst Aufmerksamkeit braucht und warum.",
    },
    {
      title: "Fähigkeitslücken",
      must:
        `${TABLE_LEAD}: Gruppe | Benötigte Fähigkeit | Heute (1-5) | Ziel (1-5) | Lücke | Lernformat. ` +
        "Je Gruppe höchstens 3 arbeitsbezogene Fähigkeiten. Heute und Ziel als Skala mit Zahl, z. B. " +
        "`■□□□□ 1` und `■■■■□ 4`; `Lücke` ist die Differenz als Zahl. Danach höchstens 3 Bullets: bei " +
        "welcher Gruppe die Lücke am größten ist und warum das die Nutzung gefährdet.",
    },
    {
      title: "ADKAR-Einschätzung",
      must:
        `${TABLE_LEAD}: Gruppe | A | D | K | A | R | Erste Blockade | Maßnahme. ` +
        "Je Gruppe die fünf Stufen mit einer Zahl von 1 bis 5. `Erste Blockade` ist die erste Stufe unter 3, " +
        "von links gelesen (Awareness, Desire, Knowledge, Ability, Reinforcement); die Maßnahme setzt NUR " +
        "an dieser Stufe an — Schulung hilft nicht, wenn der Wunsch noch fehlt. Unter der Tabelle genau " +
        "eine Legendenzeile: `A = Awareness · D = Desire · K = Knowledge · A = Ability · R = Reinforcement`. " +
        "Danach höchstens 3 Bullets.",
    },
    {
      title: "Rollen-Matrix",
      must:
        `Nur wenn sich Aufgaben oder Verantwortung ändern: ${TABLE_RULE}: Rolle | Heute | Nach der Veränderung | Was bleibt. ` +
        "Eine Zeile je betroffener Rolle; `Was bleibt` ist nie leer — die Angst sinkt, wenn Menschen sehen, " +
        "was gleich bleibt. Ändert sich nichts an den Rollen, lass die Tabelle weg und schreib genau einen " +
        "Satz dazu.",
    },
    {
      title: "Schulungs- und Kommunikationsplan",
      must:
        `${TABLE_LEAD}: Wann | Gruppe | Botschaft / Schulung | Kanal | Verantwortlich. ` +
        "Chronologisch und in dieser Logik: erst kommunizieren (Warum, Wie), vor dem Go-live schulen, " +
        "danach Ergebnisse teilen. 3-6 Zeilen. Danach höchstens 3 Bullets: was passiert, wenn die erste " +
        "Botschaft ausbleibt.",
    },
    {
      title: "Adoptions-KPIs",
      must:
        `${TABLE_LEAD}: KPI | Zielwert | Gemessen durch | Frist | Erreicht?. ` +
        "3-5 Zeilen, alle messen NUTZUNG, nicht Schulungsteilnahme (\"80 % der Fälle laufen über das neue " +
        "System\", nicht \"90 % waren im Workshop\"). `Erreicht?` steht zu Beginn auf `offen`. Danach " +
        "höchstens 3 Bullets: welcher KPI zuerst Alarm schlagen würde.",
    },
  ],
  ...promptsFor("Adoption Plan", "groups, numbers and dates"),
};

/** The consultant types' documents, by TYPE_CATALOG id (lib/agent-types.ts). */
export const CONSULTANT_DELIVERABLES: Record<string, Deliverable> = {
  strategy: STRATEGY,
  architect: ARCHITECT,
  change: CHANGE,
};

const COACH: Deliverable = {
  title: "Change Plan",
  subtitle: "How the organisation comes along — the human half of the transformation.",
  stations: [
    { label: "Affected roles", goal: "Wer ist von der Veränderung betroffen? Rollen, Teams, Anzahl Menschen, wer merkt es am stärksten." },
    { label: "Mood & resistance", goal: "Wie ist die Stimmung heute? Konkrete Sorgen und Widerstände — wer sagt was, und was steckt dahinter (Angst um den Job, Kontrollverlust, Mehraufwand)." },
    { label: "Communication so far", goal: "Was wurde bisher kommuniziert, von wem, über welchen Kanal, und wie wurde es aufgenommen." },
    { label: "Skills & training", goal: "Was müssen die Leute können, was können sie heute schon, wie lernen sie am liebsten (Learning by doing, Schulung, Doku)." },
    { label: "Champions", goal: "Wer im Team ist offen oder begeistert und könnte Multiplikator sein? Wer hat informelle Autorität." },
    { label: "Rollout & milestones", goal: "Zeitrahmen des Rollouts, feste Termine, wann welche Gruppe dran ist, was zuerst pilotiert wird." },
  ],
  sections: [
    { title: "Auf einen Blick", must: "Ein `agxp-kpi` Block mit 4 Zahlen (betroffene Menschen, betroffene Rollen, Wochen bis Rollout, Anzahl offener Widerstände), danach 3-4 Bullets zur Lage." },
    { title: "Stakeholder", must: "Ein `agxp-stakeholders` Block mit allen betroffenen Gruppen, danach 2-4 Bullets: wer braucht zuerst Aufmerksamkeit und warum." },
    { title: "Widerstände und Antworten", must: "Eine Tabelle: Widerstand (im Wortlaut) | Was dahinter steckt | Antwort | Wer spricht. Danach 1-2 Bullets zum größten Hebel." },
    { title: "Kommunikationsplan", must: "Ein `agxp-roadmap` Block mit 3-4 Zeitpunkten und je 1-3 Botschaften, danach pro Zeitpunkt ein Bullet mit Kanal und Absender." },
    { title: "Enablement und Training", must: "Eine Tabelle: Rolle | Kann heute | Braucht | Format | Wann. Kein Visual." },
    { title: "Rollout", must: "Ein `agxp-roadmap` Block mit den Phasen (welche Gruppe wann), danach pro Phase ein Bullet mit dem Meilenstein und dem Abbruchkriterium." },
    { title: "Akzeptanz messen", must: "Ein `agxp-gap` Block mit 2-4 beobachtbaren Signalen (heute vs. Ziel), danach pro Signal ein Bullet: wie gemessen." },
  ],
  generatePrompt:
    "Create the complete Change Plan now, based on our whole conversation. " +
    "Graphics and bullets only — no paragraphs: every section leads with its visual block, " +
    "filled with the concrete roles, quotes and dates we discussed. " +
    "Answer in the language we have been speaking.",
  regeneratePrompt:
    "Rebuild the complete Change Plan from scratch, sharper than the last version: every visual " +
    "block filled with the real roles, quotes and dates from our conversation, and no paragraphs. " +
    "Answer in the language we have been speaking.",
};

/**
 * The default document of each role. The Consultant's default is the Strategy
 * Consultant's — the first of its types, and what an agent that matches no
 * type works as.
 */
export const DELIVERABLES: Record<AgentType, Deliverable> = {
  consultant: STRATEGY,
  coach: COACH,
};

/**
 * What an agent is working toward, by role and type. An unknown or missing
 * `kind` gets the role's default, so a stale client or an old agent never
 * ends up without a document.
 */
export function deliverableFor(role: AgentType, kind?: string | null): Deliverable {
  if (role === "consultant" && kind && Object.prototype.hasOwnProperty.call(CONSULTANT_DELIVERABLES, kind)) {
    return CONSULTANT_DELIVERABLES[kind];
  }
  return DELIVERABLES[role];
}

/** Every document the app can produce — for recognising the buttons that ask for one. */
export const ALL_DELIVERABLES: Deliverable[] = [...Object.values(CONSULTANT_DELIVERABLES), COACH];

/**
 * Builds the interview + deliverable half of the system prompt. Patryk's rule
 * from the 2026-09-02 review still holds — one question per turn — so the depth
 * comes from staying on a station and asking real follow-ups, not from firing a
 * numbered list of questions at the user.
 */
/**
 * @param limit  How many stations this plan may work through. The free tier
 *               stops at 3 of 8: the user meets the real product and hits a
 *               wall that explains itself, instead of a counter that cuts
 *               them off mid-answer. It is also what makes that tier
 *               affordable — our cost grows with the SQUARE of the
 *               conversation length, because the whole history is resent
 *               every turn, so a third of the turns is far less than a third
 *               of the price.
 */
export function agendaPrompt(d: Deliverable, limit: number | null = null): string {
  const capped = limit !== null && limit < d.stations.length;
  const stations = capped ? d.stations.slice(0, limit) : d.stations;
  const total = stations.length;
  const agenda = stations
    .map((s, i) => `${i + 1}. ${s.label} — ${s.goal}`)
    .join("\n");
  const sections = d.sections
    .map(s => `## ${s.title}\n   → ${s.must}`)
    .join("\n");

  // A capped interview still produces a document — a shorter, honest one that
  // names what is missing. A free tier that ends with nothing to show has
  // demonstrated nothing.
  const cap = capped
    ? `

WICHTIG — dieser Nutzer ist auf der kostenlosen Stufe: Das Interview endet nach Station ` +
      `${total}. Danach erstellst du das Dokument mit dem, was du hast. Sektionen, für die dir die ` +
      `Angaben fehlen, schreibst du trotzdem — mit "offen: dafür fehlen die Angaben aus den weiteren ` +
      `Stationen" statt erfundener Inhalte. Sag dem Nutzer EINMAL, am Ende des Dokuments, dass die ` +
      `vollständige Fassung die restlichen Stationen braucht. Ein Satz, kein Verkaufstext.`
    : "";

  return (
    `\n\nDein Ergebnis-Dokument ist "${d.title}". Um es erstellen zu können, führst du den Nutzer ` +
    `durch ein echtes Interview mit ${total} Stationen — in dieser Reihenfolge:\n${agenda}\n\n` +
    `So arbeitest du die Agenda ab:\n` +
    `- Genau EINE Frage pro Antwort. Niemals eine Liste von Fragen.\n` +
    `- Bleib auf einer Station, bis du sie wirklich verstanden hast — in der Regel 2-4 Nachfragen, ` +
    `die auf der letzten Antwort des Nutzers aufbauen ("Wie oft passiert das?", "Was kostet euch das ` +
    `im Monat?", "Wer merkt das zuerst?", "Hast du ein konkretes Beispiel von letzter Woche?").\n` +
    `- Frag konsequent nach ZAHLEN. Das Dokument besteht aus Grafiken, und eine Grafik ohne Zahl ` +
    `ist leer: Menge pro Tag, Minuten pro Vorgang, Euro pro Monat, Anzahl Personen, Termine.\n` +
    `- Wenn eine Antwort vage bleibt, frag nach einer Zahl oder einem konkreten Beispiel, statt zur ` +
    `nächsten Station zu springen.\n` +
    `- Fasse zwischendurch in einem Satz zusammen, was du verstanden hast, bevor du weiterfragst — ` +
    `so merkt der Nutzer, dass du zuhörst.\n` +
    `- Wenn der Nutzer eine Station nicht beantworten kann ("weiß ich nicht"), notiere das als offenen ` +
    `Punkt und geh weiter.\n\n` +
    `Marker am ENDE JEDER Antwort, jeweils in einer eigenen Zeile (sie werden vom Frontend ` +
    `herausgefiltert und als UI dargestellt, sie erscheinen nie im sichtbaren Text):\n` +
    `[[TOPIC: n/${total} Label]] — n ist die Station, an der du gerade arbeitest, Label EXAKT so ` +
    `geschrieben wie in der Agenda oben (englisch).\n` +
    `[[PROGRESS: NN]] — 0-100 in 5er-Schritten, wie bereit du bist, "${d.title}" zu erstellen. ` +
    `Orientierung: abgeschlossene Stationen geteilt durch ${total}, mal 100. Erhöhe den Wert nur, wenn ` +
    `der Nutzer tatsächlich neue relevante Informationen geliefert hat.\n\n` +
    `Bei 100 fragst du explizit (mit CHOICES), ob du "${d.title}" jetzt erstellen sollst. Der Nutzer ` +
    `kann das Dokument aber jederzeit früher anfordern — dann erstellst du es mit dem, was du hast, ` +
    `und markierst fehlende Punkte klar als "offen".\n\n` +
    // The user's rule (2026-09-09): the document must never arrive as chat
    // text — the frontend opens it in its own reader, and it only knows to do
    // that from the [[DOC: ...]] marker on the very first line.
    `AUSGABE-REGEL (hart): Das Dokument erscheint NIE als normale Chat-Antwort. Immer wenn du das ` +
    `Dokument erstellst ODER überarbeitest, beginnt deine Antwort mit [[DOC: ${d.title}]] in einer ` +
    `eigenen ERSTEN Zeile — ohne Vorrede davor. Die Oberfläche öffnet es dann als eigenes Dokument. ` +
    `Wenn der Nutzer nur eine Verständnisfrage zu einer Sektion hat, antworte kurz im Chat OHNE Marker ` +
    `und ohne Teile des Dokuments zu wiederholen. Sobald er aber eine Änderung will, erstellst du das ` +
    `KOMPLETTE Dokument neu (wieder mit Marker) — niemals nur die geänderte Sektion, niemals ` +
    `"hier der angepasste Abschnitt".` +
    VISUAL_SPEC +
    `\n\nAufbau des Dokuments: "# ${d.title}" als Titel, danach genau diese Sektionen als ` +
    `"##"-Überschriften, in dieser Reihenfolge:\n${sections}\n\n` +
    // The 2026-09-09 rule was "graphics, barely any words", because the
    // document was a wall of prose. It overshot: on 2026-10-03 the user's
    // verdict was "mult prea scurt… nu imi explica destul", about the one
    // artefact the product is sold on. The graphic still leads every
    // section — what changed is that it now has to be explained, and a
    // 15-word bullet cannot explain anything.
    `Qualitätsanspruch — dieses Dokument ist das Ergebnis, für das der Nutzer bezahlt. Es wird ` +
    `ausgedruckt, weitergegeben und einer Entscheiderin vorgelegt, die beim Gespräch nicht dabei ` +
    `war. Sie muss es allein verstehen:\n` +
    `- Jede Sektion hat genau diesen Aufbau: zuerst der vorgesehene Visual-Block, dann EIN fetter ` +
    `Satz, der sagt, was man daraus mitnimmt (die Einordnung), dann 4-8 Bullets. Ausnahmen sind ` +
    `die Management Summary (dort steht nur der \`agxp-summary\` Block) und jede Sektion, deren ` +
    `Vorgabe oben ausdrücklich etwas anderes sagt ("Danach höchstens 3 Bullets", "Keine Bullets"): ` +
    `dann gilt die Vorgabe der Sektion.\n` +
    `- Der fette Satz interpretiert, er wiederholt nicht. Nicht "Die Wartezeit liegt bei 19 Tagen" ` +
    `— das steht in der Grafik —, sondern "Zwei Drittel der Durchlaufzeit entstehen, bevor jemand ` +
    `überhaupt arbeitet".\n` +
    `- Jedes Bullet trägt einen Grund oder eine Folge, nicht nur ein Etikett. 15 bis 35 Wörter — ` +
    `ein Bullet aus vier Wörtern ist eine Überschrift, keine Aussage. ` +
    `"Schulung nötig" ist kein Bullet; "Niemand im Team kennt React, also entscheidet die Wahl ` +
    `des Tools auch, ob extern eingekauft werden muss" ist eins.\n` +
    `- Beschreibe NIE in Worten, was die Grafik schon zeigt. Die Grafik liefert die Zahlen, der ` +
    `Text liefert die Bedeutung.\n` +
    `- Jede Sektion wird ausgefüllt, und jeder Visual-Block enthält echte Werte aus dem Gespräch — ` +
    `keine Platzhalter, keine erfundenen Zahlen.\n` +
    `- Fehlt eine Zahl, schreib sie als Annahme in ein Bullet ("Annahme: …") oder markiere den ` +
    `Punkt als "offen: …". Eine ehrliche Lücke ist wertvoller als eine erfundene Zahl — aber lass ` +
    `keinen Block weg.\n` +
    `- Keine Floskeln, keine Wiederholung der Interviewfragen, kein Meta-Kommentar über das Dokument.\n` +
    `- Jede neue Version ist eine vollständige Neuerstellung und konkreter als die vorherige.\n\n` +
    `Am Ende des Dokuments stellst du eine kurze Frage (mit CHOICES), was angepasst werden soll.` +
    cap
  );
}
