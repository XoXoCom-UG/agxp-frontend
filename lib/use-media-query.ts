"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches, as React sees it.
 *
 * A media query is an external store, so this is `useSyncExternalStore`
 * rather than an effect that copies `matches` into state. The server has no
 * viewport, so its answer is `false` — callers should treat that as "wide"
 * and let the first client render correct it.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && !!window.matchMedia?.(query).matches),
    () => false,
  );
}
