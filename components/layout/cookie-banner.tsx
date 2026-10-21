"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useExit } from "@/lib/use-exit";
import { readConsent, setConsent, openConsentSettings, OPEN_CONSENT_EVENT, type Consent } from "@/lib/consent";

/**
 * The cookie banner, as a real choice.
 *
 * It used to be a notice with one "Verstanden" button. That was accurate for
 * the necessary storage, but browser error reporting (Sentry, USA) ran for
 * everyone without being asked. Now:
 *
 *   - "Ablehnen" and "Akzeptieren" are the same size and weight, side by side.
 *     A refusal hidden behind a second screen or drawn as a faint link is what
 *     the supervisory authorities fine for.
 *   - Nothing optional runs before a choice. Ablehnen keeps it that way.
 *   - The banner comes back from any "Cookie-Einstellungen" link, so the
 *     choice can be withdrawn as easily as it was given.
 *
 * The text stays German: it is legal copy that points at the German
 * Datenschutzerklärung.
 */
export function CookieBanner() {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState<Consent | null>(null);
  // It arrived from the bottom edge; it leaves the same way, a touch quicker.
  const [closing, exitThen] = useExit(180);

  useEffect(() => {
    // `current` is only drawn when the banner is reopened, and read fresh then.
    const existing = readConsent();
    const reopen = () => { setCurrent(readConsent()); setShow(true); };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    // Asked once; the old "Verstanden" acknowledgement was not consent to
    // anything optional, so it does not count as an answer.
    const t = existing ? null : setTimeout(() => setShow(true), 700);
    return () => {
      window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
      if (t) clearTimeout(t);
    };
  }, []);

  function choose(c: Consent) {
    setConsent(c);
    setCurrent(c);
    exitThen(() => setShow(false));
  }

  if (!show) return null;

  return (
    // lang="de" so a screen reader switches voice for it. A dialog, not a
    // status: it asks for a decision.
    <div className={`cookie-note${closing ? " is-closing" : ""}`} role="dialog" aria-label="Cookie-Einstellungen" lang="de">
      <p>
        <b>Notwendig</b> und immer aktiv: das Login-Cookie und deine Einstellungen im Browser.{" "}
        <b>Optional:</b> Fehlerberichte an Sentry (USA), damit wir Abstürze beheben können. Kein
        Tracking, keine Werbung.{" "}
        {current && <>Aktuell: {current === "accepted" ? "akzeptiert" : "abgelehnt"}. </>}
        Mehr in der <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
      <div className="cookie-choices">
        <button className="btn-secondary-wide" type="button" onClick={() => choose("declined")}>Ablehnen</button>
        <button className="btn-secondary-wide" type="button" onClick={() => choose("accepted")}>Akzeptieren</button>
      </div>
    </div>
  );
}

/** "Cookie-Einstellungen" — reopens the banner wherever it is placed. */
export function ConsentLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className ?? "consent-link"}
      onClick={openConsentSettings}>
      Cookie-Einstellungen
    </button>
  );
}
