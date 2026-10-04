/**
 * Testfälle — the cases the agent is run through.
 *
 * Patryk, 2026-09-25 at 00:46:13, on what he actually wants from testing:
 * "das Gute daran ist, dass ich einfach lesen kann… dann bin ich da zehn
 * oder zwanzig mal schneller als so mit der App." So these are not
 * assertions. They are conversations we can replay on demand, so that the
 * output can be read side by side instead of clicked through.
 *
 * Each scenario is the answers a real person would give, in order, one per
 * interview station. The runner sends them as the user's turns and lets the
 * agent ask whatever it asks — which is the point: if the agent stops asking
 * for numbers, or skips a station, these answers will not fit and you will
 * see it in the transcript.
 *
 * Write new ones in the voice of the person, not of a test fixture. "Pro
 * Woche fehlen 6 bis 8 Zettel" is what a foreman says; "pain_point_count: 7"
 * is not, and an agent interviewed by a fixture produces a document written
 * for one.
 */

export const SCENARIOS = [
  {
    id: "elektro",
    title: "Elektrobetrieb — Baustellendokumentation auf Papier",
    why: "Zahlen überall, Fachjargon aus zwei Welten (Handwerk und IT), klare Ist/Soll-Lücke. Der Normalfall.",
    answers: [
      "Wir sind ein Elektroinstallationsbetrieb mit 48 Mitarbeitern, davon 31 Monteure. Wir machen Gewerbeinstallationen und DGUV-V3-Prüfungen. Auslöser: wir konnten letztes Jahr zwei Nachträge nicht abrechnen, weil die Aufmaße fehlten — rund 40.000 Euro. Die Baustellendokumentation läuft komplett auf Papier.",
      "Der Monteur schreibt Aufmaß und Messprotokoll auf Papier, fotografiert mit dem privaten Handy und gibt den Zettel freitags im Büro ab. Die Bürokraft tippt alles in Excel, legt die Fotos auf den Server und erstellt daraus die Rechnung.",
      "31 Monteure, 2 Bürokräfte, 1 Bauleiter. Wir haben Excel, Outlook und eine alte Handwerkersoftware namens mobil.erp für die Rechnung. Die Fotos liegen unsortiert auf einem NAS.",
      "Pro Woche fehlen 6 bis 8 Zettel. Die Bürokraft tippt 11 Stunden pro Woche ab. Zwischen Arbeit und Rechnung vergehen im Schnitt 19 Tage. Letztes Jahr 40.000 Euro nicht abgerechnet.",
      "Der Monteur erfasst Aufmaß und Messprotokoll direkt auf dem Handy, die Fotos hängen automatisch am Auftrag, die Rechnung wird aus den Daten vorbereitet. Freigeben soll weiterhin der Bauleiter.",
      "In 6 Monaten: keine fehlenden Zettel mehr, Abtippzeit unter 2 Stunden pro Woche, Zeit bis zur Rechnung unter 5 Tage.",
      "Budget rund 35.000 Euro, fertig bis Mai. Nur 9 von 31 Monteuren haben ein Firmenhandy. DSGVO wegen Fotos von Kundenanlagen. Der Vertrag mit mobil.erp läuft noch zwei Jahre.",
      "Risiko: drei Monteure sind über 58 und tippen ungern, die machen vielleicht nicht mit. Die Schnittstelle zu mobil.erp muss der Hersteller freigeben. Dafür ist der Bauleiter voll dabei und drängt selbst darauf, und wenn es läuft, könnten wir die DGUV-Prüfprotokolle gleich mitdigitalisieren.",
    ],
  },
  {
    id: "praxis",
    title: "Zahnarztpraxis — Terminausfälle",
    why: "Kleiner Betrieb, kaum IT-Vokabular, weiche Zahlen. Prüft, ob der Agent trotzdem auf Messbares kommt statt zu raten.",
    answers: [
      "Wir sind eine Zahnarztpraxis mit zwei Behandlern und sechs Angestellten. Das Problem sind Termine, die nicht wahrgenommen werden. Ich weiß nicht genau wie viele, aber es fühlt sich nach jedem Tag an.",
      "Die Patientin ruft an, die Rezeption trägt den Termin im Programm ein. Einen Tag vorher ruft jemand von uns an und erinnert — wenn Zeit ist. Oft ist keine Zeit.",
      "Zwei Behandler, eine an der Rezeption, drei Assistentinnen. Wir haben ein Praxisverwaltungsprogramm, Charly heißt das. Telefon und Papierkalender daneben für Notizen.",
      "Ich schätze drei bis vier Ausfälle am Tag. Ein Behandlungsstuhl kostet uns leer etwa 120 Euro die Stunde. Die Rezeption telefoniert bestimmt eine Stunde am Tag nur für Erinnerungen.",
      "Patienten sollen automatisch erinnert werden und selbst absagen können, damit der Platz wieder frei wird. Die Rezeption soll nicht mehr hinterhertelefonieren.",
      "Weniger Ausfälle. Und die Rezeption soll die Stunde zurückbekommen.",
      "Viel Budget haben wir nicht, vielleicht 5.000 Euro. Charly kann angeblich SMS, aber niemand hat es je eingerichtet. Datenschutz ist bei Patientendaten natürlich heikel.",
      "Ältere Patienten haben kein Smartphone, die können wir nicht per App erreichen. Die Rezeption hat Angst, dass sie überflüssig wird. Andererseits ist der eine Behandler technikbegeistert und würde das sofort einführen.",
    ],
  },
];

/** A short, human reason the run exists, printed at the top of the report. */
export const PURPOSE =
  "Jedes Mal wenn der Prompt sich ändert, ändert sich das Dokument — und bis jetzt " +
  "hat das niemand gesehen, bevor ein Nutzer sich beschwert hat. Hier steht, was " +
  "heute tatsächlich herauskommt.";
