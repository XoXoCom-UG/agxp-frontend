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
    const better = target < today;
    const delta = today > 0 ? Math.round(((target - today) / today) * 100) : 0;
    const deltaTxt = delta === 0 ? "" :
      `<em class="delta ${better ? "good" : "up"}">${delta > 0 ? "+" : "−"}${Math.abs(delta)}%</em>`;

    return `<div class="v-gap-row">` +
      `<div class="top"><span class="n">${label}</span>` +
        `<span class="d"><b>${todayRaw}${u}</b> → <b>${targetRaw}${u}</b> ${deltaTxt}</span></div>` +
      `<div class="track">` +
        `<i class="now" style="width:${pct(today, scale)}%"></i>` +
        `<i class="goal" style="left:${pct(target, scale)}%"></i>` +
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
  const items = rows(body)
    .filter(r => r[0])
    .map(([name, p = "", im = ""]) => ({ name, p: rank(p), im: rank(im) }));
  if (!items.length) return "";

  const cells: string[] = [];
  for (let r = 0; r < 3; r++) {
    const impact = 2 - r; // top row = highest impact
    for (let c = 0; c < 3; c++) {
      const here = items.filter(x => x.im === impact && x.p === c);
      const sev = impact + c; // 0..4
      // Only a cell that holds a risk gets a colour. Tinting the empty ones
      // by position made the matrix look like it had findings where it had
      // none — the severity is already carried by where the name sits.
      const cls = here.length === 0 ? "" : sev >= 3 ? "hot" : sev === 2 ? "warm" : "";
      const labels = here.map(x => `<span class="rname">${x.name}</span>`).join("");
      cells.push(`<div class="cell${cls ? ` ${cls}` : ""}">${labels}</div>`);
    }
  }

  return `<div class="v-risk">` +
    `<div class="grid">${cells.join("")}</div>` +
    `<div class="axes"><span>Wahrscheinlichkeit →</span><span>↑ Auswirkung</span></div>` +
    `</div>`;
}

/** `group | count | stance | influence | concern` — the Coach's stakeholder board. */
function stakeholders(body: string): string {
  const out = rows(body).map(([group, count = "", stance = "", infl = "", why = ""]) => {
    if (!group) return "";
    const s = (stance || "").toLowerCase();
    const cls = /unterst|support|pro|offen/.test(s) ? "s-pro"
      : /skept|gegen|contra|kritisch/.test(s) ? "s-con" : "s-mid";
    const lvl = rank(infl);
    const dots = [0, 1, 2].map(i => `<i${i <= lvl ? ' class="on"' : ""}></i>`).join("");
    return `<div class="v-stake-row">` +
      `<span class="g">${group}</span>` +
      (count ? `<span class="cnt">${count}</span>` : "<span></span>") +
      `<span class="infl" title="Einfluss">${dots}</span>` +
      (stance ? `<span class="mood ${cls}">${stance}</span>` : "<span></span>") +
      (why ? `<p class="why">${why}</p>` : "") +
      `</div>`;
  }).join("");
  return out ? `<div class="v-stake">${out}</div>` : "";
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
