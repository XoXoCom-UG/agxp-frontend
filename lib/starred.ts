"use client";

/**
 * Which projects you have starred.
 *
 * In this browser, not in the database — and that is a real trade, not an
 * omission. A column on `agxp_projects` would be the better home, but it
 * needs a migration, and a star is the one piece of project state where
 * being wrong costs nothing: the worst case is that a project you starred on
 * the laptop is not starred on the phone. Everything the tab filters is
 * already loaded, so nothing else changes.
 *
 * Written down here so that when someone does add the column, they find the
 * reason rather than guessing.
 */

const KEY = "agxp.starred";
export const STARRED_EVENT = "agxp:starred";

/**
 * The parse, as a pure function, so the awkward cases are testable without a
 * browser: a key holding something that is not JSON, an array with holes in
 * it, an object where an array was expected.
 */
export function parseStarred(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return new Set();
    return new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0));
  } catch {
    // Someone else's key, or a half-written value. An unreadable preference
    // means "nothing starred", never a thrown error on a list screen.
    return new Set();
  }
}

export function readStarred(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return parseStarred(window.localStorage.getItem(KEY));
  } catch {
    return new Set();
  }
}

/** Flips one project and tells every listener. Returns the new set. */
export function toggleStarred(id: string): Set<string> {
  const next = readStarred();
  if (next.has(id)) next.delete(id);
  else next.add(id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // Private mode. The star still applies for this session.
  }
  window.dispatchEvent(new Event(STARRED_EVENT));
  return next;
}
