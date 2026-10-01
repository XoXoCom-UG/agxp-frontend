import { test } from "node:test";
import assert from "node:assert/strict";
import { detectIndustries, rankIndustries } from "./industry.ts";

test("recognises an industry in German, English and Romanian", () => {
  assert.deepEqual(detectIndustries("Wir sind eine Bank in Hannover"), ["Banking"]);
  assert.deepEqual(detectIndustries("We run a logistics company"), ["Logistics"]);
  assert.deepEqual(detectIndustries("Lucrez la o bancă din Cluj"), ["Banking"]);
  assert.deepEqual(detectIndustries("Eine Versicherung mit 200 Leuten"), ["Insurance"]);
});

test("a word that only contains the keyword is not a match", () => {
  // The case the word boundaries exist for.
  assert.deepEqual(detectIndustries("Unsere Datenbank ist veraltet"), []);
  assert.deepEqual(detectIndustries("ich will ein neues Projekt starten"), []);
});

test("most mentions come first", () => {
  assert.deepEqual(
    detectIndustries("Software für Banken. Die Bank nutzt Bankwesen-Standards."),
    ["Banking", "Software & IT"],
  );
});

test("rankIndustries orders by frequency", () => {
  assert.deepEqual(rankIndustries(["Retail", "Banking", "Banking"]), ["Banking", "Retail"]);
  assert.deepEqual(rankIndustries([]), []);
});
