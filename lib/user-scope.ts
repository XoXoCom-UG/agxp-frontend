/**
 * user-scope.ts — what this browser remembers must not outlive the account it
 * belongs to.
 *
 * Three things the app keeps in localStorage are about one account's work, not
 * about the browser: the project you were last in (its id, NAME and industry —
 * the bar prints it), how far each of your agents has levelled up, and whether
 * you have seen the tour. On a shared computer, sign out and let someone else
 * sign in, and the second person would have been shown the first one's last
 * project name in the bar. The id leads nowhere (the database refuses it), but
 * the name is real information.
 *
 * So the browser also remembers WHOSE these are, and drops them the moment the
 * signed-in account is not that one — on sign-out, and on a different account
 * signing in. Look-and-feel settings (colour, theme, panel split, cookie notice)
 * belong to the browser and stay.
 *
 * Relative imports only: the test runner does not know the "@/" alias.
 */

const OWNER_KEY = "agxp.owner";

/** Every key whose contents are about one account's work. */
export const USER_BOUND_KEYS = ["agxp.last-project", "agxp.mascot-replies", "agxp.tour"];

/** Events the stores listen for, so what is on screen follows the clear. */
const REFRESH_EVENTS = ["agxp:last-project", "agxp:mascot-level"];

/**
 * Must the user-bound keys be dropped?
 *
 * `stored` is who the browser last saw (null if it never recorded), `current`
 * who is signed in now (null if nobody is). Nobody signed in always clears.
 * A stored owner that differs from the current account clears. A missing
 * stored owner clears too: data written before this existed has no owner, and
 * keeping it would be guessing it belongs to whoever signs in next.
 */
export function mustClear(stored: string | null, current: string | null): boolean {
  if (current === null) return true;
  return stored !== current;
}

/** Call whenever the signed-in account is known or changes. Safe where storage is blocked. */
export function scopeToUser(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(OWNER_KEY);
    if (!mustClear(stored, userId)) return;
    for (const k of USER_BOUND_KEYS) window.localStorage.removeItem(k);
    if (userId) window.localStorage.setItem(OWNER_KEY, userId);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    return; // storage blocked: nothing was kept either
  }
  for (const e of REFRESH_EVENTS) window.dispatchEvent(new Event(e));
}
