import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERABLES, CONSULTANT_DELIVERABLES, ALL_DELIVERABLES, deliverableFor, isDeliverableCommand, agendaPrompt, introFor,
} from "./deliverables.ts";
import { TYPE_CATALOG } from "./agent-types.ts";

const consultants = Object.entries(CONSULTANT_DELIVERABLES);

test("every consultant type has its own document, and only those", () => {
  assert.deepEqual(Object.keys(CONSULTANT_DELIVERABLES).sort(), TYPE_CATALOG.consultant.map(t => t.id).sort());
});

test("each document has its own name, and none reuses the Coach's", () => {
  const titles = ALL_DELIVERABLES.map(d => d.title);
  assert.equal(new Set(titles).size, titles.length);
  assert.deepEqual(
    consultants.map(([, d]) => d.title).sort(),
    ["Adoption Plan", "Architecture Blueprint", "Transformation Concept"],
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
  assert.equal(CONSULTANT_DELIVERABLES.strategy.stations.length, 12);
  assert.equal(CONSULTANT_DELIVERABLES.architect.stations.length, 8);
  assert.equal(CONSULTANT_DELIVERABLES.change.stations.length, 8);
  for (const [id, d] of consultants) {
    const labels = d.stations.map(s => s.label);
    assert.equal(new Set(labels).size, labels.length, `${id}: station labels are the rail's keys`);
  }
});

test("methods the sheet leaves out are not in any document or interview", () => {
  const text = consultants.map(([, d]) => JSON.stringify(d)).join(" ");
  for (const banned of [
    /Competitor/i, /Wettbewerber-Benchmark/i, /Scenario/i, /Szenario/i, /Future Headline/i,
    /Consultant-Coach/i, /Pre-Mortem/i, /Fear & Myth/i, /Champion/i, /Win Wall/i,
    /Failure Mode/i, /Vendor Lock/i, /Load Story/i,
  ]) {
    assert.doesNotMatch(text, banned, String(banned));
  }
});

test("every block a section asks for is one the renderer knows", () => {
  const known = new Set([
    "agxp-kpi", "agxp-gap", "agxp-flow", "agxp-roadmap", "agxp-risks", "agxp-stakeholders",
    "agxp-lexicon", "agxp-glance", "agxp-diff", "agxp-swot", "agxp-level", "agxp-summary",
  ]);
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
  assert.match(p, /8 Stationen/);
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

test("every consultant document closes with measures and next steps", () => {
  for (const [id, d] of consultants) {
    const titles = d.sections.map(s => s.title);
    assert.ok(titles.includes("Maßnahmen"), `${id} has Maßnahmen`);
    assert.equal(titles[titles.length - 1], "Nächste Schritte", id);
    assert.ok(titles.indexOf("Maßnahmen") < titles.indexOf("Nächste Schritte"), id);
    assert.equal(new Set(titles).size, titles.length, `${id}: section titles are unique`);
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
