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

export function md(raw: string): string {
  // Escape ALL HTML first (XSS protection), then normalize line endings
  const lines = escapeHtml(raw).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block (``` or ```lang)
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const escaped = codeLines.join("\n"); // already HTML-escaped globally
      out.push(
        `<pre class="bg-zinc-950 dark:bg-zinc-950 text-zinc-100 rounded-xl p-4 overflow-x-auto my-4 text-[12.5px] font-mono leading-relaxed border border-zinc-800"><code>${escaped}</code></pre>`
      );
      continue;
    }

    // Table
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
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
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        items.push(`<li class="leading-relaxed">${inlineFmt(lines[i].trim().replace(/^[-*•]\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ul class="my-2.5 ml-5 list-disc space-y-1 text-[13px] text-zinc-700 dark:text-zinc-300">${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(`<li class="leading-relaxed">${inlineFmt(lines[i].trim().replace(/^\d+\.\s/, ""))}</li>`);
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
