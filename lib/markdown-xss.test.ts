import { test } from "node:test";
import assert from "node:assert/strict";
import { md } from "./markdown.ts";

/**
 * The agent's answers are rendered with dangerouslySetInnerHTML, and what the
 * agent writes can be steered by anything it reads — an uploaded PDF, a pasted
 * email. So every path through md() must come out escaped: plain text, the
 * agxp-* visuals, code blocks, links, headings. A single raw tag here is a
 * stored XSS in someone's project.
 */

const PAYLOAD = `<img src=x onerror=alert(1)>"'><script>alert(2)</script><a href="javascript:alert(4)">`;
const UNSAFE = /<img\b|<script\b|<[a-z][^>]*\son[a-z]+\s*=|href="\s*(javascript|data|vbscript):/i;

const BLOCKS = ["agxp-kpi", "agxp-gap", "agxp-flow", "agxp-roadmap", "agxp-risks", "agxp-stakeholders", "js", "python", ""];

for (const lang of BLOCKS) {
  test(`model output stays escaped in a ${lang || "plain"} block`, () => {
    const rows = [
      PAYLOAD,
      `${PAYLOAD} | ${PAYLOAD} | ${PAYLOAD} | ${PAYLOAD}`,
      `${PAYLOAD}|${PAYLOAD}|${PAYLOAD}|${PAYLOAD}|${PAYLOAD}|${PAYLOAD}`,
      `Phase ${PAYLOAD} | ${PAYLOAD} | 3 | ${PAYLOAD}`,
    ];
    const out = md("```" + lang + "\n" + rows.join("\n") + "\n```");
    assert.doesNotMatch(out, UNSAFE);
  });
}

test("links, emphasis, inline code and headings stay escaped", () => {
  const out = md(
    `[x](javascript:alert(3)) [y](${PAYLOAD}) **${PAYLOAD}** \`${PAYLOAD}\`\n\n## ${PAYLOAD}\n- ${PAYLOAD}\n\n${PAYLOAD}`,
  );
  assert.doesNotMatch(out, UNSAFE);
});
