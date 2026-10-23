import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDocVisual, VISUAL_BLOCKS } from "./doc-visuals.ts";
import { BLOCK_SPECS } from "./visual-specs.ts";
import { md } from "./markdown.ts";
import { cellMarkup, headerClass } from "./table-cells.ts";
import { visualBlocks } from "./doc-blocks.ts";
import { semi } from "./doc-diagrams.ts";

/** What md() hands the renderers: the whole message is escaped first, `>` included. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const draw = (kind: string, body: string) => renderDocVisual(kind, esc(body));

/** The fenced example inside each spec in lib/visual-specs.ts. */
const examples = Object.entries(BLOCK_SPECS).map(([kind, spec]) => {
  const m = spec.match(/```[\w-]+\n([\s\S]*?)\n```/);
  assert.ok(m, `${kind} has an example`);
  return [kind, m![1]] as const;
});

test("every example the prompt shows the agent renders to a picture", () => {
  for (const [kind, body] of examples) {
    const html = draw(kind, body);
    assert.ok(html && html.length > 80, `${kind} draws nothing from its own example`);
    // And in the Word export it becomes something, not a code dump.
    // (the wireframe has no table to become: it goes into the Word file as a text sketch)
    if (kind !== "agxp-mock") assert.notEqual(visualBlocks(kind, body)[0]?.kind, "code", `${kind} has a Word fallback`);
  }
});

test("every new block has a spec, and every spec has a renderer", () => {
  for (const k of Object.keys(BLOCK_SPECS)) assert.ok(VISUAL_BLOCKS.includes(k), k);
  for (const k of ["agxp-quadrant", "agxp-graph", "agxp-sequence", "agxp-journey", "agxp-gantt", "agxp-timeline", "agxp-moscow",
    "agxp-cards", "agxp-canvas", "agxp-checklist", "agxp-okr", "agxp-debate", "agxp-mock"]) {
    assert.ok(k in BLOCK_SPECS, `${k} has a spec`);
  }
});

test("input that cannot be drawn gives nothing, so md() shows it as code instead of a broken picture", () => {
  for (const [kind] of examples) {
    assert.equal(draw(kind, ""), null, `${kind}: empty`);
    // A wireframe and a checklist are one line per entry, so one line is already a picture.
    if (kind !== "agxp-mock" && kind !== "agxp-checklist") assert.equal(draw(kind, "nur ein Satz ohne Struktur"), null, `${kind}: prose`);
  }
});

test("text from the model never becomes markup, in any picture", () => {
  const evil = `<img src=x onerror=alert(1)>`;
  const bodies: Record<string, string> = {
    "agxp-quadrant": `${evil} | 40 | 60`,
    "agxp-graph": `A: ${evil} | box\nB: x\nA -> B : ${evil}`,
    "agxp-sequence": `${evil} | B\n${evil} -> B : ${evil}`,
    "agxp-journey": `${evil} | ${evil} | 3 ${evil} | H | ${evil}`,
    "agxp-gantt": `${evil} | ${evil} | 1 | 2`,
    "agxp-timeline": `${evil} | ${evil} | ${evil} | ${evil} | ${evil}`,
    "agxp-moscow": `Must | ${evil}`,
    "agxp-cards": `${evil}\n${evil} | ${evil}`,
    "agxp-canvas": `Problem | ${evil}\nLösung | ${evil}\nKunde | ${evil}`,
    "agxp-checklist": `[x] ${evil} | ${evil} | ${evil}`,
    "agxp-okr": `Objective: ${evil}\n${evil} | ${evil} | ${evil} | 50`,
    "agxp-debate": `Entscheidung: ${evil}\nDafür | ${evil}\nDagegen | ${evil}\nWahl | ${evil} | ${evil}`,
    "agxp-mock": `${evil}\n-> ${evil}`,
  };
  for (const [kind, body] of Object.entries(bodies)) {
    const html = draw(kind, body);
    assert.ok(html, kind);
    // The text is still there, but as text: no tag was opened by it.
    assert.doesNotMatch(html!, /<img|<script|<svg[^>]*onload/i, kind);
  }
  assert.doesNotMatch(md("| a | b |\n|---|---|\n| <b>x</b> | H |"), /<b>x/);
});

test("the quadrant puts a point where its numbers say, and names the four fields", () => {
  const html = draw("agxp-quadrant", "x: Gering | Hoch\ny: Gering | Hoch\nq: A | B | C | D\nP | 100 | 100\nQ | 0 | 0") ?? "";
  assert.match(html, />A</); assert.match(html, />D</);
  const cx = [...html.matchAll(/class="q-dot" cx="([\d.]+)" cy="([\d.]+)"/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.equal(cx.length, 2);
  // the high point is right of and above the low one (SVG y grows downwards)
  assert.ok(cx[0][0] > cx[1][0] && cx[0][1] < cx[1][1]);
});

test("the graph ranks nodes along the arrows and draws a loop under the nodes", () => {
  const html = draw("agxp-graph", "A: Eins\nB: Zwei\nC: Drei\nA -> B\nB -> C\nC -> A : again") ?? "";
  const xs = [...html.matchAll(/<rect class="g-node box" x="(\d+)"/g)].map(m => Number(m[1]));
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b), "A, B, C run left to right");
  assert.equal(new Set(xs).size, 3);
  assert.match(html, /again/);
  assert.match(html, /marker-end="url\(#agx-arr\)"/);
});

test("a red edge, a dashed edge and every node shape are drawn", () => {
  const html = draw("agxp-graph",
    "A: a | db | warn\nB: b | model | ok\nC: c | decision\nD: d | goal\nE: e | person\nF: f | group\n" +
    "A -> B : x | red\nB --> C\nC -> D\nD -> E\nE -> F") ?? "";
  assert.match(html, /g-edge red/); assert.match(html, /g-edge dashed/);
  for (const shape of ["db", "model", "decision", "goal", "person", "group"]) assert.match(html, new RegExp(`g-node ${shape}`), shape);
  assert.match(html, /t-warn/);
});

test("a graph in TB direction stacks its ranks downwards", () => {
  const html = draw("agxp-graph", "dir: TB\nA: a\nB: b\nA -> B") ?? "";
  const ys = [...html.matchAll(/<rect class="g-node box" x="\d+" y="(\d+)"/g)].map(m => Number(m[1]));
  assert.ok(ys[1] > ys[0]);
});

test("a graph too large to read is not drawn", () => {
  const nodes = Array.from({ length: 30 }, (_, i) => `N${i}: n${i}`).join("\n");
  assert.equal(draw("agxp-graph", nodes), null);
});

test("the sequence names its lanes, frames the loop and marks automated steps", () => {
  const html = draw("agxp-sequence", "Host | System | Player\nHost -> System : go\nloop: 10 rounds\nSystem -> Player : clip *\nend") ?? "";
  assert.match(html, /s-frame/); assert.match(html, /loop · 10 rounds/); assert.match(html, /⚙/);
  assert.equal((html.match(/class="s-life"/g) ?? []).length, 3);
});

test("the journey puts the mood of every stage on the curve", () => {
  const html = draw("agxp-journey", "A | a | 5 | L\nB | b | 1 schlecht | H | fix") ?? "";
  assert.match(html, /j-pt m5/); assert.match(html, /j-pt m1/);
  assert.match(html, /Abbruchrisiko hoch/); assert.match(html, /schlecht/);
  assert.equal(draw("agxp-journey", "A | a | kein Wert"), null);
});

test("the gantt places bars by their start and end, and draws a milestone as a diamond", () => {
  const html = draw("agxp-gantt", "unit: Monat\nA | x | 1 | 2\nA | gate | 4 | 4 | milestone\nB | y | 3 | 4") ?? "";
  assert.match(html, /--n:4/);
  assert.match(html, /g-bar[^"]*" style="left:0%;width:50%"/);
  assert.match(html, /g-ms/);
  assert.match(html, /Monat 1/);
});

test("the MoSCoW always has four columns, and an apostrophe does not split a word", () => {
  const html = draw("agxp-moscow", "Must | a; b\nWon't | Won't do; c") ?? "";
  assert.equal((html.match(/class="m-col /g) ?? []).length, 4);
  assert.match(html, /<li>Won&#39;t do<\/li>/);
  assert.deepEqual(semi("Won&#39;t; c"), ["Won&#39;t", "c"]);
});

test("cards: a blank line starts the next card, `;` makes a list, a tone colours the head", () => {
  const html = draw("agxp-cards", "Eins\nA | x; y\n\nZwei | bad\nB | z") ?? "";
  assert.equal((html.match(/<article/g) ?? []).length, 2);
  assert.match(html, /<ul><li>x<\/li><li>y<\/li><\/ul>/);
  assert.match(html, /c-card t-bad/);
});

test("the lean canvas puts each block in its place and shows a missing one as a gap", () => {
  const html = draw("agxp-canvas", "Problem | p\nKunde | k\nAlleinstellung | u\nEinnahmen | Unbekannt") ?? "";
  for (const area of ["problem", "solution", "uvp", "advantage", "customer", "metrics", "channels", "costs", "revenue"]) assert.match(html, new RegExp(`cv-${area}`), area);
  assert.match(html, /cv-revenue unknown/);
  assert.equal(draw("agxp-canvas", "Problem | nur einer"), null);
});

test("OKR progress is clamped, the checklist keeps what is done, the debate needs both sides", () => {
  assert.match(draw("agxp-okr", "Objective: O\nK | M1 | Ana | 250") ?? "", /width:100%/);
  assert.match(draw("agxp-checklist", "[x] a | alle | Dev\n[ ] b") ?? "", /class="done"/);
  assert.equal(draw("agxp-debate", "Entscheidung: E\nDafür | a; b; c"), null);
  assert.match(draw("agxp-debate", "Entscheidung: E\nDafür | a\nDagegen | b\nWahl | offen") ?? "", /d-choice open/);
  assert.match(draw("agxp-debate", "Entscheidung: E\nDafür | a\nDagegen | b\nWahl | Nein | Frist") ?? "", /d-choice set/);
});

/* ------------------------------ table cells ------------------------------ */

test("a table cell that is a mark of the method sheet becomes that mark; any other stays text", () => {
  assert.match(cellMarkup("■■□□□ 2", "Aktuell") ?? "", /c-meter[\s\S]*on[\s\S]*<b class="c-n">2<\/b>/);
  assert.match(cellMarkup("40 %", "Baseline") ?? "", /width:40%/);
  assert.match(cellMarkup("94 %", "Übereinstimmung %") ?? "", /c-bar good/);
  assert.match(cellMarkup("72 %", "Übereinstimmung %") ?? "", /c-bar bad/);
  assert.match(cellMarkup("▼ −2", "Trend") ?? "", /c-trend down/);
  assert.match(cellMarkup("ja", "Labels?") ?? "", /c-chip good/);
  assert.match(cellMarkup("Must", "Priorität") ?? "", /c-chip bad/);
  assert.match(cellMarkup("Won&#39;t", "MoSCoW") ?? "", /c-chip muted/);
  assert.match(cellMarkup("geeignet — Lizenz-API", "Buy") ?? "", /c-chip good[\s\S]*c-rest[\s\S]*Lizenz-API/);
  assert.match(cellMarkup("15", "Score") ?? "", /c-heat bad/);
  assert.equal(cellMarkup("Clip startet in 2 s", "Messgröße"), null);
  assert.equal(cellMarkup("", "x"), null);
  assert.equal(cellMarkup("15", "Häufigkeit (1-5)"), null);
});

test("H, M and L take their colour from what high means in that column", () => {
  assert.match(cellMarkup("H", "Auswirkung (H/M/L)") ?? "", /c-chip bad/);
  assert.match(cellMarkup("L", "Auswirkung (H/M/L)") ?? "", /c-chip good/);
  assert.match(cellMarkup("H", "Qualität (H/M/L)") ?? "", /c-chip good/);
  assert.match(cellMarkup("L", "Erklärbarkeit") ?? "", /c-chip bad/);
  assert.match(cellMarkup("M", "Aufwand") ?? "", /c-chip warn/);
  // a legacy system is the one place a yes is bad news
  assert.match(cellMarkup("ja", "Legacy?") ?? "", /c-chip bad/);
  assert.match(cellMarkup("nein", "Legacy?") ?? "", /c-chip good/);
});

test("the header cells of as-is / to-be and of the two variants are told apart", () => {
  assert.equal(headerClass("As-Is"), "th-asis");
  assert.equal(headerClass("To-Be"), "th-tobe");
  assert.equal(headerClass("Variante A"), "th-a");
  assert.equal(headerClass("Variante B"), "th-b");
  assert.equal(headerClass("Deine Idee"), "th-star");
  assert.equal(headerClass("Ziel"), "");
});

test("md() draws the marks inside a table and a quote as a quote", () => {
  const html = md("| Risiko | Auswirkung (H/M/L) | Status |\n|---|---|---|\n| Daten | H | offen |\n| Text | – | frei |\n\n> \"Zwei Studenten\" schaffen es");
  assert.match(html, /<td class="has-mark"><span class="c-chip bad">/);
  assert.match(html, /<td>Text<\/td><td>–<\/td><td>frei<\/td>/);
  assert.match(html, /<blockquote class="md-quote">&quot;Zwei Studenten&quot; schaffen es<\/blockquote>/);
});

test("md() turns a fenced picture into the picture and an unknown fence into code", () => {
  assert.match(md("```agxp-moscow\nMust | a\n```"), /v-moscow/);
  assert.match(md("```agxp-nope\nx\n```"), /md-code/);
});
