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
  "ohne Vorwissen versteht:\n" +
  "```agxp-lexicon\nSoftware | React | Baukasten für Benutzeroberflächen im Browser\n" +
  "Software | API | Schnittstelle, über die zwei Programme miteinander reden\n" +
  "Infrastruktur | Hosting | Der Server, auf dem die Anwendung tatsächlich läuft\n```\n\n" +
  "8) Auf einen Blick — `Zeile | Inhalt`, eine Tabelle statt einer Aufzählung. Mehrere Werte in " +
  "einer Zeile mit `;` trennen, sie werden dann zu einzelnen Chips:\n" +
  "```agxp-glance\nKernproblem | Zwei Freigaben nacheinander kosten zwei von drei Wochen\n" +
  "Beschreibung | Jeder Antrag wartet vier bis fünf Tage bei der Abteilungsleitung\n" +
  "Benötigte Technologien | React; Node; Postgres\n" +
  "Empfohlene Richtung | Erste Freigabe abschaffen, zweite automatisieren\n```\n\n" +
  "9) Gap-Tabelle — `Dimension | heute | ziel | Lücke`. Anders als agxp-gap nimmt sie WORTE, " +
  "nicht nur Zahlen. Für die Gap-Analyse über Ziele, Reifegrad, Fähigkeiten, Technologien, " +
  "Menschen und Ressourcen:\n" +
  "```agxp-diff\nReifegrad | Excel und E-Mail | ein System für alle Regionen | kein zentrales System\n" +
  "Fähigkeiten | niemand kennt React | zwei Entwickler im Team | Schulung oder Einstellung\n" +
  "Menschen | 5 Disponenten, kein Produktowner | Produktowner benannt | Rolle unbesetzt\n```\n\n" +
  "10) SWOT — genau vier Zeilen `stärken:`, `schwächen:`, `chancen:`, `risiken:`, Punkte mit " +
  "`;` getrennt. Bewertet wird DER PLAN, nicht das Unternehmen:\n" +
  "```agxp-swot\nstärken: Prozess ist allen klar; Budget steht\n" +
  "schwächen: kein Entwickler im Haus; Daten liegen in drei Systemen\n" +
  "chancen: gleiche Lösung für die zweite Region; weniger Nachtschichten\n" +
  "risiken: Disponenten blockieren; Freigabe hängt an einer Person\n```";

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
  return Object.values(DELIVERABLES).some(
    d => t === d.generatePrompt.trim() || t === d.regeneratePrompt.trim(),
  );
}

export const DELIVERABLES: Record<AgentType, Deliverable> = {
  consultant: {
    title: "Transformation Concept",
    subtitle: "Where you stand today, where you want to be, and how to get there.",
    stations: [
      { label: "Starting point", goal: "Worum geht es überhaupt? Branche, Unternehmensgröße, Auslöser für das Projekt, wer fragt an und warum jetzt." },
      { label: "Current process", goal: "Der Ist-Prozess Schritt für Schritt: was passiert zuerst, was danach, wo wird gewartet, was ist manuell." },
      { label: "People & systems", goal: "Wer macht diese Arbeit heute (Rollen, Anzahl Personen), mit welchen Tools/Systemen, wo liegen die Daten und in welchem Format." },
      { label: "Pain points", goal: "Wo tut es konkret weh: Häufigkeit, Zeitaufwand, Fehlerquote, Kosten, wer beschwert sich zuerst. Immer nach Zahlen oder einem konkreten Beispiel fragen." },
      { label: "Target state", goal: "Wie soll es nach der Transformation laufen? Was soll automatisch passieren, was bleibt bewusst beim Menschen." },
      { label: "Success metrics", goal: "Woran würde man in 6 Monaten merken, dass es funktioniert hat? Messbare Kennzahlen, Ausgangswert und Zielwert." },
      { label: "Constraints", goal: "Budgetrahmen, Zeitrahmen, IT-Landschaft, Datenschutz/Compliance, interne Ressourcen, bestehende Verträge." },
      { label: "Risks & dependencies", goal: "Was könnte das Projekt zum Scheitern bringen, welche Entscheidungen/Freigaben hängen an anderen Personen." },
    ],
    sections: [
      // Agreed with Patryk on 2026-10-02. The Lexicon comes first because the
      // first thing separating a beginner from an expert is the vocabulary
      // (00:22:22), and the whole concept is unreadable until that is fixed.
      { title: "Lexikon", must: "Ein `agxp-lexicon` Block mit JEDEM Fachbegriff und Fremdwort, das weiter unten im Dokument vorkommt, nach Thema geclustert. Davor genau 2 Bullets: die Geschäftshypothese (der Mehrwert in einem Satz) und wofür das Ganze verwendet wird." },
      { title: "Management Summary", must: "KEIN Visual — die einzige Stelle im Dokument, an der zusammenhängender Text steht. 5-8 Sätze für eine Entscheiderin, die sonst nichts liest: Ausgangslage, was der Zustand heute kostet (mit Zahl), was empfohlen wird, was es dafür braucht, und was passiert, wenn nichts passiert. Keine Aufzählung, keine Überschriften, und keine Wiederholung der Zahlen aus den folgenden Sektionen — hier steht der Zusammenhang, dort stehen die Belege." },
      { title: "Auf einen Blick", must: "Ein `agxp-glance` Block mit genau diesen Zeilen: Kernproblem, Beschreibung, Benötigte Technologien, Empfohlene Richtung. Danach ein `agxp-kpi` Block mit 4 Kennzahlen aus dem Gespräch. Keine Bullets." },
      { title: "Prozess: heute und morgen", must: "Ein `agxp-flow` Block mit je 4-6 Schritten in as-is und to-be (`*` an jedem automatisierten Schritt), danach 3-5 Bullets zu den Unterschieden." },
      { title: "Gap-Analyse", must: "Ein `agxp-diff` Block mit einer Zeile je Dimension: Ziele, Reifegrad, Fähigkeiten und Skills, Technologien, Menschen, sonstige Ressourcen. Nur die Dimensionen, über die der Nutzer tatsächlich gesprochen hat — lieber vier echte Zeilen als sechs erfundene. Danach höchstens 3 Bullets zur größten Lücke." },
      { title: "SMART-Ziele", must: "Eine Tabelle: Ziel | Messbar woran | Bis wann | Wer. Jedes Ziel muss mit Ja oder Nein beantwortbar sein — \"die App wird genutzt\" ist kein Ziel, \"20 Touren pro Woche laufen über die App\" ist eins. 2-4 Zeilen, kein Visual." },
      { title: "SWOT", must: "Ein `agxp-swot` Block mit allen vier Feldern, je 2-4 Punkte. Bewertet wird der PLAN, nicht das Unternehmen. Danach genau 1 Bullet: welche Schwäche zuerst angegangen wird." },
      { title: "Tools und Technologien", must: "Eine Tabelle mit 3-5 namentlich benannten Optionen: Tool | Passt weil | Pro | Contra | Aufwand. Danach eine begründete Empfehlung in 3-4 Bullets: welche Option, warum gerade diese gegen die zweitbeste, was man sich damit einhandelt, und unter welcher Bedingung die Empfehlung kippt." },
      { title: "Maßnahmen", must: "Ein `agxp-roadmap` Block mit 3 Phasen und je 2-3 Maßnahmen, nach Priorität geordnet. Danach pro Maßnahme ein Bullet mit Verantwortlichem, Aufwand und der Abhängigkeit, die sie blockieren könnte — und ein letztes Bullet dazu, was die erste Phase unbrauchbar machen würde." },
      { title: "Erfolgsmessung", must: "Ein `agxp-gap` Block mit den Kennzahlen (heute vs. Ziel), danach pro Kennzahl ein Bullet: wie und wann gemessen." },
      { title: "Risiken", must: "Ein `agxp-risks` Block mit 3-5 Risiken, danach pro Risiko ein Bullet mit der Gegenmaßnahme." },
      { title: "Nächste Schritte", must: "Genau 3 Bullets, jedes mit Verantwortlichem, Termin und dem, was danach entschieden werden kann. Kein Visual." },
    ],
    generatePrompt:
      "Create the complete Transformation Concept now, based on our whole conversation. " +
      "Graphics and bullets only — no paragraphs: every section leads with its visual block, " +
      "filled with the concrete numbers and names we discussed. " +
      "Answer in the language we have been speaking.",
    regeneratePrompt:
      "Rebuild the complete Transformation Concept from scratch, sharper than the last version: " +
      "every visual block filled with real numbers from our conversation, named tools instead of " +
      "general statements, and no paragraphs. Answer in the language we have been speaking.",
  },
  coach: {
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
  },
};

/**
 * Builds the interview + deliverable half of the system prompt. Patryk's rule
 * from the 2026-09-02 review still holds — one question per turn — so the depth
 * comes from staying on a station and asking real follow-ups, not from firing a
 * numbered list of questions at the user.
 */
export function agendaPrompt(d: Deliverable): string {
  const total = d.stations.length;
  const agenda = d.stations
    .map((s, i) => `${i + 1}. ${s.label} — ${s.goal}`)
    .join("\n");
  const sections = d.sections
    .map(s => `## ${s.title}\n   → ${s.must}`)
    .join("\n");

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
    `Satz, der sagt, was man daraus mitnimmt (die Einordnung), dann 4-8 Bullets. Die einzige ` +
    `Ausnahme ist die Management Summary: dort steht zusammenhängender Text und sonst nichts.\n` +
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
    `Am Ende des Dokuments stellst du eine kurze Frage (mit CHOICES), was angepasst werden soll.`
  );
}
