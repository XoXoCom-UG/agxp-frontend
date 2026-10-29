import {
  knowledgeCheck, SEC_LEVEL, SEC_LEXICON, SEC_SUMMARY, SEC_NEXT_STEPS, glanceSection, promptsFor, TABLE_LEAD,
  type Deliverable, type Station, type DocSection,
} from "./deliverable-parts.ts";
import * as M from "./method-library.ts";

/* ---------------------------------------------------------------------------
   THE TWO SIMPLE CONSULTANTS: General Consultant and Agentics Consultant

   Patryk, 2026-10-23: of everyone who uses the internet perhaps 2-5 % know what
   an "Enterprise Architect" is, so someone who comes with an idea and no
   vocabulary will not find themselves among the nine professional types. These
   two are for that person, and Ana, 2026-10-29: only the methods such a person
   cannot do without.

     - General Consultant — "I have an idea, where do I start?":
       Idea Check, First Steps Plan, Lexicon, Personas, Competitor Benchmark,
       Future Headline, SMART Goals, Risk Register, At a Glance.
     - Agentics Consultant — "I want to do something with AI":
       What the AI Needs, First Small Version, Lexicon, Assumption Tests,
       Risk Register, At a Glance.

   Ana, 2026-10-29: besides the few methods that are theirs alone (Idea Check,
   First Steps Plan, What the AI Needs, First Small Version) they take the
   existing methods that are simplest to understand and matter most for someone
   starting out — each exactly as the professional types run it, plus the plain
   language rule below.

   Both also carry the Knowledge Check, as every consultant does: it is what sets
   the level of everything after, and a beginner type needs that most. Same
   machinery as the professional types (stations, sections, the shared Knowledge
   Check / Lexicon / Summary / At a Glance), and the same rule: a method that
   does not apply is skipped in one sentence, never invented. What differs is the
   voice: every station says the user is a beginner until the Knowledge Check
   says otherwise, and explains any term it uses in one sentence.
   --------------------------------------------------------------------------- */

/** Added to every station of these two types: the whole point of them. */
const PLAIN =
  " Sprich einfach: Der Nutzer ist Einsteiger, bis der Wissens-Check etwas anderes sagt. Benutze kein Fachwort, " +
  "ohne es in einem Satz zu erklären, und frag nach Beispielen aus dem Alltag des Nutzers statt nach Definitionen.";

const station = (label: string, note: string, goal: string): Station => ({ label, note, goal: goal + PLAIN });

/** The library's stations speak to professionals; here they get the same plain-language rule. */
const plain = (s: Station): Station => ({ ...s, goal: s.goal + PLAIN });

const section = (title: string, must: string): DocSection => ({ title, must });

/* --- General Consultant: the Idea Plan ------------------------------------- */

const personas = M.personas();
const competitors = M.competitorBenchmark();
const headline = M.futureHeadline("SMART-Ziele");
const goals = M.smartGoals(false);
const risksGeneral = M.riskRegister(
  "deine Idee",
  "zu wenig Zeit oder Geld für den Anfang; Wissen, das fehlt; etwas, das von anderen abhängt; ein Plan, der zu groß ist für den Start",
);

const GENERAL: Deliverable = {
  title: "Idea Plan",
  subtitle: "Your idea in plain words: what you want, what you need to know, and the first steps.",
  stations: [
    knowledgeCheck(
      "deine Idee und wie man sie angeht, ohne Vorwissen",
      "Ziel, Meilenstein, Risiko, Fahrplan",
      "wie viel Zeit und Geld du für den Anfang hast (wenige Stunden pro Woche / mehr; kein Budget / etwas / mehr)",
    ),
    station(
      "Your idea",
      "What it is, who it is for, and why now.",
      "Die Idee. Was ist die Idee in EINEM Satz, für wen ist sie, welches Problem löst sie, warum jetzt und wie weit " +
        "ist sie schon (nur ein Gedanke / eine Skizze / etwas Ausprobiertes). Daraus entstehen der Anwendungsfall in " +
        "EINEM Satz, das Kernproblem, die Beschreibung, das benötigte Wissen und die Eckdaten (Personen, Zeit, Budget). " +
        "Frag nach, bis du die Idee einem Fremden in zwei Sätzen erklären könntest.",
    ),
    plain(personas.station),
    plain(competitors.station),
    plain(headline.station),
    plain(goals.station),
    station(
      "First steps",
      "What to do first, next and later — and who does it.",
      "Erste Schritte, in drei Schritten: (1) Frag, was der Nutzer als Erstes tun könnte, ohne Geld auszugeben oder " +
        "jemanden zu brauchen. (2) Ordne die Schritte in drei Zeiträume: diese Woche, dieser Monat, danach. (3) Frag " +
        "je Schritt, wer ihn macht, wie lange er dauert und woran der Nutzer merkt, dass er fertig ist. Ein Plan, der " +
        "mit allem auf einmal beginnt, wird nicht begonnen: der erste Schritt muss in einer Woche machbar sein. " +
        "Nimm die Ziele aus den Erfolgskriterien auf — erfinde keine zweite Liste.",
    ),
    plain(risksGeneral.station),
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("Deine Idee in einem Satz", "Was du wissen musst"),
    section(
      "Deine Idee",
      `${TABLE_LEAD}: Frage | Antwort. Genau diese Zeilen in dieser Reihenfolge: Idee in einem Satz, Für wen, ` +
        "Welches Problem sie löst, Warum jetzt, Wo du heute stehst. Jede Antwort ist ein kurzer Satz in den Worten " +
        "des Nutzers, kein Fachwort. Kein Visual.",
    ),
    personas.section,
    competitors.section,
    headline.section,
    goals.section,
    section(
      "Erste Schritte",
      "Ein `agxp-roadmap` Block mit genau 3 Phasen — `Diese Woche`, `Dieser Monat`, `Danach` — und je 2-3 Schritten, " +
        "jeder in einem kurzen Satz und machbar, ohne dass jemand anderes zustimmen muss. Die Schritte kommen aus dem " +
        "Gespräch und führen zu den Zielen aus den Erfolgskriterien. Danach genau 3 Bullets: wer " +
        "es macht und wie lange es dauert (für die erste Phase), woran man merkt, dass die erste Phase geklappt hat, " +
        "und das EINE, was der Nutzer als Erstes tut — in einem Satz.",
    ),
    risksGeneral.section,
    SEC_NEXT_STEPS,
  ],
  ...promptsFor("Idea Plan", "words, steps and dates"),
};

/* --- Agentics Consultant: the AI Idea Brief -------------------------------- */

const assumptions = M.assumptionTests();
const risksAgentics = M.riskRegister(
  "eine Idee mit KI",
  "Daten, die fehlen oder nicht benutzt werden dürfen; ein Ergebnis, dem man nicht trauen kann; Kosten, die mit der Nutzung wachsen; ein Wunsch, der mehr ist als eine erste Version",
);

const AGENTICS: Deliverable = {
  title: "AI Idea Brief",
  subtitle: "What the AI needs from you, and the smallest first version to try — in plain words.",
  stations: [
    knowledgeCheck(
      "KI in einer eigenen Idee",
      "KI-Modell, Daten, Prompt, Automatisierung",
      "ob du die Idee selbst ausprobieren, mit Hilfe bauen oder noch nur verstehen willst (selbst / mit Hilfe / noch offen)",
    ),
    station(
      "Starting point",
      "What the AI should do for you, in one sentence.",
      "Der Ausgangspunkt, in vier Schritten: (1) Frag nach der Idee und für wen sie ist. (2) Lass den Nutzer ein " +
        "Beispiel aus seinem Alltag erzählen: Was geht hinein (ein Foto, ein Text, eine Frage), was soll " +
        "herauskommen? (3) Erkläre in einfachen Worten, was eine KI hier tatsächlich tut und was nicht — ohne den " +
        "Wunsch zu überverkaufen. (4) Frag, ob es dafür ein fertiges Werkzeug gibt, das man nur benutzen muss, oder " +
        "ob etwas Eigenes gebaut werden müsste, und erkläre den Unterschied in einem Satz. Daraus entstehen der " +
        "Anwendungsfall in EINEM Satz (was die KI tun soll), das Kernproblem, die Beschreibung, das benötigte Wissen, " +
        "die empfohlene Richtung (fertiges Werkzeug oder selbst bauen) und die Eckdaten (Personen, Zeit, Budget).",
    ),
    station(
      "What it needs",
      "The information the AI works with, and whether you have it.",
      "Was die KI braucht, in drei Schritten: (1) Liste mit dem Nutzer auf, welche Informationen die KI " +
        "bräuchte (Texte, Fotos, Zahlen, Kundendaten, Beispiele). (2) Frag je Information: Hast du sie, wo liegt " +
        "sie, und darfst du sie dafür benutzen (Datenschutz, Rechte anderer)? (3) Nenne, was fehlt — und was das " +
        "für den Anfang bedeutet. Fehlende Informationen sind der häufigste Grund, warum KI-Ideen nicht " +
        "funktionieren; sag das ehrlich, aber ohne Angst zu machen.",
    ),
    station(
      "First version",
      "The smallest version worth trying first.",
      "Die erste kleine Version, in drei Schritten: (1) Sammle, was die Idee alles können soll. (2) Sortiere es " +
        "gemeinsam: Muss in die erste Version, sollte, könnte, jetzt nicht. (3) Frag bei jedem \"Muss\", ob es ohne " +
        "wirklich nicht geht. Einsteiger bauen zu viel auf einmal; die erste Version soll in Tagen oder wenigen " +
        "Wochen ausprobierbar sein, nicht in Monaten.",
    ),
    plain(assumptions.station),
    plain(risksAgentics.station),
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("Was die KI tun soll (ein Satz)", "Was du wissen musst"),
    section(
      "Was die KI braucht",
      `${TABLE_LEAD}: Was | Hast du es? | Wo liegt es | Darf man es nutzen? | Was fehlt. Eine Zeile je ` +
        "Information (3-6). `Hast du es?` und `Darf man es nutzen?` sind `ja`, `nein` oder `offen`. `Was fehlt` ist " +
        "ein konkreter Satz, `–` nur, wenn nichts fehlt. Danach höchstens 2 Bullets: was der Nutzer als Erstes " +
        "besorgen sollte.",
    ),
    section(
      "Die erste kleine Version",
      "Ein `agxp-moscow` Block mit den vier Zeilen `Must`, `Should`, `Could`, `Won't`, die Funktionen mit `;` " +
        "getrennt (insgesamt 4-8, höchstens ein Drittel davon Must). Jede Funktion in einfachen Worten, ohne " +
        "Fachbegriff. Danach genau 3 Bullets: wie lange die erste Version braucht, woran man merkt, dass sie " +
        "funktioniert, und was bewusst fehlt.",
    ),
    assumptions.section,
    risksAgentics.section,
    SEC_NEXT_STEPS,
  ],
  ...promptsFor("AI Idea Brief", "words, examples and decisions"),
};

/** The two recommended types, by TYPE_CATALOG id (lib/agent-types.ts). */
export const MAINSTREAM_DELIVERABLES: Record<string, Deliverable> = {
  general: GENERAL,
  agentics: AGENTICS,
};
