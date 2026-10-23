/**
 * doc-layouts.ts — the rest of the method sheet's pictures, drawn in HTML and CSS.
 *
 * doc-diagrams.ts has the three that need coordinates (quadrant, graph,
 * sequence). These are the ones that are layouts rather than drawings:
 *
 *   agxp-journey    the user's path, a face per stage          (User Journey)
 *   agxp-gantt      bars on a time axis                        (Roadmap, Build-Measure-Learn)
 *   agxp-timeline   messages above and below an axis           (Training & Communication Plan)
 *   agxp-moscow     Must / Should / Could / Won't              (MVP Scope)
 *   agxp-cards      one card per item                          (Personas, Model Card, Canvas, Scenarios, Hiring)
 *   agxp-canvas     the lean canvas, nine blocks in place      (Lean Canvas)
 *   agxp-checklist  a checklist with who checks what           (Definition of Done)
 *   agxp-okr        objectives with key results and progress   (OKRs)
 *   agxp-debate     for, against, and the user's choice        (Consultant-Coach Debate)
 *   agxp-mock       a wireframe with one fake door             (Fake Door Test)
 *
 * Same contract as doc-visuals.ts: the body arrives HTML-escaped, nothing is added
 * to the markup but numbers computed here and fixed class names, and every
 * renderer returns "" for input it cannot draw (md() then shows a plain code block).
 */
import { semi } from "./doc-diagrams.ts";

const lines = (body: string) => body.split("\n").map(l => l.trim()).filter(Boolean);
const cells = (l: string) => l.split("|").map(c => c.trim());
const num = (s: string): number => {
  const m = (s ?? "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const f = (n: number) => Math.round(n * 10) / 10;

/** high / medium / low in either language, or H / M / L → 2 | 1 | 0, or -1 for anything else. */
function level3(w: string): number {
  const s = (w || "").trim().toLowerCase();
  if (/^(h|hoch|high)$/.test(s)) return 2;
  if (/^(m|mittel|medium)$/.test(s)) return 1;
  if (/^(l|gering|niedrig|low)$/.test(s)) return 0;
  return -1;
}

/* ================================ JOURNEY ============================== */

/** A face: a circle, two eyes, and a mouth that bends with the mood (1 low, 5 high). */
const face = (m: number) => {
  const c = f(12.5 + (m - 3) * 2.4);
  return `<svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true"><circle class="j-face" cx="10" cy="10" r="9"/>` +
    `<circle class="j-eye" cx="7" cy="8" r="1"/><circle class="j-eye" cx="13" cy="8" r="1"/>` +
    `<path class="j-mouth" d="M6 12.5Q10 ${c} 14 12.5"/></svg>`;
};

/**
 * `agxp-journey` — `Stufe | Nutzeraktion | Gefühl | Abbruchrisiko | Lösung`.
 *
 * Gefühl is a number from 1 (bad) to 5 (good), with an optional word after it
 * (`2 genervt`). The faces sit on a line, so the dip in the middle of the path
 * is visible before anything is read.
 */
export function journey(body: string): string {
  const rows = lines(body).map(cells).filter(r => r[0] && isFinite(num(r[2] ?? "")));
  if (!rows.length || rows.length > 9) return "";
  const n = rows.length;
  const mood = rows.map(r => clamp(Math.round(num(r[2])), 1, 5));
  const pos = (i: number) => ({ x: ((i + 0.5) / n) * 100, y: 88 - ((mood[i] - 1) / 4) * 76 });
  const poly = mood.map((_, i) => `${f(pos(i).x)},${f(pos(i).y)}`).join(" ");
  const faces = mood.map((m, i) =>
    `<span class="j-pt m${m}" style="left:${f(pos(i).x)}%;top:${f(pos(i).y)}%" title="${rows[i][2]}">${face(m)}</span>`).join("");
  const cards = rows.map((r, i) => {
    const risk = level3(r[3] ?? "");
    const word = (r[2] ?? "").replace(/^[\d.,\s]+/, "");
    return `<div class="j-stage s${i % 4}"><b class="j-name">${r[0]}</b>` +
      `<p class="j-act">${r[1] ?? ""}</p>` +
      (word ? `<span class="j-feel">${word}</span>` : "") +
      (risk >= 0 ? `<span class="j-risk r${risk}">Abbruchrisiko ${["gering", "mittel", "hoch"][risk]}</span>` : "") +
      (r.slice(4).join(" | ") ? `<p class="j-fix"><i>Lösung</i>${r.slice(4).join(" | ")}</p>` : "") + `</div>`;
  }).join("");
  return `<div class="v-journey" style="--n:${n}">` +
    `<div class="j-curve"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${poly}" vector-effect="non-scaling-stroke"/></svg>${faces}</div>` +
    `<div class="j-row">${cards}</div></div>`;
}

/* ================================= GANTT =============================== */

/**
 * `agxp-gantt` — bars on a time axis.
 *
 *   unit: Monat
 *   ticks: Jan | Feb | Mär | Apr
 *   Quick Wins | Triage-Pilot (1 Team) | 1 | 3
 *   Quick Wins | Gate: −15 % Bearbeitungszeit | 3 | 3 | milestone
 *   Scale | Triage alle Teams | 3 | 8
 *
 * Rows are `Lane | Text | start | end | milestone?`. start and end are counted
 * in the axis' own steps (1-based, end included). `ticks:` names the steps,
 * otherwise they are `unit 1`, `unit 2` …
 */
export function gantt(body: string): string {
  let unit = "";
  let ticks: string[] = [];
  type T = { lane: string; text: string; a: number; b: number; ms: boolean };
  const tasks: T[] = [];
  for (const l of lines(body)) {
    const key = l.match(/^(unit|ticks)\s*:\s*(.*)$/i);
    if (key) {
      if (key[1].toLowerCase() === "unit") unit = key[2].trim();
      else ticks = key[2].split("|").map(s => s.trim()).filter(Boolean);
      continue;
    }
    const r = cells(l);
    const a = num(r[2] ?? ""), b = num(r[3] ?? "");
    if (!r[1] || !isFinite(a)) continue;
    const end = isFinite(b) ? b : a;
    tasks.push({ lane: r[0], text: r[1], a: Math.max(1, a), b: Math.max(a, end), ms: /^(milestone|meilenstein|gate|◆)$/i.test(r[4] ?? "") || (!isFinite(b)) });
  }
  if (!tasks.length || tasks.length > 24) return "";
  const total = Math.max(ticks.length, ...tasks.map(t => Math.ceil(t.b)));
  if (total > 60) return "";
  const labels = Array.from({ length: total }, (_, i) => ticks[i] ?? `${unit || "·"} ${i + 1}`.trim());
  // With many steps only every few are named, or the labels run into each other.
  const every = total > 24 ? 4 : total > 12 ? 2 : 1;
  const axis = labels.map((t, i) => (i % every === 0
    ? `<span style="left:${f((i / total) * 100)}%;width:${f((every / total) * 100)}%">${t}</span>` : "")).join("");
  const lanes: string[] = [];
  for (const t of tasks) if (!lanes.includes(t.lane)) lanes.push(t.lane);

  const rows = lanes.map((lane, li) => tasks.filter(t => t.lane === lane).map((t, k) => {
    const left = ((t.a - 1) / total) * 100, width = ((t.b - t.a + 1) / total) * 100;
    const mark = t.ms
      ? `<i class="g-ms" style="left:${f(((t.a - 0.5) / total) * 100)}%"></i><em class="g-ms-t" style="left:${f(((t.a - 0.5) / total) * 100)}%">${t.text}</em>`
      : `<i class="g-bar${width < 22 ? " short" : ""}" style="left:${f(left)}%;width:${f(width)}%"><em>${t.text}</em></i>`;
    return `<div class="g-row l${li % 3}${k === 0 ? " first" : ""}"><span class="g-lane">${k === 0 ? lane : ""}</span>` +
      `<div class="g-track">${mark}</div></div>`;
  }).join("")).join("");
  return `<div class="v-gantt" style="--n:${total}"><div class="g-row g-axis"><span class="g-lane"></span><div class="g-track">${axis}</div></div>${rows}</div>`;
}

/* ================================ TIMELINE ============================= */

/**
 * `agxp-timeline` — `Wann | Gruppe | Botschaft / Schulung | Kanal | Verantwortlich`.
 *
 * Time and group above the axis, what is said or taught, and by whom, below.
 */
export function timeline(body: string): string {
  const rows = lines(body).map(cells).filter(r => r[0] && r[2]);
  if (!rows.length || rows.length > 12) return "";
  const items = rows.map((r, i) =>
    `<div class="tl-item c${i % 3}"><div class="t-top"><b>${r[0]}</b><span>${r[1] ?? ""}</span></div>` +
    `<i class="t-dot"></i>` +
    `<div class="t-bot"><p>${r[2]}</p>` +
    (r[3] ? `<span class="t-ch">${r[3]}</span>` : "") +
    (r[4] ? `<span class="t-by">${r[4]}</span>` : "") + `</div></div>`).join("");
  return `<div class="v-timeline" style="--n:${rows.length}">${items}</div>`;
}

/* ================================= MOSCOW ============================== */

/**
 * `agxp-moscow` — `Must | item; item`, `Should | …`, `Could | …`, `Won't | …`.
 * The four columns are always drawn, so an empty Must is as visible as a full one.
 */
export function moscow(body: string): string {
  const cols: Record<string, string[]> = { must: [], should: [], could: [], wont: [] };
  let any = false;
  for (const r of lines(body).map(cells)) {
    const k = (r[0] ?? "").toLowerCase().replace(/&#39;|'|’/g, "").replace(/[^a-z]/g, "");
    if (!(k in cols)) continue;
    cols[k].push(...semi(r.slice(1).join(" | ")));
    any = true;
  }
  if (!any) return "";
  const name: Record<string, string> = { must: "Must", should: "Should", could: "Could", wont: "Won&#39;t" };
  return `<div class="v-moscow">` + Object.keys(cols).map(k =>
    `<section class="m-col ${k}"><h4>${name[k]}<em>${cols[k].length}</em></h4>` +
    (cols[k].length ? `<ul>${cols[k].map(i => `<li>${i}</li>`).join("")}</ul>` : `<p class="m-none">—</p>`) +
    `</section>`).join("") + `</div>`;
}

/* ================================== CARDS ============================== */

/**
 * `agxp-cards` — one card per paragraph; a blank line starts the next card.
 *
 *   Party-Host
 *   Kontext | abends, 4-8 Freunde
 *   Ziel | einfacher Spaß in der Gruppe
 *
 * The first line is the card's title, optionally `Title | tone` (good, bad, warn);
 * every other line is `Label | Value`. A value with `;` becomes a list.
 */
export function cards(body: string): string {
  const groups = body.split(/\n\s*\n/).map(g => lines(g)).filter(g => g.length);
  const out = groups.map(g => {
    const [head, ...rest] = g;
    const [title, tone] = cells(head);
    const rowsHtml = rest.map(l => {
      const [k, ...v] = cells(l);
      const val = v.join(" | ");
      if (!k || !val) return "";
      const parts = semi(val);
      const inner = parts.length > 1 ? `<ul>${parts.map(p => `<li>${p}</li>`).join("")}</ul>` : val;
      return `<div class="c-row"><dt>${k}</dt><dd>${inner}</dd></div>`;
    }).join("");
    if (!title || !rowsHtml) return "";
    const t = /^(good|bad|warn)$/i.test(tone ?? "") ? ` t-${tone.toLowerCase()}` : "";
    return `<article class="c-card${t}"><h4>${title}</h4><dl>${rowsHtml}</dl></article>`;
  }).join("");
  return out ? `<div class="v-cards">${out}</div>` : "";
}

/* ================================== CANVAS ============================= */

const CANVAS: [string, RegExp, string][] = [
  ["problem", /^(problem)/i, "Problem"],
  ["solution", /^(l(ö|oe)sung|solution)/i, "Lösung"],
  ["uvp", /^(alleinstellung|unique|nutzenversprechen|value)/i, "Alleinstellung"],
  ["advantage", /^(unfair|vorteil)/i, "Unfairer Vorteil"],
  ["customer", /^(kunde|customer|segment)/i, "Kunde"],
  ["metrics", /^(kennzahl|key metric|metrik)/i, "Kennzahl"],
  ["channels", /^(kan(ä|ae)le|channels)/i, "Kanäle"],
  ["costs", /^(kosten|costs?)/i, "Kosten"],
  ["revenue", /^(einnahmen|revenue|erl(ö|oe)se)/i, "Einnahmen"],
];

/**
 * `agxp-canvas` — the lean canvas, `Block | Inhalt` for nine blocks, each drawn
 * where the canvas has it: problem, solution with the key metric under it, the
 * value proposition in the middle, the unfair advantage with the channels under
 * it, the customer; costs and revenue along the bottom. An unknown block is dropped,
 * a missing one is drawn empty so the gap shows.
 */
export function canvas(body: string): string {
  const got = new Map<string, string>();
  for (const r of lines(body).map(cells)) {
    const hit = CANVAS.find(([, re]) => re.test(r[0] ?? ""));
    if (hit && r[1]) got.set(hit[0], r.slice(1).join(" | "));
  }
  if (got.size < 3) return "";
  const cell = (key: string) => {
    const def = CANVAS.find(c => c[0] === key)!;
    const v = got.get(key);
    const unknown = !v || /^(unbekannt|unknown|offen)/i.test(v);
    return `<section class="cv-${key}${unknown ? " unknown" : ""}"><h4>${def[2]}</h4><p>${v ?? "—"}</p></section>`;
  };
  return `<div class="v-canvas">` + CANVAS.map(([k]) => cell(k)).join("") + `</div>`;
}

/* =============================== CHECKLIST ============================= */

/**
 * `agxp-checklist` — `[x] Prüfpunkt | Gilt für | Wer prüft`. `[x]` is done, `[ ]` or
 * nothing is open.
 */
export function checklist(body: string): string {
  const rows = lines(body).map(l => {
    const m = l.match(/^\[( |x|X)\]\s*(.*)$/);
    const done = !!m && m[1].toLowerCase() === "x";
    const r = cells(m ? m[2] : l);
    return { done, text: r[0], applies: r[1] ?? "", who: r.slice(2).join(" | ") };
  }).filter(r => r.text);
  if (!rows.length) return "";
  const items = rows.map(r =>
    `<li class="${r.done ? "done" : ""}"><i class="ck" aria-hidden="true"></i><span class="tx">${r.text}</span>` +
    (r.applies ? `<span class="ap">${r.applies}</span>` : "") +
    (r.who ? `<span class="wh">${r.who}</span>` : "") + `</li>`).join("");
  return `<ul class="v-check">${items}</ul>`;
}

/* ================================== OKR ================================ */

/**
 * `agxp-okr` — objectives, each with its key results.
 *
 *   Objective: KI-Nutzen im Schadenwesen belegen
 *   Bearbeitungszeit im Pilotteam −15 % | Monat 3 | Leiter Schaden | 40
 *   80 % der neuen Fälle von der KI vorsortiert | Monat 4 | IT | 20
 *
 * A key result is `Text | Frist | Verantwortlich | Fortschritt` (0–100).
 */
export function okr(body: string): string {
  type KR = { text: string; due: string; owner: string; pct: number };
  const groups: { name: string; krs: KR[] }[] = [];
  for (const l of lines(body)) {
    const o = l.match(/^(objective|ziel)\s*:\s*(.+)$/i);
    if (o) { groups.push({ name: o[2], krs: [] }); continue; }
    const r = cells(l);
    if (!r[0] || !groups.length) continue;
    const p = num(r[3] ?? "");
    groups[groups.length - 1].krs.push({ text: r[0], due: r[1] ?? "", owner: r[2] ?? "", pct: isFinite(p) ? clamp(p, 0, 100) : 0 });
  }
  const live = groups.filter(g => g.krs.length);
  if (!live.length) return "";
  return `<div class="v-okr">` + live.map(g =>
    `<section class="o-obj"><h4><i aria-hidden="true"></i>${g.name}</h4><ul>` +
    g.krs.map((k, i) =>
      `<li><span class="kr"><b>KR${i + 1}</b>${k.text}</span>` +
      `<span class="meta">${k.due}${k.due && k.owner ? " · " : ""}${k.owner}</span>` +
      `<span class="bar" title="${f(k.pct)} %"><i style="width:${f(k.pct)}%"></i></span><em>${f(k.pct)} %</em></li>`).join("") +
    `</ul></section>`).join("") + `</div>`;
}

/* ================================= DEBATE ============================== */

/**
 * `agxp-debate` — the Consultant-Coach Debate.
 *
 *   Entscheidung: Eigene Clips verwenden?
 *   Dafür | volle Kontrolle über die Musik; keine API-Abhängigkeit; eigener Sound
 *   Dagegen | 20 Tage sind zu kurz; rechtliches Risiko; Nutzer wollen bekannte Songs
 *   Wahl | Keine eigenen Clips | Frist
 *
 * `Dafür` are the Consultant's three arguments, `Dagegen` the Coach's, `Wahl` is
 * the user's decision and its reason. One block per decision.
 */
export function debate(body: string): string {
  let title = "", pro: string[] = [], con: string[] = [], choice = "", why = "";
  for (const l of lines(body)) {
    const t = l.match(/^(entscheidung|decision)\s*:\s*(.+)$/i);
    if (t) { title = t[2]; continue; }
    const r = cells(l);
    const k = (r[0] ?? "").toLowerCase();
    if (/^(daf(ü|ue)r|for|pro)$/.test(k)) pro = semi(r.slice(1).join(" | "));
    else if (/^(dagegen|against|contra)$/.test(k)) con = semi(r.slice(1).join(" | "));
    else if (/^(wahl|entscheidung des nutzers|nutzer|user|choice)$/.test(k)) { choice = r[1] ?? ""; why = r.slice(2).join(" | "); }
  }
  if (!title && !pro.length && !con.length) return "";
  if (!pro.length || !con.length) return "";
  const list = (xs: string[]) => `<ol>${xs.map(x => `<li>${x}</li>`).join("")}</ol>`;
  return `<div class="v-debate">` +
    (title ? `<p class="d-title">${title}</p>` : "") +
    `<div class="d-cols"><section class="d-pro"><h4>Consultant: dafür</h4>${list(pro)}</section>` +
    `<section class="d-con"><h4>Coach: dagegen</h4>${list(con)}</section></div>` +
    `<p class="d-choice ${choice && !/^offen/i.test(choice) ? "set" : "open"}"><b>Nutzer entscheidet</b>` +
    `${choice ? ` <span>${choice}</span>` : " <span>offen</span>"}${why ? ` <em>Begründung: ${why}</em>` : ""}</p></div>`;
}

/* ================================== MOCK =============================== */

/**
 * `agxp-mock` — a wireframe of the screen with the fake door in it.
 *
 *   Neues Spiel
 *   Genre-Packs *
 *   Einstellungen
 *   -> Bald verfügbar! Willst du es?
 *
 * Every line is an entry on the screen; a trailing `*` marks the fake door, and a
 * line that starts with `->` is what a click on it shows.
 */
export function mock(body: string): string {
  const ls = lines(body);
  const entries: { text: string; door: boolean }[] = [];
  let result = "";
  for (const l of ls) {
    const r = l.match(/^-&gt;\s*(.*)$/);
    if (r) { result = r[1]; continue; }
    const door = /\*$/.test(l);
    entries.push({ text: door ? l.replace(/\s*\*$/, "") : l, door });
  }
  if (!entries.length) return "";
  return `<div class="v-mock"><div class="mk-screen">` +
    entries.map(e => `<span class="mk-row${e.door ? " door" : ""}">${e.text}${e.door ? "<em>Fake Door</em>" : ""}</span>`).join("") +
    `</div>${result ? `<p class="mk-click"><i aria-hidden="true">→</i>${result}</p>` : ""}</div>`;
}
