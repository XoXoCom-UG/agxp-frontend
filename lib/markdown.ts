/**
 * markdown.ts — shared, XSS-safe markdown renderer used by the main chat and
 * the right-side help panel.
 *
 * SECURITY: all raw text is HTML-escaped BEFORE markdown parsing. The renderer
 * only ever emits tags it generates itself — user/model content can never
 * inject markup (XSS via dangerouslySetInnerHTML).
 */

// Relative, with the extension: node's test runner loads this file directly
// (lib/markdown.test.ts) and knows nothing about the "@/" alias.
import { renderDocVisual } from "./doc-visuals.ts";
import { iconSvg } from "./icon-paths.ts";

function escapeHtml(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unescapeHtml(t: string): string {
  return t
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

// Light syntax colouring for fenced code: comments, strings, numbers,
// keywords and function calls. Tokenised on the RAW text and escaped piece
// by piece, so an escaped quote (&quot;) can never be mistaken for a string.
const KEYWORDS = new Set([
  "import", "from", "export", "default", "async", "function", "const", "let", "var", "await",
  "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new",
  "throw", "try", "catch", "finally", "class", "extends", "interface", "type", "enum", "public",
  "private", "protected", "static", "readonly", "implements", "in", "of", "as", "typeof", "instanceof",
  "null", "true", "false", "undefined", "this", "super", "yield", "void", "def", "elif", "lambda",
  "pass", "None", "True", "False", "with", "and", "or", "not", "is", "fn", "pub", "use", "mut", "impl",
  "struct", "select", "where", "insert", "update", "delete", "create", "table", "values", "into",
]);
// Strings, numbers, identifiers (a trailing "(" makes one a call), and the
// comment syntax of the language: # for the script languages, // and /* */
// for everything else.
const TOKEN_C = /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*)/g;
const TOKEN_HASH = /(#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*)/g;

function highlightLine(raw: string, lang: string): string {
  const re = /^(py|python|sh|bash|shell|zsh|yaml|yml|toml|rb|ruby|r)$/i.test(lang) ? TOKEN_HASH : TOKEN_C;
  let out = "";
  let last = 0;
  for (const m of raw.matchAll(re)) {
    const idx = m.index ?? 0;
    const t = m[0];
    if (idx > last) out += escapeHtml(raw.slice(last, idx));
    let cls = "";
    if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("#")) cls = "tk-com";
    else if (/^["'`\d]/.test(t)) cls = "tk-str";
    else if (KEYWORDS.has(t)) cls = "tk-kw";
    else if (/^\s*\(/.test(raw.slice(idx + t.length))) cls = "tk-fn";
    out += cls ? `<span class="${cls}">${escapeHtml(t)}</span>` : escapeHtml(t);
    last = idx + t.length;
  }
  if (last < raw.length) out += escapeHtml(raw.slice(last));
  // An empty line still needs height, or the numbers drift from the code.
  return out || " ";
}

// Same geometry as the React icon set, so the code panel never drifts from it.
const FILE_ICON = iconSvg("code", 15);
const COPY_ICON = iconSvg("copy", 11);
/** The copy button's two states swap in with the shared icon-swap animation. */
const COPY_ICON_SWAP = iconSvg("copy", 11, "icon-swap");
const CHECK_ICON_SWAP = iconSvg("check", 11, "icon-swap");
/** How long "Copied" stays before the button goes back to "Copy". */
const COPIED_MS = 1500;

const EXT: Record<string, string> = {
  javascript: "js", js: "js", jsx: "jsx", typescript: "ts", ts: "ts", tsx: "tsx",
  python: "py", py: "py", bash: "sh", sh: "sh", shell: "sh", zsh: "sh", json: "json",
  css: "css", scss: "scss", html: "html", xml: "xml", sql: "sql", yaml: "yml", yml: "yml",
  toml: "toml", md: "md", markdown: "md", go: "go", rust: "rs", rs: "rs", java: "java",
  kotlin: "kt", swift: "swift", ruby: "rb", rb: "rb", php: "php", c: "c", cpp: "cpp", csharp: "cs", cs: "cs",
};
const FILE_NAME = /^[\w@.\-/]+\.[A-Za-z0-9]{1,8}$/;

/**
 * The header names the file, not the language. In order: a name after the
 * language in the fence (```tsx:src/Search.tsx, or title="..."), a first-line
 * comment that is just a file name (// Search.js, # app.py — then it is not
 * repeated in the body), and last a generic name with the right extension.
 */
function fileNameFor(info: string, lines: string[]): { name: string; lang: string; body: string[] } {
  let lang = info;
  let name = "";
  const colon = info.match(/^([\w+#-]+):(\S+)/);
  const titled = info.match(/^([\w+#-]*)\s+(?:title|file|filename)=["']?([^"'\s]+)["']?/);
  if (colon) { lang = colon[1]; name = colon[2]; }
  else if (titled) { lang = titled[1]; name = titled[2]; }
  else if (/^\S+\s+\S+\.\w+$/.test(info)) { [lang, name] = info.split(/\s+/); }
  let body = lines;
  if (!name && lines.length) {
    const first = lines[0].trim().match(/^(?:\/\/|#|--|\/\*)\s*([^\s*]+)\s*(?:\*\/)?$/);
    if (first && FILE_NAME.test(first[1])) {
      name = first[1];
      body = lines.slice(1);
      while (body.length && !body[0].trim()) body = body.slice(1);
    }
  }
  if (!name) name = `snippet.${EXT[lang.toLowerCase()] ?? (lang ? lang.toLowerCase() : "txt")}`;
  return { name, lang, body };
}

/** A code panel: file header with a Copy button, a line-numbered listing
 *  with a gutter rule, light syntax colouring, and wrapping lines. */
function renderCodeBlock(info: string, escapedLines: string[]): string {
  const raw = escapedLines.map(unescapeHtml);
  while (raw.length && !raw[raw.length - 1].trim()) raw.pop();
  const { name, lang, body: rawLines } = fileNameFor(unescapeHtml(info), raw);
  const label = escapeHtml(name);
  const rows = rawLines.map((l, i) =>
    `<div class="cb-line"><span class="cb-num">${i + 1}</span><code>${highlightLine(l, lang)}</code></div>`,
  ).join("");
  return `<div class="md-code">` +
    `<div class="cb-head"><span class="cb-file">${FILE_ICON}<span class="cb-name">${label}</span></span>` +
    `<button type="button" class="cb-copy" aria-label="Copy code">${COPY_ICON}<span>Copy</span></button></div>` +
    `<div class="cb-body"><span class="cb-rule" aria-hidden="true"></span>${rows}</div></div>`;
}

/**
 * Copy for the code panels. The markup is a string, so there is no React
 * handler on the button — the chat (or the document) passes its clicks here.
 */
export function handleCodeCopyClick(e: { target: EventTarget | null }): void {
  const el = e.target instanceof Element ? e.target.closest(".cb-copy") : null;
  if (!el) return;
  const block = el.closest(".md-code");
  if (!block) return;
  const text = Array.from(block.querySelectorAll(".cb-line code")).map(c => (c.textContent === " " ? "" : c.textContent ?? "")).join("\n");
  const label = el.querySelector("span");
  navigator.clipboard?.writeText(text).then(() => {
    el.classList.add("is-done");
    el.innerHTML = `${CHECK_ICON_SWAP}<span>Copied</span>`;
    setTimeout(() => {
      el.classList.remove("is-done");
      el.innerHTML = `${COPY_ICON_SWAP}<span>Copy</span>`;
    }, COPIED_MS);
  }).catch(() => { if (label) label.textContent = "Copy failed"; });
}

// Only allow safe link protocols (blocks javascript:, data:, vbscript: …)
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : "#";
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
/** Marks where a finished link sits while the rest of the line is formatted. */
const SLOT = /\uE000(\d+)\uE000/g;

function emphasis(t: string): string {
  return t
    .replace(/`([^`]+)`/g, '<code class="md-tick">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em class='opacity-80'>$1</em>");
}

/**
 * Links are cut out first and put back last. Formatted in place, a URL with
 * `**` in it grew a <strong> inside its href, and a `*` in the URL could pair
 * with one in the label and wrap an <em> across the tag. Nothing could break
 * out of the attribute (quotes are already escaped), but the markup was wrong.
 */
function inlineFmt(t: string): string {
  const links: string[] = [];
  const slotted = t.replace(LINK, (_m, label: string, url: string) => {
    links.push(`<a href="${safeUrl(url)}" class="md-link" target="_blank" rel="noopener noreferrer">${emphasis(label)}</a>`);
    return `\uE000${links.length - 1}\uE000`;
  });
  return emphasis(slotted).replace(SLOT, (_m, n: string) => links[Number(n)] ?? "");
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
  // U+E000 (private use) is the link placeholder in inlineFmt, so none may come in from outside.
  const lines = escapeHtml(raw.replace(/\uE000/g, "")).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
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

      out.push(renderCodeBlock(lang, codeLines));
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
