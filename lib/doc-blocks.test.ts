import test from "node:test";
import assert from "node:assert/strict";
import { parseDoc, visualBlocks, runs } from "./doc-blocks.ts";

test("headings, bullets, numbers and paragraphs keep their order and level", () => {
  const b = parseDoc("# Titel\n\n## Abschnitt\n\nErster Satz\nzweite Zeile.\n\n- eins\n- zwei\n\n1. a\n2. b");
  assert.deepEqual(b.map(x => x.kind), ["heading", "heading", "para", "bullet", "bullet", "number", "number"]);
  assert.deepEqual(b[1], { kind: "heading", level: 2, text: "Abschnitt" });
  assert.deepEqual(b[2], { kind: "para", text: "Erster Satz zweite Zeile." });
});

test("a markdown table keeps its header and drops the separator row", () => {
  const [t] = parseDoc("| Tool | Aufwand |\n|---|---|\n| A | gering |\n| B | hoch |");
  assert.equal(t.kind, "table");
  if (t.kind === "table") {
    assert.deepEqual(t.header, ["Tool", "Aufwand"]);
    assert.deepEqual(t.rows, [["A", "gering"], ["B", "hoch"]]);
  }
});

test("inline bold, italic, code and links come out as runs", () => {
  assert.deepEqual(runs("a **fett** und *schief* und `code` [Link](https://x.de)"), [
    { text: "a " }, { text: "fett", bold: true }, { text: " und " }, { text: "schief", italics: true },
    { text: " und " }, { text: "code", code: true }, { text: " Link (https://x.de)" },
  ]);
});

test("an agxp block becomes a table that says the same thing", () => {
  const b = parseDoc("```agxp-kpi\nAufträge pro Tag | 180\nDiesel | 600 € | bad\n```");
  assert.equal(b.length, 1);
  assert.deepEqual(b[0], { kind: "table", header: ["Kennzahl", "Wert"], rows: [["Aufträge pro Tag", "180"], ["Diesel", "600 €"]], widths: [70, 30] });
});

test("risks are listed worst first, with the counter-measure in its own column", () => {
  const [t] = visualBlocks("agxp-risks", "klein | gering | gering | nichts\ngroß | hoch | hoch | Pilot\nmittel | mittel | hoch | Schulung");
  assert.equal(t.kind, "table");
  if (t.kind === "table") {
    assert.deepEqual(t.rows.map(r => r[0]), ["groß", "mittel", "klein"]);
    assert.equal(t.rows[0][3], "Pilot");
  }
});

test("the summary uses its labels, including the risk and the potential", () => {
  const [t] = visualBlocks("agxp-summary", "Was | a\nWarum | b\nMehrwert | c\nRisiko | d\nPotenzial | e");
  assert.equal(t.kind, "table");
  if (t.kind === "table") assert.deepEqual(t.rows.map(r => r[0]), ["Was wir tun", "Warum", "Erwarteter Mehrwert", "Größtes Risiko", "Größtes Potenzial"]);
});

test("the lexicon becomes a heading per theme, its meaning, then the terms", () => {
  const b = visualBlocks("agxp-lexicon", "Software | * | Alles, was läuft\nSoftware | React | Baukasten\nSoftware | API | Schnittstelle");
  assert.deepEqual(b.map(x => x.kind), ["label", "para", "table"]);
});

test("the gap table takes a fifth column for the action plan, one step per line", () => {
  const [t] = visualBlocks("agxp-diff", "Fähigkeiten | wenig | viel | Schulung | 1. Kurs ; 2. Bauen");
  assert.equal(t.kind, "table");
  if (t.kind === "table") {
    assert.equal(t.header?.length, 5);
    assert.equal(t.rows[0][4], "1. Kurs\n2. Bauen");
  }
});

test("an empty or unknown block never throws", () => {
  assert.deepEqual(visualBlocks("agxp-kpi", ""), []);
  assert.deepEqual(parseDoc("```agxp-swot\n\n```"), []);
  assert.equal(parseDoc("```agxp-unknown\nx\n```")[0].kind, "code");
});
