"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How long a dialog takes to leave: shorter than the 200ms it took to arrive. */
export const EXIT_MS = 140;

/**
 * Plays an exit before something that unmounts itself through its parent.
 *
 * `exitThen(fn)` flips `closing` (the caller adds `.is-closing`), then calls
 * `fn` — the parent's own onClose — once the exit has played. Parents keep
 * their `{open && <Dialog />}` as it is; only the dialog knows it takes 140ms
 * to leave. A second call while one is pending is ignored, so a double click
 * or Escape-then-click cannot close twice.
 *
 * Unlike usePresence this does not keep a closed thing mounted: it delays the
 * moment the parent is told. Use it where the parent owns the open state.
 *
 * `settleMs` is how long it stays invisible after the parent was told, for a
 * parent that needs a moment to actually remove it (the beta gate waits for
 * an entitlement fetch). If the parent never does, it comes back rather than
 * leaving an invisible, unclickable layer on the screen.
 */
export function useExit(ms: number = EXIT_MS, settleMs = 0): [boolean, (then: () => void) => void] {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const exitThen = useCallback((then: () => void) => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => {
      timer.current = setTimeout(() => { timer.current = null; setClosing(false); }, settleMs);
      then();
    }, ms);
  }, [ms, settleMs]);

  return [closing, exitThen];
}
