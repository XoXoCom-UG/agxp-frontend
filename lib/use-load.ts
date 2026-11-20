"use client";

import { useCallback, useEffect, useState } from "react";

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  /** A read is in flight (the first one, or a reload). */
  busy: boolean;
  reload: () => void;
  /** Change what is on screen without asking again (a key just made, say). */
  set: (update: (current: T | null) => T | null) => void;
}

/**
 * One read, with its own error, so a panel that fails says so and leaves the
 * rest of the page alone. `read` must be a stable function (a module-level
 * one): a new function each render would read again each render.
 *
 * State is only set from the promise and from event handlers, never in the
 * body of the effect, which React 19 warns about.
 */
export function useLoad<T>(read: () => Promise<T>): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    read()
      .then(d => { if (alive) { setData(d); setError(null); } })
      .catch(e => { if (alive) setError((e as Error).message || "Couldn't read that."); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [read, round]);

  const reload = useCallback(() => { setBusy(true); setRound(n => n + 1); }, []);
  const set = useCallback((update: (c: T | null) => T | null) => setData(update), []);
  return { data, error, busy, reload, set };
}
