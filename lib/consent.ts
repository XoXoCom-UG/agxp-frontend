import * as Sentry from "@sentry/nextjs";

/**
 * Consent for what is optional — and only that.
 *
 * Everything else the app keeps in the browser is strictly necessary for the
 * service the person asked for (§ 25 Abs. 2 Nr. 2 TDDDG): the login cookie,
 * and the preferences they set themselves (theme, accent, split, tour seen).
 * Declining cannot switch those off without switching off the app.
 *
 * The one optional thing is error reporting from the browser: Sentry sends
 * technical details about a crash to a provider in the USA. It runs only after
 * "Akzeptieren", stops on "Ablehnen", and the choice can be changed at any time
 * from the same place it was given (Art. 7 Abs. 3 DSGVO: withdrawing must be as
 * easy as giving). Server-side Sentry reads nothing from the device and is
 * covered by legitimate interest, so it is not part of this.
 */

export type Consent = "accepted" | "declined";

const KEY = "agxp_consent";
/** Fired to bring the banner back, from "Cookie-Einstellungen" links. */
export const OPEN_CONSENT_EVENT = "agxp:open-consent";

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

let started = false;

/** Starts browser error reporting — only ever after consent. */
export function startErrorReporting(): void {
  if (started) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (process.env.NODE_ENV !== "production" || !dsn) return;
  started = true;
  Sentry.init({
    dsn,
    // Errors are always sent; this only samples performance traces, which are
    // not what we are watching for. A tenth is enough to spot a slow route.
    tracesSampleRate: 0.1,
    // Never attach IP addresses, cookies or headers to an event. The useful
    // part of a report is the stack; the rest is a customer's data.
    sendDefaultPii: false,
  });
}

function stopErrorReporting(): void {
  if (!started) return;
  started = false;
  void Sentry.close();
}

export function setConsent(c: Consent): void {
  try { localStorage.setItem(KEY, c); } catch { /* the choice still applies to this visit */ }
  if (c === "accepted") startErrorReporting();
  else stopErrorReporting();
}

/** Brings the banner back so the choice can be changed. */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
