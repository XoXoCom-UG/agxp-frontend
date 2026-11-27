import { safeNext } from "./safe-next.ts";

/**
 * after-login.ts — the `?next=` of /login, carried across Google sign-in.
 *
 * The login page itself reads `next` from its own address (safe-next.ts). Google
 * sign-in leaves the site and comes back through /auth/callback WITHOUT that
 * query string, so the page also keeps it in sessionStorage for the callback.
 * Same check as safe-next.ts on the way in and on the way out: only a path
 * inside the app, never another site (an open redirect is a phishing tool).
 * (Relative imports only: the test runner does not know the "@/" alias.)
 */

const KEY = "agxp-after-login";

/** On the login page: remember ?next= for the OAuth round-trip, or forget an old one. */
export function rememberNext(search: string): void {
  try {
    const raw = new URLSearchParams(search).get("next");
    const next = safeNext(raw);
    if (raw && next === raw) sessionStorage.setItem(KEY, next);
    else sessionStorage.removeItem(KEY);
  } catch { /* storage blocked: everyone goes to the dashboard */ }
}

/** In /auth/callback: where to go now. Reading it also clears it, so it is used once. */
export function afterLogin(): string {
  try {
    const next = safeNext(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
    return next;
  } catch {
    return safeNext(null);
  }
}
