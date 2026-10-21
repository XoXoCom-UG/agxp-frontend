"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useExit } from "@/lib/use-exit";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import {
  readConsent, setConsent, openConsentSettings,
  OPEN_CONSENT_EVENT,
} from "@/lib/consent";
import { memoryAllowed } from "@/lib/memory-pref";

/**
 * Datenschutz-Einstellungen: the cookie banner, and the settings behind it.
 *
 * Two views in one card:
 *
 *   summary   on the first visit. Three buttons of the same size and weight —
 *             "Alle ablehnen", "Anpassen", "Alle akzeptieren". A refusal that
 *             is harder to reach than consent is what supervisory authorities
 *             fine for, so it is never a link, never on a second screen.
 *   details   every category with what it is, who receives it and whether it
 *             can be switched off. Opened by "Anpassen" and by every
 *             "Cookie-Einstellungen" link, so withdrawing is as easy as giving.
 *
 * Categories:
 *   - Notwendig: login session, the bot check at sign-in, your own UI
 *     settings, and this choice itself. Always on — shown, not switchable,
 *     because the app does not work without them (§ 25 Abs. 2 Nr. 2 TDDDG).
 *   - Fehlerberichte: Sentry in the browser (USA). Consent, stored on this
 *     device (lib/consent.ts).
 *   - Lernnotizen der Agenten: whether agents may carry what they learned
 *     into your later projects. Stored on the account, so it applies on every
 *     device; only shown when signed in.
 *
 * The text stays German: it is legal copy that points at the German
 * Datenschutzerklärung.
 */
export function CookieBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [view, setView] = useState<"summary" | "details">("summary");
  /** The switches while the details are open; saved only on "Auswahl speichern". */
  const [errors, setErrors] = useState(false);
  const [memory, setMemory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstControl = useRef<HTMLButtonElement>(null);
  // It arrived from the bottom edge; it leaves the same way, a touch quicker.
  const [closing, exitThen] = useExit(180);

  const signedIn = !!user;
  const meta = user?.user_metadata as Record<string, unknown> | undefined;

  useEffect(() => {
    const reopen = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail !== false;
      setErrors(readConsent() === "accepted");
      setMemory(memoryAllowed(meta));
      setView(detail ? "details" : "summary");
      setError("");
      setShow(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    // Asked once per device. The old "Verstanden" acknowledgement was not
    // consent to anything optional, so it does not count as an answer.
    const t = readConsent() ? null : setTimeout(() => setShow(true), 700);
    return () => {
      window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
      if (t) clearTimeout(t);
    };
  }, [meta]);

  // Whoever opened this is here to choose: the keyboard goes to the first
  // control instead of staying on the link behind.
  useEffect(() => {
    if (show) firstControl.current?.focus({ preventScroll: true });
  }, [show, view]);

  async function save(next: { errors: boolean; memory: boolean }) {
    setSaving(true);
    setError("");
    setConsent(next.errors ? "accepted" : "declined");
    // The memory choice is the account's, so it is written only when there
    // is an account and only when it changes.
    if (signedIn && next.memory !== memoryAllowed(meta)) {
      const { error: e } = await createClient().auth.updateUser({ data: { agent_memory: next.memory } });
      if (e) {
        setSaving(false);
        setError("Die Einstellung für die Lernnotizen konnte nicht gespeichert werden. Bitte versuche es erneut.");
        return;
      }
    }
    setSaving(false);
    exitThen(() => { setShow(false); setView("summary"); });
  }

  if (!show) return null;

  const cls = `cookie-note${view === "details" ? " is-details" : ""}${closing ? " is-closing" : ""}`;

  if (view === "summary") {
    return (
      // lang="de" so a screen reader switches voice for it. A dialog, not a
      // status: it asks for a decision.
      <div className={cls} role="dialog" aria-label="Datenschutz-Einstellungen" lang="de">
        <h2 className="cookie-title">Datenschutz-Einstellungen</h2>
        <p>
          Notwendige Cookies für Login und Sicherheit sind immer aktiv. Optional sind Fehlerberichte
          an Sentry (USA){signedIn ? " und die Lernnotizen deiner Agenten" : ""}. Kein Tracking, keine
          Werbung, kein Verkauf deiner Daten. Mehr in der <Link href="/datenschutz">Datenschutzerklärung</Link>.
        </p>
        <div className="cookie-choices is-three">
          <button ref={firstControl} className="btn-secondary-wide" type="button" disabled={saving}
            onClick={() => save({ errors: false, memory: false })}>Alle ablehnen</button>
          <button className="btn-secondary-wide" type="button" disabled={saving}
            onClick={() => { setErrors(readConsent() === "accepted"); setMemory(memoryAllowed(meta)); setView("details"); }}>
            Anpassen
          </button>
          <button className="btn-secondary-wide" type="button" disabled={saving}
            onClick={() => save({ errors: true, memory: true })}>Alle akzeptieren</button>
        </div>
      </div>
    );
  }

  return (
    <div className={cls} role="dialog" aria-modal="false" aria-labelledby="consent-title" lang="de">
      <h2 className="cookie-title" id="consent-title">Datenschutz-Einstellungen</h2>
      <p>Du entscheidest, was über das Notwendige hinaus passiert. Du kannst das jederzeit hier ändern.</p>

      <ul className="consent-list">
        <Category
          title="Notwendig"
          locked
          on
          text="Login-Sitzung, die Sicherheitsprüfung bei der Anmeldung (Cloudflare Turnstile), deine Einstellungen wie Farbschema und Fensteraufteilung, und diese Auswahl selbst. Ohne sie funktioniert AgentiX nicht."
        />
        <Category
          title="Fehlerberichte"
          on={errors}
          onChange={setErrors}
          buttonRef={firstControl}
          text="Stürzt etwas in deinem Browser ab, senden wir technische Angaben dazu an Sentry (Functional Software, Inc., USA): Fehlermeldung, Seite, Browser. Wir hängen weder deine IP-Adresse noch Inhalte deiner Projekte an."
        />
        {signedIn && (
          <Category
            title="Lernnotizen der Agenten"
            on={memory}
            onChange={setMemory}
            text="Deine Agenten merken sich kurze Notizen aus deinen Projekten (etwa Branche oder Arbeitsweise) und nutzen sie in späteren Projekten wieder. Gilt für dein Konto auf allen Geräten. Ausgeschaltet beginnt jedes Projekt ohne Vorwissen."
          />
        )}
      </ul>

      <p className="consent-never">
        Nie: Werbe-Tracking, Weitergabe an Werbenetzwerke, Verkauf deiner Daten. Deine Inhalte werden
        nicht zum Training von KI-Modellen verwendet. <Link href="/datenschutz">Datenschutzerklärung</Link>
      </p>

      {error && <p className="consent-error" role="alert">{error}</p>}

      <div className="cookie-choices">
        <button className="btn-secondary-wide" type="button" disabled={saving}
          onClick={() => save({ errors, memory })}>
          {saving ? "Speichern…" : "Auswahl speichern"}
        </button>
        <button className="btn-secondary-wide" type="button" disabled={saving}
          onClick={() => save({ errors: true, memory: true })}>Alle akzeptieren</button>
      </div>
    </div>
  );
}

function Category({ title, text, on, locked, onChange, buttonRef }: {
  title: string;
  text: string;
  on: boolean;
  locked?: boolean;
  onChange?: (v: boolean) => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <li className="consent-item">
      <div className="consent-row">
        <span className="consent-name">{title}</span>
        {locked ? (
          <span className="consent-always">Immer aktiv</span>
        ) : (
          <button ref={buttonRef} type="button" role="switch" aria-checked={on} aria-label={title}
            className={`consent-switch${on ? " on" : ""}`} onClick={() => onChange?.(!on)}>
            <span aria-hidden="true" />
          </button>
        )}
      </div>
      <p>{text}</p>
    </li>
  );
}

/** "Cookie-Einstellungen" — reopens the settings wherever it is placed. */
export function ConsentLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className ?? "consent-link"} onClick={() => openConsentSettings()}>
      Cookie-Einstellungen
    </button>
  );
}
