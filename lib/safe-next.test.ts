import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./safe-next.ts";

test("a path inside the app is kept", () => {
  assert.equal(safeNext("/dashboard/project/50914afc-c8af-4fc1-9c60-29dd39949f31"), "/dashboard/project/50914afc-c8af-4fc1-9c60-29dd39949f31");
  assert.equal(safeNext("/dashboard/history?status=Archived"), "/dashboard/history?status=Archived");
  assert.equal(safeNext("/dashboard"), "/dashboard");
  assert.equal(safeNext("/metrics"), "/metrics");
});

test("anything else falls back to the dashboard", () => {
  for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil.example",
    "/dashboardevil", "/metricsevil", "/metrics//evil.example", "/login", "/dashboard//evil.example", "/dashboard/\\x", "javascript:alert(1)"]) {
    assert.equal(safeNext(bad), "/dashboard", String(bad));
  }
});
