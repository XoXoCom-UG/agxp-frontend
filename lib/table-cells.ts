/**
 * table-cells.ts — what a table cell looks like when it says something the method
 * sheet draws as a picture rather than as a word.
 *
 * The sheet's tables are full of small marks: a coloured dot for High / Medium /
 * Low, a tick or a cross, a row of squares for 1–5, MoSCoW as coloured chips, a
 * bar for a percentage, an arrow for a trend. The agent writes the plain word or
 * number (`H`, `ja`, `■■□□□ 2`, `40 %`, `▼ −2`) and this turns it into the mark —
 * so the document reads the way the sheet's examples do, and the Word export
 * still has the plain word.
 *
 * A cell that is none of these comes back as null and md() formats it as text.
 *
 * SECURITY: the cell arrives HTML-escaped. A chip shows the original, escaped text
 * (it matched a word list, so it is one of those words) and only fixed class names
 * and numbers computed here are added.
 */

type Tone = "good" | "bad" | "warn" | "open" | "muted" | "blue";

/** word (lower case, unescaped) → tone and glyph. */
const WORDS: Record<string, [Tone, string]> = {
  "ja": ["good", "✓"], "erfüllt": ["good", "✓"], "ok": ["good", "✓"],
  "nein": ["bad", "✗"], "nicht erfüllt": ["bad", "✗"],
  "teilweise": ["warn", "◐"], "offen": ["open", "○"], "unklar": ["muted", "?"], "geplant": ["warn", "◐"],
  "genehmigen": ["good", "✓"], "ersetzen": ["warn", "⇄"], "blockieren": ["bad", "✗"],
  "bauen": ["good", "✓"], "nicht bauen": ["bad", "✗"],
  "behalten": ["good", "✓"], "ändern": ["warn", "⇄"], "verwerfen": ["bad", "✗"],
  "quick win": ["good", "★"], "strategic bet": ["blue", "◆"], "later": ["muted", "…"], "drop": ["bad", "✗"],
  "auto": ["blue", "⚙"], "vorschlag": ["warn", "✎"], "mensch": ["good", "☺"],
  "geeignet": ["good", "✓"], "riskant": ["warn", "!"], "ungeeignet": ["bad", "✗"],
  "start hier": ["good", "★"], "haupt-poc": ["good", "★★"], "phase 2": ["muted", "…"],
  "must": ["bad", ""], "should": ["warn", ""], "could": ["open", ""], "won't": ["muted", ""],
  "eng einbinden": ["bad", ""], "zufrieden halten": ["warn", ""], "informieren": ["blue", ""], "beobachten": ["muted", ""],
  "unterstützer": ["good", ""], "skeptisch": ["bad", ""], "neutral": ["muted", ""],
};
/** Words that may be followed by their explanation in the same cell ("geeignet — Lizenz-API"). */
const LEADING = ["geeignet", "riskant", "ungeeignet", "eng einbinden", "zufrieden halten", "informieren", "beobachten"];

const unesc = (s: string) => s.replace(/&#39;|&apos;|’/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
const f = (n: number) => Math.round(n * 10) / 10;

/** Headers whose High is the good end: quality, explainability, value, confidence. */
const GOOD_HIGH = /qualit|erkl(ä|ae)rbar|^wert\b|value|konfidenz|confidence/i;

export function cellMarkup(raw: string, header: string): string | null {
  const text = unesc(raw.trim());
  if (!text) return null;
  const lower = text.toLowerCase();

  // ■■□□□ 2 — a 1–5 scale, written as squares and a number.
  const sq = text.match(/^([■□]{3,10})\s*(\d+)?$/);
  if (sq) {
    const total = sq[1].length;
    const on = (sq[1].match(/■/g) ?? []).length;
    const n = sq[2] !== undefined ? sq[2] : String(on);
    return `<span class="c-meter" role="img" aria-label="${on} / ${total}">` +
      Array.from({ length: total }, (_, i) => `<i${i < on ? ' class="on"' : ""}></i>`).join("") +
      `</span><b class="c-n">${n.replace(/[^\d]/g, "")}</b>`;
  }

  // 40 % — a bar. Agreement and quality columns are coloured by how good the number is.
  const pc = text.match(/^(\d{1,3}(?:[.,]\d+)?)\s?%$/);
  if (pc) {
    const v = Math.min(100, parseFloat(pc[1].replace(",", ".")));
    const tone = /(ü|ue)bereinstimmung|agreement/i.test(header) ? (v >= 90 ? " good" : v >= 80 ? " warn" : " bad") : "";
    return `<span class="c-bar${tone}"><i style="width:${f(v)}%"></i></span><b class="c-n">${f(v)}&nbsp;%</b>`;
  }

  // ▲ +1 / ▼ −2 / = — the way a score moved.
  const tr = text.match(/^([▲▼])\s*([+\-−]?\s*\d+)?$/);
  if (tr) return `<span class="c-trend ${tr[1] === "▲" ? "up" : "down"}">${tr[1]}${tr[2] ? " " + tr[2].replace(/\s/g, "") : ""}</span>`;

  // H / M / L — a dot. The colour follows what high means in this column.
  if (/^[HML]$/.test(text)) {
    const goodHigh = GOOD_HIGH.test(header);
    const rank = text === "H" ? 2 : text === "M" ? 1 : 0;
    const tone = rank === 1 ? "warn" : (rank === 2) === goodHigh ? "good" : "bad";
    return `<span class="c-chip ${tone}"><i class="dot"></i>${text}</span>`;
  }

  // Score — the heat of a pain point, by size.
  if (/^score$/i.test(header) && /^\d{1,3}$/.test(text)) {
    const v = Number(text);
    const tone = v >= 15 ? "bad" : v >= 10 ? "hot" : v >= 5 ? "warn" : "good";
    return `<span class="c-heat ${tone}">${text}</span>`;
  }

  // gering / mittel / hoch — three dots, no judgement (an influence is not good or bad).
  const three = /^(gering|niedrig|low)$/.test(lower) ? 0 : /^(mittel|medium)$/.test(lower) ? 1 : /^(hoch|high)$/.test(lower) ? 2 : -1;
  if (three >= 0) {
    return `<span class="c-dots" role="img" aria-label="${raw}">` +
      [0, 1, 2].map(i => `<i${i <= three ? ' class="on"' : ""}></i>`).join("") + `</span><span class="c-w">${raw}</span>`;
  }

  const hit = WORDS[lower];
  // "Legacy?" is the one column where a yes is the bad answer.
  if (hit && /legacy/i.test(header) && (lower === "ja" || lower === "nein")) {
    return chip(lower === "ja" ? ["bad", "✗"] : ["good", "✓"], raw, "");
  }
  if (hit) return chip(hit, raw, "");

  // "geeignet — Lizenz-API": the verdict is the chip, the rest stays text.
  for (const w of LEADING) {
    if (lower.startsWith(w) && /^[\s:—–,.-]/.test(lower.slice(w.length)) && WORDS[w]) {
      const head = raw.trim().slice(0, w.length);
      const rest = raw.trim().slice(w.length).replace(/^[\s:—–,.-]+/, "");
      return chip(WORDS[w], head, rest);
    }
  }
  return null;
}

function chip([tone, glyph]: [Tone, string], label: string, rest: string): string {
  return `<span class="c-chip ${tone}">${glyph ? `<i class="gl">${glyph}</i>` : '<i class="dot"></i>'}${label}</span>` +
    (rest ? `<span class="c-rest"> ${rest}</span>` : "");
}

/** The class a header cell gets, so as-is is grey and to-be is blue, A and B are told apart. */
export function headerClass(header: string): string {
  const h = unesc(header).trim().toLowerCase();
  if (/^as-is/.test(h)) return "th-asis";
  if (/^to-be|^nach der ver(ä|ae)nderung/.test(h)) return "th-tobe";
  if (/^variante a/.test(h)) return "th-a";
  if (/^variante b/.test(h)) return "th-b";
  if (/^(deine idee|your idea)/.test(h)) return "th-star";
  return "";
}
