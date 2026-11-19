"use client";

import { useEffect, useState } from "react";

export type PresencePhase = "closed" | "mounting" | "open" | "closing";

/**
 * Keeps a popover mounted long enough to play its exit: "closing" holds it for
 * --dropdown-close-dur (150ms).
 *
 * It opens straight into "open". It used to mount in a "mounting" phase
 * (invisible, unclickable) and switch to "open" on the next animation frame,
 * so the transition had a state to start from. On a busy page that frame came
 * late — measured on the live site, 2026-11-19: the account menu sat
 * invisible for over a second after the click. People clicked again, which
 * closed it ("trebuie să apăs de mai multe ori"). The entrance now comes from
 * `@starting-style` in the stylesheet (.t-dropdown.is-open), which the
 * browser plays on its own; the menu is there and clickable on the frame the
 * click is drawn. "mounting" stays in the type for callers that name it.
 */
export function usePresence(open: boolean): PresencePhase {
  const [shown, setShown] = useState(open);
  // Opened: mount at once. Adjusted during render, React's pattern for state
  // that follows a prop.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setShown(true);
  }
  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => setShown(false), 150);
    return () => clearTimeout(id);
  }, [open]);
  if (!shown && !open) return "closed";
  if (!open) return "closing";
  return "open";
}

export function phaseClass(phase: PresencePhase): string {
  return phase === "open" ? " is-open" : phase === "closing" ? " is-closing" : "";
}
