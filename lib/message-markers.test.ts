import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMarkers, streamingText, streamIsDocument, looksLikeDocument } from "./message-markers.ts";

/** A realistic reply: prose, a question, and every marker the prompt asks for. */
const REPLY = [
  "Verstanden — 800 Rechnungen im Monat ist eine Menge.",
  "",
  "Wie lange dauert die Erfassung pro Rechnung ungefähr?",
  "[[CHOICES: 6-8 Minuten|Unter 5 Minuten|Weiß ich nicht]]",
  "[[TOPIC: 4/8 Pain points]]",
  "[[PROGRESS: 35]]",
  "[[MEMORY: branche | Der Nutzer arbeitet in der Logistik]]",
].join("\n");

test("parseMarkers pulls every marker out of the visible text", () => {
  const p = parseMarkers(REPLY);
  assert.equal(p.text, "Verstanden — 800 Rechnungen im Monat ist eine Menge.\n\nWie lange dauert die Erfassung pro Rechnung ungefähr?");
  assert.deepEqual(p.choices, ["6-8 Minuten", "Unter 5 Minuten", "Weiß ich nicht"]);
  assert.equal(p.progress, 35);
  assert.equal(p.topic?.index, 4);
  assert.equal(p.topic?.total, 8);
  assert.equal(p.topic?.label, "Pain points");
  assert.deepEqual(p.memories, [{ kind: "branche", fact: "Der Nutzer arbeitet in der Logistik" }]);
});

test("no marker fragment is ever visible while streaming", () => {
  // The answer arrives a piece at a time; every prefix is a frame the user can
  // actually see. The first version of streamingText leaked four of them — the
  // moment the first of the two closing brackets landed, the regex stopped
  // matching and the whole marker flashed into the chat.
  for (let i = 1; i <= REPLY.length; i++) {
    const visible = streamingText(REPLY.slice(0, i));
    assert.ok(!visible.includes("[["), `leaked "[[" at ${i}: ${visible.slice(-40)}`);
    assert.ok(!visible.includes("]]"), `leaked "]]" at ${i}: ${visible.slice(-40)}`);
  }
});

test("streaming text ends up equal to the parsed text", () => {
  assert.equal(streamingText(REPLY), parseMarkers(REPLY).text);
});

test("a document is recognised from its first chunk, a normal answer is not", () => {
  assert.equal(streamIsDocument("[[DOC: "), true);
  assert.equal(streamIsDocument("[[DOC: Transformation Concept]]\n# Transformation Concept"), true);
  assert.equal(streamIsDocument(REPLY), false);
});

test("a long sectioned answer counts as a document even without the marker", () => {
  const doc = "# Transformation Concept\n" + "## Section\nbody text here.\n".repeat(40);
  assert.equal(looksLikeDocument(doc, "Transformation Concept"), true);
  assert.equal(looksLikeDocument(parseMarkers(REPLY).text, "Transformation Concept"), false);
});
