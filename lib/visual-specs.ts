/**
 * visual-specs.ts — how the agent writes each picture of the method sheet.
 *
 * The first twelve blocks (kpi … summary) are described once, for every
 * document, in VISUAL_SPEC (lib/deliverables.ts). These are the thirteen added
 * with the method sheet of 2026-10-23. A document's prompt carries only the
 * blocks its own sections ask for (visualSpecsFor), so a Product Brief does not pay for the
 * lean canvas. Each is plain pipe-separated lines — the agent never writes SVG or HTML —
 * and each has its renderer in lib/doc-diagrams.ts or lib/doc-layouts.ts.
 */

export const BLOCK_SPECS: Record<string, string> = {
  "agxp-quadrant":
    "Vier-Felder-Tafel — `x:` und `y:` benennen die Achsen (`niedrig | hoch`), `q:` die vier Felder (unten links | unten rechts | " +
    "oben links | oben rechts), danach Punkte `Name | x | y` mit Werten von 0 bis 100 (y zählt nach oben):\n" +
    "```agxp-quadrant\nx: Geringes Interesse | Hohes Interesse\ny: Geringer Einfluss | Hoher Einfluss\n" +
    "q: Beobachten | Informieren | Zufrieden halten | Eng einbinden\nBetriebsrat | 35 | 80\nTeamleiter | 85 | 85\n```",
  "agxp-graph":
    "Diagramm aus Kästen und Pfeilen — `dir: LR` (links nach rechts) oder `dir: TB` (oben nach unten), dann Knoten `id: Beschriftung | " +
    "Form | Ton` (Form `box`, `db`, `model`, `goal`, `decision`, `person`, `group`; Ton `warn`, `ok`, `bad`, `star`, `muted`; beides optional) " +
    "und Kanten `a -> b : Beschriftung` (durchgezogen) oder `a --> b : Beschriftung` (gestrichelt); `| red` am Ende färbt die Kante rot. " +
    "Eine Kante zurück zu einem früheren Knoten zeichnet eine Schleife. Höchstens 12 Knoten, Beschriftungen kurz:\n" +
    "```agxp-graph\ndir: LR\nA: Schadenkern | db | warn\nB: KI-Triage | model | ok\nC: Archiv | db\n" +
    "A -> B : nächtlicher Batch | red\nC -> B : REST-API\nB --> A : Klasse + Konfidenz\n```",
  "agxp-sequence":
    "Sequenzdiagramm — die erste Zeile nennt die Spuren (`Host | System | Spieler`), dann je Schritt `von -> an : Text` (Aufruf) oder " +
    "`von --> an : Text` (gestrichelte Antwort); ein `*` am Ende heißt automatisch; `loop: Text` … `end` rahmt Wiederholungen ein:\n" +
    "```agxp-sequence\nHost | System | Spieler\nHost -> System : Spiel anlegen\nSystem --> Host : Spielcode\n" +
    "loop: 10 Runden\nSystem -> Spieler : Clip + 4 Antworten *\nSpieler -> System : Antwort\nend\n```",
  "agxp-journey":
    "Nutzerreise — `Stufe | Nutzeraktion | Gefühl | Abbruchrisiko | Lösung`; Gefühl ist 1 (schlecht) bis 5 (gut) mit einem Wort " +
    "dahinter, Abbruchrisiko `H`, `M` oder `L`:\n" +
    "```agxp-journey\nEntdecken | Bekommt Link von Freund | 4 neugierig | L | –\nStart | Sieht Login-Bildschirm | 2 genervt | H | Ohne Login spielen\n```",
  "agxp-gantt":
    "Balkenplan — optional `unit: Monat` oder `ticks: Jan | Feb | Mär` für die Zeitachse, dann `Lane | Text | Start | Ende` in Schritten der " +
    "Achse (ab 1, Ende eingeschlossen); `| milestone` am Ende macht aus der Zeile eine Raute:\n" +
    "```agxp-gantt\nunit: Monat\nQuick Wins | Triage-Pilot (1 Team) | 1 | 3\nQuick Wins | Gate: −15 % Bearbeitungszeit | 3 | 3 | milestone\n" +
    "Scale | Triage in allen Teams | 3 | 8\n```",
  "agxp-timeline":
    "Zeitstrahl — `Wann | Gruppe | Botschaft / Schulung | Kanal | Verantwortlich`, chronologisch, höchstens 8 Zeilen:\n" +
    "```agxp-timeline\nMonat 1 | Alle Mitarbeitenden | Town Hall: warum wir das tun | Präsenz | Leitung Schaden\n```",
  "agxp-moscow":
    "MoSCoW-Spalten — vier Zeilen `Must | …`, `Should | …`, `Could | …`, `Won't | …`, die Einträge mit `;` getrennt:\n" +
    "```agxp-moscow\nMust | Clip + 4 Antworten abspielen; Beitritt per Code; Punktestand\nShould | Tägliche Challenge\nCould | Genre-Auswahl\nWon't | Chat; Accounts\n```",
  "agxp-cards":
    "Karten — je Karte ein Absatz, getrennt durch eine Leerzeile: die erste Zeile ist der Titel (optional `Titel | good`, `| warn` oder `| bad`), " +
    "jede weitere `Label | Wert`; mehrere Werte mit `;`:\n" +
    "```agxp-cards\nParty-Host\nKontext | abends, 4-8 Freunde\nZiel | einfacher Spaß in der Gruppe\n\nPendler\nKontext | allein, 15 Minuten im Zug\n```",
  "agxp-canvas":
    "Lean Canvas — neun Zeilen `Block | Inhalt` mit den Blöcken Problem, Kunde, Alleinstellung, Lösung, Kanäle, Einnahmen, Kosten, Kennzahl, " +
    "Unfairer Vorteil; ein Satz je Block, Unbekanntes als `Unbekannt`:\n" +
    "```agxp-canvas\nProblem | Gruppenspiele brauchen Vorbereitung\nKunde | Freundesgruppen 18-30\nAlleinstellung | Musikquiz-Party in 1 Minute\nEinnahmen | Unbekannt\n```",
  "agxp-checklist":
    "Checkliste — `[ ] Prüfpunkt | Gilt für | Wer prüft`, `[x]` für Erledigtes:\n" +
    "```agxp-checklist\n[x] Läuft auf Handy und Desktop | alle Stories | Entwicklung\n[ ] Vom zweiten Teammitglied getestet | alle Stories | Test\n```",
  "agxp-okr":
    "OKRs — `Objective: Text`, darunter je Key Result `Key Result | Frist | Verantwortlich | Fortschritt 0-100`:\n" +
    "```agxp-okr\nObjective: KI-Nutzen im Schadenwesen belegen\nBearbeitungszeit im Pilotteam −15 % | Monat 3 | Leiter Schaden | 40\n```",
  "agxp-debate":
    "Streitgespräch — `Entscheidung: Text`, `Dafür | …` (drei Argumente mit `;`), `Dagegen | …`, `Wahl | Entscheidung | Begründung`:\n" +
    "```agxp-debate\nEntscheidung: Eigene Clips verwenden?\nDafür | volle Kontrolle über die Musik; keine API-Abhängigkeit; eigener Sound\n" +
    "Dagegen | 20 Tage sind zu kurz; rechtliches Risiko; Nutzer wollen bekannte Songs\nWahl | Keine eigenen Clips | Frist\n```",
  "agxp-mock":
    "Bildschirm-Skizze — jede Zeile ein Eintrag, der Fake-Einstieg mit `*` am Ende, `-> Text` für das, was ein Klick zeigt:\n" +
    "```agxp-mock\nNeues Spiel\nGenre-Packs *\n-> Bald verfügbar! Willst du es?\n```",
};

/** The specs for the blocks a document's sections name, in the order they are numbered from 13. */
export function visualSpecsFor(sectionText: string): string {
  const used = Object.keys(BLOCK_SPECS).filter(k => sectionText.includes(k));
  if (!used.length) return "";
  return "\n\nWEITERE VISUAL-BLÖCKE — für dieses Dokument, gleiche Regeln wie oben (nur Pipe-Zeilen, kein Erklärtext im Block):\n\n" +
    used.map((k, i) => `${13 + i}) ${BLOCK_SPECS[k]}`).join("\n\n") +
    "\n\nIn Tabellen schreibst du Einstufungen als einzelnes Zeichen oder Wort (`H`, `M`, `L`; `ja`, `nein`, `teilweise`, `offen`; " +
    "`Must`, `Should`) und Prozentwerte als `40 %` — die Oberfläche zeichnet daraus Punkte, Häkchen und Balken. Nie Emojis.";
}
