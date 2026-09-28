"use client";

import { useEffect, useState } from "react";

export type PresencePhase = "closed" | "mounting" | "open" | "closing";

/**
 * Keeps a popover mounted long enough to play its exit. "mounting" is one
 * frame at the pre-open state, so the transition to "open" has something to
 * animate from; "closing" holds it for --dropdown-close-dur (150ms).
 */
export function usePresence(open: boolean): PresencePhase {
  const [shown, setShown] = useState(open);
  const [entered, setEntered] = useState(open);
  // Reopened (or opened for the first time): mount at the pre-open state.
  // Adjusted during render, React's pattern for state that follows a prop.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) { setShown(true); setEntered(false); }
  }
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    const id = setTimeout(() => setShown(false), 150);
    return () => clearTimeout(id);
  }, [open]);
  if (!shown) return "closed";
  if (!open) return "closing";
  return entered ? "open" : "mounting";
}

export function phaseClass(phase: PresencePhase): string {
  return phase === "open" ? " is-open" : phase === "closing" ? " is-closing" : "";
}
