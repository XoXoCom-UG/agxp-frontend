/**
 * doc-visuals.ts — turns the structured blocks the agent writes into the
 * graphics of the deliverable document.
 *
 * The agent emits fenced blocks with a pipe-separated body, e.g.
 *
 *   ```agxp-kpi
 *   Aufträge pro Tag | 180 | neutral
 *   Diesel pro Monat | 600 € | bad
 *   ```
 *
 * and md() replaces the block with the rendered HTML. Everything is drawn in
 * CSS — no chart library — so the visuals survive print/PDF and both themes.
 *
 * SECURITY: md() HTML-escapes the whole message BEFORE splitting it into
 * blocks, so the strings arriving here are already escaped. Never add raw
 * user/model text to an attribute — only numbers this file computes itself.
 *
 * Colour rule (decided 2026-09-09): blue + grey is the base, exactly like the
 * approved template. Red / amber / green appear ONLY where the colour IS the
 * information — risk severity, delta against a target, a stakeholder's stance
 * — never as decoration.
 */

/** Pipe-separated rows, empty cells and blank lines dropped. */
function rows(body: string): string[][] {
  return body
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.split("|").map(c => c.trim()));
}

/** Tone words the model may use, in either language. */
function tone(word?: string): "good" | "bad" | "warn" | "" {
  const w = (word || "").toLowerCase();
  if (/^(good|gut|positiv|ok|green|grün)$/.test(w)) return "good";
  if (/^(bad|schlecht|kritisch|negativ|red|rot)$/.test(w)) return "bad";
  if (/^(warn|warning|mittel|achtung|amber|gelb)$/.test(w)) return "warn";
  return "";
}

/** gering|mittel|hoch (or low|medium|high) → 0 | 1 | 2 */
function rank(word: string): number {
  const w = (word || "").toLowerCase();
  if (/^(hoch|high|gro(ß|ss)|mare)$/.test(w)) return 2;
  if (/^(gering|niedrig|low|klein|mic)$/.test(w)) return 0;
  return 1;
}

/** First number in a string ("12 min" → 12, "1.200 €" → 1200). */
function num(s: string): number {
  const cleaned = s.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

function pct(part: number, whole: number): string {
  if (!isFinite(part) || !isFinite(whole) || whole <= 0) return "0";
  return Math.max(1.5, Math.min(100, (part / whole) * 100)).toFixed(1);
}

/** `label | value | tone?` — the numbers from the interview, as tiles. */
function kpi(body: string): string {
  const tiles = rows(body)
    .map(([label, value, t]) => {
      if (!label) return "";
      return `<div class="v-tile${tone(t) ? ` t-${tone(t)}` : ""}">` +
        `<span class="lbl">${label}</span>` +
        `<b>${value ?? ""}</b></div>`;
    })
    .join("");
  return tiles ? `<div class="v-kpi">${tiles}</div>` : "";
}

/**
 * `label | today | target | unit?`
 *
 * One track per indicator, not two stacked bars: the fill is where you are,
 * and a tick marks where you said you want to be. The distance between them
 * is the whole point, and two bars made you measure it yourself.
 */
function gap(body: string): string {
  const out = rows(body).map(([label, todayRaw = "", targetRaw = "", unit = ""]) => {
    if (!label) return "";
    const today = num(todayRaw);
    const target = num(targetRaw);
    const u = unit ? ` ${unit}` : "";

    // Without two numbers there is nothing to scale — keep it as a plain row.
    if (!isFinite(today) || !isFinite(target)) {
      return `<div class="v-gap-row"><div class="top"><span class="n">${label}</span>` +
        `<span class="d"><b>${todayRaw}</b> → <b>${targetRaw}${u}</b></span></div></div>`;
    }

    const scale = Math.max(today, target, 1);
    // pct() returns a formatted string for CSS; the dumbbell also needs the
    // two positions as numbers to work out which end comes first.
    const a = Number(pct(today, scale));
    const b = Number(pct(target, scale));
    const better = target < today;
    const delta = today > 0 ? Math.round(((target - today) / today) * 100) : 0;
    const deltaTxt = delta === 0 ? "" :
      `<em class="delta ${better ? "good" : "up"}">${delta > 0 ? "+" : "−"}${Math.abs(delta)}%</em>`;

    return `<div class="v-gap-row">` +
      `<div class="top"><span class="n">${label}</span>` +
        `<span class="d"><b>${todayRaw}${u}</b> → <b>${targetRaw}${u}</b> ${deltaTxt}</span></div>` +
      // Dumbbell: a dot where it is now, a dot where it should be, and the
      // distance between them drawn as the only heavy mark. A filled bar
      // implied the value was a quantity being filled up; most of these are
      // durations and counts that need to come DOWN.
      `<div class="track">` +
        `<i class="span" style="left:${Math.min(a, b)}%; width:${Math.abs(b - a)}%"></i>` +
        `<i class="now" style="left:${a}%"></i>` +
        `<i class="goal" style="left:${b}%"></i>` +
      `</div></div>`;
  }).join("");
  return out ? `<div class="v-gap">${out}</div>` : "";
}

/**
 * Two lanes of chained steps:
 *   as-is: E-Mail rein | Excel tippen | Tour bauen
 *   to-be: Auftrag erkannt* | Disponent gibt frei
 * A trailing `*` marks a step that runs automatically — the chip says so
 * itself, which is why there is no legend underneath any more.
 */
function flow(body: string): string {
  const lanes = body.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
    const at = line.indexOf(":");
    const label = at > 0 ? line.slice(0, at).trim() : "";
    const rest = at > 0 ? line.slice(at + 1) : line;
    const steps = rest.split("|").map(s => s.trim()).filter(Boolean);
    if (!steps.length) return "";
    const chain = steps.map(s => {
      const auto = s.endsWith("*");
      return `<span class="step${auto ? " auto" : ""}">${auto ? s.slice(0, -1).trim() : s}</span>`;
    }).join("");
    return `<div class="v-flow-lane">${label ? `<span class="k">${label}</span>` : ""}<div class="chain">${chain}</div></div>`;
  }).join("");
  return lanes ? `<div class="v-flow">${lanes}</div>` : "";
}

/**
 * `phase | item; item; item`
 *
 * Read top to bottom, like the rest of the document — the phase on the left,
 * its measures hanging off a lit rail.
 */
function roadmap(body: string): string {
  const phases = rows(body).map(([phase, items = ""]) => {
    if (!phase) return "";
    const list = items.split(";").map(s => s.trim()).filter(Boolean)
      .map(s => `<span class="it">${s}</span>`).join("");
    return `<div class="v-road-phase"><span class="ph">${phase}</span>` +
      `<div class="items">${list}</div></div>`;
  }).join("");
  return phases ? `<div class="v-road">${phases}</div>` : "";
}

/**
 * `risk | probability | impact` — placed on a 3×3 grid.
 *
 * The risk is written in its own cell. It used to be a key of R1…Rn with a
 * legend underneath, which meant reading the chart was a lookup exercise.
 */
function risks(body: string): string {
  const SEV = [
    { at: 4, cls: "crit", label: "kritisch" },
    { at: 3, cls: "high", label: "hoch" },
    { at: 2, cls: "mid", label: "mittel" },
    { at: 0, cls: "low", label: "gering" },
  ];
  const WORD = ["gering", "mittel", "hoch"];

  const items = rows(body)
    .filter(r => r[0])
    .map(r => {
      const p = rank(r[1] ?? "");
      const im = rank(r[2] ?? "");
      return { name: r[0], p, im, sev: p + im, fix: r.slice(3).join(" — ") };
    })
    // Worst first. A register is read top-down and acted on in that order,
    // which a grid cannot express at all.
    .sort((a, b) => b.sev - a.sev);
  if (!items.length) return "";

  const dots = (n: number) =>
    [0, 1, 2].map(i => `<i${i <= n ? ' class="on"' : ""}></i>`).join("");

  const out = items.map(x => {
    const s = SEV.find(v => x.sev >= v.at)!;
    return `<div class="v-risk-row ${s.cls}">` +
      `<span class="sev">${s.label}</span>` +
      `<span class="rn">${x.name}</span>` +
      `<span class="sc" title="Wahrscheinlichkeit ${WORD[x.p]}">` +
        `<em>W</em>${dots(x.p)}</span>` +
      `<span class="sc" title="Auswirkung ${WORD[x.im]}">` +
        `<em>A</em>${dots(x.im)}</span>` +
      `<span class="fix">${x.fix || "—"}</span>` +
      `</div>`;
  }).join("");

  return `<div class="v-risk">` +
    `<div class="v-risk-head"><span>Schwere</span><span>Risiko</span>` +
    `<span>Wahrsch.</span><span>Auswirkung</span><span>Gegenmaßnahme</span></div>` +
    out + `</div>`;
}

/** `group | count | stance | influence | concern` — the Coach's stakeholder board. */
function stakeholders(body: string): string {
  const out = rows(body).map(([group, count = "", stance = "", infl = "", why = ""]) => {
    if (!group) return "";
    const s = (stance || "").toLowerCase();
    // Either language: the agent answers in the one the user writes in.
    const cls = /unterst|support|pro|offen|open/.test(s) ? "s-pro"
      : /skept|scept|gegen|against|contra|kritisch|critical|resist|widerst/.test(s) ? "s-con" : "s-mid";
    const lvl = rank(infl);
    const dots = [0, 1, 2].map(i => `<i${i <= lvl ? ' class="on"' : ""}></i>`).join("");
    return `<div class="v-stake-row">` +
      `<span class="g">${group}</span>` +
      (count ? `<span class="cnt">${count}</span>` : "<span></span>") +
      `<span class="infl" title="Influence">${dots}</span>` +
      (stance ? `<span class="mood ${cls}">${stance}</span>` : "<span></span>") +
      (why ? `<p class="why">${why}</p>` : "") +
      `</div>`;
  }).join("");
  return out ? `<div class="v-stake">${out}</div>` : "";
}


/* ---------------------------------------------------------------------------
   The methods agreed with Patryk on 2026-10-02.
   --------------------------------------------------------------------------- */

/**
 * Lexicon — `Thema | Begriff | Erklärung`, clustered by theme.
 *
 * Patryk's point (00:22:22): the first thing separating a beginner from an
 * expert is the vocabulary, so the concept opens by explaining its own words.
 * It has to survive being printed and handed to someone else, which is why it
 * is `<details open>` rather than a collapsed drawer — the shared PDF is
 * readable by default and the reader can fold it away once they know the terms.
 */
function lexicon(body: string): string {
  const byTheme = new Map<string, [string, string][]>();
  for (const r of rows(body)) {
    const [theme, term, meaning] = [r[0] ?? "", r[1] ?? "", r.slice(2).join(" — ")];
    if (!term) continue;
    const key = theme || "Allgemein";
    if (!byTheme.has(key)) byTheme.set(key, []);
    byTheme.get(key)!.push([term, meaning]);
  }
  if (!byTheme.size) return "";

  const groups = [...byTheme.entries()].map(([theme, terms]) => {
    const list = terms.map(([term, meaning]) =>
      `<div class="v-lex-row"><dt>${term}</dt><dd>${meaning || "—"}</dd></div>`).join("");
    return `<section class="v-lex-grp"><h4>${theme}</h4><dl>${list}</dl></section>`;
  }).join("");

  const count = [...byTheme.values()].reduce((n, t) => n + t.length, 0);
  return `<details class="v-lex" open>` +
    `<summary><span class="v-lex-t">Lexikon</span>` +
    `<span class="v-lex-n">${count} Begriffe</span></summary>` +
    `<div class="v-lex-body">${groups}</div></details>`;
}

/**
 * At a glance — `Zeile | Inhalt`, a label/value table.
 *
 * Was a bullet list, and Patryk's objection (00:37:00) was that you still have
 * to read it: "Kann man das nicht besser verpacken?" A two-column table gives
 * each line a weight a bullet cannot.
 */
function glance(body: string): string {
  const out = rows(body).map(r => {
    const label = r[0] ?? "";
    const value = r.slice(1).join(" | ");
    if (!label || !value) return "";
    // Semicolons in the value are a list — React; Node; Postgres.
    const parts = value.split(";").map(s => s.trim()).filter(Boolean);
    const cell = parts.length > 1
      ? `<span class="v-gl-tags">${parts.map(p => `<i>${p}</i>`).join("")}</span>`
      : value;
    return `<div class="v-gl-row"><span class="k">${label}</span><span class="v">${cell}</span></div>`;
  }).join("");
  return out ? `<div class="v-gl">${out}</div>` : "";
}

/**
 * Gap analysis — `Dimension | heute | ziel | Lücke`.
 *
 * Patryk asked for the diff table from Matfeld (00:44:34), across goals,
 * maturity, capabilities and skills, technologies, people and resources.
 * Unlike `agxp-gap` this takes words, not numbers: "kein zentrales System"
 * against "ein System, alle Regionen" is the honest answer for most rows, and
 * forcing it into a bar chart was what made the old section feel invented.
 */
function diff(body: string): string {
  const out = rows(body).map(r => {
    const [dim, now, want] = [r[0] ?? "", r[1] ?? "", r[2] ?? ""];
    const lack = r.slice(3).join(" — ");
    if (!dim) return "";
    return `<div class="v-diff-row">` +
      `<span class="d">${dim}</span>` +
      `<span class="now">${now || "—"}</span>` +
      `<span class="arrow" aria-hidden="true"></span>` +
      `<span class="want">${want || "—"}</span>` +
      (lack ? `<span class="lack">${lack}</span>` : `<span class="lack muted">—</span>`) +
      `</div>`;
  }).join("");
  if (!out) return "";
  return `<div class="v-diff">` +
    `<div class="v-diff-head"><span>Dimension</span><span>Heute</span><span></span>` +
    `<span>Ziel</span><span>Lücke</span></div>${out}</div>`;
}

/**
 * SWOT — four labelled lines, each a `;`-separated list.
 *
 * Patryk explained it on a shared screen (01:02:35): strengths, weaknesses,
 * risks and opportunities OF THE PLAN, not of the company. The grid keeps the
 * internal pair on top and the external pair below, which is how the tool is
 * normally drawn and how the two halves are meant to be read against each
 * other.
 */
function swot(body: string): string {
  const want: [string, string, string][] = [
    ["stärken", "Stärken", "good"],
    ["schwächen", "Schwächen", "bad"],
    ["chancen", "Chancen", "good"],
    ["risiken", "Risiken", "warn"],
  ];
  const found = new Map<string, string[]>();
  for (const line of body.split("\n")) {
    const at = line.indexOf(":");
    if (at < 0) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const items = line.slice(at + 1).split(";").map(s => s.trim()).filter(Boolean);
    if (items.length) found.set(key, items);
  }
  const cells = want.map(([key, label, tone]) => {
    const items = found.get(key) ?? [];
    if (!items.length) return "";
    return `<section class="v-swot-c ${tone}">` +
      `<h4>${label}</h4><ul>${items.map(i => `<li>${i}</li>`).join("")}</ul></section>`;
  }).filter(Boolean).join("");
  return cells ? `<div class="v-swot">${cells}</div>` : "";
}

const RENDERERS: Record<string, (body: string) => string> = {
  "agxp-kpi": kpi,
  "agxp-gap": gap,
  "agxp-flow": flow,
  "agxp-roadmap": roadmap,
  "agxp-risks": risks,
  "agxp-stakeholders": stakeholders,
  "agxp-lexicon": lexicon,
  "agxp-glance": glance,
  "agxp-diff": diff,
  "agxp-swot": swot,
};

/** Every block type the agent may use, for the system prompt. */
export const VISUAL_BLOCKS = Object.keys(RENDERERS);

/**
 * Renders one fenced block, or returns null when the language is not one of
 * ours (md() then falls back to a normal code block).
 */
export function renderDocVisual(lang: string, body: string): string | null {
  const fn = RENDERERS[lang.toLowerCase()];
  if (!fn) return null;
  const html = fn(body);
  return html || null;
}
