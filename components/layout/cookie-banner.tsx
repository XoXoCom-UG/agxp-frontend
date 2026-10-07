"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useExit } from "@/lib/use-exit";

const ACK_KEY = "agxp_cookie_ack";

/**
 * Minimal cookie/consent notice. The app only uses technically necessary
 * storage (login session, settings) — no marketing/tracking cookies — so this
 * is an informational banner with a single acknowledgement, per the current
 * privacy policy. If tracking is added later, upgrade to a real opt-in consent
 * manager.
 *
 * The text stays German: it is legal copy that points at the German
 * Datenschutzerklärung.
 */
export function CookieBanner() {
  const [show, setShow] = useState(false);
  // It arrived from the bottom edge; it leaves the same way, a touch quicker.
  const [closing, exitThen] = useExit(180);

  useEffect(() => {
    // Storage can throw in a locked-down browser; a missing banner is better
    // than a crashed page.
    try {
      if (localStorage.getItem(ACK_KEY)) return;
    } catch { return; }
    const t = setTimeout(() => setShow(true), 700);
    return () => clearTimeout(t);
  }, []);

  function accept() {
    try { localStorage.setItem(ACK_KEY, "1"); } catch { /* not fatal */ }
    exitThen(() => setShow(false));
  }

  if (!show) return null;

  return (
    // lang="de" so a screen reader switches voice for it; the label names the
    // region, since a status role on its own is announced without a name.
    <div className={`cookie-note${closing ? " is-closing" : ""}`} role="status" aria-label="Cookie-Hinweis" lang="de">
      <p>
        Wir verwenden nur technisch notwendige Cookies bzw. lokale Speicherung (Login &amp;
        Einstellungen), kein Tracking. Mehr dazu in der{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
      <button className="btn-primary-wide" type="button" onClick={accept}>Verstanden</button>
    </div>
  );
}
