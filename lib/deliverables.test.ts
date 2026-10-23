import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERABLES, CONSULTANT_DELIVERABLES, ALL_DELIVERABLES, deliverableFor, isDeliverableCommand, agendaPrompt, introFor,
} from "./deliverables.ts";
import { TYPE_CATALOG } from "./agent-types.ts";
import { VISUAL_BLOCKS } from "./doc-visuals.ts";
import { BLOCK_SPECS, visualSpecsFor } from "./visual-specs.ts";

const consultants = Object.entries(CONSULTANT_DELIVERABLES);

test("every consultant type has its own document, and only those", () => {
  assert.deepEqual(Object.keys(CONSULTANT_DELIVERABLES).sort(), TYPE_CATALOG.consultant.map(t => t.id).sort());
});

test("each document has its own name, and none reuses the Coach's", () => {
  const titles = ALL_DELIVERABLES.map(d => d.title);
  assert.equal(new Set(titles).size, titles.length);
  assert.deepEqual(
    consultants.map(([, d]) => d.title).sort(),
    [
      "Adoption Plan", "Architecture Blueprint", "Data Science Plan", "Enterprise Architecture Plan",
      "Product Brief", "Requirements Specification", "Startup Tech Plan", "Transformation Concept",
      "Transformation Roadmap",
    ],
  );
  assert.equal(DELIVERABLES.coach.title, "Change Plan");
});

test("the Consultant's default is the Strategy Consultant's document", () => {
  assert.equal(DELIVERABLES.consultant, CONSULTANT_DELIVERABLES.strategy);
});

test("deliverableFor falls back to the role's default for an unknown or missing type", () => {
  assert.equal(deliverableFor("consultant", "architect").title, "Architecture Blueprint");
  assert.equal(deliverableFor("consultant", "change").title, "Adoption Plan");
  for (const k of [undefined, null, "", "nope", "__proto__", "constructor"]) {
    assert.equal(deliverableFor("consultant", k).title, "Transformation Concept", String(k));
  }
  // Coaches have one document whatever their type.
  assert.equal(deliverableFor("coach", "architect").title, "Change Plan");
});

test("every consultant interview starts with the Knowledge Check", () => {
  for (const [id, d] of consultants) {
    assert.equal(d.stations[0].label, "Knowledge check", id);
    assert.match(d.stations[0].goal, /DREI kurze Multiple-Choice-Fragen/, id);
  }
});

test("every consultant document opens with the same four sections", () => {
  for (const [id, d] of consultants) {
    assert.deepEqual(
      d.sections.slice(0, 4).map(s => s.title),
      ["Wissensstand", "Lexikon", "Management Summary", "Auf einen Blick"],
      id,
    );
  }
});

test("the management summary is the structured five-row block", () => {
  for (const [id, d] of consultants) {
    const s = d.sections.find(x => x.title === "Management Summary")!;
    assert.match(s.must, /agxp-summary/, id);
    assert.match(s.must, /zwei bis drei Sätzen/, id);
    assert.match(s.must, /`Was`/);
    assert.match(s.must, /`Warum`/);
    assert.match(s.must, /`Mehrwert`/);
    assert.match(s.must, /`Risiko`/, id);
    assert.match(s.must, /`Potenzial`/, id);
    assert.match(s.must, /genau fünf Zeilen/, id);
  }
});

test("the interview has as many stations as the document has questions to answer", () => {
  const counts = Object.fromEntries(consultants.map(([id, d]) => [id, d.stations.length]));
  assert.deepEqual(counts, {
    strategy: 16, "business-analyst": 13, transformation: 12, "data-scientist": 12, product: 14,
    architect: 12, enterprise: 11, "startup-cto": 12, change: 11,
  });
  for (const [id, d] of consultants) {
    const labels = d.stations.map(s => s.label);
    assert.equal(new Set(labels).size, labels.length, `${id}: station labels are the rail's keys`);
  }
});

/**
 * The method sheet ("AgxP – Method Groups per Consultant", 2026-10-23), method
 * by method: the section that writes its output. A type whose catalog entry
 * names a method must have that section — the sheet says "all methods", and a
 * method that is listed on the tile but never asked for is a promise broken.
 */
const SECTION_OF: Record<string, string[]> = {
  "Knowledge Check": ["Wissensstand"], "Lexicon": ["Lexikon"], "At a Glance": ["Auf einen Blick"],
  "Gap Analysis + Action Plan": ["Gap-Analyse und Aktionsplan"],
  "Market / Opportunity Gaps": ["Markt- und Chancenlücken"],
  "Build / Buy / Partner Matrix": ["Build / Buy / Partner"],
  "Competitor Benchmark": ["Wettbewerber-Benchmark"],
  "Scenario Planning": ["Szenarien"],
  "Future Headline": ["Schlagzeile aus der Zukunft"],
  "Consultant-Coach Debate": ["Streitgespräch Consultant–Coach"],
  "SMART Goals": ["SMART-Ziele", "SMART-Ziele (Erfolgskriterien)"],
  "SWOT": ["SWOT"],
  "As-Is / To-Be": ["As-Is / To-Be"],
  "Requirements (User Stories + MoSCoW)": ["Anforderungen (User Stories + MoSCoW)"],
  "Impact Mapping": ["Impact Mapping"],
  "Process Mapping": ["Prozess-Mapping"],
  "Pain Point Heatmap": ["Schmerzpunkt-Heatmap"],
  "Data Mapping": ["Data Mapping"],
  "Edge Case Hunt": ["Randfälle"],
  "Definition of Done": ["Definition of Done"],
  "Risk Register": ["Risiko-Register"],
  "Capability Maturity": ["Reifegrad"],
  "Use-Case Prioritization": ["Use-Case-Priorisierung"],
  "Roadmap": ["Roadmap"],
  "Governance Model": ["Governance-Modell"],
  "Stakeholder Map": ["Stakeholder-Landkarte"],
  "AI Use-Case Canvas": ["KI-Use-Case-Canvas"],
  "Transformation Pulse Check": ["Transformations-Puls"],
  "Pre-Mortem": ["Pre-Mortem"],
  "OKRs": ["OKRs"],
  "Problem Framing": ["Problem-Framing"],
  "Data Readiness": ["Datenreife"],
  "Model Options": ["Modell-Optionen"],
  "Root Cause Analysis (5 Whys)": ["Ursachenanalyse (5 Whys)"],
  "Label Audit": ["Label-Audit"],
  "Human-in-the-Loop Design": ["Human-in-the-Loop-Design"],
  "Model Card": ["Model Card"],
  "Evaluation Metrics": ["Bewertungsmetriken"],
  "PoC Experiment Plan": ["PoC-Experimentplan"],
  "Personas": ["Personas"],
  "MVP Scope (MoSCoW)": ["MVP-Scope (MoSCoW)"],
  "User Journey": ["User Journey"],
  "A/B Test Plan": ["A/B-Testplan"],
  "Jobs-to-be-Done": ["Jobs-to-be-Done"],
  "Feature Kill List": ["Feature-Kill-List"],
  "Fake Door Test": ["Fake-Door-Test"],
  "Retention Hook Map": ["Retention-Hook-Map"],
  "Assumption Tests": ["Annahmen-Tests"],
  "Architecture Overview": ["Architektur-Überblick"],
  "Tech Stack Decisions (ADR)": ["Technologie-Entscheidungen (ADR)"],
  "Non-Functional Requirements": ["Nichtfunktionale Anforderungen"],
  "Data & ML Pipeline": ["Daten- & ML-Pipeline"],
  "Infrastructure Plan": ["Infrastruktur-Plan"],
  "Failure Mode Walkthrough": ["Failure-Mode-Walkthrough"],
  "Vendor Lock-in Check": ["Vendor-Lock-in-Check"],
  "Load Story": ["Load Story"],
  "Cost Model (TCO)": ["Kostenmodell (TCO)"],
  "IT Landscape": ["IT-Landschaft"],
  "Integration Blueprint": ["Integrations-Blueprint"],
  "Compliance Check": ["Compliance-Check"],
  "AI Model Register": ["KI-Modellregister"],
  "Shadow AI Scan": ["Shadow-AI-Scan"],
  "Data Lineage Map": ["Data-Lineage-Map"],
  "Change Impact": ["Change Impact"],
  "Lean Canvas": ["Lean Canvas"],
  "MVP Core Loop": ["MVP-Kernschleife"],
  "Lean Tech Stack": ["Schlanker Tech-Stack"],
  "Team Setup": ["Team-Setup"],
  "Pivot Triggers": ["Pivot-Auslöser"],
  "Weekly Ship Log": ["Wöchentliches Ship-Log"],
  "Hiring Scorecard": ["Hiring-Scorecard"],
  "Build-Measure-Learn Milestones": ["Build-Measure-Learn-Meilensteine"],
  "Tech Debt Log": ["Tech-Debt-Log"],
  "Skill-Gap Analysis": ["Fähigkeitslücken"],
  "ADKAR Assessment": ["ADKAR-Einschätzung"],
  "Role Matrix": ["Rollen-Matrix"],
  "Fear & Myth Board": ["Fear-&-Myth-Board"],
  "Champion Network": ["Champion-Netzwerk"],
  "Win Wall": ["Win Wall"],
  "Training & Communication Plan": ["Schulungs- und Kommunikationsplan"],
  "Adoption KPIs": ["Adoptions-KPIs"],
};

test("every method a type names has its section in that type's document", () => {
  for (const t of TYPE_CATALOG.consultant) {
    const titles = CONSULTANT_DELIVERABLES[t.id].sections.map(s => s.title);
    for (const m of [...t.primary, ...t.secondary]) {
      const wanted = SECTION_OF[m];
      assert.ok(wanted, `${m} is on the sheet but SECTION_OF does not know it`);
      assert.ok(wanted.some(w => titles.includes(w)), `${t.id}: ${m} has no section (${wanted.join(" / ")})`);
    }
  }
});

test("and no section names a method the type does not have", () => {
  const known = new Set(Object.values(SECTION_OF).flat());
  const own = (id: string) => new Set(
    [...TYPE_CATALOG.consultant.find(t => t.id === id)!.primary, ...TYPE_CATALOG.consultant.find(t => t.id === id)!.secondary]
      .flatMap(m => SECTION_OF[m]),
  );
  // The sections every document adds around its methods, not methods themselves.
  const frame = new Set(["Management Summary", "Nächste Schritte", "Maßnahmen", "Prozess: heute und morgen",
    "Tools und Technologien", "Erfolgsmessung", "Risiken"]);
  for (const [id, d] of consultants) {
    for (const s of d.sections) {
      if (frame.has(s.title)) continue;
      assert.ok(known.has(s.title), `${id}: unknown section ${s.title}`);
      assert.ok(own(id).has(s.title), `${id}: ${s.title} belongs to a method this type does not have`);
    }
  }
});

test("every method a type names has its station, so the interview asks what the section needs", () => {
  // Knowledge Check is the first station; Lexicon, At a Glance and the Management Summary are written
  // from the other answers and have none; Starting point stands in for the glance's key data.
  const STATION_OF: Record<string, string> = {
    "Gap Analysis + Action Plan": "Gaps & actions", "Market / Opportunity Gaps": "Market & opportunity",
    "Build / Buy / Partner Matrix": "Build, buy or partner", "Competitor Benchmark": "Competitors",
    "Scenario Planning": "Scenarios", "Future Headline": "Future headline", "Consultant-Coach Debate": "Decision debate",
    "SMART Goals": "Success metrics|Success criteria", "As-Is / To-Be": "As-is / to-be", "Requirements (User Stories + MoSCoW)": "Requirements",
    "Impact Mapping": "Impact map", "Process Mapping": "Process map", "Pain Point Heatmap": "Pain points",
    "Data Mapping": "Data map", "Edge Case Hunt": "Edge cases", "Definition of Done": "Definition of done",
    "Capability Maturity": "Capability maturity", "Use-Case Prioritization": "Use cases", "Roadmap": "Roadmap",
    "Governance Model": "Governance", "Stakeholder Map": "Stakeholders", "AI Use-Case Canvas": "Use-case canvas",
    "Transformation Pulse Check": "Pulse check", "Pre-Mortem": "Pre-mortem", "OKRs": "OKRs",
    "Problem Framing": "Problem framing", "Data Readiness": "Data readiness", "Model Options": "Model options",
    "Root Cause Analysis (5 Whys)": "Root cause", "Label Audit": "Label audit", "Human-in-the-Loop Design": "Human in the loop",
    "Model Card": "Model card", "Evaluation Metrics": "Evaluation metrics", "PoC Experiment Plan": "PoC plan",
    "Personas": "Personas", "MVP Scope (MoSCoW)": "MVP scope", "User Journey": "User journey", "A/B Test Plan": "A/B test",
    "Jobs-to-be-Done": "Jobs to be done", "Feature Kill List": "Kill list", "Fake Door Test": "Fake door",
    "Retention Hook Map": "Retention hooks", "Assumption Tests": "Assumptions",
    "Architecture Overview": "Components", "Tech Stack Decisions (ADR)": "Technology decisions",
    "Non-Functional Requirements": "Quality requirements", "Data & ML Pipeline": "Data & ML pipeline",
    "Infrastructure Plan": "Infrastructure", "Failure Mode Walkthrough": "Failure modes", "Vendor Lock-in Check": "Vendor lock-in",
    "Load Story": "Load story", "Cost Model (TCO)": "Costs & timeline", "Risk Register": "Risks|Risks & dependencies",
    "IT Landscape": "IT landscape", "Integration Blueprint": "Integration blueprint", "Compliance Check": "Compliance",
    "AI Model Register": "AI model register", "Shadow AI Scan": "Shadow AI scan", "Data Lineage Map": "Data lineage",
    "Change Impact": "Change impact", "Lean Canvas": "Lean canvas", "MVP Core Loop": "MVP core loop",
    "Lean Tech Stack": "Lean tech stack", "Team Setup": "Team setup", "Pivot Triggers": "Pivot triggers",
    "Weekly Ship Log": "Weekly ship log", "Hiring Scorecard": "Hiring scorecard", "Build-Measure-Learn Milestones": "Build-measure-learn",
    "Tech Debt Log": "Tech debt log", "Skill-Gap Analysis": "Skills", "ADKAR Assessment": "Readiness (ADKAR)",
    "Role Matrix": "Roles", "Fear & Myth Board": "Fears & myths", "Champion Network": "Champions", "Win Wall": "Win wall",
    "Training & Communication Plan": "Training & communication", "Adoption KPIs": "Adoption KPIs",
  };
  // SWOT is the agent's own evaluation of the plan ("Always, agent does it for the user"), written from
  // the stations before it; it asks nothing of its own.
  const shared = new Set(["Knowledge Check", "Lexicon", "At a Glance", "SWOT"]);
  for (const t of TYPE_CATALOG.consultant) {
    const labels = CONSULTANT_DELIVERABLES[t.id].stations.map(s => s.label);
    for (const m of [...t.primary, ...t.secondary]) {
      if (shared.has(m)) continue;
      // The Solution Architect's register has always been written from the gaps of the other sections.
      if (t.id === "architect" && m === "Risk Register") continue;
      assert.ok(STATION_OF[m], `${m} has no entry in STATION_OF`);
      assert.ok(STATION_OF[m].split("|").some(l => labels.includes(l)), `${t.id}: ${m} has no station "${STATION_OF[m]}"`);
    }
  }
});

test("a method the sheet gives a trigger is skipped in a sentence when it does not apply", () => {
  // Trigger from the sheet's "Trigger" column, per type. "Always" methods are not here.
  const conditional: Record<string, string[]> = {
    strategy: ["Markt- und Chancenlücken", "Wettbewerber-Benchmark", "Szenarien", "Streitgespräch Consultant–Coach"],
    "business-analyst": ["Impact Mapping", "Prozess-Mapping", "Schmerzpunkt-Heatmap", "Data Mapping", "Definition of Done"],
    transformation: ["Governance-Modell", "Stakeholder-Landkarte", "Transformations-Puls", "Pre-Mortem"],
    "data-scientist": ["Ursachenanalyse (5 Whys)", "Label-Audit", "Human-in-the-Loop-Design", "Model Card"],
    product: ["User Journey", "A/B-Testplan", "Fake-Door-Test", "Retention-Hook-Map"],
    architect: ["Daten- & ML-Pipeline", "Vendor-Lock-in-Check", "Load Story", "Streitgespräch Consultant–Coach"],
    enterprise: ["Compliance-Check", "KI-Modellregister", "Shadow-AI-Scan", "Data-Lineage-Map"],
    "startup-cto": ["Team-Setup", "Wöchentliches Ship-Log", "Hiring-Scorecard", "Pre-Mortem"],
    change: ["Rollen-Matrix", "Champion-Netzwerk", "Win Wall"],
  };
  for (const [id, titles] of Object.entries(conditional)) {
    for (const title of titles) {
      const s = CONSULTANT_DELIVERABLES[id].sections.find(x => x.title === title);
      assert.ok(s, `${id}: ${title}`);
      assert.match(s!.must, /Nur wenn|schreib genau einen Satz|Satz dazu|Ohne Modell/i, `${id}: ${title} says what to do when it does not apply`);
    }
  }
  // And "always" stays unconditional: Gap Analysis, Requirements, Roadmap … must not be skippable.
  for (const [id, title] of [["business-analyst", "As-Is / To-Be"], ["business-analyst", "Anforderungen (User Stories + MoSCoW)"],
    ["transformation", "Reifegrad"], ["enterprise", "Governance-Modell"], ["product", "Impact Mapping"],
    ["startup-cto", "Pivot-Auslöser"], ["change", "Fear-&-Myth-Board"]] as const) {
    const s = CONSULTANT_DELIVERABLES[id].sections.find(x => x.title === title)!;
    assert.doesNotMatch(s.must, /Nur wenn|lass die Tabelle weg/, `${id}: ${title} is always`);
  }
});

test("the sheet's output columns are the section's columns, in the sheet's order", () => {
  const COLUMNS: Record<string, string> = {
        "Wettbewerber-Benchmark": "Kriterium | Deine Idee | Alt 1 | Alt 2 | Alt 3",
    "Schlagzeile aus der Zukunft": "Was wahr sein muss | Verknüpftes Ziel",
    "As-Is / To-Be": "Bereich | As-Is | To-Be | Gelöster Schmerzpunkt",
    "Anforderungen (User Stories + MoSCoW)": "ID | User Story | Typ (F/NF) | Akzeptanzkriterien | Priorität",
    "Impact Mapping": "Ziel | Akteur | Wirkung | Lieferobjekt",
    "Prozess-Mapping": "Schritt | Rolle | Aktion | Input | Output",
    "Schmerzpunkt-Heatmap": "Schmerzpunkt | Häufigkeit (1-5) | Schwere (1-5) | Score | Betroffene",
    "Data Mapping": "Feld | Benötigt für (Req-ID) | Quelle | Verantwortlicher | Qualität | Lücke",
    "Randfälle": "Story-ID | Randfall | Erwartetes Verhalten | Priorität",
    "SMART-Ziele (Erfolgskriterien)": "Ziel | Zielwert | Gemessen durch | Frist | Erreicht?",
    "Reifegrad": "Dimension | Aktuell (1-5) | Ziel | Evidenz",
    "Use-Case-Priorisierung": "Use Case | Wert | Aufwand | Daten bereit? | Kategorie",
    "Roadmap": "Phase | Meilensteine | Verantwortlich | Gate zur nächsten Phase",
    "Governance-Modell": "Entscheidung / Regel | Entscheidet / Verantwortlich | Konsultiert | Rhythmus / Prüfung",
    "Stakeholder-Landkarte": "Gruppe | Größe | Interesse | Einfluss | Haltung | Einbindung",
    "Transformations-Puls": "Frage | Wert diesen Monat | Letzter Monat | Trend | Maßnahme",
    "Pre-Mortem": "Scheiter-Grund | Wahrscheinlichkeit | Gegenmaßnahme | Verantwortlicher",
    "Problem-Framing": "Geschäftsfrage | ML-Aufgabe | Input | Output | Unterstützte Entscheidung",
    "Datenreife": "Datenquelle | Volumen | Labels? | Qualität (H/M/L) | Zugang | Lücke",
    "Modell-Optionen": "Option | Wie es funktioniert | Benötigte Daten | Erklärbarkeit | Aufwand | Empfehlung",
    "Ursachenanalyse (5 Whys)": "Warum? | Antwort | Evidenz",
    "Label-Audit": "Label-Klasse | Stichprobe | Übereinstimmung % | Hauptverwechslung | Korrektur",
    "Human-in-the-Loop-Design": "Entscheidung | KI-Konfidenz | Modus (Auto/Vorschlag/Mensch) | Wer prüft",
    "Bewertungsmetriken": "Metrik | Geschäftliche Bedeutung | Baseline | Ziel",
    "PoC-Experimentplan": "Hypothese | Datensatz | Schwellenwert | Zeitbox | Wenn ja | Wenn nein",
    "MVP-Scope (MoSCoW)": "Feature | Persona | MoSCoW | Begründung",
    "A/B-Testplan": "Hypothese | Variante A | Variante B | Metrik | Min. Nutzer | Entscheidungsregel",
    "Jobs-to-be-Done": "Wenn… | Ich will… | Damit… | Heutige Alternative",
    "Feature-Kill-List": "Feature | Warum jetzt nicht | Wieder prüfen, wenn",
    "Fake-Door-Test": "Feature | Fake-Einstieg | Besucher | Klicks % | Schwellenwert | Entscheidung",
    "Retention-Hook-Map": "Auslöser | Aktion | Belohnung | Investition",
    "Annahmen-Tests": "Annahme | Risiko, falls falsch | Günstigster Test | Signal",
    "Failure-Mode-Walkthrough": "Komponente | Fehlerfall | Auswirkung auf Nutzer | Erkennung | Wiederherstellung",
    "Vendor-Lock-in-Check": "Anbieter | Genutzt für | Wechselaufwand (H/M/L) | Exit-Plan",
    "Load Story": "Laststufe | Geschichte | Was zuerst bricht | Lösung | Kosten",
    "IT-Landschaft": "System | Zweck | Verantwortlicher | Gehaltene Daten | Integrationsoption | Legacy?",
    "Integrations-Blueprint": "Datenfluss | Von | Nach | Schnittstelle | Frequenz | Daten",
    "Compliance-Check": "Regulierung | Anforderung | Status | Maßnahme",
    "KI-Modellregister": "Modell / Tool | Zweck | Verantwortlicher | Genutzte Daten | Risikostufe | Nächste Prüfung",
    "Shadow-AI-Scan": "Tool | Nutzende Teams | Eingegebene Daten | Risiko | Entscheidung",
    "Data-Lineage-Map": "Ausgabefeld | Transformation | Input | Quellsystem | Verantwortlicher",
    "Change Impact": "Element | Änderung | Auswirkung (H/M/L) | Betroffene",
    "MVP-Kernschleife": "Kernschleife-Schritt | Im MVP | Fertig, wenn",
    "Schlanker Tech-Stack": "Schicht | Wahl | Warum schlank | Ersetzen, wenn",
    "Team-Setup": "Rolle | Person | Verantwortet | Stunden/Woche",
    "Pivot-Auslöser": "Signal | Schwellenwert | Prüfdatum | Pivot zu",
    "Wöchentliches Ship-Log": "Woche | Geliefert | Metrik | Learning",
    "Build-Measure-Learn-Meilensteine": "Woche | Bauen | Messen | Lernen (Entscheidung)",
    "Tech-Debt-Log": "Abkürzung | Akzeptiert, weil | Zurückzahlen, wenn",
    "Fear-&-Myth-Board": "Angst / Mythos | Wie oft gehört | Ehrliche Antwort | Beleg",
    "Champion-Netzwerk": "Team | Champion | Geschult? | Feedback-Kanal",
    "Win Wall": "Datum | Team | Erfolg | Geteilt wo",
  };
  // Sections whose picture carries every column of the sheet's output itself: the block is the table.
  const BLOCKS: Record<string, [string, string[]]> = {
    "Szenarien": ["agxp-cards", ["Best Case", "Base Case", "Worst Case", "Was passiert", "Frühwarnzeichen", "Reaktion"]],
    "Streitgespräch Consultant–Coach": ["agxp-debate", ["Entscheidung", "Dafür", "Dagegen", "Wahl"]],
    "Definition of Done": ["agxp-checklist", ["Prüfpunkt", "Gilt für", "Wer prüft"]],
    "OKRs": ["agxp-okr", ["Objective", "Key Result", "Frist", "Verantwortlich"]],
    "KI-Use-Case-Canvas": ["agxp-cards", ["Problem", "Nutzer", "Daten", "Modell-Idee", "Wert", "Risiko", "Verantwortlicher"]],
    "Model Card": ["agxp-cards", ["Zweck", "Daten", "Metriken", "Grenzen", "Nicht geeignet für", "Verantwortlicher"]],
    "Personas": ["agxp-cards", ["Kontext", "Ziel", "Frust heute", "Kommt zurück, weil"]],
    "User Journey": ["agxp-journey", ["Stufe", "Nutzeraktion", "Gefühl", "Abbruchrisiko", "Lösung"]],
    "Lean Canvas": ["agxp-canvas", ["Problem", "Kunde", "Alleinstellung", "Lösung", "Kanäle", "Einnahmen", "Kosten", "Kennzahl", "Unfairer Vorteil"]],
  };
  for (const [, d] of consultants) {
    for (const s of d.sections) {
      const b = BLOCKS[s.title];
      if (!b) continue;
      assert.ok(s.must.includes(b[0]), `${d.title} / ${s.title}: ${b[0]}`);
      for (const label of b[1]) assert.ok(s.must.includes(label), `${d.title} / ${s.title}: ${label}`);
    }
  }
  const seen = new Set<string>();
  for (const [, d] of consultants) {
    for (const s of d.sections) {
      const cols = COLUMNS[s.title];
      if (!cols) continue;
      seen.add(s.title);
      assert.ok(s.must.includes(cols), `${d.title} / ${s.title}: columns "${cols}"`);
    }
  }
  assert.deepEqual([...Object.keys(COLUMNS)].filter(k => !seen.has(k)), [], "every listed section is in some document");
});

test("the Roadmap draws a Gantt chart of the phases and then the sheet's table", () => {
  const roadmap = CONSULTANT_DELIVERABLES.transformation.sections.find(s => s.title === "Roadmap")!.must;
  assert.match(roadmap, /agxp-gantt/);
  assert.match(roadmap, /Quick Wins, Scale, Embed/);
  assert.ok(roadmap.indexOf("agxp-gantt") < roadmap.indexOf("Phase | Meilensteine"));
});

test("every method the sheet shows as a picture is drawn as one", () => {
  // Part 2 of the sheet, "Visual example", method by method: the block that draws it.
  const PICTURE: [string, string, string][] = [
    ["strategy", "Szenarien", "agxp-cards"], ["strategy", "Streitgespräch Consultant–Coach", "agxp-debate"],
    ["strategy", "Schlagzeile aus der Zukunft", "> "], ["architect", "Streitgespräch Consultant–Coach", "agxp-debate"],
    ["architect", "Architektur-Überblick", "agxp-graph"], ["architect", "Daten- & ML-Pipeline", "agxp-graph"],
    ["business-analyst", "Impact Mapping", "agxp-graph"], ["business-analyst", "Prozess-Mapping", "agxp-sequence"],
    ["business-analyst", "Definition of Done", "agxp-checklist"],
    ["transformation", "Use-Case-Priorisierung", "agxp-quadrant"], ["transformation", "Roadmap", "agxp-gantt"],
    ["transformation", "Stakeholder-Landkarte", "agxp-quadrant"], ["transformation", "KI-Use-Case-Canvas", "agxp-cards"],
    ["transformation", "OKRs", "agxp-okr"], ["transformation", "Pre-Mortem", "> "],
    ["data-scientist", "Problem-Framing", "agxp-graph"], ["data-scientist", "Ursachenanalyse (5 Whys)", "agxp-graph"],
    ["data-scientist", "Human-in-the-Loop-Design", "agxp-graph"], ["data-scientist", "Model Card", "agxp-cards"],
    ["product", "Personas", "agxp-cards"], ["product", "Impact Mapping", "agxp-graph"], ["product", "MVP-Scope (MoSCoW)", "agxp-moscow"],
    ["product", "User Journey", "agxp-journey"], ["product", "Fake-Door-Test", "agxp-mock"], ["product", "Retention-Hook-Map", "agxp-graph"],
    ["enterprise", "IT-Landschaft", "agxp-graph"], ["enterprise", "Integrations-Blueprint", "agxp-graph"],
    ["enterprise", "Data-Lineage-Map", "agxp-graph"],
    ["startup-cto", "Lean Canvas", "agxp-canvas"], ["startup-cto", "MVP-Kernschleife", "agxp-graph"],
    ["startup-cto", "Build-Measure-Learn-Meilensteine", "agxp-gantt"], ["startup-cto", "Pre-Mortem", "> "],
    ["change", "Stakeholder-Landkarte", "agxp-quadrant"], ["change", "Schulungs- und Kommunikationsplan", "agxp-timeline"],
    ["change", "Champion-Netzwerk", "agxp-graph"],
  ];
  for (const [id, title, marker] of PICTURE) {
    const s = CONSULTANT_DELIVERABLES[id].sections.find(x => x.title === title);
    assert.ok(s, `${id}: ${title}`);
    assert.ok(s!.must.includes(marker), `${id} / ${title} should use ${marker}`);
  }
});

test("a document's prompt describes exactly the new blocks its sections use", () => {
  for (const d of ALL_DELIVERABLES) {
    const prompt = agendaPrompt(d, null);
    const wanted = Object.keys(BLOCK_SPECS).filter(k => d.sections.some(s => s.must.includes(k)));
    for (const k of Object.keys(BLOCK_SPECS)) {
      assert.equal(prompt.includes("```" + k + "\n"), wanted.includes(k), `${d.title}: ${k}`);
    }
  }
  assert.equal(visualSpecsFor("no block here"), "");
});

test("the Consultant-Coach Debate needs the Coach's three arguments, not an invented opposition", () => {
  for (const id of ["strategy", "architect"]) {
    const st = CONSULTANT_DELIVERABLES[id].stations.find(s => s.label === "Decision debate")!;
    assert.match(st.goal, /Coach-Fenster/);
    assert.match(st.goal, /drei Argumente/);
    assert.match(st.goal, /statt sie zu erfinden/);
  }
});

test("every block a section asks for is one the renderer knows", () => {
  const known = new Set(VISUAL_BLOCKS);
  for (const d of ALL_DELIVERABLES) {
    for (const s of d.sections) {
      for (const m of s.must.match(/agxp-[a-z]+/g) ?? []) assert.ok(known.has(m), `${d.title} / ${s.title}: ${m}`);
    }
  }
});

test("the section columns match the method sheet", () => {
  const sec = (id: string, title: string) => CONSULTANT_DELIVERABLES[id].sections.find(s => s.title === title)!.must;
  assert.match(sec("strategy", "SMART-Ziele"), /Ziel \| Zielwert \| Gemessen durch \| Frist \| Erreicht\?/);
  assert.match(sec("strategy", "Build / Buy / Partner"), /Fähigkeit \| Build \| Buy \| Partner \| Empfehlung \| Warum/);
  assert.match(sec("strategy", "Markt- und Chancenlücken"), /Marktlage \| Potenzial \| Lücke \| Maßnahme/);
  assert.match(sec("strategy", "Gap-Analyse und Aktionsplan"), /Dimension \| heute \| ziel \| Lücke \| Aktionsplan/);
  assert.match(sec("architect", "Architektur-Überblick"), /Komponente \| Verantwortung \| Technologie \| Spricht mit/);
  assert.match(sec("architect", "Technologie-Entscheidungen (ADR)"), /Nr\. \| Entscheidung \| Optionen \| Gewählt \| Warum \| Konsequenz/);
  assert.match(sec("architect", "Nichtfunktionale Anforderungen"), /Qualität \| Anforderung \| Messgröße \| Design-Antwort/);
  assert.match(sec("architect", "Kostenmodell (TCO)"), /Kostenposition \| Einmalig \| Monatlich \| Annahme/);
  assert.match(sec("change", "Stakeholder-Landkarte"), /Gruppe \| Größe \| Interesse \| Einfluss \| Haltung \| Einbindung/);
  assert.match(sec("change", "Fähigkeitslücken"), /Gruppe \| Benötigte Fähigkeit \| Heute \(1-5\) \| Ziel \(1-5\) \| Lücke \| Lernformat/);
  assert.match(sec("change", "ADKAR-Einschätzung"), /Gruppe \| A \| D \| K \| A \| R \| Erste Blockade \| Maßnahme/);
  assert.match(sec("change", "Rollen-Matrix"), /Rolle \| Heute \| Nach der Veränderung \| Was bleibt/);
  assert.match(sec("change", "Schulungs- und Kommunikationsplan"), /Wann \| Gruppe \| Botschaft \/ Schulung \| Kanal \| Verantwortlich/);
  assert.match(sec("change", "Adoptions-KPIs"), /KPI \| Zielwert \| Gemessen durch \| Frist \| Erreicht\?/);
});

test("the buttons that ask for a document are recognised for every type", () => {
  for (const d of ALL_DELIVERABLES) {
    assert.equal(isDeliverableCommand(d.generatePrompt), true, d.title);
    assert.equal(isDeliverableCommand(d.regeneratePrompt), true, d.title);
    assert.match(d.generatePrompt, new RegExp(d.title));
  }
  assert.equal(isDeliverableCommand("Create the document please"), false);
});

test("the agenda names the document and the stations of that type", () => {
  const p = agendaPrompt(CONSULTANT_DELIVERABLES.architect, null);
  assert.match(p, /"Architecture Blueprint"/);
  assert.match(p, /\[\[DOC: Architecture Blueprint\]\]/);
  assert.match(p, /12 Stationen/);
  assert.match(p, /agxp-summary/);
});

test("the Transformation Concept keeps everything it had, with the sheet's methods added", () => {
  const titles = CONSULTANT_DELIVERABLES.strategy.sections.map(s => s.title);
  // what was there before the method sheet
  for (const old of ["Lexikon", "Management Summary", "Auf einen Blick", "Prozess: heute und morgen",
    "SMART-Ziele", "SWOT", "Tools und Technologien", "Maßnahmen", "Erfolgsmessung", "Risiken", "Nächste Schritte"]) {
    assert.ok(titles.includes(old), `still has ${old}`);
  }
  // what the sheet added, or sharpened
  for (const added of ["Wissensstand", "Gap-Analyse und Aktionsplan", "Markt- und Chancenlücken", "Build / Buy / Partner"]) {
    assert.ok(titles.includes(added), `has ${added}`);
  }
  assert.equal(new Set(titles).size, titles.length);
  // and the interview still asks what those older sections need
  const stations = CONSULTANT_DELIVERABLES.strategy.stations.map(s => s.label);
  for (const label of ["Current process", "People & systems", "Pain points", "Constraints", "Success metrics", "Risks & dependencies"]) {
    assert.ok(stations.includes(label), `still asks ${label}`);
  }
});

test("every consultant document closes with next steps", () => {
  for (const [id, d] of consultants) {
    const titles = d.sections.map(s => s.title);
    assert.equal(titles[titles.length - 1], "Nächste Schritte", id);
    assert.equal(new Set(titles).size, titles.length, `${id}: section titles are unique`);
  }
  // The three that predate the method sheet also close their plan with measures.
  for (const id of ["strategy", "architect", "change"]) {
    const titles = CONSULTANT_DELIVERABLES[id].sections.map(s => s.title);
    assert.ok(titles.includes("Maßnahmen"), `${id} has Maßnahmen`);
    assert.ok(titles.indexOf("Maßnahmen") < titles.indexOf("Nächste Schritte"), id);
  }
});

test("the measures are built from the document's own methods, not a second list", () => {
  const measures = (id: string) => CONSULTANT_DELIVERABLES[id].sections.find(s => s.title === "Maßnahmen")!.must;
  assert.match(measures("architect"), /ADR/);
  assert.match(measures("architect"), /Risiko-Register/);
  assert.match(measures("change"), /ADKAR/);
  assert.match(measures("change"), /Schulungs- und Kommunikationsplan/);
  for (const id of ["strategy", "architect", "change"]) assert.match(measures(id), /erfinde keine zweite/);
});

test("the interview asks the timeline the measures need", () => {
  assert.ok(CONSULTANT_DELIVERABLES.architect.stations.some(s => /Zeitrahmen/.test(s.goal)));
  assert.ok(CONSULTANT_DELIVERABLES.strategy.stations.some(s => /Zeitrahmen/.test(s.goal)));
  assert.ok(CONSULTANT_DELIVERABLES.change.stations.some(s => /Go-live/.test(s.goal)));
});

test("the note under the Methods title names the document and says what it is for", () => {
  for (const [id, d] of consultants) {
    const note = introFor(d);
    assert.ok(note.includes(d.title), id);
    assert.match(note, /one at a time/, id);
    // The subtitle comes through whole, lower-cased and without its full stop.
    assert.ok(note.toLowerCase().includes(d.subtitle.replace(/\.$/, "").toLowerCase()), id);
    assert.ok(!note.includes(".."), id);
  }
});
