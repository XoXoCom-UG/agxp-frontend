import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLanguage, replyLanguage, languagePrompt, languageNote, typedByUser } from "./reply-language.ts";

test("the tester's English conversation reads as English", () => {
  // The turns from the screenshot of 2026-11-03, where the Consultant switched to German.
  assert.equal(detectLanguage([
    "i want to build an app that helps people pick outfits from their wardrobe",
    "all of them, i am a computer science student, already working on a project which uses ai",
    "Build it myself",
  ]), "en");
});

test("German reads as German, umlauts included", () => {
  assert.equal(detectLanguage(["Es gibt noch einen Mitgesellschafter"]), "de");
  assert.equal(detectLanguage(["Wir möchten die Aufträge über eine Plattform abwickeln, weil es schneller geht"]), "de");
});

test("the latest messages decide, so a switch is followed", () => {
  const early = ["Ich habe eine Idee für eine App und möchte wissen, ob das funktioniert"];
  assert.equal(detectLanguage([...early, "Actually, can we continue in English? I think it is easier for me"]), "en");
});

test("too little to go on says nothing", () => {
  assert.equal(detectLanguage(["ok"]), null);
  assert.equal(detectLanguage(["Spotify"]), null);
  assert.equal(detectLanguage([]), null);
});

test("markers are not the person's words", () => {
  assert.equal(detectLanguage(["[[FILE: u/p/x.pdf | the plan for the and with that | application/pdf]]"]), null);
});

test("the other panel decides only when this one says nothing", () => {
  assert.equal(replyLanguage(["ok"], ["I would like to start with the plan for my team"]), "en");
  assert.equal(replyLanguage(["Ich möchte mit dem Plan anfangen"], ["I would like to start with the plan"]), "de");
});

test("the instruction is in the language it asks for, and nothing when unsure", () => {
  assert.match(languagePrompt("en"), /user writes in English/);
  assert.match(languagePrompt("en"), /CHOICES/);
  assert.match(languagePrompt("de"), /Nutzer schreibt Deutsch/);
  assert.equal(languagePrompt(null), "");
});

test("a click on an offered option is the agent's words, not the person's", () => {
  // The Coach conversation of 2026-11-03: the options were German, the person writes English.
  const turns = [
    { role: "user" as const, content: "i only have testers" },
    { role: "assistant" as const, content: "Testers — gut. Wie viele? [[CHOICES: 2-3 Freunde|5-10 Leute aus dem Studium]]" },
    { role: "user" as const, content: "2-3 Freunde" },
    { role: "assistant" as const, content: "Gut. [[CHOICES: Regelmäßig, laufend|Noch nicht gestartet, nur angekündigt]]" },
    { role: "user" as const, content: "Noch nicht gestartet, nur angekündigt" },
  ];
  assert.deepEqual(typedByUser(turns, () => false), ["i only have testers"]);
});

test("the app's own commands are left out", () => {
  const turns = [
    { role: "user" as const, content: "(Systemhinweis, nicht vom Nutzer geschrieben. Melde dich kurz.)" },
    { role: "user" as const, content: "yes, we can leave out the try on function for the start" },
  ];
  assert.deepEqual(typedByUser(turns, t => t.startsWith("(Systemhinweis")), ["yes, we can leave out the try on function for the start"]);
});

test("typed text that only resembles an option still counts", () => {
  const turns = [
    { role: "assistant" as const, content: "[[CHOICES: Build it myself|With a team]]" },
    { role: "user" as const, content: "Build it myself, with a friend helping on the design" },
  ];
  assert.equal(typedByUser(turns, () => false).length, 1);
});

test("the note after the latest message is marked as the app's, in the language it asks for", () => {
  assert.match(languageNote("en"), /not written by the user/);
  assert.match(languageNote("en"), /Answer in English/);
  assert.match(languageNote("de"), /Antworte auf Deutsch/);
  assert.equal(languageNote(null), "");
});
