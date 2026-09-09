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

export interface Deliverable {
  /** Document title, also the marker value: [[DOC: Transformation Concept]]. */
  title: string;
  /** One line under the title, in the document header. */
  subtitle: string;
  stations: Station[];
  /** The `##` sections the finished document must contain, in order. */
  sections: string[];
  /** What the rail's generate button sends as the user's message. */
  generatePrompt: string;
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
      "Executive Summary",
      "Ist-Zustand",
      "Ziel-Zustand",
      "Gap-Analyse",
      "Empfohlene Tools & Technologien (mit Pro/Contra)",
      "Priorisierte Maßnahmen",
      "Erfolgsmessung",
      "Risiken & nächste Schritte",
    ],
    generatePrompt:
      "Create the complete Transformation Concept now, based on our whole conversation. " +
      "Answer in the language we have been speaking.",
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
      "Ausgangslage",
      "Stakeholder-Map (wer ist betroffen, was ist die Sorge)",
      "Erwartete Widerstände & Antworten darauf",
      "Kommunikationsplan (wer erfährt was, wann, über welchen Kanal)",
      "Enablement & Training pro Rolle",
      "Rollout-Schritte mit Meilensteinen",
      "Woran wir merken, dass es angenommen wird",
    ],
    generatePrompt:
      "Create the complete Change Plan now, based on our whole conversation. " +
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
  const sections = d.sections.map(s => `- ${s}`).join("\n");

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
    `und markierst fehlende Punkte klar als "noch offen".\n\n` +
    `Wenn du das Dokument erstellst: beginne deine Antwort mit [[DOC: ${d.title}]] in einer eigenen ` +
    `ERSTEN Zeile. Danach folgt das vollständige Dokument in Markdown mit "# ${d.title}" als Titel und ` +
    `genau diesen Abschnitten als "##"-Überschriften:\n${sections}\n` +
    `Im Dokument ist die volle Struktur erwünscht: Tabellen, Listen, konkrete Zahlen aus dem Gespräch, ` +
    `keine Platzhalter-Floskeln. Beziehe dich auf das, was der Nutzer wirklich gesagt hat. Am Ende des ` +
    `Dokuments fragst du (mit CHOICES), ob etwas angepasst werden soll.`
  );
}
