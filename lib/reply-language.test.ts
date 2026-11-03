import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLanguage, replyLanguage, languagePrompt } from "./reply-language.ts";

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
