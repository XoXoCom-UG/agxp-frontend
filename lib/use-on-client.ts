"use client";

import { useSyncExternalStore } from "react";

/**
 * True once React is running in the browser, false while rendering on the
 * server and during hydration.
 *
 * For anything that cannot exist on the server — a portal needs a document,
 * a measurement needs a layout. Rendering null there and the real thing on
 * the client is precisely the hydration mismatch React warns about.
 *
 * useSyncExternalStore rather than a `mounted` flag flipped in an effect:
 * the server snapshot is part of the hook, so hydration renders the server's
 * answer and the next render has the real one — no effect writing state it
 * has just rendered, and nothing to clean up. The store never changes, so
 * subscribing is a no-op.
 */
export function useOnClient(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

function subscribeNever(): () => void {
  return () => {};
}
