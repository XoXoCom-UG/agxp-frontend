import { test } from "node:test";
import assert from "node:assert/strict";
import { resumeLine } from "./resume-line.ts";

test("the consultant's open question is the line", () => {
  const l = resumeLine("Gut, das Budget kennen wir. Wer entscheidet am Ende über den Start? [[CHOICES: Ich|Mein Chef]] [[TOPIC: 3/8 Stakeholder]]");
  assert.deepEqual(l, { kind: "question", text: "Wer entscheidet am Ende über den Start?" });
});

test("a finished document says so, by its title", () => {
  assert.deepEqual(resumeLine("# Konzept\n\n- a\n[[DOC: Transformation Concept]]"), { kind: "doc", text: "Transformation Concept" });
});

test("no question: the start of what was said, cut at a word", () => {
  const l = resumeLine("**Hier** ist der erste Entwurf deiner Methoden, schau ihn dir im Cockpit an und sag mir, was fehlt oder was ich ändern soll, dann geht es weiter.");
  assert.equal(l?.kind, "said");
  assert.ok(l!.text.endsWith("…") && l!.text.length <= 91);
  assert.ok(!l!.text.includes("*"));
});

test("an empty message gives nothing", () => {
  assert.equal(resumeLine("[[PROGRESS: 10]]"), null);
});
