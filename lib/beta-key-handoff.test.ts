import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBetaHash } from "./beta-key-handoff.ts";

test("reads the key from a #beta= fragment", () => {
  assert.equal(parseBetaHash("#beta=AGXP-7K2M-Q9TR"), "AGXP-7K2M-Q9TR");
});

test("normalises case and surrounding space", () => {
  assert.equal(parseBetaHash("#beta=%20agxp-7k2m%20"), "AGXP-7K2M");
});

test("ignores other fragment parameters", () => {
  assert.equal(parseBetaHash("#x=1&beta=AGXP-1234"), "AGXP-1234");
});

test("returns null without a key", () => {
  assert.equal(parseBetaHash(""), null);
  assert.equal(parseBetaHash("#"), null);
  assert.equal(parseBetaHash("#beta="), null);
});

test("rejects anything that isn't key-shaped", () => {
  assert.equal(parseBetaHash("#beta=<script>"), null);
  assert.equal(parseBetaHash("#beta=AB"), null);
  assert.equal(parseBetaHash("#beta=" + "A".repeat(80)), null);
});
