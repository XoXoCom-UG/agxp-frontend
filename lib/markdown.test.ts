import { test } from "node:test";
import assert from "node:assert/strict";
import { md } from "./markdown.ts";

/**
 * md() output goes straight into dangerouslySetInnerHTML, and its input is
 * model output that can quote the user — so anything a person can type must
 * come out as text. These payloads are the usual ways that goes wrong.
 */

/** Every tag md() and the doc visuals are allowed to emit. */
const ALLOWED_TAGS = new Set([
  "a", "b", "button", "code", "div", "em", "h1", "h2", "h3", "h4", "hr", "i", "li", "ol",
  "p", "path", "rect", "circle", "span", "strong", "svg", "table", "tbody", "td", "th", "thead", "tr", "ul",
]);

/** The tags in a piece of HTML, with their attribute text. */
function tags(html: string): { name: string; attrs: string }[] {
  return Array.from(html.matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g), m => ({ name: m[1].toLowerCase(), attrs: m[2] }));
}

/** Fails if the HTML holds anything but md()'s own markup. */
function assertSafe(html: string, label: string) {
  for (const t of tags(html)) {
    assert.ok(ALLOWED_TAGS.has(t.name), `${label}: unexpected <${t.name}> in ${html}`);
    assert.doesNotMatch(t.attrs, /(^|[\s"'/])on[a-z]+\s*=/i, `${label}: event handler attribute on <${t.name}>`);
    assert.doesNotMatch(t.attrs, /(href|src)\s*=\s*["']?\s*(javascript|data|vbscript):/i, `${label}: dangerous URL on <${t.name}>`);
    // Each attribute is name="value" with no stray quote left to close early.
    const rest = t.attrs.replace(/\s[\w-]+="[^"]*"/g, "").replace(/\s[\w-]+='[^']*'/g, "").replace(/\s*\/$/, "").trim();
    assert.equal(rest, "", `${label}: unparsed attribute text on <${t.name}>: ${rest}`);
  }
  // Every "<" left over is the start of one of the tags checked above.
  const stray = html.replace(/<\/?[a-zA-Z][\w-]*[^>]*>/g, "");
  assert.ok(!stray.includes("<"), `${label}: raw "<" in text: ${stray}`);
}

const PAYLOADS: Record<string, string> = {
  "script tag": "<script>alert(1)</script>",
  "img onerror": '<img src=x onerror="alert(1)">',
  "svg onload": "<svg/onload=alert(1)>",
  "javascript link": "[click me](javascript:alert(1))",
  "mixed-case javascript link": "[click me](JaVaScRiPt:alert(1))",
  "data link": "[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
  "quote in href": '[x](https://example.com/"onmouseover="alert(1))',
  "single quote in href": "[x](https://example.com/'onmouseover='alert(1))",
  "quote in link text": '[a" onclick="alert(1)](https://example.com)',
  "tag in link text": "[<img src=x onerror=alert(1)>](https://example.com)",
  "markdown inside href": "[x](https://example.com/**bold**/*em*)",
  "heading": "# <b onmouseover=alert(1)>hi</b>",
  "list item": "- <iframe src=javascript:alert(1)>",
  "table cell": '| a | b |\n|---|---|\n| <img src=x onerror=alert(1)> | "><script>x</script> |',
  "inline code": "`<script>alert(1)</script>`",
  "code fence filename (colon)": '```tsx:"><img src=x onerror=alert(1)>\nconst a = 1;\n```',
  "code fence filename (title=)": "```js title=\"a.js\" onmouseover=\"alert(1)\"\nx()\n```",
  "code fence first-line filename": "```\n// \"><svg onload=alert(1)>.js\nx\n```",
  "code fence body": "```html\n<script>alert(1)</script>\n\"'><img src=x onerror=alert(1)>\n```",
  "code fence language": "```<img/src/onerror=alert(1)>\nx\n```",
  "kpi block": '```agxp-kpi\n<img src=x onerror=alert(1)> | "><script>1</script> | good\n```',
  "gap block": '```agxp-gap\n"><b onclick=x> | 10" onmouseover="x | 5 | <i>min</i>\n```',
  "flow block": "```agxp-flow\nas-is: <script>a</script> | \" onclick=\"x*\n```",
  "roadmap block": "```agxp-roadmap\n<img onerror=x> | a; \"><b>; <svg onload=x>\n```",
  "risks block": "```agxp-risks\n\"><img src=x onerror=alert(1)> | high | high\n```",
  "stakeholders block": "```agxp-stakeholders\n<b onclick=x> | 3\" onclick=\"x | support<script> | high | '><img onerror=x>\n```",
  "link placeholder smuggling": "[a](https://x)0 1",
};

for (const [label, input] of Object.entries(PAYLOADS)) {
  test(`md() keeps ${label} inert`, () => {
    assertSafe(md(input), label);
  });
}

test("a javascript: link is neutralised, not dropped", () => {
  const html = md("[click me](javascript:alert(1))");
  assert.match(html, /<a href="#"/);
  assert.match(html, />click me<\/a>/);
});

test("a normal link still works, with its formatting kept outside the href", () => {
  const html = md("See [the **docs**](https://example.com/a**b**c) now");
  assert.match(html, /<a href="https:\/\/example\.com\/a\*\*b\*\*c" class="md-link"[^>]*>the <strong>docs<\/strong><\/a>/);
});

test("the code panel uses the shared icon set", () => {
  const html = md("```ts\nconst a = 1;\n```");
  assert.match(html, /class="cb-copy"/);
  assert.match(html, /stroke-width="2"/);
});
