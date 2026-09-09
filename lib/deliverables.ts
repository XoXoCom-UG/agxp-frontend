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
      { title: "Executive Summary", must: "3-5 Sätze: Ausgangslage, Kern des Problems in Zahlen, empfohlene Richtung, erwarteter Nutzen." },
      { title: "Ist-Zustand", must: "Der Prozess Schritt für Schritt (nummeriert), beteiligte Rollen und Systeme, Mengen/Zeiten/Kosten wo bekannt." },
      { title: "Ziel-Zustand", must: "Wie der Prozess nach der Transformation läuft — was automatisiert ist, was bewusst beim Menschen bleibt, welche Freigaben es weiter gibt." },
      { title: "Gap-Analyse", must: "Tabelle: Bereich | Heute | Ziel | Lücke | Warum das heute blockiert." },
      { title: "Empfohlene Tools & Technologien", must: "2-4 konkrete, namentlich benannte Optionen als Tabelle: Tool | Passt, weil | Pro | Contra | Grober Aufwand/Kosten. Danach eine klare Empfehlung mit Begründung." },
      { title: "Priorisierte Maßnahmen", must: "Mindestens 5 Maßnahmen als Tabelle: Maßnahme | Priorität | Aufwand | Wer | Zeitrahmen — sortiert nach Wirkung." },
      { title: "Erfolgsmessung", must: "Tabelle: Kennzahl | Heute | Ziel | Wie gemessen | Wann geprüft." },
      { title: "Risiken & nächste Schritte", must: "Risiken als Tabelle (Risiko | Wahrscheinlichkeit | Auswirkung | Gegenmaßnahme) und danach die nächsten 3 konkreten Schritte mit Verantwortlichen." },
    ],
    generatePrompt:
      "Create the complete Transformation Concept now, based on our whole conversation. " +
      "Make it thorough: fill every section with the concrete details, numbers and names we discussed, " +
      "use tables where the section calls for them, and no filler. " +
      "Answer in the language we have been speaking.",
    regeneratePrompt:
      "Rebuild the complete Transformation Concept from scratch, richer and more detailed than the last " +
      "version: every section filled out, the tables complete, concrete numbers and named tools instead " +
      "of general statements. Answer in the language we have been speaking.",
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
      { title: "Ausgangslage", must: "3-5 Sätze: was sich verändert, für wen, in welchem Zeitrahmen, und wie die Stimmung heute ist." },
      { title: "Stakeholder-Map", must: "Tabelle: Rolle/Gruppe | Anzahl | Was ändert sich für sie | Größte Sorge | Haltung (Unterstützer/neutral/skeptisch) | Wer kümmert sich um sie." },
      { title: "Erwartete Widerstände & Antworten darauf", must: "Tabelle: Widerstand (möglichst im Wortlaut der Betroffenen) | Was dahinter steckt | Antwort/Maßnahme | Wer spricht mit ihnen." },
      { title: "Kommunikationsplan", must: "Mindestens 5 Einträge über den Rollout verteilt, als Tabelle: Zeitpunkt | Zielgruppe | Botschaft | Kanal | Absender." },
      { title: "Enablement & Training pro Rolle", must: "Tabelle: Rolle | Was sie können müssen | Format (Schulung/Learning by doing/Doku) | Dauer | Wann." },
      { title: "Rollout-Schritte mit Meilensteinen", must: "Nummerierte Phasen mit Zeitfenster: wer wann dran ist, was der Pilot ist, welche Meilensteine es gibt und woran man abbricht bzw. nachsteuert." },
      { title: "Woran wir merken, dass es angenommen wird", must: "Beobachtbare Signale plus Tabelle: Signal | Wie gemessen | Ab wann erwartet." },
    ],
    generatePrompt:
      "Create the complete Change Plan now, based on our whole conversation. " +
      "Make it thorough: fill every section with the concrete roles, concerns and dates we discussed, " +
      "use tables where the section calls for them, and no filler. " +
      "Answer in the language we have been speaking.",
    regeneratePrompt:
      "Rebuild the complete Change Plan from scratch, richer and more detailed than the last version: " +
      "every section filled out, the tables complete, concrete roles, quotes and dates instead of general " +
      "statements. Answer in the language we have been speaking.",
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
    `"hier der angepasste Abschnitt".\n\n` +
    `Aufbau des Dokuments: "# ${d.title}" als Titel, danach genau diese Sektionen als ` +
    `"##"-Überschriften, in dieser Reihenfolge:\n${sections}\n\n` +
    `Qualitätsanspruch — dafür ist der Nutzer hier, also gib dir hier deutlich mehr Mühe als in einer ` +
    `Chat-Antwort:\n` +
    `- JEDE Sektion wird ausgefüllt. Keine leere Überschrift, keine Sektion, die nur aus "wird noch ` +
    `ergänzt" besteht.\n` +
    `- Benutze die konkreten Zahlen, Namen, Systeme und Zitate aus dem Gespräch. Wo eine Information ` +
    `fehlt, schreibe an genau dieser Stelle eine explizite Annahme ("Annahme: ...") oder "offen: ..." ` +
    `— das ersetzt aber nie eine ganze Sektion.\n` +
    `- Tabellen dort, wo die Sektion sie verlangt (siehe oben), mit vollständig gefüllten Zeilen — ` +
    `keine Fließtext-Wand.\n` +
    `- Ziel-Umfang: 900-1800 Wörter. Lieber konkret und ausführlich als kurz und allgemein.\n` +
    `- Keine Floskeln ("in der heutigen schnelllebigen Welt"), keine Wiederholung der Interviewfragen, ` +
    `kein Meta-Kommentar über das Dokument selbst.\n` +
    `- Jede neue Version ist eine vollständige Neuerstellung des ganzen Dokuments, und sie ist ` +
    `ausführlicher und konkreter als die vorherige.\n\n` +
    `Am Ende des Dokuments stellst du eine kurze Frage (mit CHOICES), was angepasst werden soll.`
  );
}
