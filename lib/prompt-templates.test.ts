import { test } from "node:test";
import assert from "node:assert/strict";
import { PROMPT_TEMPLATES, composeText, fieldsOf, fillText, nextBlank, partsOf, slotsOf, stepsOf } from "./prompt-templates.ts";
import { DE } from "./i18n.ts";

test("the small form lists each field once, in the order the sentences ask", () => {
  assert.deepEqual(fieldsOf(PROMPT_TEMPLATES[0]), ["role", "what", "goal", "who", "when"]);
});

test("a sentence with an empty field is left out whole, never a bracket", () => {
  const text = composeText(PROMPT_TEMPLATES[0], { role: " Head of IT ", what: "a new CRM", goal: "", who: "sales", when: "March" });
  assert.equal(text, "My role is Head of IT and I want to implement a new CRM. " +
    "The people involved are sales, and it has to be done by March.");
  assert.ok(!text.includes("["));
});

test("nothing filled in writes nothing", () => {
  assert.equal(composeText(PROMPT_TEMPLATES[0], {}), "");
});

test("every blank of every template gets its own question, with ready answers", () => {
  for (const t of PROMPT_TEMPLATES) {
    const steps = stepsOf(t);
    assert.deepEqual(steps.map(s => s.id), fieldsOf(t), t.id);
    for (const s of steps) {
      assert.ok(s.ask.endsWith("?"), `${t.id}.${s.id} asks a question`);
      assert.ok(s.options.length >= 3 && s.options.length <= 5, `${t.id}.${s.id} has 3-5 answers`);
    }
  }
});

test("a German screen asks and answers in German", () => {
  const missing: string[] = [];
  for (const t of PROMPT_TEMPLATES) {
    for (const s of stepsOf(t)) for (const text of [s.ask, ...s.options]) if (!(text in DE)) missing.push(text);
  }
  assert.deepEqual(missing, []);
});

test("a tapped answer reads as a sentence", () => {
  const t = PROMPT_TEMPLATES.find(x => x.id === "it-project")!;
  const [role, what] = stepsOf(t);
  assert.equal(composeText(t, { role: role.options[0], what: what.options[0] }),
    "My role is Head of IT and I want to implement a new CRM.");
});

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
