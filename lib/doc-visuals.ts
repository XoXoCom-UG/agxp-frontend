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

/** `label | today | target | unit?` — one pair of bars per indicator. */
function gap(body: string): string {
  const out = rows(body).map(([label, todayRaw = "", targetRaw = "", unit = ""]) => {
    if (!label) return "";
    const today = num(todayRaw);
    const target = num(targetRaw);
    const u = unit ? ` ${unit}` : "";
    const head = `<span class="n">${label}</span>`;

    // Without two numbers there is nothing to scale — keep it as a plain row.
    if (!isFinite(today) || !isFinite(target)) {
      return `<div class="v-gap-row"><div class="top">${head}` +
        `<span class="d">${todayRaw} → ${targetRaw}${u}</span></div></div>`;
    }

    const scale = Math.max(today, target, 1);
    const better = target < today;
    const delta = today > 0 ? Math.round(((target - today) / today) * 100) : 0;
    const deltaTxt = delta === 0 ? "" :
      `<em class="delta ${better ? "good" : "up"}">${delta > 0 ? "+" : "−"}${Math.abs(delta)}%</em>`;

    return `<div class="v-gap-row">` +
      `<div class="top">${head}<span class="d">${todayRaw}${u} → ${targetRaw}${u} ${deltaTxt}</span></div>` +
      `<div class="bars">` +
        `<span class="k">heute</span><span class="track"><i class="now" style="width:${pct(today, scale)}%"></i></span>` +
        `<span class="k">ziel</span><span class="track"><i class="goal" style="width:${pct(target, scale)}%"></i></span>` +
      `</div></div>`;
  }).join("");
  return out ? `<div class="v-gap">${out}</div>` : "";
}

/**
 * Two lanes of chained steps:
 *   as-is: E-Mail rein | Excel tippen | Tour bauen
 *   to-be: Auftrag erkannt* | Disponent gibt frei
 * A trailing `*` marks a step that runs automatically.
 */
function flow(body: string): string {
  let hasAuto = false;
  const lanes = body.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
    const at = line.indexOf(":");
    const label = at > 0 ? line.slice(0, at).trim() : "";
    const rest = at > 0 ? line.slice(at + 1) : line;
    const steps = rest.split("|").map(s => s.trim()).filter(Boolean);
    if (!steps.length) return "";
    // The arrow is glued to the step that FOLLOWS it, so a wrapping chain
    // never leaves an arrow dangling at the end of a line.
    const chain = steps.map((s, idx) => {
      const auto = s.endsWith("*");
      if (auto) hasAuto = true;
      const chip = `<span class="step${auto ? " auto" : ""}">${auto ? s.slice(0, -1).trim() : s}</span>`;
      return idx === 0 ? chip : `<span class="lnk"><span class="arw">→</span>${chip}</span>`;
    }).join("");
    return `<div class="v-flow-lane">${label ? `<span class="k">${label}</span>` : ""}<div class="chain">${chain}</div></div>`;
  }).join("");
  if (!lanes) return "";
  const legend = hasAuto
    ? '<div class="v-legend"><span class="sw auto"></span>läuft automatisch<span class="sw"></span>bleibt beim Menschen</div>'
    : "";
  return `<div class="v-flow">${lanes}${legend}</div>`;
}

/** `phase | item; item; item` — the measures on a calendar instead of a table. */
function roadmap(body: string): string {
  const cols = rows(body).map(([phase, items = ""], i) => {
    if (!phase) return "";
    const chips = items.split(";").map(s => s.trim()).filter(Boolean)
      .map(s => `<span class="it">${s}</span>`).join("");
    return `<div class="v-road-col"${i === 0 ? ' data-first="1"' : ""}>` +
      `<span class="rail"></span><span class="ph">${phase}</span>` +
      `<div class="items">${chips}</div></div>`;
  }).join("");
  return cols ? `<div class="v-road">${cols}</div>` : "";
}

/** `risk | probability | impact` — placed on a 3×3 grid, keyed R1…Rn. */
function risks(body: string): string {
  const items = rows(body)
    .filter(r => r[0])
    .map(([name, p = "", im = ""], i) => ({ id: `R${i + 1}`, name, p: rank(p), im: rank(im) }));
  if (!items.length) return "";

  const cells: string[] = [];
  for (let r = 0; r < 3; r++) {
    const impact = 2 - r; // top row = highest impact
    for (let c = 0; c < 3; c++) {
      const here = items.filter(x => x.im === impact && x.p === c);
      const sev = impact + c; // 0..4
      const cls = sev >= 3 ? "hot" : sev === 2 ? "warm" : "";
      const chips = here.map(x => {
        const t = x.im + x.p >= 3 ? "bad" : x.im + x.p === 2 ? "warn" : "";
        return `<span class="rchip${t ? ` t-${t}` : ""}">${x.id}</span>`;
      }).join("");
      cells.push(`<div class="cell${cls ? ` ${cls}` : ""}">${chips}</div>`);
    }
  }

  const key = items.map(x => `<li><span class="rid">${x.id}</span>${x.name}</li>`).join("");
  return `<div class="v-risk">` +
    `<div class="v-risk-plot">` +
      `<span class="ax-y">Auswirkung</span>` +
      `<div class="y-ticks"><span>hoch</span><span>mittel</span><span>gering</span></div>` +
      `<div class="v-risk-main"><div class="grid">${cells.join("")}</div>` +
      `<div class="x-ticks"><span>gering</span><span>mittel</span><span>hoch</span></div>` +
      `<span class="ax-x">Wahrscheinlichkeit</span></div>` +
    `</div><ol class="v-risk-key">${key}</ol></div>`;
}

/** `group | count | stance | influence | concern` — the Coach's stakeholder board. */
function stakeholders(body: string): string {
  const cards = rows(body).map(([group, count = "", stance = "", infl = "", why = ""]) => {
    if (!group) return "";
    const s = (stance || "").toLowerCase();
    const cls = /unterst|support|pro|offen/.test(s) ? "s-pro"
      : /skept|gegen|contra|kritisch/.test(s) ? "s-con" : "s-mid";
    const lvl = rank(infl);
    const dots = [0, 1, 2].map(i => `<i${i <= lvl ? ' class="on"' : ""}></i>`).join("");
    return `<div class="v-stake-card ${cls}">` +
      `<div class="top"><b>${group}</b>${count ? `<span class="cnt">${count}</span>` : ""}</div>` +
      `<div class="mid">${stance ? `<span class="stance">${stance}</span>` : ""}` +
      `<span class="infl" title="Einfluss">${dots}</span></div>` +
      (why ? `<span class="why">${why}</span>` : "") +
      `</div>`;
  }).join("");
  return cards ? `<div class="v-stake">${cards}</div>` : "";
}

const RENDERERS: Record<string, (body: string) => string> = {
  "agxp-kpi": kpi,
  "agxp-gap": gap,
  "agxp-flow": flow,
  "agxp-roadmap": roadmap,
  "agxp-risks": risks,
  "agxp-stakeholders": stakeholders,
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
