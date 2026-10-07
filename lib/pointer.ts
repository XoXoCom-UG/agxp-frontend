"use client";

/**
 * Where the pointer is, as -1..1 from the middle of the window.
 *
 * The 3D agents lean towards you, which on the marketing site came from its
 * scroll library. Nothing here needs that: one listener, two numbers, and
 * `passive` so it never holds up a scroll.
 *
 * A module-level object rather than state on purpose — it is read inside a
 * requestAnimationFrame loop sixty times a second, and re-rendering React for
 * a mouse move would be the most expensive thing on the screen.
 */
export const pointer = { x: 0, y: 0 };

let listening = false;

/** Starts tracking on the first scene that asks; returns the stop function. */
export function trackPointer(): () => void {
  if (typeof window === "undefined" || listening) return () => {};
  listening = true;
  const onMove = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  return () => {
    window.removeEventListener("pointermove", onMove);
    listening = false;
  };
}
