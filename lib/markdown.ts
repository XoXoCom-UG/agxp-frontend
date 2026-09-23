/**
 * markdown.ts — shared, XSS-safe markdown renderer used by the main chat and
 * the right-side help panel.
 *
 * SECURITY: all raw text is HTML-escaped BEFORE markdown parsing. The renderer
 * only ever emits tags it generates itself — user/model content can never
 * inject markup (XSS via dangerouslySetInnerHTML).
 */

import { renderDocVisual } from "@/lib/doc-visuals";

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
    .replace(/`([^`]+)`/g, '<code class="md-tick">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em class='opacity-80'>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) =>
      `<a href="${safeUrl(url)}" class="md-link" target="_blank" rel="noopener noreferrer">${label}</a>`);
}

function renderTable(rows: string[]): string {
  const isSep = (r: string) => /^\|[\s|:-]+\|$/.test(r.trim());
  const parseRow = (r: string) =>
    r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const dataRows = rows.filter(r => !isSep(r) && r.trim());
  if (!dataRows.length) return "";
  const [head, ...body] = dataRows;
  const ths = parseRow(head).map(h =>
    `<th>${inlineFmt(h)}</th>`
  ).join("");
  const trs = body.map(r => {
    const tds = parseRow(r).map(c =>
      `<td>${inlineFmt(c)}</td>`
    ).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
  return `<div class="md-table"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
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
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const escaped = codeLines.join("\n"); // already HTML-escaped globally

      // An agxp-* fence is a graphic of the deliverable, not source code.
      const visual = renderDocVisual(lang, escaped);
      if (visual) { out.push(visual); continue; }

      out.push(
        // Hardcoded zinc classes before this: the block was the same near-black
        // in both themes, and it ignored every token in the design system.
        `<div class="md-code">${lang ? `<span class="md-code-lang">${lang}</span>` : ""}` +
        `<pre><code>${escaped}</code></pre></div>`
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
        "md-h1",
        "md-h2",
        "md-h3",
        "md-h4",
      ][lvl - 1] ?? "text-sm font-semibold mt-2 mb-1";
      out.push(`<h${lvl} class="${cls}">${txt}</h${lvl}>`);
      i++; continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      out.push('<hr class="md-rule" />');
      i++; continue;
    }

    // Unordered list
    if (/^[-*•]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        items.push(`<li>${inlineFmt(lines[i].trim().replace(/^[-*•]\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ul class="md-ul">${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(`<li>${inlineFmt(lines[i].trim().replace(/^\d+\.\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ol class="md-ol">${items.join("")}</ol>`);
      continue;
    }

    // Empty line → spacer
    if (!trimmed) {
      out.push('<div class="h-2"></div>');
      i++; continue;
    }

    // Normal paragraph
    out.push(`<p>${inlineFmt(trimmed)}</p>`);
    i++;
  }

  return out.join("");
}
