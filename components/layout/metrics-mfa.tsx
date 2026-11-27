"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Step =
  | { kind: "loading" }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string }
  | { kind: "error"; message: string };

/**
 * The second factor for /metrics.
 *
 * The metrics functions (migration 0033) answer only to an aal2 token: a session
 * that has passed an authenticator-app code. This screen gets the viewer there.
 * The first time it shows a QR code to scan (Google Authenticator, Microsoft
 * Authenticator, 1Password…); after that it only asks for the 6-digit code.
 *
 * Nothing here is the security — a session that skips this screen still gets
 * "mfa_required" from the database. It only makes the right path easy.
 *
 * `onVerified` runs after Supabase upgrades the session; the auth listener in
 * lib/auth-context.tsx picks up the new token on its own.
 */
export function MetricsMfa({ onVerified }: { onVerified: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const mfa = createClient().auth.mfa;
      const { data, error } = await mfa.listFactors();
      if (!alive) return;
      if (error) { setStep({ kind: "error", message: error.message }); return; }

      const verified = data.totp[0];
      if (verified) { setStep({ kind: "verify", factorId: verified.id }); return; }

      // A half-finished enrollment from an earlier visit would block a new one.
      for (const f of data.all) {
        if (f.factor_type === "totp" && f.status === "unverified") await mfa.unenroll({ factorId: f.id });
      }
      const enrolled = await mfa.enroll({ factorType: "totp", friendlyName: "AgentiX metrics" });
      if (!alive) return;
      if (enrolled.error) { setStep({ kind: "error", message: enrolled.error.message }); return; }
      setStep({ kind: "enroll", factorId: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
    })().catch(e => { if (alive) setStep({ kind: "error", message: (e as Error).message }); });
    return () => { alive = false; };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "enroll" && step.kind !== "verify") return;
    setBusy(true); setWrong(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: step.factorId, code: code.trim() });
    setBusy(false);
    if (error) { setWrong("That code didn't work. Codes change every 30 seconds — try the current one."); setCode(""); return; }
    onVerified();
  }

  if (step.kind === "loading") return <p className="mx-muted" role="status">Preparing the security check…</p>;
  if (step.kind === "error") return <p className="mx-error" role="alert">Two-factor setup failed: {step.message}</p>;

  return (
    <section className="mx-mfa" aria-labelledby="mx-mfa-title">
      <h2 id="mx-mfa-title">{step.kind === "enroll" ? "Set up two-factor sign-in" : "Enter your authenticator code"}</h2>
      {step.kind === "enroll" ? (
        <>
          <p>The metrics are only shown to a session that has passed a second factor. Scan this code once with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password), then type the 6 digits it shows.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: SVG from Supabase, nothing to optimise */}
          <img className="mx-qr" src={step.qr} alt="QR code for your authenticator app" width={180} height={180} />
          <details className="mx-secret">
            <summary>Can&apos;t scan? Enter the key by hand</summary>
            <code>{step.secret}</code>
          </details>
        </>
      ) : (
        <p>Open your authenticator app and type the current 6-digit code for AgentiX.</p>
      )}
      <form onSubmit={submit} className="mx-code-form">
        <label htmlFor="mx-code" className="visually-hidden">6-digit code</label>
        <input
          id="mx-code" className="mx-code" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" maxLength={6} required autoFocus
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
        />
        <button type="submit" className="btn btn-solid" disabled={busy || code.length !== 6}>
          {busy ? "Checking…" : "Verify"}
        </button>
      </form>
      {wrong && <p className="mx-error" role="alert">{wrong}</p>}
    </section>
  );
}
