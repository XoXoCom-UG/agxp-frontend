import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DE, translate } from "./i18n.ts";

/** The files that ask for translations. A string added there without its
 *  German shows up in English on the German screen — this catches it. */
const FILES = [
  "components/layout/agent-nav.tsx",
  "components/layout/home-screen.tsx",
  "components/layout/settings-sheet.tsx",
  "components/layout/right-tabs.tsx",
  "components/layout/confirm-dialog.tsx",
  "components/layout/chat/chat-composer.tsx",
  "components/layout/chat/chat-head.tsx",
  "components/layout/agent-picker-panel.tsx",
  "app/dashboard/history/page.tsx",
];

test("every literal passed to t() / tr() has its German", () => {
  const missing: string[] = [];
  for (const f of FILES) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    for (const m of src.matchAll(/\btr?\("((?:[^"\\]|\\.)*)"/g)) {
      const key = JSON.parse(`"${m[1]}"`) as string;
      if (!(key in DE)) missing.push(`${f}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("the German keeps every slot of the English", () => {
  const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const [en, de] of Object.entries(DE)) assert.deepEqual(slots(de), slots(en), en);
});

test("translate fills slots and falls back to English", () => {
  assert.equal(translate("de", "Select {name}", { name: "Ada" }), "Ada auswählen");
  assert.equal(translate("en", "Select {name}", { name: "Ada" }), "Select Ada");
  assert.equal(translate("de", "Not in the dictionary"), "Not in the dictionary");
});

test("agoStr's English turns into German", () => {
  assert.equal(translate("de", "5m ago"), "vor 5 Min.");
  assert.equal(translate("de", "1w ago"), "vor 1 Woche");
  assert.equal(translate("de", "3d ago"), "vor 3 Tagen");
  assert.equal(translate("de", "Yesterday"), "gestern");
});
