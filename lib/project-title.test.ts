import { test } from "node:test";
import assert from "node:assert/strict";
import { worthNaming } from "./project-title.ts";

test("a greeting is not a name", () => {
  for (const t of ["Hallo", "salut", "Hi there", "Hallo, wie geht's", "  ", ""]) {
    assert.equal(worthNaming(t), false, t);
  }
});

test("a short description of a task is", () => {
  assert.equal(worthNaming("Disposition automatisieren"), true);
  assert.equal(worthNaming("Wir wollen unsere Dispo mit KI verbessern"), true);
});
