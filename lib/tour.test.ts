import { test } from "node:test";
import assert from "node:assert/strict";
import { tourSeen, TOUR_VERSION, TOUR_STEPS } from "./tour.ts";

test("never seen means never seen, whatever shape the nothing arrives in", () => {
  assert.equal(tourSeen(undefined, null), false);
  assert.equal(tourSeen(null, null), false);
  // A half-written or hand-edited value is not a version. It must read as
  // unseen rather than silently counting as seen — the tour is the one thing
  // a new account should not miss.
  assert.equal(tourSeen("yes", null), false);
  assert.equal(tourSeen({}, null), false);
  assert.equal(tourSeen(NaN, "nope"), false);
});

test("either side saying seen is enough", () => {
  // They disagree whenever a write failed, or a second machine is involved.
  assert.equal(tourSeen(TOUR_VERSION, null), true);
  assert.equal(tourSeen(undefined, String(TOUR_VERSION)), true);
  // Supabase hands metadata back as JSON, so the number may arrive as a
  // string. Both are the same answer.
  assert.equal(tourSeen(String(TOUR_VERSION), null), true);
});

test("a newer tour replays; a rolled-back one does not re-nag", () => {
  assert.equal(tourSeen(TOUR_VERSION - 1, null), false);
  assert.equal(tourSeen(null, String(TOUR_VERSION - 1)), false);
  // Someone who saw a LATER version has certainly seen this one.
  assert.equal(tourSeen(TOUR_VERSION + 5, null), true);
});

test("the steps are a usable sequence", () => {
  assert.ok(TOUR_STEPS.length >= 3, "a two-step tour is a dialog, not a tour");
  const ids = TOUR_STEPS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length, "ids are React keys and scene switches");
  // The first and last carry the promise and the exit; losing either is how a
  // tour starts mid-thought or ends without telling you it is over.
  assert.equal(TOUR_STEPS[0].id, "hello");
  assert.equal(TOUR_STEPS[TOUR_STEPS.length - 1].id, "go");
  for (const s of TOUR_STEPS) {
    assert.ok(s.tag.length > 0 && s.tag.length <= 10, `${s.id}: the rail tag has to fit on a phone`);
    assert.ok(s.title.length > 0 && s.line.length > 0, `${s.id}: every step says something`);
  }
});
