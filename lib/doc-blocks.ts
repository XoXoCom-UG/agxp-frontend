/**
 * doc-blocks.ts — the document as a plain list of blocks, for the Word export.
 *
 * The on-screen document is markdown plus a handful of fenced `agxp-*` blocks
 * that doc-visuals.ts draws in CSS. CSS does not travel into a .docx, so the
 * export needs the same content as structure: headings, paragraphs, bullets and
 * TABLES. Each agxp block becomes the table (or line) that says the same thing
 * in words — a KPI tile becomes a row, the gap dumbbell becomes today / target
 * columns, the risk grid becomes a register.
 *
 * Pure and free of any library, so it can be tested without building a file.
 * (Relative imports only: the test runner does not know the "@/" alias.)
 */

export type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "para"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "number"; n: number; text: string }
  | { kind: "label"; text: string }
  | { kind: "code"; text: string }
  | {
    kind: "table";
    /** Column titles, or null for a plain label / value table. */
    header: string[] | null;
    rows: string[][];
    /** Relative column widths in percent, when the default even split is wrong. */
    widths?: number[];
  };

/** A run of text with the formatting markdown gave it. */
export interface Run { text: string; bold?: boolean; italics?: boolean; code?: boolean }

/** `**bold**`, `*italic*` / `_italic_` and `` `code` `` → runs; links keep their text. */
export function runs(input: string): Run[] {
  const text = input.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  const out: Run[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|(?<![\w])_[^_\s][^_]*_(?![\w]))/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    const t = m[0];
    if (t.startsWith("**")) out.push({ text: t.slice(2, -2), bold: true });
    else if (t.startsWith("`")) out.push({ text: t.slice(1, -1), code: true });
    else out.push({ text: t.slice(1, -1), italics: true });
    last = at + t.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.filter(r => r.text !== "");
}

/** Pipe-separated rows, blank lines dropped (the same reading as doc-visuals). */
function rows(body: string): string[][] {
  return body.split("\n").map(l => l.trim()).filter(Boolean).map(l => l.split("|").map(c => c.trim()));
}

const rank = (w: string): number => {
  const s = (w || "").toLowerCase();
  if (/^(hoch|high|gro(ß|ss)|mare)$/.test(s)) return 2;
  if (/^(gering|niedrig|low|klein|mic)$/.test(s)) return 0;
  return 1;
};

const items = (s: string) => s.split(";").map(x => x.trim()).filter(Boolean);

/** What one `agxp-*` fenced block says, as blocks. Unknown kinds come out as code. */
export function visualBlocks(kind: string, body: string): Block[] {
  const R = rows(body);
  switch (kind) {
    case "agxp-kpi": {
      const r = R.filter(x => x[0]).map(x => [x[0], x[1] ?? ""]);
      return r.length ? [{ kind: "table", header: ["Kennzahl", "Wert"], rows: r, widths: [70, 30] }] : [];
    }
    case "agxp-gap": {
      const r = R.filter(x => x[0]).map(x => [x[0], x[1] ?? "", x[2] ?? "", x[3] ?? ""]);
      return r.length ? [{ kind: "table", header: ["Indikator", "Heute", "Ziel", "Einheit"], rows: r, widths: [46, 18, 18, 18] }] : [];
    }
    case "agxp-flow": {
      return body.split("\n").map(l => l.trim()).filter(Boolean).map((line): Block | null => {
        const at = line.indexOf(":");
        const label = at > 0 ? line.slice(0, at).trim() : "";
        const steps = (at > 0 ? line.slice(at + 1) : line).split("|").map(s => s.trim()).filter(Boolean)
          .map(s => (s.endsWith("*") ? `${s.slice(0, -1).trim()} (automatisch)` : s));
        if (!steps.length) return null;
        return { kind: "para", text: `${label ? `**${label}:** ` : ""}${steps.join("  →  ")}` };
      }).filter((b): b is Block => b !== null);
    }
    case "agxp-roadmap": {
      const r = R.filter(x => x[0]).map(x => [x[0], items(x[1] ?? "").join("\n")]);
      return r.length ? [{ kind: "table", header: ["Phase", "Maßnahmen"], rows: r, widths: [24, 76] }] : [];
    }
    case "agxp-risks": {
      const r = R.filter(x => x[0])
        .map(x => ({ x, sev: rank(x[1] ?? "") + rank(x[2] ?? "") }))
        .sort((a, b) => b.sev - a.sev)
        .map(({ x }) => [x[0], x[1] ?? "", x[2] ?? "", x.slice(3).join(" — ")]);
      return r.length
        ? [{ kind: "table", header: ["Risiko", "Wahrscheinlichkeit", "Auswirkung", "Gegenmaßnahme"], rows: r, widths: [28, 16, 16, 40] }]
        : [];
    }
    case "agxp-stakeholders": {
      const r = R.filter(x => x[0]).map(x => [x[0], x[1] ?? "", x[2] ?? "", x[3] ?? "", x.slice(4).join(" | ")]);
      return r.length
        ? [{ kind: "table", header: ["Gruppe", "Anzahl", "Haltung", "Einfluss", "Sorge"], rows: r, widths: [22, 10, 16, 14, 38] }]
        : [];
    }
    case "agxp-lexicon": {
      const byTheme = new Map<string, [string, string][]>();
      const about = new Map<string, string>();
      for (const r of R) {
        const [theme, term, meaning] = [r[0] ?? "", r[1] ?? "", r.slice(2).join(" — ")];
        if (!term) continue;
        const key = theme || "Allgemein";
        if (term === "*") { if (meaning) about.set(key, meaning); continue; }
        if (!byTheme.has(key)) byTheme.set(key, []);
        byTheme.get(key)!.push([term, meaning]);
      }
      const out: Block[] = [];
      for (const [theme, terms] of byTheme) {
        out.push({ kind: "label", text: theme });
        const lead = about.get(theme);
        if (lead) out.push({ kind: "para", text: `*${lead}*` });
        out.push({ kind: "table", header: ["Begriff", "Erklärung"], rows: terms.map(([t, m]) => [t, m || "—"]), widths: [28, 72] });
      }
      return out;
    }
    case "agxp-glance": {
      const r = R.filter(x => x[0] && x.slice(1).join("").trim())
        .map(x => [x[0], items(x.slice(1).join(" | ")).length > 1 ? items(x.slice(1).join(" | ")).join(", ") : x.slice(1).join(" | ")]);
      return r.length ? [{ kind: "table", header: null, rows: r, widths: [28, 72] }] : [];
    }
    case "agxp-diff": {
      const t = R.filter(x => x[0]);
      const withPlan = t.some(x => (x[4] ?? "") !== "");
      const r = t.map(x => {
        const lack = withPlan ? (x[3] ?? "") : x.slice(3).join(" — ");
        const base = [x[0], x[1] ?? "", x[2] ?? "", lack];
        if (!withPlan) return base;
        const plan = x.slice(4).join(" | ").split(";").map(s => s.trim()).filter(Boolean).join("\n");
        return [...base, plan];
      });
      if (!r.length) return [];
      return withPlan
        ? [{ kind: "table", header: ["Dimension", "Heute", "Ziel", "Lücke", "Aktionsplan"], rows: r, widths: [16, 20, 20, 16, 28] }]
        : [{ kind: "table", header: ["Dimension", "Heute", "Ziel", "Lücke"], rows: r, widths: [20, 27, 27, 26] }];
    }
    case "agxp-swot": {
      const FIELDS: [RegExp, string][] = [
        [/^st(ä|ae)rken|^strengths/i, "Stärken"], [/^schw(ä|ae)chen|^weaknesses/i, "Schwächen"],
        [/^chancen|^opportunities/i, "Chancen"], [/^risiken|^threats/i, "Risiken"],
      ];
      const got = new Map<string, string[]>();
      for (const line of body.split("\n").map(l => l.trim()).filter(Boolean)) {
        const at = line.indexOf(":");
        if (at < 1) continue;
        const hit = FIELDS.find(([re]) => re.test(line.slice(0, at).trim()));
        if (hit) got.set(hit[1], items(line.slice(at + 1)));
      }
      const r = FIELDS.map(([, label]) => [label, (got.get(label) ?? []).map(s => `• ${s}`).join("\n") || "—"]);
      return got.size ? [{ kind: "table", header: null, rows: r, widths: [20, 80] }] : [];
    }
    case "agxp-level": {
      const [stage, ...why] = (R[0] ?? []);
      return stage ? [{ kind: "para", text: `**Wissensstand: ${stage}**${why.length ? ` — ${why.join(" | ")}` : ""}` }] : [];
    }
    case "agxp-summary": {
      const LABEL: [RegExp, string][] = [
        [/^(was|what)/i, "Was wir tun"], [/^(warum|why)/i, "Warum"],
        [/^(mehrwert|value|nutzen|benefit)/i, "Erwarteter Mehrwert"],
        [/^(risiko|risk)/i, "Größtes Risiko"], [/^(potenzial|potential|chance)/i, "Größtes Potenzial"],
      ];
      const r = R.filter(x => x[0] && x.slice(1).join("").trim())
        .map(x => [LABEL.find(([re]) => re.test(x[0]))?.[1] ?? x[0], x.slice(1).join(" | ")]);
      return r.length ? [{ kind: "table", header: null, rows: r, widths: [24, 76] }] : [];
    }
    default:
      return [{ kind: "code", text: body.trim() }];
  }
}

/** Markdown (with agxp blocks) → blocks, in document order. */
export function parseDoc(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "para", text: para.join(" ") });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    const fence = line.match(/^```\s*([\w-]*)\s*$/);
    if (fence) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith("```"); i++) body.push(lines[i]);
      const lang = fence[1].toLowerCase();
      if (lang.startsWith("agxp-")) out.push(...visualBlocks(lang, body.join("\n")));
      else if (body.join("").trim()) out.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    if (!line) { flush(); continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); out.push({ kind: "heading", level: h[1].length, text: h[2].replace(/[*`]/g, "").trim() }); continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); continue; }

    if (line.startsWith("|")) {
      flush();
      const table: string[][] = [];
      for (; i < lines.length && lines[i].trim().startsWith("|"); i++) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue; // the --- separator row
        table.push(cells);
      }
      i--;
      if (table.length) out.push({ kind: "table", header: table[0], rows: table.slice(1) });
      continue;
    }

    const b = line.match(/^[-*•]\s+(.*)$/);
    if (b) { flush(); out.push({ kind: "bullet", text: b[1] }); continue; }

    const n = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (n) { flush(); out.push({ kind: "number", n: Number(n[1]), text: n[2] }); continue; }

    const q = line.match(/^>\s?(.*)$/);
    if (q) { flush(); out.push({ kind: "para", text: `*${q[1]}*` }); continue; }

    para.push(line);
  }
  flush();
  return out;
}
