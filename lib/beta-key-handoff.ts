"use client";

import { useSyncExternalStore } from "react";

/**
 * Carries a beta key from the invitation email to the BetaGate, so the tester
 * never has to copy it.
 *
 * The email's button links to `/login#beta=AGXP-XXXXXX`. The key rides in the
 * fragment on purpose: a fragment is never sent to the server, so it stays out
 * of request logs and analytics, which a `?key=` query would not.
 *
 * It can't stay in the URL, though: login navigates to /dashboard, and Google
 * sign-in leaves the site entirely, and both drop the fragment. So the first
 * page that sees it moves it into sessionStorage — per tab, survives the
 * round-trip to Google, gone when the tab closes — and strips it from the
 * address bar. The gate reads it from there and fills the field in. It does
 * not redeem on its own: the person still presses the button, which is also
 * where a wrong or used key gets explained.
 */

const KEY = "agxp.beta-key";
const EVENT = "agxp:beta-key";

/** Loose shape check — the redeem route decides what is real. */
const KEY_RE = /^[A-Z0-9][A-Z0-9-]{3,63}$/;

/** The key in a `#beta=…` fragment, normalised, or null. Pure, for tests. */
export function parseBetaHash(hash: string): string | null {
  const raw = new URLSearchParams(hash.replace(/^#/, "")).get("beta");
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  return KEY_RE.test(key) ? key : null;
}

/**
 * Moves a key from the current URL's fragment into sessionStorage and removes
 * it from the address bar. Safe to call on every mount; a no-op without one.
 */
export function captureBetaKeyFromUrl(): void {
  if (typeof window === "undefined") return;
  const key = parseBetaHash(window.location.hash);
  if (!key) return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", pathname + search);
  // Storage blocked (private mode, policy): the email still shows the key.
  try { window.sessionStorage.setItem(KEY, key); } catch { return; }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Forget the waiting key, once it has been redeemed. */
export function clearPendingBetaKey(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(KEY); } catch { return; }
  window.dispatchEvent(new CustomEvent(EVENT));
}

function readPendingBetaKey(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage.getItem(KEY); } catch { return null; }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** The key waiting from the invitation link, if the tester came that way. */
export function usePendingBetaKey(): string | null {
  return useSyncExternalStore(subscribe, readPendingBetaKey, () => null);
}
