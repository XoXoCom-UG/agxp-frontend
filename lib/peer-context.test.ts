import { test } from "node:test";
import assert from "node:assert/strict";
import { peerTranscript } from "./peer-context.ts";

const words = (n: number) => Array.from({ length: n }, (_, i) => `wort${i}`).join(" ");

test("the newest answer is kept long enough to be answered (the debate)", () => {
  // Three arguments and a question: about 700 characters, which the old
  // per-turn cut of 420 chopped in the middle of a sentence.
  const debate = "1. " + words(40) + ".\n2. " + words(40) + ".\n3. " + words(40) + ".\nWas wiegt für dich schwerer?";
  assert.ok(debate.length > 420 && debate.length < 1600);
  const out = peerTranscript([
    { role: "user", content: "Gegenseite bitte" },
    { role: "assistant", content: debate },
  ], "Coach");
  assert.ok(out.includes("Was wiegt für dich schwerer?"), out);
  assert.ok(!out.includes("…"));
});

test("older answers are still shortened, and cut at a word", () => {
  const long = words(200);
  const out = peerTranscript([
    { role: "assistant", content: long },
    { role: "user", content: "ok" },
    { role: "assistant", content: "kurz" },
  ], "Coach");
  const first = out.split("\n")[0];
  assert.ok(first.endsWith("…"), first);
  assert.ok(first.length < 460, String(first.length));
  // no half word before the ellipsis
  assert.match(first, /wort\d+…$/);
  const last = first.slice(0, -1).split(" ").pop()!;
  assert.ok(Number(last.slice(4)) < 200 && words(200).includes(last));
});

test("a very long newest answer is cut too, not passed whole", () => {
  const out = peerTranscript([{ role: "assistant", content: words(900) }], "Coach");
  assert.ok(out.length < 1700 && out.endsWith("…"), String(out.length));
});
