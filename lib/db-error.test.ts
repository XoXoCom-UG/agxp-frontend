import { test } from "node:test";
import assert from "node:assert/strict";
import { describeDbError, isNetworkError, NETWORK_ERROR } from "./db-error.ts";
import { DE, translate } from "./i18n.ts";

// What supabase-js hands back when the browser could not send the request:
// the browser's own words as the message, its whole stack as the details.
const dropped = (message: string) => ({
  message,
  details: `${message}\n    at window.fetch (<anonymous>:9:11)\n    at fetch.u (http://localhost:3100/_next/static/chunks/a.js:15:57345)`,
  hint: "",
  code: "",
});

test("a dropped request reads as one plain sentence, in every browser's wording", () => {
  for (const m of ["TypeError: Failed to fetch", "TypeError: Load failed", "TypeError: NetworkError when attempting to fetch resource."]) {
    assert.ok(isNetworkError(dropped(m)), m);
    assert.equal(describeDbError(dropped(m), "Choosing the consultant"), NETWORK_ERROR);
  }
});

test("the network message has its German", () => {
  assert.ok(DE[NETWORK_ERROR]);
  assert.equal(translate("de", NETWORK_ERROR),
    "Die Verbindung zum Server ist abgebrochen. Prüfe deine Internetverbindung und versuch es erneut.");
});

test("a stack trace never reaches the screen", () => {
  const e = { message: "Something odd", details: "Error: x\n    at f (file.js:1:2)", code: "" };
  const shown = describeDbError(e, "Loading this task");
  assert.equal(shown, "Loading this task failed: Something odd");
});

test("database errors keep their code and their fix", () => {
  assert.match(describeDbError({ message: "new row violates row-level security policy", code: "42501" }), /^\[42501\]/);
  assert.equal(isNetworkError({ message: "new row violates row-level security policy", code: "42501" }), false);
});
