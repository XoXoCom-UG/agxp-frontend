/**
 * Testfälle — runs the scenarios through the real agent and writes a page to
 * read.
 *
 *   node --experimental-strip-types scripts/testfaelle.mjs
 *   node --experimental-strip-types scripts/testfaelle.mjs --only elektro
 *   node --experimental-strip-types scripts/testfaelle.mjs --role coach
 *
 * It spends real money: a full interview is eight turns and the history is
 * resent each time, so about $0.55-0.70 per scenario on Sonnet 5. The script
 * prints the bill at the end and refuses to start without a key.
 *
 * It imports lib/agent-prompt.ts, which is the same module the API route
 * uses. That is the whole point — a runner with its own copy of the prompt
 * tests the runner.
 *
 * What it is NOT: a pass/fail suite. The model answers differently every
 * run, so there is nothing to assert about the words. The structural checks
 * at the top of each report are assertions (did it emit a lexicon block at
 * all); the quality is for a person to read, which is exactly what Patryk
 * asked for on 2026-09-25.
 */

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { SCENARIOS, PURPOSE } from "./scenarios.mjs";
import { systemPrompt } from "../lib/agent-prompt.ts";
import { DELIVERABLES } from "../lib/deliverables.ts";
import { parseMarkers, looksLikeDocument } from "../lib/message-markers.ts";
import { md } from "../lib/markdown.ts";

const MODEL = "claude-sonnet-5";
/** Sonnet 5, dollars per million tokens. Cache reads are a tenth of input. */
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 };

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; };
const only = arg("--only");
const role = arg("--role") ?? "consultant";
/**
 * --dry writes the page from a canned document instead of calling the API.
 * It proves the report and the rendering before a run spends anything, and
 * it is how you check a change to this script without paying for it.
 */
const dry = argv.includes("--dry");

const key = process.env.ANTHROPIC_API_KEY;
if (!key && !dry) {
  console.error("ANTHROPIC_API_KEY is not set. This script calls the real API and costs real money.");
  console.error("Run it with --dry to check the report format without spending anything.");
  process.exit(1);
}
const anthropic = key ? new Anthropic({ apiKey: key }) : null;
const deliverable = DELIVERABLES[role];
const cases = SCENARIOS.filter(s => !only || s.id === only);
if (!cases.length) {
  console.error(`No scenario matches --only ${only}. Known: ${SCENARIOS.map(s => s.id).join(", ")}`);
  process.exit(1);
}

const spend = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/** A deliberately imperfect document, so --dry shows what a FAILING report
 *  looks like rather than a reassuring all-green one: SWOT has three fields
 *  instead of four, and one risk has no countermeasure. */
const DRY_REPLY = (messages) => {
  const asked = messages.filter(m => m.role === "user").length;
  if (asked <= SCENARIOS[0].answers.length) {
    return `Verstanden. Und wie oft passiert das pro Woche?\n\n[[TOPIC: ${asked}/8 Pain points]]\n[[PROGRESS: ${asked * 12}]]`;
  }
  return [
    "[[DOC: Transformation Concept]]",
    "# Transformation Concept", "",
    "## Lexikon", "",
    "- Geschäftshypothese: Zettel digital erfassen spart zwei Wochen pro Auftrag.",
    "- Verwendung: Grundlage für die Entscheidung über die mobile Erfassung.", "",
    "```agxp-lexicon",
    "Software | API | Schnittstelle, über die zwei Programme Daten austauschen",
    "Prozess | Aufmaß | Die Messung der geleisteten Arbeit auf der Baustelle",
    "Prozess | DGUV V3 | Die vorgeschriebene Prüfung elektrischer Betriebsmittel",
    "```", "",
    "## Management Summary", "",
    "Der Betrieb verliert jede Woche sechs bis acht Aufmaßzettel, und zwischen der Arbeit auf der Baustelle und der Rechnung vergehen im Schnitt neunzehn Tage. Im vergangenen Jahr blieben dadurch rund 40.000 Euro unabgerechnet. Empfohlen wird die mobile Erfassung direkt auf der Baustelle. Dafür braucht es Firmengeräte für die verbleibenden 22 Monteure und eine Schnittstelle zur vorhandenen Software. Bleibt alles wie es ist, wächst der Verlust mit jedem Auftrag.", "",
    "## Auf einen Blick", "",
    "```agxp-glance",
    "Kernproblem | Aufmaße entstehen auf Papier und gehen verloren",
    "Beschreibung | 6 bis 8 Zettel pro Woche fehlen",
    "Benötigte Technologien | Mobile Erfassung; API",
    "Empfohlene Richtung | Erfassung an die Baustelle verlagern",
    "```", "",
    "**Zwei Drittel der Durchlaufzeit entstehen, bevor jemand an der Rechnung arbeitet.**", "",
    "- Der Zettel liegt vier Tage in der Jackentasche, länger als der Rechnungslauf dauert.", "",
    "## Gap-Analyse", "",
    "```agxp-diff",
    "Reifegrad | Papier und Excel | ein System von Baustelle bis Rechnung | keine Kette",
    "Technologien | Outlook, Excel | mobile Erfassung mit API | Schnittstelle ungeklärt",
    "Menschen | 9 von 31 mit Firmenhandy | alle 31 | 22 Geräte fehlen",
    "```", "",
    "**Die Technologielücke ist eine Frage an einen Anbieter, die Gerätelücke eine ans Budget.**", "",
    "- Ohne Schnittstelle wird aus der Erfassung ein zweites System, das jemand abtippt.", "",
    "## SWOT", "",
    "```agxp-swot",
    "stärken: Bauleiter treibt es selbst; Budget steht",
    "schwächen: kein Entwickler im Haus",
    "risiken: Schnittstelle hängt am Hersteller",
    "```", "",
    "## Risiken", "",
    "```agxp-risks",
    "Schnittstelle wird nicht freigegeben | hoch | hoch | Früh mit dem Anbieter klären",
    "Ältere Monteure machen nicht mit | mittel | mittel",
    "```", "",
    "[[CHOICES: Tools vertiefen|Maßnahmen schärfen|So lassen]]",
  ].join("\n");
};

/** One turn, with the same two-block caching layout the route uses. */
async function ask(messages) {
  if (dry) return { text: DRY_REPLY(messages), truncated: false };
  const sys = systemPrompt(role, role === "coach" ? "Lena Vogt" : "Markus Feld", [], { level: "New", projects: 0 }, null);
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 24_000,
    system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
    messages,
  });
  const u = res.usage;
  spend.input += u.input_tokens ?? 0;
  spend.output += u.output_tokens ?? 0;
  spend.cacheRead += u.cache_read_input_tokens ?? 0;
  spend.cacheWrite += u.cache_creation_input_tokens ?? 0;
  const text = res.content.filter(b => b.type === "text").map(b => b.text).join("");
  return { text, truncated: res.stop_reason === "max_tokens" };
}

/**
 * The structural report: the part that makes this readable in five seconds.
 * Everything here is countable, so a regression shows up as a number
 * changing rather than as a feeling that the document got worse.
 */
function inspect(docText) {
  const p = parseMarkers(docText);
  const body = p.text;
  const block = (name) => (body.match(new RegExp("```" + name + "\\n([\\s\\S]*?)```", "g")) ?? []);
  const rowsIn = (name) => block(name).reduce((n, b) =>
    n + b.split("\n").filter(l => l.includes("|") && !l.startsWith("```")).length, 0);

  const sections = (body.match(/^##\s+(.+)$/gm) ?? []).map(h => h.replace(/^##\s+/, "").trim());
  const expected = deliverable.sections.map(s => s.title);
  const missing = expected.filter(t => !sections.some(s => s.startsWith(t)));

  const bullets = (body.match(/^[-*]\s+\S/gm) ?? []).length;
  const leads = (body.match(/^\*\*[^*]+\*\*\s*$/gm) ?? []).length;
  const openPoints = (body.match(/offen:/gi) ?? []).length;
  const emptyBlocks = ["agxp-lexicon", "agxp-glance", "agxp-diff", "agxp-swot", "agxp-risks", "agxp-kpi"]
    .filter(n => block(n).length && rowsIn(n) === 0);

  return {
    words: body.split(/\s+/).filter(Boolean).length,
    sections: sections.length,
    missing,
    lexiconTerms: rowsIn("agxp-lexicon"),
    lexiconThemes: new Set(block("agxp-lexicon").join("\n").split("\n")
      .filter(l => l.includes("|")).map(l => l.split("|")[0].trim())).size,
    glanceRows: rowsIn("agxp-glance"),
    gapRows: rowsIn("agxp-diff"),
    swotFields: block("agxp-swot").join("\n").split("\n").filter(l => l.includes(":")).length,
    riskRows: rowsIn("agxp-risks"),
    riskWithFix: block("agxp-risks").join("\n").split("\n")
      .filter(l => l.split("|").length >= 4 && l.split("|")[3].trim()).length,
    bullets, leads, openPoints, emptyBlocks,
    hasSummary: /^##\s+Management Summary/m.test(body),
    summaryWords: (body.match(/^##\s+Management Summary\n+([\s\S]*?)(?=\n##\s)/m)?.[1] ?? "")
      .split(/\s+/).filter(Boolean).length,
  };
}

function verdictRows(r) {
  const ok = (good) => good ? "ok" : "bad";
  return [
    ["Sektionen", `${r.sections} von ${deliverable.sections.length}`, ok(r.missing.length === 0)],
    ["Fehlend", r.missing.length ? r.missing.join(", ") : "—", ok(r.missing.length === 0)],
    ["Management Summary", r.hasSummary ? `${r.summaryWords} Wörter` : "fehlt", ok(r.hasSummary && r.summaryWords >= 60)],
    ["Lexikon", `${r.lexiconTerms} Begriffe in ${r.lexiconThemes} Themen`, ok(r.lexiconTerms >= 3 && r.lexiconThemes >= 2)],
    ["Auf einen Blick", `${r.glanceRows} Zeilen`, ok(r.glanceRows >= 3)],
    ["Gap-Tabelle", `${r.gapRows} Zeilen`, ok(r.gapRows >= 3)],
    ["SWOT", `${r.swotFields} von 4 Feldern`, ok(r.swotFields === 4)],
    ["Risiken", `${r.riskRows}, davon ${r.riskWithFix} mit Gegenmaßnahme`, ok(r.riskRows > 0 && r.riskWithFix === r.riskRows)],
    ["Einordnungssätze", String(r.leads), ok(r.leads >= 4)],
    ["Bullets", String(r.bullets), ok(r.bullets >= 20)],
    ["Offene Punkte", String(r.openPoints), "info"],
    ["Leere Blöcke", r.emptyBlocks.length ? r.emptyBlocks.join(", ") : "keine", ok(r.emptyBlocks.length === 0)],
    ["Länge", `${r.words} Wörter`, "info"],
  ];
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function run(scenario) {
  process.stdout.write(`\n${scenario.id}: `);
  const messages = [];
  const transcript = [];

  for (const answer of scenario.answers) {
    messages.push({ role: "user", content: answer });
    transcript.push({ who: "user", text: answer });
    const { text } = await ask(messages);
    messages.push({ role: "assistant", content: text });
    transcript.push({ who: "agent", text: parseMarkers(text).text });
    process.stdout.write(".");
  }

  messages.push({ role: "user", content: deliverable.generatePrompt });
  const { text: docText, truncated } = await ask(messages);
  process.stdout.write("D");

  const p = parseMarkers(docText);
  const isDoc = !!p.doc || looksLikeDocument(p.text, deliverable.title);
  return { scenario, transcript, docText, isDoc, truncated, report: inspect(docText) };
}

const results = [];
for (const s of cases) results.push(await run(s));

const cost =
  (spend.input / 1e6) * PRICE.input +
  (spend.output / 1e6) * PRICE.output +
  (spend.cacheRead / 1e6) * PRICE.cacheRead +
  (spend.cacheWrite / 1e6) * PRICE.cacheWrite;

const css = fs.readFileSync(path.join(process.cwd(), "app", "agxp-design.css"), "utf8");
const tokens = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8")
  .replace(/@tailwind[^;]*;\n?/g, "");

const html = `<!doctype html>
<html lang="de" class="dark"><head><meta charset="utf-8">
<title>Testfälle · ${esc(new Date().toISOString().slice(0, 16).replace("T", " "))}</title>
<style>${tokens}\n${css}
  body{margin:0;background:var(--background)}
  .tf{max-width:900px;margin:0 auto;padding:34px}
  .tf-head{margin-bottom:34px}
  .tf-head h1{font-family:var(--font-display,sans-serif);font-size:30px;font-weight:600;letter-spacing:-.03em;margin:0 0 8px}
  .tf-head p{color:var(--text-secondary);font-size:14px;line-height:1.6;margin:0 0 6px;max-width:66ch}
  .tf-cost{font-family:var(--font-mono,monospace);font-size:11px;color:var(--text-muted);letter-spacing:.06em}
  .tf-case{margin:44px 0;padding-top:26px;border-top:1px solid var(--border)}
  .tf-case h2{font-family:var(--font-display,sans-serif);font-size:23px;font-weight:600;letter-spacing:-.03em;margin:0 0 4px}
  .tf-why{color:var(--text-muted);font-size:12.5px;margin:0 0 18px}
  table.tf-rep{width:100%;border-collapse:collapse;margin-bottom:22px;font-size:12.5px}
  table.tf-rep td{padding:7px 10px;border-top:1px solid var(--border)}
  table.tf-rep td:first-child{color:var(--text-muted);width:190px}
  table.tf-rep tr.bad td{background:color-mix(in srgb,var(--destructive) 12%,transparent)}
  table.tf-rep tr.bad td:last-child{color:var(--destructive);font-weight:600}
  table.tf-rep tr.ok td:last-child{color:var(--success)}
  .tf-flag{display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;margin-bottom:14px;
    background:color-mix(in srgb,var(--destructive) 16%,transparent);color:var(--destructive)}
  details.tf-tr{margin-top:26px;border-top:1px dashed var(--border);padding-top:14px}
  details.tf-tr summary{cursor:pointer;font-size:12.5px;color:var(--text-muted)}
  .tf-turn{margin:14px 0;font-size:13px;line-height:1.65}
  .tf-turn.user{color:var(--foreground);padding-left:14px;border-left:2px solid var(--primary-soft)}
  .tf-turn.agent{color:var(--text-secondary)}
</style></head><body><div class="app" style="position:relative;overflow:hidden;height:auto;min-height:0"><div class="tf">

<div class="tf-head">
  <h1>Testfälle</h1>
  <p>${esc(PURPOSE)}</p>
  <p class="tf-cost">${esc(new Date().toLocaleString("de-DE"))} · ${esc(role)} · ${results.length} Szenarien ·
    ${spend.input.toLocaleString("de-DE")} in / ${spend.output.toLocaleString("de-DE")} out ·
    ${spend.cacheRead.toLocaleString("de-DE")} aus dem Cache · ${cost.toFixed(2)} USD</p>
</div>

${results.map(r => `
<section class="tf-case">
  <h2>${esc(r.scenario.title)}</h2>
  <p class="tf-why">${esc(r.scenario.why)}</p>
  ${r.truncated ? '<span class="tf-flag">Abgeschnitten — max_tokens erreicht</span>' : ""}
  ${r.isDoc ? "" : '<span class="tf-flag">Keine Dokument-Antwort — der DOC-Marker fehlt</span>'}
  <table class="tf-rep"><tbody>
    ${verdictRows(r.report).map(([k, v, s]) =>
      `<tr class="${s}"><td>${esc(k)}</td><td>${esc(v)}</td><td>${s === "ok" ? "ok" : s === "bad" ? "prüfen" : ""}</td></tr>`).join("")}
  </tbody></table>
  <div class="doc-body">${md(parseMarkers(r.docText).text)}</div>
  <details class="tf-tr"><summary>Gesprächsverlauf (${r.transcript.length} Beiträge)</summary>
    ${r.transcript.map(t => `<div class="tf-turn ${t.who}">${esc(t.text)}</div>`).join("")}
  </details>
</section>`).join("")}

</div></div></body></html>`;

const out = path.join(process.cwd(), "testfaelle.html");
fs.writeFileSync(out, html, "utf8");
console.log(`\n\nGeschrieben: ${out}`);
console.log(`Kosten dieses Laufs: ${cost.toFixed(2)} USD`);
for (const r of results) {
  const bad = verdictRows(r.report).filter(([, , s]) => s === "bad");
  console.log(` ${r.scenario.id}: ${bad.length ? bad.map(b => b[0]).join(", ") : "alles im Rahmen"}`);
}
