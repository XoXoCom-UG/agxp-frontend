import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDocVisual } from "./doc-visuals.ts";

const body = [
  "Software | * | Alles, was auf dem Rechner läuft",
  "Software | React | Baukasten für Oberflächen",
  "Software | API | Schnittstelle zwischen Programmen",
  "Infrastruktur | Hosting | Der Server der Anwendung",
].join("\n");

test("a theme row explains the theme under its heading", () => {
  const html = renderDocVisual("agxp-lexicon", body) ?? "";
  assert.match(html, /<h4>Software<\/h4><p class="v-lex-about">Alles, was auf dem Rechner läuft<\/p>/);
});

test("the theme row is not a term, and is not counted as one", () => {
  const html = renderDocVisual("agxp-lexicon", body) ?? "";
  assert.doesNotMatch(html, /<dt>\*<\/dt>/);
  assert.match(html, /3 Begriffe/);
});

test("a theme the model did not explain simply has no line", () => {
  const html = renderDocVisual("agxp-lexicon", body) ?? "";
  const infra = html.slice(html.indexOf("<h4>Infrastruktur</h4>"));
  assert.doesNotMatch(infra.slice(0, 80), /v-lex-about/);
});

test("a lexicon of only theme rows draws nothing", () => {
  assert.equal(renderDocVisual("agxp-lexicon", "Software | * | Nur eine Erklärung"), null);
});

test("the level is a badge with dots for the stage", () => {
  const e = renderDocVisual("agxp-level", "Einsteiger | Noch nie eine App gebaut") ?? "";
  assert.match(e, /v-level l1/);
  assert.match(e, /<b class="badge">Einsteiger<\/b>/);
  assert.match(e, /Noch nie eine App gebaut/);
  assert.match(renderDocVisual("agxp-level", "Fortgeschritten | x") ?? "", /l2/);
  assert.match(renderDocVisual("agxp-level", "Experte | x") ?? "", /l3/);
  assert.match(renderDocVisual("agxp-level", "Expert | x") ?? "", /l3/);
});

test("the management summary is three labelled rows", () => {
  const html = renderDocVisual("agxp-summary",
    "Was | Wir bauen ein Tool.\nWarum | Heute dauert es zwölf Minuten.\nMehrwert | Unter drei Minuten.") ?? "";
  assert.equal((html.match(/class="v-sum-row"/g) ?? []).length, 3);
  assert.match(html, /<span class="k">Was wir tun<\/span><p>Wir bauen ein Tool\.<\/p>/);
  assert.match(html, /Erwarteter Mehrwert/);
});

test("a summary row with no text is dropped, and an empty summary draws nothing", () => {
  assert.equal((renderDocVisual("agxp-summary", "Was | a\nWarum | ") ?? "").match(/v-sum-row"/g)?.length, 1);
  assert.equal(renderDocVisual("agxp-summary", ""), null);
});

test("the gap table takes an action plan as a fifth column", () => {
  const html = renderDocVisual("agxp-diff",
    "Fähigkeiten | niemand kennt React | zwei Entwickler | Schulung | 1. Kurs ; 2. Bildschirm bauen") ?? "";
  assert.match(html, /v-diff has-plan/);
  assert.match(html, /<span>Aktionsplan<\/span>/);
  assert.match(html, /<ol class="plan"><li>Kurs<\/li><li>Bildschirm bauen<\/li><\/ol>/);
});

test("without a fifth column the gap table is what it was", () => {
  const html = renderDocVisual("agxp-diff", "Menschen | 5 Disponenten | Produktowner benannt | Rolle unbesetzt") ?? "";
  assert.doesNotMatch(html, /has-plan/);
  assert.doesNotMatch(html, /Aktionsplan/);
  assert.match(html, /<span class="lack">Rolle unbesetzt<\/span>/);
});
