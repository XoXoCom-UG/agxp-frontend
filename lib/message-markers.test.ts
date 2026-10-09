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
  "[[INDUSTRY: Logistics]]",
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
  assert.equal(p.industry, "Logistics");
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

test("an attachment is parsed out of the user's own message", () => {
  const sent = [
    "Hier ist unsere Prozessbeschreibung.",
    "[[FILE: 7f3a/2b11/c9.pdf | Prozess Rechnungseingang.pdf | application/pdf]]",
  ].join("\n");
  const p = parseMarkers(sent);
  assert.equal(p.text, "Hier ist unsere Prozessbeschreibung.");
  assert.deepEqual(p.files, [{
    path: "7f3a/2b11/c9.pdf",
    name: "Prozess Rechnungseingang.pdf",
    mime: "application/pdf",
  }]);
});

test("several attachments, and a name containing a pipe is not lost to the split", () => {
  const p = parseMarkers([
    "Zwei Dateien:",
    "[[FILE: u/p/a.png | Organigramm.png | image/png]]",
    "[[FILE: u/p/b.csv | preise.csv | text/csv]]",
  ].join("\n"));
  assert.equal(p.files.length, 2);
  assert.deepEqual(p.files.map(f => f.name), ["Organigramm.png", "preise.csv"]);
  assert.equal(p.text, "Zwei Dateien:");
});

test("a message that is only an attachment leaves no stray whitespace", () => {
  const p = parseMarkers("[[FILE: u/p/a.pdf | a.pdf | application/pdf]]");
  assert.equal(p.text, "");
  assert.equal(p.files.length, 1);
});

test("a malformed FILE marker is dropped rather than shown", () => {
  // No path: nothing to fetch, so it is not an attachment. It must still not
  // survive into the visible text as raw marker syntax.
  const p = parseMarkers("Text\n[[FILE: ]]");
  assert.deepEqual(p.files, []);
  assert.equal(p.text, "Text");
});

test("a half-written FILE marker never flashes while the text streams", () => {
  const full = "Hier.\n[[FILE: u/p/a.pdf | a.pdf | application/pdf]]";
  for (let i = 1; i <= full.length; i++) {
    const shown = streamingText(full.slice(0, i));
    assert.ok(!shown.includes("[["), `leaked at ${i}: ${JSON.stringify(shown)}`);
  }
});

test("[[TITLE:]] gives the project a name and a one-line description", () => {
  const p = parseMarkers("Gut, dann fangen wir an. [[TITLE: Disposition automatisieren | Tourenplanung von 12 auf 3 Minuten]]");
  assert.deepEqual(p.title, {
    name: "Disposition automatisieren",
    description: "Tourenplanung von 12 auf 3 Minuten",
  });
  // The marker itself never reaches the screen.
  assert.equal(p.text.includes("TITLE"), false);
  assert.equal(p.text.trim(), "Gut, dann fangen wir an.");
});

test("a title without a description is still a title", () => {
  // Dropping the whole marker over a missing sentence would leave the
  // project called "New Project" forever.
  const p = parseMarkers("[[TITLE: Claims triage]]");
  assert.deepEqual(p.title, { name: "Claims triage", description: "" });
});

test("a description containing a pipe keeps it", () => {
  const p = parseMarkers("[[TITLE: Rollout | Pilot | dann alle Regionen]]");
  assert.equal(p.title?.name, "Rollout");
  assert.equal(p.title?.description, "Pilot | dann alle Regionen");
});

test("an empty or missing title marker is no title, never an empty name", () => {
  assert.equal(parseMarkers("Keine Marker hier.").title, null);
  // A model that emits the marker with nothing in it must not blank the name.
  assert.equal(parseMarkers("[[TITLE: ]]").title, null);
  assert.equal(parseMarkers("[[TITLE: | nur Beschreibung]]").title, null);
});
