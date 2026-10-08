import { test } from "node:test";
import assert from "node:assert/strict";
import { placeBubble, TOUR_SPOTS, GAP, type Rect, type Box } from "./tour-spots.ts";

const VIEW: Box = { width: 1440, height: 900 };
const BUBBLE: Box = { width: 300, height: 160 };
/** Something in the middle of the screen, with room on every side. */
const MIDDLE: Rect = { x: 600, y: 400, width: 200, height: 60 };

test("the preferred side is used when it fits", () => {
  for (const side of ["top", "bottom", "left", "right"] as const) {
    assert.equal(placeBubble(MIDDLE, BUBBLE, VIEW, side).side, side);
  }
});

test("it sits beside the target, not on it", () => {
  const below = placeBubble(MIDDLE, BUBBLE, VIEW, "bottom");
  assert.equal(below.top, MIDDLE.y + MIDDLE.height + GAP);
  const above = placeBubble(MIDDLE, BUBBLE, VIEW, "top");
  assert.equal(above.top, MIDDLE.y - GAP - BUBBLE.height);
  // Centred on the target across the other axis.
  assert.equal(below.left, MIDDLE.x + MIDDLE.width / 2 - BUBBLE.width / 2);
});

test("no room on the preferred side flips it to the opposite one", () => {
  // The nav bar: hard against the top, so a bubble above it cannot fit.
  const nav: Rect = { x: 40, y: 8, width: 120, height: 34 };
  assert.equal(placeBubble(nav, BUBBLE, VIEW, "top").side, "bottom");

  // The composer: hard against the bottom.
  const composer: Rect = { x: 300, y: 820, width: 600, height: 64 };
  assert.equal(placeBubble(composer, BUBBLE, VIEW, "bottom").side, "top");

  // A panel flush against the left edge cannot take a bubble to its left.
  const leftPanel: Rect = { x: 0, y: 200, width: 400, height: 500 };
  assert.equal(placeBubble(leftPanel, BUBBLE, VIEW, "left").side, "right");
});

test("the bubble never leaves the window", () => {
  const corners: Rect[] = [
    { x: 0, y: 0, width: 40, height: 40 },                                   // top-left
    { x: VIEW.width - 40, y: 0, width: 40, height: 40 },                     // top-right
    { x: 0, y: VIEW.height - 40, width: 40, height: 40 },                    // bottom-left
    { x: VIEW.width - 40, y: VIEW.height - 40, width: 40, height: 40 },      // bottom-right
  ];
  for (const r of corners) {
    for (const side of ["top", "bottom", "left", "right"] as const) {
      const p = placeBubble(r, BUBBLE, VIEW, side);
      assert.ok(p.left >= 0, `left ${p.left} off the window`);
      assert.ok(p.top >= 0, `top ${p.top} off the window`);
      assert.ok(p.left + BUBBLE.width <= VIEW.width, `right edge ${p.left + BUBBLE.width} past ${VIEW.width}`);
      assert.ok(p.top + BUBBLE.height <= VIEW.height, `bottom edge ${p.top + BUBBLE.height} past ${VIEW.height}`);
    }
  }
});

test("a phone, where nothing fits beside anything", () => {
  // 360x640 with a bubble nearly as wide as the screen: every side is too
  // tight, so it has to pick the roomiest and stay on screen anyway.
  const phone: Box = { width: 360, height: 640 };
  const wide: Box = { width: 330, height: 200 };
  const target: Rect = { x: 20, y: 300, width: 320, height: 56 };
  const p = placeBubble(target, wide, phone, "right");
  assert.ok(p.left >= 0 && p.left + wide.width <= phone.width);
  assert.ok(p.top >= 0 && p.top + wide.height <= phone.height);
});

test("a bubble taller than the window is pinned, not pushed off both ends", () => {
  const squat: Box = { width: 300, height: 700 };
  const view: Box = { width: 800, height: 400 };
  const p = placeBubble({ x: 300, y: 180, width: 100, height: 40 }, squat, view, "top");
  assert.equal(p.top, 10, "pinned to the top edge");
  assert.ok(p.left >= 0);
});

test("every spot is usable", () => {
  const anchors = TOUR_SPOTS.map(s => s.anchor);
  assert.equal(new Set(anchors).size, anchors.length, "two spots on one anchor would highlight the same thing twice");
  for (const s of TOUR_SPOTS) {
    assert.ok(/^[a-z-]+$/.test(s.anchor), `${s.anchor}: the anchor goes in a data attribute and a selector`);
    assert.ok(s.title.length > 0 && s.body.length > 0, `${s.anchor}: says something`);
  }
});
