import { test } from "node:test";
import assert from "node:assert/strict";
import { PROMPT_TEMPLATES, fillText, nextBlank, partsOf, slotsOf } from "./prompt-templates.ts";
import { DE } from "./i18n.ts";

const first = PROMPT_TEMPLATES[0];

test("a template writes its sentences with every blank named in square brackets", () => {
  assert.equal(fillText(first),
    "My role is [your role] and I want to implement [what you want to implement]. " +
    "It should help us [your goal]. " +
    "The people involved are [who is involved], and it has to be done by [the deadline].");
});

test("the sentences and the blank names go through the translator", () => {
  const out = fillText(PROMPT_TEMPLATES[5], s => `<${s}>`);
  assert.equal(out, "<I am {role}. My problem is {problem}, and I do not know where to start.>"
    .replace("{role}", "[<your role>]").replace("{problem}", "[<your problem>]"));
});

test("a German screen writes German, blanks included", () => {
  const say = (s: string) => DE[s] ?? s;
  assert.equal(fillText(PROMPT_TEMPLATES[5], say),
    "Ich bin [deine Rolle]. Mein Problem ist [dein Problem], und ich weiß nicht, wo ich anfangen soll.");
});

test("nextBlank finds the blanks one after the other and says when none is left", () => {
  const t = "I am [your role]. My problem is [your problem].";
  assert.deepEqual(nextBlank(t, 0), [5, 16]);
  assert.deepEqual(nextBlank(t, 16), [32, 46]);
  assert.equal(nextBlank(t, 46), null);
  assert.equal(nextBlank("nothing to fill in", 0), null);
});

test("a sentence is cut into text and blanks", () => {
  assert.deepEqual(partsOf("My role is {role} and I want {what}."),
    [{ text: "My role is " }, { slot: "role" }, { text: " and I want " }, { slot: "what" }, { text: "." }]);
  assert.deepEqual(slotsOf("{a} and {b}"), ["a", "b"]);
});

test("every blank has a name, and every word has its German with the same blanks", () => {
  assert.equal(new Set(PROMPT_TEMPLATES.map(t => t.id)).size, PROMPT_TEMPLATES.length);
  const missing: string[] = [];
  for (const t of PROMPT_TEMPLATES) {
    const used = new Set(t.sentences.flatMap(slotsOf));
    assert.deepEqual([...used].sort(), Object.keys(t.hints).sort(), t.id);
    if (!(t.title in DE)) missing.push(t.title);
    for (const s of t.sentences) {
      const de = DE[s];
      if (!de) { missing.push(s); continue; }
      assert.deepEqual(slotsOf(de).sort(), slotsOf(s).sort(), `German keeps every blank: ${s}`);
    }
    for (const h of Object.values(t.hints)) if (!(h in DE)) missing.push(h);
  }
  assert.deepEqual(missing, []);
});
