import { TABLE_RULE, TABLE_LEAD, type Station, type DocSection } from "./deliverable-parts.ts";

/**
 * The methods of the method sheet (Part 2 of "AgxP – Method Groups per
 * Consultant"), one entry each: the station that asks what the method needs,
 * and the section that writes its output.
 *
 * The sheet gives every method four things, and each has a place here:
 *  - How the agent runs it  → the station's `goal`, step by step
 *  - Trigger                → "NUR wenn …" in the station and the section, so a
 *                             method that does not apply is skipped in one
 *                             sentence instead of invented
 *  - Output                 → the table's columns, in the sheet's order
 *  - Used by                → which documents call it (lib/consultant-documents.ts,
 *                             lib/deliverables.ts)
 *
 * Where two types use a method with a different trigger (Impact Mapping is
 * "always" for the Product Manager and "when the goal is vague" for the
 * Business Analyst; Governance Model, Stakeholder Map likewise) the entry is a
 * function of that trigger. Everything the types do not share stays in their
 * own document.
 */

export interface MethodParts {
  station: Station;
  section: DocSection;
}

/** A station that only applies when the sheet's trigger does. */
const only = (when: string) =>
  `NUR wenn ${when} — sonst sag in einem Satz, dass du diese Station überspringst, und geh weiter. `;

/**
 * The section's table. With a trigger it is conditional: when the trigger does
 * not apply the table is left out and one sentence says so, rather than an
 * invented row (the same rule as Market / Opportunity Gaps and the Role Matrix).
 */
function table(cols: string, rest: string, when?: string): string {
  return when
    ? `Nur wenn ${when}: ${TABLE_RULE}: ${cols}. ${rest} Trifft das nicht zu, lass die Tabelle weg und schreib genau einen Satz dazu, warum.`
    : `${TABLE_LEAD}: ${cols}. ${rest}`;
}

const part = (label: string, note: string, goal: string, title: string, must: string): MethodParts => ({
  station: { label, note, goal },
  section: { title, must },
});

/* ============================== OPENERS ================================== */

/** Future Headline — Strategy Consultant, Product Manager, General Consultant. Optional opener. */
export const futureHeadline = (linkedTo: "SMART-Ziele" | "OKRs" | "Ersten Schritten"): MethodParts => part(
  "Future headline",
  "An optional start: the headline of your success, 12 months from now.",
  "Zukunftsschlagzeile — ein OPTIONALER Einstieg: biete ihn EINMAL gleich nach dem Wissens-Check an (\"Magst du mit " +
    "einem kleinen Spiel starten?\", mit CHOICES) und überspringe ihn ohne Nachfrage, wenn der Nutzer nicht will. " +
    "Der Nutzer schreibt die Nachrichtenschlagzeile seines Erfolgs in 12 Monaten und einen Satz dazu. Du arbeitest " +
    `rückwärts: leite DREI Dinge ab, die wahr sein müssen, und verknüpfe jedes mit einem Ziel (${linkedTo}).`,
  "Schlagzeile aus der Zukunft",
  "Nur wenn der Nutzer eine Schlagzeile geschrieben hat: sie WÖRTLICH als Zitat (eine Zeile, die mit `> ` beginnt), " +
    `mit Datum und seinem einen Satz dahinter. Danach ${TABLE_RULE}: Was wahr sein muss | Verknüpftes Ziel. ` +
    `Genau 3 Zeilen; \`Verknüpftes Ziel\` verweist auf ein Ziel aus den ${linkedTo} weiter unten. ` +
    "Hat der Nutzer den Einstieg abgelehnt, lass die Sektion weg und schreib genau einen Satz dazu.",
);

/* ============================ STRATEGY ONLY ============================== */

export const competitorBenchmark = (): MethodParts => part(
  "Competitors",
  "Your idea against the alternatives. Skipped if you are not selling.",
  only("der Nutzer veröffentlichen oder verkaufen will") +
    "Wettbewerber-Benchmark: Finde gemeinsam mit dem Nutzer 3-5 Alternativen (Wettbewerber, Ersatzlösungen, die " +
    "heutige Behelfslösung). Wähle mit ihm 4-6 Kriterien, die seinen Nutzern wichtig sind. Bewerte die eigene Idee " +
    "und jede Alternative je Kriterium. Benenne zuletzt den White Space: wo die Idee anders ist, statt zu kopieren.",
  "Wettbewerber-Benchmark",
  table(
    "Kriterium | Deine Idee | Alt 1 | Alt 2 | Alt 3",
    "4-6 Kriterien als Zeilen; die Alternativen stehen mit Namen in den Spaltenköpfen (Alt 1 = die stärkste). " +
      "Jede Zelle ist `ja`, `nein` oder `teilweise`. Die LETZTE Zeile heißt `White Space` und sagt in der Spalte " +
      "`Deine Idee` in einer Zeile, wo die Idee anders ist als alle Alternativen. Gibt es mehr als drei Alternativen, " +
      "stehen die weiteren in einem Bullet danach. Danach höchstens 2 Bullets: welches Kriterium die Idee am " +
      "ehesten verwundbar macht.",
    "der Nutzer veröffentlichen oder verkaufen will",
  ),
);

export const scenarioPlanning = (): MethodParts => part(
  "Scenarios",
  "Best, base and worst case. Skipped for short, certain plans.",
  only("der Planungshorizont über 6 Monate liegt oder die Unsicherheit hoch ist") +
    "Szenarien: Definiere zuerst die Treiber — was entscheidet darüber, wie sich die Zukunft entwickelt. Schreibe " +
    "dann DREI Szenarien (Best Case, Base Case, Worst Case) mit je einem Frühwarnzeichen, an dem man es erkennt, " +
    "und der Reaktion darauf. Ein Plan, der nur eine Zukunft annimmt, ist eine Wette.",
  "Szenarien",
  "Nur wenn der Planungshorizont über 6 Monate liegt oder die Unsicherheit hoch ist: ein `agxp-cards` Block mit " +
    "genau 3 Karten in dieser Reihenfolge — `Best Case | good`, `Base Case`, `Worst Case | bad` — und je den Zeilen " +
    "`Was passiert`, `Frühwarnzeichen`, `Reaktion`. Das Frühwarnzeichen ist etwas Beobachtbares mit Zahl oder " +
    "Ereignis, die Reaktion eine konkrete Handlung. Danach höchstens 2 Bullets: welcher Treiber die drei " +
    "Szenarien am meisten auseinanderzieht. Trifft das nicht zu, lass den Block weg und schreib genau einen Satz dazu.",
);

/** Consultant-Coach Debate — Strategy Consultant, Solution Architect. */
export const debate = (): MethodParts => part(
  "Decision debate",
  "Consultant and Coach argue both sides; you decide. Only for a big trade-off.",
  only("eine große Entscheidung mit Zielkonflikten ansteht") +
    "Streitgespräch Consultant–Coach, in vier Schritten: (1) Benenne die Entscheidung in einem Satz. " +
    "(2) DU argumentierst DAFÜR — genau drei Argumente, je ein Satz. (3) Sag dem Nutzer, dass er im Coach-Fenster " +
    "die drei Argumente DAGEGEN abholen kann (der Coach liest dieses Gespräch mit); lies sie dann im parallelen " +
    "Gespräch nach und gib sie wörtlich weiter, statt sie zu erfinden. Liegen sie noch nicht vor, frag den Nutzer, " +
    "ob er sie holen will. (4) Der Nutzer wählt. Halte die Entscheidung mit seiner Begründung fest. Du entscheidest " +
    "nicht für ihn.",
  "Streitgespräch Consultant–Coach",
  "Nur wenn im Gespräch eine große Entscheidung mit Zielkonflikten diskutiert wurde: je Entscheidung (meist 1-2) " +
    "ein `agxp-debate` Block mit den Zeilen `Entscheidung: …`, `Dafür | …` (die drei Argumente des Consultants, mit `;` " +
    "getrennt, im Wortlaut), `Dagegen | …` (die drei des Coaches, im Wortlaut) und `Wahl | Entscheidung des Nutzers | " +
    "Begründung`. Stammt die Wahl noch nicht vom Nutzer, steht dort `Wahl | offen`. Danach höchstens 2 Bullets: was " +
    "die Entscheidung kippen würde. Gab es keine solche Entscheidung, lass den Block weg und schreib genau einen Satz dazu.",
);

/* ============================ SHARED METHODS ============================= */

/** Gap Analysis + Action Plan — Strategy Consultant, Business Analyst. */
export const gapAnalysis = (): MethodParts => part(
  "Gaps & actions",
  "The distance between today and the goal, and what closes it.",
  "Gap-Analyse mit Aktionsplan, in vier Schritten: (1) Frag nach den Zielen des Nutzers. (2) Bestimme zuerst den " +
    "Soll-Zustand (Desired). (3) Frag nur so viel nach, bis du die 2-3 Dimensionen kennst, die dem Nutzer wichtig " +
    "sind (Ziele, Reifegrad, Fähigkeiten, Technologien, Menschen, Ressourcen). (4) Fülle je Dimension heute, Ziel und " +
    "Lücke und leite die Maßnahmen ab, nach Priorität geordnet. Vieles weißt du schon aus den Stationen davor: fasse " +
    "es zusammen und frag nur nach, was fehlt.",
  "Gap-Analyse und Aktionsplan",
  "Ein `agxp-diff` Block mit einer Zeile je Dimension und fünf Spalten: `Dimension | heute | ziel | Lücke | " +
    "Aktionsplan`. Dimensionen: Ziele, Reifegrad, Fähigkeiten, Technologien, Menschen, Ressourcen — nur die 2-4, " +
    "über die der Nutzer tatsächlich gesprochen hat; lieber drei echte Zeilen als sechs erfundene. Erst das Ziel " +
    "festlegen, dann heute und Lücke. Der Aktionsplan steht IM Block: 1-3 Maßnahmen, nummeriert nach Priorität " +
    "(`1. … ; 2. …`), mit `;` getrennt. Danach höchstens 3 Bullets zur größten Lücke.",
);

/** SMART Goals — Strategy Consultant, Business Analyst (as Success Criteria). */
export const smartGoals = (asSuccessCriteria: boolean): MethodParts => part(
  "Success criteria",
  "Goals rewritten until a yes or no can check them.",
  "SMART-Ziele" + (asSuccessCriteria ? " als Erfolgskriterien des Vorhabens" : "") + ", in drei Schritten: (1) Sammle " +
    "die Ziele mit dem Nutzer. (2) Schreib jedes Ziel gemeinsam mit ihm um, bis es sich mit Ja oder Nein prüfen lässt " +
    "(\"die App wird genutzt\" ist kein Ziel, \"20 Touren pro Woche laufen über die App\" ist eins). (3) Ergänze " +
    "Frist und Messung: woran, bis wann, wer prüft. Du formulierst die Ziele MIT dem Nutzer, nicht für ihn.",
  asSuccessCriteria ? "SMART-Ziele (Erfolgskriterien)" : "SMART-Ziele",
  table(
    "Ziel | Zielwert | Gemessen durch | Frist | Erreicht?",
    "Jedes Ziel muss mit Ja oder Nein beantwortbar sein. 2-4 Zeilen; `Erreicht?` steht zu Beginn auf `offen`. " +
      "Kein Visual.",
  ),
);

/** Risk Register — Business Analyst, Digital Transformation Mgr, Data Scientist, Solution Architect, Enterprise Architect. */
export const riskRegister = (domain: string, typical: string): MethodParts => part(
  "Risks",
  "What could go wrong, rated, each with a countermeasure.",
  `Risiko-Register für ${domain}, in vier Schritten: (1) Zieh die Risiken aus den Lücken der Stationen davor — ` +
    `fast nichts davon musst du neu erfragen. Typische Quellen: ${typical}. (2) Bewerte je Risiko Auswirkung und ` +
    `Wahrscheinlichkeit (hoch, mittel, gering). (3) Schreib je Risiko eine Gegenmaßnahme. (4) Sortiere nach ` +
    `Schwere. Frag nur nach, was dir wirklich fehlt — höchstens ein- bis zweimal.`,
  "Risiko-Register",
  `Ein \`agxp-risks\` Block mit 4-6 Risiken aus ${domain} — die Gegenmaßnahme steht IM Block, sortiert nach ` +
    "Schwere (das schwerste zuerst). Risiken kommen aus den Lücken der Sektionen davor, nicht aus einer " +
    "allgemeinen Liste. Wiederhole die Gegenmaßnahme danach NICHT als Bullet; die Bullets sagen, welches Risiko " +
    "zuerst angegangen wird und warum.",
);

/** Impact Mapping — Product Manager (always), Business Analyst (goal vague or several actors). */
export const impactMapping = (when?: string): MethodParts => part(
  "Impact map",
  "Goal, actors, the behaviour you want, and what to build.",
  (when ? only(when) : "") +
    "Impact Mapping, in vier Schritten: (1) Setze ein MESSBARES Ziel (mit Zahl und Frist). (2) Benenne die Akteure, " +
    "die dieses Ziel beeinflussen. (3) Definiere je Akteur die Verhaltensänderung, die du dir wünschst. (4) Liste " +
    "die Lieferobjekte, die diese Änderung auslösen. Ein Feature ohne Wirkung wird gestrichen.",
  "Impact Mapping",
  table(
    "Ziel | Akteur | Wirkung | Lieferobjekt",
    "Davor ein `agxp-graph` Block als Baum von links nach rechts (`dir: LR`): ein Knoten `goal` für das Ziel, daran die " +
      "Akteure (`person`), daran je die Wirkung, daran das Lieferobjekt (`box`). Das Ziel steht messbar in der ersten Zeile und wird in den weiteren Zeilen nicht wiederholt (leer lassen). Je " +
      "Akteur eine Zeile, `Wirkung` ist die gewünschte Verhaltensänderung, `Lieferobjekt` das, was gebaut oder " +
      "getan wird. Danach höchstens 3 Bullets: welches Lieferobjekt ohne Wirkung auf das Ziel gestrichen würde.",
    when,
  ),
);

/** Governance Model — Digital Transformation Mgr (conditional), Enterprise Architect (always). */
export const governanceModel = (when?: string): MethodParts => part(
  "Governance",
  "Who decides what, who is consulted, and how often it is checked.",
  (when ? only(when) : "") +
    "Governance-Modell, in zwei Schritten: (1) Liste die wichtigsten Entscheidungen und Regeln (z. B. neuen " +
    "KI-Anwendungsfall starten, Modell geht live, personenbezogene Daten nur für den genannten Zweck). (2) Ordne " +
    "je Eintrag zu, wer entscheidet, wer konsultiert wird und in welchem Rhythmus oder mit welcher Prüfung. " +
    "Mehrere KI-Projekte ohne Regeln sind ein Risiko, zu viele Regeln töten Innovation: wenige, klare Regeln.",
  "Governance-Modell",
  table(
    "Entscheidung / Regel | Entscheidet / Verantwortlich | Konsultiert | Rhythmus / Prüfung",
    "Eine Zeile je Entscheidung oder Regel (3-6), `Entscheidet` ist EINE Rolle oder ein Gremium, nie eine " +
      "Aufzählung. Danach höchstens 3 Bullets: welche Regel am ehesten umgangen würde und warum.",
    when,
  ),
);

/** Stakeholder Map — Digital Transformation Mgr (conditional); the Change Manager has its own in lib/deliverables.ts. */
export const stakeholderMap = (when: string): MethodParts => part(
  "Stakeholders",
  "Who is affected, who can block, who helps. Skipped for small changes.",
  only(when) +
    "Stakeholder-Landkarte, in drei Schritten: (1) Frag, wer betroffen ist, wer blockieren kann und wer begeistert " +
    "ist. (2) Bewerte je Gruppe Interesse und Einfluss (gering, mittel, hoch) und die Haltung (Unterstützer, " +
    "neutral, skeptisch). (3) Weise eine Rolle zu. Widerstand kommt von Gruppen, die niemand gefragt hat.",
  "Stakeholder-Landkarte",
  table(
    "Gruppe | Größe | Interesse | Einfluss | Haltung | Einbindung",
    "Davor ein `agxp-quadrant` Block: Interesse auf der x-Achse, Einfluss auf der y-Achse, jede Gruppe ein Punkt " +
      "(0-100), die Felder `Beobachten | Informieren | Zufrieden halten | Eng einbinden`. Eine Zeile je Gruppe. Interesse und Einfluss sind `gering`, `mittel` oder `hoch`; Haltung ist `Unterstützer`, " +
      "`neutral` oder `skeptisch`. `Einbindung` beginnt mit dem Feld, in das die Gruppe fällt — `Eng einbinden` " +
      "(hoher Einfluss, hohes Interesse), `Zufrieden halten` (hoher Einfluss, geringes Interesse), `Informieren` " +
      "(geringer Einfluss, hohes Interesse) oder `Beobachten` — und sagt dann, wie. Danach 2-3 Bullets: wer zuerst " +
      "Aufmerksamkeit braucht.",
    when,
  ),
);

/** Pre-Mortem — Digital Transformation Mgr, Startup CTO. */
export const preMortem = (): MethodParts => part(
  "Pre-mortem",
  "Imagine it failed in 12 months and ask why. Before you commit budget.",
  only("vor einer Budgetzusage oder dem Start entschieden wird") +
    "Pre-Mortem, in drei Schritten: (1) Sag es klar: \"Es ist in zwölf Monaten, das Projekt ist gescheitert.\" " +
    "(2) Sammle mit dem Nutzer die fünf wichtigsten Gründe — Menschen nennen Risiken ehrlicher, wenn das Scheitern " +
    "schon angenommen ist. (3) Mach aus jedem Grund eine Gegenmaßnahme mit einem Verantwortlichen.",
  "Pre-Mortem",
  "Nur wenn vor einer Budgetzusage oder dem Start entschieden wird: zuerst als Zitat (eine Zeile, die mit `> ` beginnt) " +
    `der Satz \"Es ist <Monat Jahr in zwölf Monaten>. Das Projekt ist gescheitert. Warum?\". Danach ${TABLE_RULE}: ` +
    "Scheiter-Grund | Wahrscheinlichkeit | Gegenmaßnahme | Verantwortlicher. Genau 5 Zeilen, `Wahrscheinlichkeit` " +
    "ist `H`, `M` oder `L`, nach Wahrscheinlichkeit sortiert. Danach höchstens 2 Bullets: welcher Grund zuerst " +
    "angegangen wird. Steht keine Entscheidung an, lass die Tabelle weg und schreib genau einen Satz dazu.",
);

/** OKRs — Digital Transformation Mgr, Product Manager. */
export const okrs = (): MethodParts => part(
  "OKRs",
  "Up to three objectives, each proven by measurable key results.",
  "OKRs, in drei Schritten: (1) Höchstens DREI Objectives — die Ambition, in einem Satz. (2) Je Objective zwei " +
    "bis drei Key Results, die messbar sind (Zahl, nicht Tätigkeit). (3) Je Key Result Frist und Verantwortlicher. " +
    "OKRs verbinden Ambition mit Beleg.",
  "OKRs",
  "Ein `agxp-okr` Block: je Objective (höchstens 3) eine Zeile `Objective: …`, darunter je Key Result (2-3) eine Zeile " +
    "`Key Result | Frist | Verantwortlich | Fortschritt in %`. Jedes Key Result enthält Ausgangs- und Zielwert " +
    "(\"Bearbeitungszeit von 12 auf 9 min\"); der Fortschritt ist eine Zahl von 0 bis 100 (zu Beginn 0). Danach höchstens " +
    "2 Bullets: welches Key Result zuerst Alarm schlagen würde.",
);

/* ========================= BUSINESS ANALYST ============================== */

export const asIsToBe = (): MethodParts => part(
  "As-is / to-be",
  "How it works today, and how it should work after the project.",
  "As-Is / To-Be, in drei Schritten: (1) Frag, wie es heute gemacht wird und von wem. (2) Frag, was anders sein " +
    "soll. (3) Verknüpfe jede Zeile mit dem Schmerzpunkt, den sie löst. Nutzer beschreiben Wünsche, nicht " +
    "Veränderungen — ohne den heutigen Zustand kann niemand sagen, was besser wird.",
  "As-Is / To-Be",
  table(
    "Bereich | As-Is | To-Be | Gelöster Schmerzpunkt",
    "Eine Zeile je Bereich (3-6). `As-Is` beschreibt, wie es heute läuft, `To-Be`, wie es danach laufen soll — " +
      "beides konkret, nicht \"besser\". Jede Zeile nennt den Schmerzpunkt, den sie löst; eine Zeile ohne " +
      "Schmerzpunkt fliegt raus. Danach höchstens 3 Bullets: wo der Abstand zwischen heute und morgen am " +
      "größten ist.",
  ),
);

export const requirements = (): MethodParts => part(
  "Requirements",
  "User stories with acceptance criteria and a priority.",
  "Anforderungen (User Stories + MoSCoW), in vier Schritten: (1) Frag nach Nutzern (Rollen), ihren Aktionen und " +
    "den Qualitätsanforderungen. (2) Schreib daraus User Stories (\"Als <Rolle> möchte ich <Aktion>, damit " +
    "<Nutzen>\"). (3) Ergänze Akzeptanzkriterien nach dem Muster Given-When-Then. (4) Priorisiere gemeinsam mit " +
    "dem Nutzer nach MoSCoW (Must, Should, Could, Won't). \"Eine Quiz-App bauen\" ist nicht baubar — testbare " +
    "Anforderungen sind es.",
  "Anforderungen (User Stories + MoSCoW)",
  table(
    "ID | User Story | Typ (F/NF) | Akzeptanzkriterien | Priorität",
    "IDs `R1`, `R2` … ; `Typ` ist `F` (funktional) oder `NF` (nichtfunktional, z. B. Geschwindigkeit). Funktionale " +
      "Anforderungen haben Akzeptanzkriterien als `Given … When … Then …`, nichtfunktionale ein messbares " +
      "Kriterium. `Priorität` ist `Must`, `Should`, `Could` oder `Won't`. 5-10 Zeilen. Danach höchstens 3 Bullets: " +
      "welche Must-Stories das Ziel tragen und welche man streichen könnte.",
  ),
);

export const processMapping = (): MethodParts => part(
  "Process map",
  "The to-be process, step by step, with roles, inputs and outputs.",
  only("mehr als eine Rolle beteiligt ist oder es Übergaben gibt") +
    "Prozess-Mapping, in drei Schritten: (1) Frag die Schritte des To-Be-Prozesses der Reihe nach. (2) Ordne je " +
    "Schritt Rolle, Input und Output zu. (3) Markiere die automatisierten Schritte. Prozesse brechen an den " +
    "Übergaben zwischen Menschen und Systemen — frag dort genau nach.",
  "Prozess-Mapping",
  table(
    "Schritt | Rolle | Aktion | Input | Output",
    "Davor ein `agxp-sequence` Block mit den Rollen als Spuren (erste Zeile) und je Schritt einer Nachricht; ein `*` am " +
      "Ende markiert einen automatisierten Schritt. Die Schritte in der Reihenfolge des To-Be-Prozesses, nummeriert (`1`, `2` …). Ein `*` hinter der Aktion " +
      "heißt: läuft automatisch. `Rolle` ist die Person oder das System. Danach höchstens 3 Bullets: an welcher " +
      "Übergabe der Prozess am ehesten bricht.",
    "mehr als eine Rolle beteiligt ist oder es Übergaben gibt",
  ),
);

export const painPointHeatmap = (): MethodParts => part(
  "Pain points",
  "Pain points by frequency and severity, to see where to start. Skipped for a few.",
  only("mehr als 4 Schmerzpunkte genannt wurden") +
    "Schmerzpunkt-Heatmap, in drei Schritten: (1) Sammle die Schmerzpunkte. (2) Bewerte je Schmerzpunkt Häufigkeit " +
    "und Schwere von 1 bis 5. (3) Berechne den Score (Häufigkeit mal Schwere) und sortiere. Nicht jede Beschwerde " +
    "zählt gleich viel — hier sieht man, wo man anfängt.",
  "Schmerzpunkt-Heatmap",
  table(
    "Schmerzpunkt | Häufigkeit (1-5) | Schwere (1-5) | Score | Betroffene",
    "Absteigend nach Score sortiert. `Score` ist das Produkt aus Häufigkeit und Schwere, als Zahl. `Betroffene` " +
      "nennt die Gruppe oder Rolle. Danach höchstens 2 Bullets: womit man beginnt und warum.",
    "mehr als 4 Schmerzpunkte genannt wurden",
  ),
);

export const dataMapping = (): MethodParts => part(
  "Data map",
  "Every data field the use case needs, with source, owner and quality.",
  only("der Use Case Daten aus bestehenden Systemen braucht") +
    "Data Mapping, in drei Schritten: (1) Liste die Felder, die die Anforderungen brauchen (mit der Req-ID). " +
    "(2) Finde je Feld Quelle und Verantwortlichen. (3) Bewerte die Qualität. KI-Anforderungen scheitern, wenn " +
    "ein benötigtes Feld nirgends existiert — frag genau danach.",
  "Data Mapping",
  table(
    "Feld | Benötigt für (Req-ID) | Quelle | Verantwortlicher | Qualität | Lücke",
    "Eine Zeile je Feld. `Benötigt für` nennt die ID aus den Anforderungen (R1 …), `Qualität` ist `H`, `M` oder " +
      "`L`. `Lücke` sagt in einem Satz, was fehlt — \"–\" nur, wenn nichts fehlt. Danach höchstens 3 Bullets: " +
      "welches Feld die Anforderung am ehesten scheitern lässt.",
    "der Use Case Daten aus bestehenden Systemen braucht",
  ),
);

export const edgeCaseHunt = (): MethodParts => part(
  "Edge cases",
  "What happens in unusual situations, for every must-have story.",
  "Randfall-Jagd, direkt nach den Anforderungen: (1) Frag je Must-Story \"Was, wenn …?\" — leer, zu viele, " +
    "offline, falsche Eingabe, Missbrauch. (2) Lege das erwartete Verhalten fest. Die meisten Fehler und " +
    "Beschwerden kommen aus Fällen, über die nie gesprochen wurde.",
  "Randfälle",
  table(
    "Story-ID | Randfall | Erwartetes Verhalten | Priorität",
    "Je Must-Story ein bis zwei Randfälle, `Story-ID` aus den Anforderungen. `Randfall` beginnt mit \"Was, wenn …\". " +
      "`Priorität` ist `Must`, `Should` oder `Could`. Danach höchstens 3 Bullets: welcher Randfall das Ziel am " +
      "stärksten gefährdet.",
  ),
);

export const definitionOfDone = (): MethodParts => part(
  "Definition of done",
  "A shared checklist every feature passes before it counts as done. For teams of two or more.",
  only("das Team aus mindestens zwei Personen besteht") +
    "Definition of Done, in drei Schritten: (1) Schlage 5-8 Prüfpunkte vor. (2) Der Nutzer bestätigt oder ändert " +
    "sie. (3) Sie gelten für jede Story. \"Fertig\" bedeutet für jeden etwas anderes — hier steht, was es hier " +
    "bedeutet.",
  "Definition of Done",
  "Nur wenn das Team aus mindestens zwei Personen besteht: ein `agxp-checklist` Block mit 5-8 Zeilen " +
    "`[ ] Prüfpunkt | Gilt für | Wer prüft` (`[x]` für bereits Erledigtes). `Gilt für` ist `alle Stories` oder eine benannte " +
    "Gruppe, `Wer prüft` eine Person oder Rolle — möglichst nicht die, die es gebaut hat. Danach höchstens 2 Bullets: " +
    "welcher Prüfpunkt am ehesten übersprungen wird. Besteht das Team nur aus einer Person, lass den Block weg und " +
    "schreib genau einen Satz dazu.",
);

/* ===================== DIGITAL TRANSFORMATION MGR ======================== */

export const capabilityMaturity = (): MethodParts => part(
  "Capability maturity",
  "Rates the organisation 1 to 5 per dimension against a target level.",
  "Reifegrad, in drei Schritten: (1) Stell je Dimension Evidenzfragen (Daten, Technologie, Skills, Prozesse, " +
    "Governance) — nicht \"wie reif seid ihr?\", sondern \"woran sieht man das?\". (2) Bewerte von 1 (ad hoc) bis " +
    "5 (optimiert). (3) Setze das Zielniveau. Ohne Ausgangspunkt ist die Größe des Schritts unbekannt und die " +
    "Roadmap geraten.",
  "Reifegrad",
  table(
    "Dimension | Aktuell (1-5) | Ziel | Evidenz",
    "Eine Zeile je Dimension: Daten, Technologie, Skills, Prozesse, Governance. `Aktuell` und `Ziel` als Skala mit " +
      "Zahl, z. B. `■■□□□ 2` und `■■■□□ 3`. `Evidenz` ist ein Beleg, kein Eindruck. Danach höchstens 3 Bullets: " +
      "welche Dimension den Rest ausbremst.",
  ),
);

export const prioritizeUseCases = (): MethodParts => part(
  "Use cases",
  "Rates AI use cases by value, effort and data readiness.",
  "Use-Case-Priorisierung, in drei Schritten: (1) Sammle die KI-Anwendungsfälle. (2) Bewerte je Use Case Wert, " +
    "Aufwand und Datenreife. (3) Ordne ihn ein: Quick Win, Strategic Bet, Later oder Drop. Organisationen starten " +
    "alles auf einmal und beenden nichts.",
  "Use-Case-Priorisierung",
  table(
    "Use Case | Wert | Aufwand | Daten bereit? | Kategorie",
    "Davor ein `agxp-quadrant` Block: Aufwand auf der x-Achse, Wert auf der y-Achse, jeder Use Case ein Punkt (0-100), die " +
      "Felder `Later | Drop | Quick Wins | Strategic Bets`. Eine Zeile je Use Case. `Wert` und `Aufwand` sind `H`, `M` oder `L`, `Daten bereit?` ist `ja`, `teilweise` " +
      "oder `nein`. `Kategorie`: hoher Wert und geringer Aufwand = `Quick Win`, hoher Wert und hoher Aufwand = " +
      "`Strategic Bet`, geringer Wert und geringer Aufwand = `Later`, geringer Wert und hoher Aufwand = `Drop`. " +
      "Danach höchstens 3 Bullets: womit man beginnt und was bewusst nicht.",
  ),
);

export const roadmap = (): MethodParts => part(
  "Roadmap",
  "Phases with milestones, owners and a gate to the next phase.",
  "Roadmap, in drei Schritten: (1) Definiere die Phasen (Quick Wins, Scale, Embed). (2) Je Phase Meilensteine und " +
    "Verantwortlicher. (3) Gate-Kriterien — woran man erkennt, dass die nächste Phase beginnen darf. Sie macht aus " +
    "Prioritäten eine Reihenfolge mit Terminen und Abhängigkeiten; nimm die Quick Wins und Strategic Bets aus der " +
    "Use-Case-Priorisierung auf.",
  "Roadmap",
  `Ein \`agxp-gantt\` Block: je Phase (Quick Wins, Scale, Embed) eine Lane, je Meilenstein eine Zeile ` +
    `\`Phase | Meilenstein | Start | Ende\` auf einer Zeitachse (\`unit:\` oder \`ticks:\` benennt die Schritte; ein Gate ` +
    `ist eine Zeile mit \`| milestone\` am Ende). Danach ${TABLE_RULE}: ` +
    "Phase | Meilensteine | Verantwortlich | Gate zur nächsten Phase. Eine Zeile je Phase; das Gate ist ein " +
    "messbares Kriterium (\"Bearbeitungszeit −15 %\"), nie \"wenn fertig\". Die Meilensteine kommen aus der " +
    "Use-Case-Priorisierung — erfinde keine zweite Liste. Danach höchstens 3 Bullets: was die erste Phase " +
    "unbrauchbar machen würde.",
);

export const aiUseCaseCanvas = (): MethodParts => part(
  "Use-case canvas",
  "A one-page card per AI use case, for steering meetings.",
  "KI-Use-Case-Canvas, je Use Case aus der Priorisierung (die Quick Wins und Strategic Bets, höchstens drei): " +
    "(1) Fülle sieben Felder — Problem, Nutzer, Daten, Modell-Idee, Wert, Risiko, Verantwortlicher. (2) Häng sie " +
    "an die Priorisierung. Die Karte macht Anwendungsfälle vergleichbar und im Lenkungskreis teilbar. Vieles " +
    "weißt du schon: fasse zusammen und frag nur nach, was fehlt.",
  "KI-Use-Case-Canvas",
  "Je Use Case aus der Priorisierung (Quick Wins und Strategic Bets, höchstens 3) eine Karte in einem `agxp-cards` Block: " +
    "die erste Zeile ist der Titel `KI-Use-Case: <Name>`, danach genau 7 Zeilen `Feld | Inhalt` in dieser Reihenfolge: " +
    "Problem, Nutzer, Daten, Modell-Idee, Wert, Risiko, Verantwortlicher. Jede Zelle ist ein Satz mit Zahl, wo " +
    "es eine gibt; Unbekanntes steht als `offen: …`. Danach höchstens 2 Bullets: welcher Use Case zuerst " +
    "in den Lenkungskreis geht.",
);

export const pulseCheck = (): MethodParts => part(
  "Pulse check",
  "A monthly five-question check on progress, energy and blockers.",
  only("die Transformation bereits läuft und länger als 3 Monate dauert") +
    "Transformations-Puls, in vier Schritten: (1) Stelle jeden Monat dieselben fünf Fragen — Fortschritt gegenüber " +
    "Plan, Energie im Team, Blocker, Rückhalt im Management, Klarheit über das Ziel. (2) Bewerte von 1 bis 5. " +
    "(3) Vergleiche mit dem Vormonat. (4) Handle bei einem Abfall. Transformationen sterben leise; ein " +
    "regelmäßiger Puls zeigt Ärger früh. Frag nach dem letzten Wert, falls es einen gibt.",
  "Transformations-Puls",
  table(
    "Frage | Wert diesen Monat | Letzter Monat | Trend | Maßnahme",
    "Genau 5 Zeilen, immer dieselben Fragen. Die Werte als Skala mit Zahl (`■■■□□ 3`); gibt es keinen Vormonat, " +
      "steht dort `–`. `Trend` ist `▲ +n`, `▼ −n` oder `=`. Bei einem Abfall von 2 oder mehr nennt `Maßnahme` " +
      "eine konkrete Handlung, sonst `–`. Danach höchstens 2 Bullets: welche Frage zuerst kippt.",
    "die Transformation bereits läuft und länger als 3 Monate dauert",
  ),
);

/* ============================ DATA SCIENTIST ============================= */

export const problemFraming = (): MethodParts => part(
  "Problem framing",
  "Turns the business question into an ML task: input, output, decision.",
  "Problem-Framing, in drei Schritten: (1) Frag, welche ENTSCHEIDUNG das Modell unterstützt. (2) Lege " +
    "ML-Aufgabentyp, Input und Output fest (Klassifikation, Regression, Ranking, Prognose, Clustering …). " +
    "(3) Prüfe, dass jemand auf das Ergebnis tatsächlich handelt. \"KI für Schadenfälle nutzen\" ist keine " +
    "Aufgabe; ein Modell braucht definierten Input, Output und Entscheidung.",
  "Problem-Framing",
  table(
    "Geschäftsfrage | ML-Aufgabe | Input | Output | Unterstützte Entscheidung",
    "Davor ein `agxp-graph` Block: Geschäftsfrage und Input laufen in die ML-Aufgabe, daraus der Output und die Entscheidung. " +
      "Eine Zeile je Geschäftsfrage (1-3). `ML-Aufgabe` nennt den Typ (z. B. `Klassifikation in 3 Klassen`), " +
      "`Input` und `Output` konkret mit Feldern bzw. Klassen. `Unterstützte Entscheidung` sagt, wer was mit dem " +
      "Ergebnis tut. Danach höchstens 3 Bullets: ob wirklich jemand auf das Ergebnis handelt.",
  ),
);

export const dataReadiness = (): MethodParts => part(
  "Data readiness",
  "Whether the data exists, is labelled, good enough and reachable.",
  "Datenreife, in vier Schritten: (1) Liste die Datenquellen. (2) Frag nach Volumen und Labels in ZAHLEN. " +
    "(3) Bewerte Qualität und Zugang. (4) Benenne die Lücke. Datenqualität ist der häufigste Grund, warum " +
    "KI-PoCs scheitern.",
  "Datenreife",
  table(
    "Datenquelle | Volumen | Labels? | Qualität (H/M/L) | Zugang | Lücke",
    "Eine Zeile je Quelle. `Volumen` als Zahl mit Einheit, `Labels?` ist `ja`, `nein` oder `–` (wenn keine " +
      "nötig), `Qualität (H/M/L)` ist `H`, `M` oder `L`, `Zugang` ist `ja`, `offen` (z. B. Freigabe fehlt) oder " +
      "`nein`. `Lücke` ist ein konkreter Satz (\"20 % fehlende Werte\"), \"–\" nur, wenn nichts fehlt. Danach " +
      "höchstens 3 Bullets: welche Lücke den PoC zuerst stoppen würde.",
  ),
);

export const modelOptions = (): MethodParts => part(
  "Model options",
  "Compares 2-3 approaches, including a simple baseline.",
  "Modell-Optionen, in drei Schritten: (1) Schlage eine einfache Baseline vor und ein bis zwei Modelle. " +
    "(2) Vergleiche Datenbedarf, Erklärbarkeit und Aufwand. (3) Empfiehl. Nutzer können nicht beurteilen, welche " +
    "KI-Technik passt; eine Baseline zeigt, ob KI sich überhaupt lohnt.",
  "Modell-Optionen",
  table(
    "Option | Wie es funktioniert | Benötigte Daten | Erklärbarkeit | Aufwand | Empfehlung",
    "2-3 Zeilen; die ERSTE ist immer die einfache Baseline (z. B. Regeln eines Experten). `Erklärbarkeit` und " +
      "`Aufwand` sind `H`, `M` oder `L`. `Empfehlung` ist `Start hier`, `Haupt-PoC` oder `Phase 2`. Danach " +
      "höchstens 3 Bullets: was die Baseline schon leistet und was ein Modell darüber hinaus bringen müsste.",
  ),
);

export const rootCause = (): MethodParts => part(
  "Root cause",
  "Asks why repeatedly until the team can act. Only if a result is below target.",
  only("bereits ein Modell existiert, ein PoC-Ergebnis unter dem Ziel liegt oder etwas wiederholt scheitert") +
    "Ursachenanalyse (5 Whys), in drei Schritten: (1) Nenne das Problem in einem Satz mit Zahl. (2) Frag \"Warum?\" " +
    "und beantworte es mit Evidenz, nicht mit Vermutung. (3) Wiederhole, bis eine Ursache erreicht ist, an der das " +
    "Team etwas ändern kann — meist nach 3 bis 5 Stufen. Symptome zu beheben verschwendet Zeit.",
  "Ursachenanalyse (5 Whys)",
  table(
    "Warum? | Antwort | Evidenz",
    "Davor ein `agxp-graph` Block mit `dir: TB`: das Problem oben, darunter die Kette der Warum-Fragen, die Ursache als " +
      "letzter Knoten mit `| box | ok` und der Maßnahme im Text. Die erste Zeile nennt das Problem mit Zahl, dann 3-5 Zeilen `Warum? …` mit Antwort und Evidenz; die LETZTE " +
      "Zeile ist die Ursache und nennt in `Antwort` die Maßnahme. Eine Antwort ohne Evidenz steht als `Vermutung`. " +
      "Danach höchstens 2 Bullets: was dagegen spricht, dass dies die tiefste Ursache ist.",
    "bereits ein Modell existiert, ein PoC-Ergebnis unter dem Ziel liegt oder etwas wiederholt scheitert",
  ),
);

export const labelAudit = (): MethodParts => part(
  "Label audit",
  "Checks a sample of training labels for errors. Only if labelled data exists.",
  only("gelabelte Daten existieren") +
    "Label-Audit, in vier Schritten: (1) Ziehe je Klasse 100 Datensätze als Stichprobe. (2) Ein Experte labelt " +
    "sie blind neu. (3) Miss die Übereinstimmung. (4) Korrigiere die Regeln, wo sie schwach ist. Falsche Labels " +
    "lehren das Modell falsches Verhalten; kein Modell repariert schlechte Labels. Frag, wer als Experte infrage " +
    "kommt.",
  "Label-Audit",
  table(
    "Label-Klasse | Stichprobe | Übereinstimmung % | Hauptverwechslung | Korrektur",
    "Eine Zeile je Klasse. `Stichprobe` ist die Anzahl (Ziel: 100), `Übereinstimmung %` eine Zahl, " +
      "`Hauptverwechslung` die Klasse, mit der sie am häufigsten verwechselt wird (\"–\" bei guter Übereinstimmung), " +
      "`Korrektur` die geänderte Regel. Noch nicht auditiert: `offen`. Danach höchstens 3 Bullets: welche Klasse " +
      "zuerst neu gelabelt werden muss.",
    "gelabelte Daten existieren",
  ),
);

export const humanInTheLoop = (): MethodParts => part(
  "Human in the loop",
  "When the AI decides alone, when it suggests, when a human decides.",
  only("die Modellausgabe Menschen oder Geld betrifft") +
    "Human-in-the-Loop-Design, in drei Schritten: (1) Liste die Entscheidungen, an denen das Modell beteiligt ist. " +
    "(2) Lege Konfidenz-Schwellen fest. (3) Weise je Bereich zu: automatisch, Vorschlag oder Mensch. Vertrauen " +
    "und Regulierung verlangen klare menschliche Kontrollpunkte.",
  "Human-in-the-Loop-Design",
  table(
    "Entscheidung | KI-Konfidenz | Modus (Auto/Vorschlag/Mensch) | Wer prüft",
    "Davor ein `agxp-graph` Block: der Eingang, ein Knoten `decision` für die KI-Konfidenz und je Konfidenz-Bereich ein " +
      "Ausgang (`Auto`, `Vorschlag`, `Mensch`) mit der Schwelle als Beschriftung. Eine Zeile je Entscheidung und Konfidenz-Bereich (z. B. `> 95 %`, `70-95 %`, `< 70 % oder auffällig`). " +
      "`Modus` ist `Auto`, `Vorschlag` oder `Mensch`; `Wer prüft` nennt Rolle und, bei `Auto`, die Stichprobe " +
      "(\"5 % Stichprobe\"). Entscheidungen über Geld oder Menschen sind nie ohne Prüfpunkt `Auto`. Danach " +
      "höchstens 3 Bullets: wo die Schwelle am riskantesten gesetzt ist.",
    "die Modellausgabe Menschen oder Geld betrifft",
  ),
);

export const modelCard = (): MethodParts => part(
  "Model card",
  "A short fact sheet of the model. Once a model passes the PoC.",
  only("ein Modell den PoC bestanden hat") +
    "Model Card, in zwei Schritten: (1) Fülle nach dem PoC die festen Felder — Zweck, Daten, Metriken, Grenzen, " +
    "Nicht geeignet für, Verantwortlicher. (2) Aktualisiere sie bei jedem Release. Sie macht das Modell für " +
    "Fachbereich, Prüfer und den nächsten Entwickler verständlich.",
  "Model Card",
  "Nur wenn ein Modell den PoC bestanden hat: ein `agxp-cards` Block mit EINER Karte, deren erste Zeile `Model Card: <Name> v1` ist, " +
    "danach genau 6 Zeilen `Feld | Inhalt` in dieser Reihenfolge: Zweck, Daten, Metriken, Grenzen, " +
    "Nicht geeignet für, Verantwortlicher. `Metriken` mit Zahlen. Danach höchstens 2 Bullets: was bei einem " +
    "neuen Release zuerst neu geprüft wird. Ist noch kein Modell durch den PoC, lass den Block weg und " +
    "schreib genau einen Satz dazu.",
);

export const evaluationMetrics = (): MethodParts => part(
  "Evaluation metrics",
  "Technical metrics translated into business meaning.",
  "Bewertungsmetriken, in drei Schritten: (1) Wähle die Metriken. (2) Übersetze jede in ihre geschäftliche " +
    "Wirkung. (3) Setze Baseline und Zielwert. Precision sagt einem Fachbereich nichts — ihre Wirkung schon.",
  "Bewertungsmetriken",
  table(
    "Metrik | Geschäftliche Bedeutung | Baseline | Ziel",
    "2-4 Zeilen. `Geschäftliche Bedeutung` ist ein Satz ohne Fachwort (\"Anteil der einfachen Fälle, die wir " +
      "schnell abwickeln\"). `Baseline` und `Ziel` sind Zahlen mit Einheit; die Baseline stammt aus dem heutigen " +
      "Verfahren oder der einfachen Baseline-Option. Danach höchstens 3 Bullets: welche Metrik der Fachbereich " +
      "zuerst fragen wird.",
  ),
);

export const pocPlan = (): MethodParts => part(
  "PoC plan",
  "Hypothesis, dataset, threshold, timebox and the next step.",
  "PoC-Experimentplan, in fünf Schritten: (1) Formuliere die Hypothese. (2) Wähle den Datensatz. (3) Lege einen " +
    "Ja/Nein-Schwellenwert fest. (4) Setze eine Zeitbox. (5) Definiere, was bei Ja und was bei Nein folgt. PoCs " +
    "ohne Schwelle enden nie und entscheiden nichts.",
  "PoC-Experimentplan",
  table(
    "Hypothese | Datensatz | Schwellenwert | Zeitbox | Wenn ja | Wenn nein",
    "1-2 Zeilen. Die Hypothese ist prüfbar (\"Modell schlägt die Regeln bei …\"), der Schwellenwert eine Zahl, die " +
      "VOR dem Test festgelegt wird, die Zeitbox in Wochen. `Wenn nein` verweist, wenn sinnvoll, auf die " +
      "Ursachenanalyse. Danach höchstens 3 Bullets: was den PoC vorzeitig beenden würde.",
  ),
);

/* ========================== PRODUCT MANAGER ============================== */

export const personas = (): MethodParts => part(
  "Personas",
  "Short profiles of the main user types.",
  "Personas, in drei Schritten: (1) Frag, wer es zuerst nutzt, wann und wo. (2) Frag, was sie heute stattdessen " +
    "nutzen. (3) Schreibe höchstens DREI Personas. Wer für alle baut, baut für niemanden.",
  "Personas",
  "Ein `agxp-cards` Block mit höchstens 3 Karten, je eine Persona: die erste Zeile ist der Name mit Rolle " +
    "(\"Party-Host\"), danach genau diese Zeilen `Label | Wert`: Kontext (wann und wo), Ziel, Frust heute (die heutige " +
    "Alternative), Kommt zurück, weil. Danach höchstens 3 Bullets: welche Persona zuerst bedient wird und warum.",
);

export const mvpScope = (): MethodParts => part(
  "MVP scope",
  "Features sorted into Must, Should, Could and Won't for the first release.",
  "MVP-Scope (MoSCoW), in vier Schritten: (1) Liste die Features. (2) Ordne sie den Personas zu. (3) Priorisiere " +
    "mit Must, Should, Could, Won't. (4) Begründe. Einsteiger überbauen und verpassen Fristen — frag deshalb " +
    "bei jedem Must, ob es ohne wirklich nicht geht.",
  "MVP-Scope (MoSCoW)",
  table(
    "Feature | Persona | MoSCoW | Begründung",
    "Davor ein `agxp-moscow` Block mit den vier Zeilen `Must`, `Should`, `Could`, `Won't`, die Features mit `;` getrennt. " +
      "Eine Zeile je Feature (6-12). `MoSCoW` ist `Must`, `Should`, `Could` oder `Won't`. Höchstens ein Drittel " +
      "der Features sind Must. Danach höchstens 3 Bullets: welches Must am ehesten gestrichen werden könnte.",
  ),
);

export const userJourney = (): MethodParts => part(
  "User journey",
  "The stages a user goes through, with feelings and drop-off risks.",
  only("der Kernablauf mehr als 3 Schritte hat oder ein Onboarding nötig ist") +
    "User Journey, in vier Schritten: (1) Liste die Stufen. (2) Notiere je Stufe Aktion und Gefühl. (3) Bewerte " +
    "das Abbruchrisiko. (4) Schlage eine Lösung vor. Nutzer steigen an bestimmten Momenten aus — die Journey zeigt " +
    "wo und warum.",
  "User Journey",
  "Nur wenn der Kernablauf mehr als 3 Schritte hat oder ein Onboarding nötig ist: ein `agxp-journey` Block mit " +
    "4-7 Zeilen `Stufe | Nutzeraktion | Gefühl | Abbruchrisiko | Lösung`, in der Reihenfolge der Nutzung. `Gefühl` ist eine " +
    "Zahl von 1 (schlecht) bis 5 (gut), danach ein Wort (`2 genervt`); `Abbruchrisiko` ist `H`, `M` oder `L`. Bei `H` ist " +
    "`Lösung` konkret, sonst darf sie `–` sein. Danach höchstens 3 Bullets: an welcher Stufe die meisten Nutzer " +
    "verloren gehen. Trifft das nicht zu, lass den Block weg und schreib genau einen Satz dazu.",
);

export const abTestPlan = (): MethodParts => part(
  "A/B test",
  "A controlled test of two variants. Only once the app has live users.",
  only("die App bereits Live-Nutzer hat (ein paar hundert oder mehr)") +
    "A/B-Testplan, in fünf Schritten: (1) Hypothese. (2) Varianten A und B. (3) Metrik. (4) Mindestzahl Nutzer. " +
    "(5) Entscheidungsregel — sie wird VOR dem Test festgelegt. Meinungen über Features sind billig; das " +
    "Verhalten echter Nutzer entscheidet.",
  "A/B-Testplan",
  table(
    "Hypothese | Variante A | Variante B | Metrik | Min. Nutzer | Entscheidungsregel",
    "1-2 Tests. Die Entscheidungsregel ist eine Zahl mit Folge (\"B behalten, wenn ≥ +10 %\"). `Min. Nutzer` " +
      "gilt je Variante. Danach höchstens 2 Bullets: was das Ergebnis verfälschen könnte.",
    "die App bereits Live-Nutzer hat (ein paar hundert oder mehr)",
  ),
);

export const jobsToBeDone = (): MethodParts => part(
  "Jobs to be done",
  "The job a user hires the product for: when, I want, so that.",
  "Jobs-to-be-Done, in drei Schritten: (1) Frag nach Nutzungssituationen. (2) Schreibe Job-Statements nach dem " +
    "Muster \"Wenn … will ich … damit …\". (3) Sortiere nach Wichtigkeit. Personas sagen, WER; Jobs sagen, WARUM " +
    "jemand dich gegenüber den Alternativen wählt.",
  "Jobs-to-be-Done",
  table(
    "Wenn… | Ich will… | Damit… | Heutige Alternative",
    "2-4 Zeilen, nach Wichtigkeit sortiert (wichtigster Job zuerst). `Heutige Alternative` nennt, womit der Nutzer " +
      "den Job heute erledigt. Danach höchstens 3 Bullets: bei welchem Job die heutige Alternative am schwächsten " +
      "ist.",
  ),
);

export const featureKillList = (): MethodParts => part(
  "Kill list",
  "Features explicitly decided against, with the reason.",
  "Feature-Kill-List, direkt nach dem MVP-Scope: (1) Sammle die Won't-Punkte und neue Ideen. (2) Nenne den Grund. " +
    "(3) Lege fest, wann man sie wieder prüft. Nein zu sagen ist die schwerste Produktfähigkeit — ein " +
    "aufgeschriebenes Nein stoppt Scope Creep.",
  "Feature-Kill-List",
  table(
    "Feature | Warum jetzt nicht | Wieder prüfen, wenn",
    "Eine Zeile je Feature. `Wieder prüfen, wenn` ist eine Bedingung mit Zahl (\"> 1.000 Spieler\") oder \"nie " +
      "für das MVP\". Danach höchstens 2 Bullets: welches Nein am meisten Widerstand auslösen wird.",
  ),
);

export const fakeDoorTest = (): MethodParts => part(
  "Fake door",
  "A fake entry point to measure real interest. Before a costly feature.",
  only("ein teures Feature gebaut werden soll") +
    "Fake-Door-Test, in vier Schritten: (1) Wähle das Feature. (2) Platziere einen Fake-Einstieg (Button oder " +
    "Landingpage). (3) Zähle die Klicks. (4) Entscheide anhand eines Schwellenwerts, den du VORHER festlegst. " +
    "So misst man Nachfrage, bevor irgendetwas gebaut ist.",
  "Fake-Door-Test",
  table(
    "Feature | Fake-Einstieg | Besucher | Klicks % | Schwellenwert | Entscheidung",
    "Davor ein `agxp-mock` Block: die Einträge des Bildschirms je eine Zeile, der Fake-Einstieg mit `*` am Ende, danach eine " +
      "Zeile `-> Bald verfügbar! Willst du es?` für das, was ein Klick zeigt. Eine Zeile je getestetem Feature. Liegen noch keine Zahlen vor, stehen bei `Besucher` und `Klicks %` " +
      "`offen`. `Entscheidung` ist `Bauen`, `Nicht bauen` oder `offen`. Danach höchstens 2 Bullets: wo der " +
      "Fake-Einstieg sichtbar sein muss, damit die Zahl etwas aussagt.",
    "ein teures Feature gebaut werden soll",
  ),
);

export const retentionHookMap = (): MethodParts => part(
  "Retention hooks",
  "What brings users back: trigger, action, reward, investment. For consumer products.",
  only("es ein Produkt für Endkunden (Consumer) ist") +
    "Retention-Hook-Map, in vier Schritten: (1) Definiere den Auslöser. (2) Die einfachste Aktion. (3) Die " +
    "Belohnung. (4) Was der Nutzer investiert. Nutzer einmal zu gewinnen ist leicht; sie zurückzuholen ist " +
    "das Produkt.",
  "Retention-Hook-Map",
  table(
    "Auslöser | Aktion | Belohnung | Investition",
    "Davor ein `agxp-graph` Block als Schleife: Auslöser → Aktion → Belohnung → Investition und von der Investition zurück zum " +
      "Auslöser. 1-3 Zeilen, je ein Hook. `Investition` ist das, was der Nutzer einbringt und beim Wegbleiben verlöre " +
      "(Serie, Verlauf, Einstellungen). Danach höchstens 2 Bullets: welcher Hook am wenigsten trägt.",
    "es ein Produkt für Endkunden (Consumer) ist",
  ),
);

export const assumptionTests = (): MethodParts => part(
  "Assumptions",
  "The riskiest assumptions, the cheapest test, and the signal that settles them.",
  "Annahmen-Tests, in vier Schritten: (1) Liste die Annahmen, auf denen das Produkt ruht. (2) Bewerte, wie " +
    "riskant es wäre, wenn sie falsch sind. (3) Finde den günstigsten Test. (4) Lege das Erfolgssignal fest. " +
    "Die meisten Produkte scheitern an einer falschen Annahme, nicht an schlechtem Code.",
  "Annahmen-Tests",
  table(
    "Annahme | Risiko, falls falsch | Günstigster Test | Signal",
    "3-6 Zeilen, das höchste Risiko zuerst. `Risiko, falls falsch` ist `H`, `M` oder `L`. Das Signal ist eine " +
      "Zahl oder ein Ereignis (\"2 von 3 Gruppen spielen noch einmal\"), das die Annahme belegt oder " +
      "widerlegt. Danach höchstens 3 Bullets: welche Annahme zuerst getestet wird.",
  ),
);

/* ========================= SOLUTION ARCHITECT ============================ */

export const failureModes = (): MethodParts => part(
  "Failure modes",
  "What happens when each component fails.",
  "Failure-Mode-Walkthrough: Geh jede Komponente durch und frag, was passiert, wenn sie ausfällt — je " +
    "Komponente Fehlerfall, Auswirkung auf den Nutzer, Erkennung und Wiederherstellung. Systeme versagen an der " +
    "schwächsten Komponente; geplanter Ausfall ist billiger Ausfall.",
  "Failure-Mode-Walkthrough",
  table(
    "Komponente | Fehlerfall | Auswirkung auf Nutzer | Erkennung | Wiederherstellung",
    "Eine Zeile je Komponente aus dem Architektur-Überblick. `Erkennung` nennt das Signal (Health-Check, " +
      "Fehlerrate-Alarm), nicht \"Monitoring\". Danach höchstens 3 Bullets: welche Komponente der einzelne " +
      "Schwachpunkt ist.",
  ),
);

export const vendorLockIn = (): MethodParts => part(
  "Vendor lock-in",
  "How hard it would be to leave each external service.",
  only("externe Dienste oder eine Cloud genutzt werden") +
    "Vendor-Lock-in-Check, in drei Schritten: (1) Liste die Anbieter. (2) Bewerte den Wechselaufwand. (3) Plane " +
    "für die hohen einen Ausstieg. Billig heute kann morgen eine Falle sein.",
  "Vendor-Lock-in-Check",
  table(
    "Anbieter | Genutzt für | Wechselaufwand (H/M/L) | Exit-Plan",
    "Eine Zeile je Anbieter. `Wechselaufwand (H/M/L)` ist `H`, `M` oder `L`. Für jedes `H` ist `Exit-Plan` " +
      "konkret (\"Adapter-Schicht\"), sonst darf er `–` sein. Danach höchstens 2 Bullets: welcher Anbieter das " +
      "Geschäft am stärksten abhängig macht.",
    "externe Dienste oder eine Cloud genutzt werden",
  ),
);

export const loadStory = (): MethodParts => part(
  "Load story",
  "A concrete story of 10x and 100x usage and what breaks first. If growth is expected.",
  only("Wachstum erwartet wird oder das Produkt viral gehen könnte") +
    "Load Story, in drei Schritten: (1) Schreib eine Geschichte für 10-fache und 100-fache Nutzung. (2) Benenne, " +
    "was zuerst bricht. (3) Nenne Lösung und Kosten. Abstraktes Gerede über Skalierbarkeit versteckt den echten " +
    "Engpass.",
  "Load Story",
  table(
    "Laststufe | Geschichte | Was zuerst bricht | Lösung | Kosten",
    "3 Zeilen: `1x`, `10x`, `100x`. Die Geschichte ist ein konkretes Ereignis (\"Streamer teilt den Link, " +
      "1.000 Räume\"), `Kosten` eine Zahl pro Monat oder `+0`; bei `1x` stehen bei `Was zuerst bricht` und " +
      "`Lösung` `–`. Danach höchstens 2 Bullets: wie früh man die Warnzeichen sieht.",
    "Wachstum erwartet wird oder das Produkt viral gehen könnte",
  ),
);

/* ========================== ENTERPRISE ARCHITECT ========================= */

export const itLandscape = (): MethodParts => part(
  "IT landscape",
  "The systems the use case touches.",
  "IT-Landschaft, in zwei Schritten: (1) Frag, welche Systeme die benötigten Daten halten. (2) Halte je System " +
    "Zweck, Verantwortlichen, Daten, Integrationsoption und Legacy-Status fest. KI-Projekte scheitern an der " +
    "Integration, wenn Altsysteme ignoriert werden.",
  "IT-Landschaft",
  table(
    "System | Zweck | Verantwortlicher | Gehaltene Daten | Integrationsoption | Legacy?",
    "Davor ein `agxp-graph` Block: jedes System ein Knoten `db` (Legacy mit `| db | warn`), das neue KI-System ein Knoten " +
      "`model` mit `ok`, die Kanten mit der Integrationsoption beschriftet (`nightly batch`, `API`). Eine Zeile je betroffenem System. `Integrationsoption` ist die Art, wie man herankommt (\"REST API\", " +
      "\"nur Batch\", \"Datei-Export\"), `Legacy?` ist `ja` oder `nein`. Danach höchstens 3 Bullets: welches " +
      "System die Integration am meisten erschwert.",
  ),
);

export const integrationBlueprint = (): MethodParts => part(
  "Integration blueprint",
  "Data flows between systems: from, to, interface, frequency, data.",
  "Integrations-Blueprint, in drei Schritten: (1) Liste die Datenflüsse. (2) Bevorzuge bestehende " +
    "Schnittstellen. (3) Markiere neue Schnittstellen an Legacy-Systemen. Integration ist die Stelle, an der " +
    "Enterprise-KI-Projekte stehen bleiben.",
  "Integrations-Blueprint",
  table(
    "Datenfluss | Von | Nach | Schnittstelle | Frequenz | Daten",
    "Davor ein `agxp-graph` Block: Systeme als Knoten, Datenflüsse als Kanten mit Schnittstelle und Frequenz; eine neue " +
      "Schnittstelle an einem Legacy-System wird rot (`| red`). Eine Zeile je Datenfluss, nummeriert (`F1` …). Ein neuer Aufbau an einem Legacy-System steht in " +
      "`Schnittstelle` mit dem Zusatz `(neu, Legacy)`. Danach höchstens 3 Bullets: welche neue Schnittstelle am " +
      "teuersten wird und ob es eine bestehende Alternative gibt.",
  ),
);

export const complianceCheck = (): MethodParts => part(
  "Compliance",
  "The regulations that apply, the requirement, status and action.",
  only("personenbezogene Daten verarbeitet werden oder die Branche reguliert ist") +
    "Compliance-Check, in vier Schritten: (1) Liste die Regulierungen (z. B. DSGVO, EU AI Act, " +
    "Branchenaufsicht). (2) Nenne je Regulierung die Anforderung. (3) Setze den Status: erfüllt, offen oder " +
    "unklar. (4) Leg die Maßnahme fest. Compliance, die spät auffällt, stoppt Projekte kurz vor dem Go-live.",
  "Compliance-Check",
  table(
    "Regulierung | Anforderung | Status | Maßnahme",
    "Eine Zeile je Regulierung. `Status` ist `erfüllt`, `offen` oder `unklar`. Bei `unklar` ist die Maßnahme, " +
      "WER es klärt (z. B. \"Legal klassifiziert\"). Du gibst keine Rechtsberatung: die Tabelle sagt, was " +
      "geprüft werden muss, nicht, wie es rechtlich ausgeht. Danach höchstens 2 Bullets: welcher Punkt vor dem " +
      "Start geklärt sein muss.",
    "personenbezogene Daten verarbeitet werden oder die Branche reguliert ist",
  ),
);

export const aiModelRegister = (): MethodParts => part(
  "AI model register",
  "A company-wide list of AI models and tools, with owner and risk.",
  only("die Organisation mehr als ein KI-Tool oder Modell nutzt") +
    "KI-Modellregister, in zwei Schritten: (1) Sammle die Modelle und KI-Tools. (2) Halte je Eintrag " +
    "Verantwortlichen, Zweck, genutzte Daten, Risikostufe und Prüftermin fest. Was man nicht kennt, kann man " +
    "nicht steuern; viele KI-Regulierungen verlangen dieses Register.",
  "KI-Modellregister",
  table(
    "Modell / Tool | Zweck | Verantwortlicher | Genutzte Daten | Risikostufe | Nächste Prüfung",
    "Eine Zeile je Modell oder Tool. `Risikostufe` ist `H`, `M` oder `L`, `Nächste Prüfung` ein Quartal oder " +
      "Datum. Danach höchstens 2 Bullets: welcher Eintrag am dringendsten geprüft wird.",
    "die Organisation mehr als ein KI-Tool oder Modell nutzt",
  ),
);

export const shadowAiScan = (): MethodParts => part(
  "Shadow AI scan",
  "AI tools employees already use without approval. For organisations over 50.",
  only("die Organisation mehr als 50 Mitarbeitende hat") +
    "Shadow-AI-Scan, in drei Schritten: (1) Schlage eine anonyme Umfrage zur KI-Nutzung vor — du fragst nicht " +
    "nach Namen. (2) Bewerte das Datenrisiko je Tool. (3) Entscheide: genehmigen, ersetzen oder blockieren. " +
    "Nicht freigegebene KI-Tools lassen Daten abfließen; sie zu verbieten, ohne Alternative, scheitert.",
  "Shadow-AI-Scan",
  table(
    "Tool | Nutzende Teams | Eingegebene Daten | Risiko | Entscheidung",
    "Eine Zeile je Tool. `Risiko` ist `H`, `M` oder `L`, `Entscheidung` ist `Genehmigen`, `Ersetzen` (mit dem " +
      "Ersatz) oder `Blockieren`. Hat noch keine Umfrage stattgefunden, stehen die Zeilen als `Annahme` und der " +
      "erste Bullet nennt die Umfrage als Maßnahme. Danach höchstens 2 Bullets: welches Tool zuerst ersetzt wird.",
    "die Organisation mehr als 50 Mitarbeitende hat",
  ),
);

export const dataLineage = (): MethodParts => part(
  "Data lineage",
  "Where data comes from, how it is transformed and where it ends up.",
  only("die Branche reguliert ist oder eine Prüfung (Audit) ansteht") +
    "Data-Lineage-Map, in drei Schritten: (1) Starte beim KI-Ergebnis. (2) Verfolge jeden Input bis zur Quelle " +
    "zurück. (3) Halte die Transformationen fest. Prüfungen und Fehlersuche müssen jedes Ergebnis auf seine " +
    "Quelle zurückführen können.",
  "Data-Lineage-Map",
  table(
    "Ausgabefeld | Transformation | Input | Quellsystem | Verantwortlicher",
    "Davor ein `agxp-graph` Block: Quellsysteme (`db`) → Transformationen (`box`) → Modell (`model`) → Ausgabe. Eine Zeile je Ausgabefeld des Modells, rückwärts vom Ergebnis her. `Transformation` sagt, was mit den Daten " +
      "geschieht (\"Betrag in Klassen eingeteilt\"). Danach höchstens 3 Bullets: welcher Input sich nicht " +
      "vollständig zurückverfolgen lässt.",
    "die Branche reguliert ist oder eine Prüfung (Audit) ansteht",
  ),
);

export const changeImpact = (): MethodParts => part(
  "Change impact",
  "What changes in systems, processes and roles, how strongly and for whom.",
  "Change Impact, in vier Schritten: (1) Liste die veränderten Elemente (Systeme, Prozesse, Rollen). " +
    "(2) Beschreibe die Änderung. (3) Bewerte die Auswirkung. (4) Benenne die Betroffenen. Unsichtbare " +
    "Nebenwirkungen erzeugen Widerstand und Ausfälle.",
  "Change Impact",
  table(
    "Element | Änderung | Auswirkung (H/M/L) | Betroffene",
    "Eine Zeile je Element. `Auswirkung (H/M/L)` ist `H`, `M` oder `L`, `Betroffene` nennt Gruppe und, wenn " +
      "bekannt, Anzahl. Danach höchstens 3 Bullets: welche `H`-Auswirkung zuerst mit den Betroffenen geklärt " +
      "werden muss.",
  ),
);

/* ============================ STARTUP CTO ================================ */

export const leanCanvas = (): MethodParts => part(
  "Lean canvas",
  "The business model on one page: problem, customer, value, solution and more.",
  "Lean Canvas, in drei Schritten: (1) Eine Frage je Block — Problem, Kunde, Alleinstellung, Lösung, Kanäle, " +
    "Einnahmen, Kosten, Kennzahl, unfairer Vorteil. (2) Ein Satz je Block. (3) Markiere Unbekanntes als " +
    "\"Unbekannt\", statt es zu erfinden. Gründer programmieren, bevor sie wissen, wer zahlt und warum.",
  "Lean Canvas",
  "Ein `agxp-canvas` Block mit genau 9 Zeilen `Block | Inhalt` in dieser Reihenfolge: Problem, Kunde, Alleinstellung, " +
    "Lösung, Kanäle, Einnahmen, Kosten, Kennzahl, Unfairer Vorteil. Je Zeile ein Satz; Unbekanntes steht als `Unbekannt`. " +
    "Danach höchstens 3 Bullets: welcher unbekannte Block das Vorhaben am stärksten gefährdet.",
);

export const mvpCoreLoop = (): MethodParts => part(
  "MVP core loop",
  "The smallest repeatable loop a stranger can use without help.",
  "MVP-Kernschleife, in drei Schritten: (1) Definiere die Schritte der Schleife — die kleinste wiederholbare " +
    "Abfolge, die ein Fremder ohne Hilfe nutzen kann. (2) Markiere je Schritt, ob er im MVP ist. (3) Schreib je " +
    "Schritt \"fertig, wenn …\". Ein CTO braucht eine auslieferbare Schleife, keine Feature-Liste.",
  "MVP-Kernschleife",
  table(
    "Kernschleife-Schritt | Im MVP | Fertig, wenn",
    "Davor ein `agxp-graph` Block als Schleife (der letzte Schritt führt mit `play again` zurück zum ersten); ein Schritt, der " +
      "nicht im MVP ist, steht als `| group | muted`. Die Schritte in der Reihenfolge der Schleife (der letzte führt zurück zum ersten). `Im MVP` ist `ja` oder " +
      "`nein`; jeder Schritt, der `nein` ist, braucht einen Satz, warum es ohne geht. `Fertig, wenn` ist ein " +
      "messbares Kriterium (\"Code in unter 2 s\"). Danach höchstens 3 Bullets: welcher Schritt den Fremden am " +
      "ehesten aussteigen lässt.",
  ),
);

export const leanTechStack = (): MethodParts => part(
  "Lean tech stack",
  "The fastest stack to ship, with the trigger for replacing each choice.",
  "Schlanker Tech-Stack, in drei Schritten: (1) Wähle verwaltete Dienste und Vorlagen. (2) Begründe, warum das " +
    "schlank ist. (3) Nenne den Auslöser, ab dem die Wahl ersetzt wird. Startups sterben an Überengineering, " +
    "bevor die Nutzer da sind.",
  "Schlanker Tech-Stack",
  table(
    "Schicht | Wahl | Warum schlank | Ersetzen, wenn",
    "Eine Zeile je Schicht (Frontend, Backend, Daten, Hosting, was sonst nötig ist). `Ersetzen, wenn` ist ein " +
      "Auslöser mit Zahl (\"> 1.000 tägliche Spieler\") oder \"nie für das MVP\". Danach höchstens 3 Bullets: " +
      "welche Wahl am schwersten zurückzunehmen wäre.",
  ),
);

export const teamSetup = (): MethodParts => part(
  "Team setup",
  "Roles, people, ownership and time. For more than two people or planned hires.",
  only("das Team aus mehr als 2 Personen besteht oder Einstellungen geplant sind") +
    "Team-Setup, in drei Schritten: (1) Liste die Rollen. (2) Weise Person und Verantwortung zu. (3) Halte die " +
    "Stunden pro Woche fest. Ohne klare Verantwortliche doppeln kleine Teams Arbeit oder lassen sie fallen.",
  "Team-Setup",
  table(
    "Rolle | Person | Verantwortet | Stunden/Woche",
    "Eine Zeile je Rolle. `Person` ist ein Name oder `offen` (Einstellung geplant), `Stunden/Woche` eine Zahl, " +
      "optional als Balken (`■■■■ 20`). Danach höchstens 3 Bullets: welche Verantwortung bei niemandem liegt.",
    "das Team aus mehr als 2 Personen besteht oder Einstellungen geplant sind",
  ),
);

export const pivotTriggers = (): MethodParts => part(
  "Pivot triggers",
  "Signals, decided in advance, that mean change direction.",
  "Pivot-Auslöser, in drei Schritten: (1) Definiere DREI Signale mit Zahlen. (2) Setze ein Prüfdatum. " +
    "(3) Nenne die alternative Richtung. Gründer entscheiden zu spät für einen Pivot, weil die Kriterien nie " +
    "festgelegt wurden — jetzt, vor dem Start, ist der ehrlichste Zeitpunkt.",
  "Pivot-Auslöser",
  table(
    "Signal | Schwellenwert | Prüfdatum | Pivot zu",
    "Genau 3 Zeilen. `Schwellenwert` ist eine Zahl mit Richtung (\"< 20 pro Woche\"), `Prüfdatum` ein " +
      "konkretes Datum oder eine Woche, `Pivot zu` eine benannte Alternative. Danach höchstens 2 Bullets: wer " +
      "am Prüfdatum entscheidet.",
  ),
);

export const weeklyShipLog = (): MethodParts => part(
  "Weekly ship log",
  "One line per week: what shipped and what was learned. During the build phase.",
  only("die Bauphase bereits läuft") +
    "Wöchentliches Ship-Log: Frag je Woche nach dem Gelieferten, der Metrik und dem Learning. Es hält den " +
    "Schwung sichtbar und füttert die Build-Measure-Learn-Schleife. Du führst es mit dem Nutzer von Woche zu Woche; " +
    "frag nach den bisherigen Wochen.",
  "Wöchentliches Ship-Log",
  table(
    "Woche | Geliefert | Metrik | Learning",
    "Eine Zeile je Woche, die NEUESTE zuerst. `Metrik` ist eine Zahl (\"14 Spiele\"), `Learning` ein Satz. " +
      "Danach höchstens 2 Bullets: was sich über die Wochen hinweg wiederholt.",
    "die Bauphase bereits läuft",
  ),
);

export const hiringScorecard = (): MethodParts => part(
  "Hiring scorecard",
  "Defines the next hire by outcomes, not job titles. When hiring is planned.",
  only("eine Einstellung geplant ist") +
    "Hiring-Scorecard, in drei Schritten: (1) Die Mission der Rolle in einem Satz. (2) Drei Ergebnisse in 6 " +
    "Monaten. (3) Die Muss-Fähigkeiten. Startups stellen nach Titeln ein und bekommen die falsche Person.",
  "Hiring-Scorecard",
  "Nur wenn eine Einstellung geplant ist: ein `agxp-cards` Block mit einer Karte je geplanter Einstellung — die erste Zeile ist die " +
    "Rolle, danach genau diese Zeilen `Label | Wert`: Mission, Ergebnis 1, Ergebnis 2, Ergebnis 3, Muss-Fähigkeiten. Jedes Ergebnis " +
    "ist messbar und nach 6 Monaten prüfbar (\"1.000 parallele Räume ohne Fehler bis Monat 6\"); Muss-Fähigkeiten höchstens 3. " +
    "Danach höchstens 2 Bullets: welche Fähigkeit am schwersten zu finden sein wird. Ist keine Einstellung geplant, lass den " +
    "Block weg und schreib genau einen Satz dazu.",
);

export const buildMeasureLearn = (): MethodParts => part(
  "Build-measure-learn",
  "A weekly loop: what to build, what to measure, which decision follows.",
  "Build-Measure-Learn-Meilensteine, in drei Schritten: (1) Je Woche: das Bauteil. (2) Die Metrik. " +
    "(3) Die Entscheidung — behalten, ändern oder verwerfen. Das hält ein Startup lernend, statt nur zu " +
    "programmieren. Plane die ersten 3-4 Wochen; die Metrik der Vorwoche entscheidet über die nächste.",
  "Build-Measure-Learn-Meilensteine",
  table(
    "Woche | Bauen | Messen | Lernen (Entscheidung)",
    "Davor ein `agxp-gantt` Block: je Woche eine Lane (`Woche 1` …), darin das, was gebaut wird, als Balken über die Tage " +
      "(`unit: Tag`), die Messung als Meilenstein. 3-4 Zeilen, `Woche 1` bis `Woche 4`. `Messen` ist eine Zahl mit Zielwert, `Lernen (Entscheidung)` sagt, " +
      "was bei Erreichen und Verfehlen folgt: `behalten`, `ändern` oder `verwerfen`. Danach " +
      "höchstens 2 Bullets: welche Woche das Vorhaben " +
      "entscheidet.",
  ),
);

export const techDebtLog = (): MethodParts => part(
  "Tech debt log",
  "Shortcuts taken on purpose, why, and when to pay them back.",
  "Tech-Debt-Log, in drei Schritten: (1) Liste die bewusst genommenen Abkürzungen. (2) Nenne den Grund. " +
    "(3) Lege den Auslöser fürs Zurückzahlen fest. Akzeptierte Schulden sind in Ordnung, vergessene fatal.",
  "Tech-Debt-Log",
  table(
    "Abkürzung | Akzeptiert, weil | Zurückzahlen, wenn",
    "Eine Zeile je Abkürzung. `Zurückzahlen, wenn` ist ein Auslöser (\"bevor der zweite Entwickler dazukommt\"), " +
      "nie \"irgendwann\". Danach höchstens 2 Bullets: welche Schuld am schnellsten teuer wird.",
  ),
);

/* ============================ CHANGE MANAGER ============================= */

export const fearMythBoard = (): MethodParts => part(
  "Fears & myths",
  "The fears and myths about the change, each answered honestly.",
  "Fear-&-Myth-Board, in vier Schritten: (1) Sammle Ängste und Mythen anonym — frag, was im Team gesagt wird, " +
    "nicht, wer es sagt. (2) Clustere sie. (3) Schreib je Cluster eine ehrliche Antwort mit Beleg. (4) Veröffentliche " +
    "sie. Unausgesprochene Ängste werden zu Widerstand.",
  "Fear-&-Myth-Board",
  table(
    "Angst / Mythos | Wie oft gehört | Ehrliche Antwort | Beleg",
    "Eine Zeile je Cluster (3-6), `Angst / Mythos` im Wortlaut der Betroffenen in Anführungszeichen. `Wie oft " +
      "gehört` ist `oft`, `manchmal` oder `selten`. Die Antwort ist EHRLICH: räumt sie ein, was stimmt, steht das " +
      "da. `Beleg` verweist auf etwas Prüfbares (z. B. die Rollen-Matrix). Danach höchstens 3 Bullets: welche Angst " +
      "am meisten Widerstand erzeugt.",
  ),
);

export const championNetwork = (): MethodParts => part(
  "Champions",
  "Volunteers in each team who try it first and help colleagues.",
  only("die Veränderung mehr als 3 Teams betrifft") +
    "Champion-Netzwerk, in drei Schritten: (1) Ein Champion je Team. (2) Früher Zugang und Schulung. " +
    "(3) Monatlicher Austausch. Menschen vertrauen Kollegen mehr als Projektteams.",
  "Champion-Netzwerk",
  table(
    "Team | Champion | Geschult? | Feedback-Kanal",
    "Davor ein `agxp-graph` Block mit `dir: TB`: oben der Change Manager, darunter je Team ein Champion, darunter die Zahl der " +
      "Kolleginnen und Kollegen. Eine Zeile je Team. `Champion` ist ein Name oder `offen`, `Geschult?` ist `ja`, `geplant` oder `nein`. " +
      "`Feedback-Kanal` ist der Weg, auf dem die Champions Rückmeldungen weitergeben. Danach höchstens " +
      "2 Bullets: welches Team noch keinen Champion hat.",
    "die Veränderung mehr als 3 Teams betrifft",
  ),
);

export const winWall = (): MethodParts => part(
  "Win wall",
  "A visible collection of small wins from the new way of working. After go-live.",
  only("die Veränderung bereits live ist") +
    "Win Wall, in drei Schritten: (1) Sammle die kleinen Erfolge wöchentlich. (2) Nenne das Team. (3) Teile " +
    "sie sichtbar. Reinforcement ist die am häufigsten vergessene ADKAR-Stufe. Frag nach den bisherigen Erfolgen.",
  "Win Wall",
  table(
    "Datum | Team | Erfolg | Geteilt wo",
    "Eine Zeile je Erfolg, der neueste zuerst. `Erfolg` ist konkret und mit Zahl, `Geteilt wo` der Ort " +
      "(\"Intranet\", \"Town Hall\"). Danach höchstens 2 Bullets: wo noch keine Erfolge geteilt werden.",
    "die Veränderung bereits live ist",
  ),
);
