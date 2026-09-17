/**
 * markdown.ts — shared, XSS-safe markdown renderer used by the main chat and
 * the right-side help panel.
 *
 * SECURITY: all raw text is HTML-escaped BEFORE markdown parsing. The renderer
 * only ever emits tags it generates itself — user/model content can never
 * inject markup (XSS via dangerouslySetInnerHTML).
 */

function escapeHtml(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only allow safe link protocols (blocks javascript:, data:, vbscript: …)
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : "#";
}

function inlineFmt(t: string): string {
  return t
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-100 dark:bg-zinc-700 px-1 py-0.5 rounded text-[11.5px] font-mono text-zinc-800 dark:text-zinc-200">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em class='opacity-80'>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) =>
      `<a href="${safeUrl(url)}" class="text-green-600 underline underline-offset-2 hover:text-green-700" target="_blank" rel="noopener noreferrer">${label}</a>`);
}

function renderTable(rows: string[]): string {
  const isSep = (r: string) => /^\|[\s|:-]+\|$/.test(r.trim());
  const parseRow = (r: string) =>
    r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const dataRows = rows.filter(r => !isSep(r) && r.trim());
  if (!dataRows.length) return "";
  const [head, ...body] = dataRows;
  const ths = parseRow(head).map(h =>
    `<th class="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">${inlineFmt(h)}</th>`
  ).join("");
  const trs = body.map(r => {
    const tds = parseRow(r).map(c =>
      `<td class="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 border-t border-zinc-100 dark:border-zinc-700">${inlineFmt(c)}</td>`
    ).join("");
    return `<tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">${tds}</tr>`;
  }).join("");
  return `<div class="overflow-x-auto my-3 rounded-lg border border-zinc-200 dark:border-zinc-700"><table class="w-full"><thead class="bg-zinc-50 dark:bg-zinc-800/60"><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

// A block of text between (or around) fenced code blocks — kept as RAW,
// unescaped source, same as the rest of `raw` before `md()`/`mdBlocks()`
// walk it. Splitting on the fence lines first (rather than inside the single
// escape-then-parse loop `parseBlocks` used to be) is what lets `mdBlocks()`
// hand real, un-escaped source off to `CodeBlock`/prism-react-renderer,
// which token-highlights and escapes it itself via JSX — not HTML strings.
type Segment = { type: "text"; raw: string } | { type: "code"; lang: string; code: string };

function splitFences(raw: string): Segment[] {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const segments: Segment[] = [];
  let textLines: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("```")) {
      if (textLines.length) { segments.push({ type: "text", raw: textLines.join("\n") }); textLines = []; }
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { codeLines.push(lines[i]); i++; }
      i++; // skip closing ```
      segments.push({ type: "code", lang, code: codeLines.join("\n") });
      continue;
    }
    textLines.push(lines[i]);
    i++;
  }
  if (textLines.length) segments.push({ type: "text", raw: textLines.join("\n") });
  return segments;
}

// Renders one already-HTML-escaped, fence-free text segment (headings,
// lists, tables, paragraphs — everything `md()` handled directly before code
// fences were split out above). `lines` have already been through
// `escapeHtml()`, matching the original `md()`'s single upfront pass.
function parseBlocks(escapedLines: string[]): string {
  const out: string[] = [];
  let i = 0;

  while (i < escapedLines.length) {
    const line = escapedLines[i];
    const trimmed = line.trim();

    // Table
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < escapedLines.length && escapedLines[i].trim().startsWith("|")) {
        tableLines.push(escapedLines[i]);
        i++;
      }
      out.push(renderTable(tableLines));
      continue;
    }

    // Headings — match on trimmed, use trimmed for text
    const hm = trimmed.match(/^(#{1,4})\s+(.+)/);
    if (hm) {
      const lvl = hm[1].length;
      const txt = inlineFmt(hm[2].trim());
      const cls = [
        "text-[18px] font-bold text-zinc-900 dark:text-zinc-50 mt-6 mb-2 leading-tight",
        "text-[15px] font-semibold text-zinc-800 dark:text-zinc-100 mt-5 mb-2 leading-tight",
        "text-[13px] font-semibold text-zinc-700 dark:text-zinc-200 mt-4 mb-1.5 uppercase tracking-wide",
        "text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 mt-3 mb-1",
      ][lvl - 1] ?? "text-sm font-semibold mt-2 mb-1";
      out.push(`<h${lvl} class="${cls}">${txt}</h${lvl}>`);
      i++; continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      out.push('<hr class="border-zinc-200 dark:border-zinc-700 my-5" />');
      i++; continue;
    }

    // Unordered list
    if (/^[-*•]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < escapedLines.length && /^[-*•]\s/.test(escapedLines[i].trim())) {
        items.push(`<li class="leading-relaxed">${inlineFmt(escapedLines[i].trim().replace(/^[-*•]\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ul class="my-2.5 ml-5 list-disc space-y-1 text-[13px] text-zinc-700 dark:text-zinc-300">${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < escapedLines.length && /^\d+\.\s/.test(escapedLines[i].trim())) {
        items.push(`<li class="leading-relaxed">${inlineFmt(escapedLines[i].trim().replace(/^\d+\.\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ol class="my-2.5 ml-5 list-decimal space-y-1 text-[13px] text-zinc-700 dark:text-zinc-300">${items.join("")}</ol>`);
      continue;
    }

    // Empty line → spacer
    if (!trimmed) {
      out.push('<div class="h-2"></div>');
      i++; continue;
    }

    // Normal paragraph
    out.push(`<p class="leading-relaxed text-[13.5px] text-zinc-800 dark:text-zinc-200">${inlineFmt(trimmed)}</p>`);
    i++;
  }

  return out.join("");
}

// Same `<pre><code>` chrome `md()` has always emitted for a fenced block —
// kept byte-for-byte so the printable/export path (which still calls `md()`
// directly, not `mdBlocks()`) is unaffected by the CodeBlock/highlighting
// work below.
function renderCodeHtml(code: string): string {
  const escaped = escapeHtml(code);
  return `<pre class="bg-zinc-950 dark:bg-zinc-950 text-zinc-100 rounded-xl p-4 overflow-x-auto my-4 text-[12.5px] font-mono leading-relaxed border border-zinc-800"><code>${escaped}</code></pre>`;
}

/** Full markdown → HTML string, for callers that render via
 * `dangerouslySetInnerHTML` and don't need interactive code blocks (the
 * print/export path, the legacy chat page, the right-side help panel). */
export function md(raw: string): string {
  return splitFences(raw).map(seg =>
    seg.type === "code"
      ? renderCodeHtml(seg.code)
      : parseBlocks(escapeHtml(seg.raw).split("\n"))
  ).join("");
}

/** One rendered chunk of a message: prose (already-safe HTML, for
 * `dangerouslySetInnerHTML`) or a fenced code block (raw source + language,
 * for a real `<CodeBlock>` — not HTML, so it can stay interactive). */
export type MdBlock = { type: "html"; html: string } | { type: "code"; lang: string; code: string };

/** Same parse as `md()`, but keeps fenced code blocks as raw source instead
 * of flattening everything into one HTML string — lets the chat panel render
 * real `<CodeBlock>` components (copy button, syntax highlighting) inline
 * with the rest of the prose. */
export function mdBlocks(raw: string): MdBlock[] {
  return splitFences(raw).map(seg =>
    seg.type === "code"
      ? { type: "code" as const, lang: seg.lang, code: seg.code }
      : { type: "html" as const, html: parseBlocks(escapeHtml(seg.raw).split("\n")) }
  );
}
