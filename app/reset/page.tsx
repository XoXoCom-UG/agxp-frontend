"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isAuthRetryableFetchError, isAuthSessionMissingError, isAuthWeakPasswordError, type AuthError,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { IconArrow, IconCheck, IconBack, IconEye, IconEyeOff } from "@/components/layout/agxp-icons";
import { BrandLogo } from "@/components/layout/brand-logo";

type LinkState = "checking" | "ready" | "invalid";
type FieldErrors = { password?: string; again?: string };

/**
 * What went wrong with updateUser, in words that say what to do next. Only an
 * expired or missing session means the link is spent; a password the server
 * won't take, or a dropped connection, is fixed on this same screen.
 */
function describeError(error: AuthError): { text: string; linkSpent: boolean } {
  if (isAuthWeakPasswordError(error) || error.code === "weak_password") {
    return { text: "That password is too easy to guess. Try a longer one, or mix in numbers and symbols.", linkSpent: false };
  }
  if (error.code === "same_password") {
    return { text: "That's your current password. Pick a new one.", linkSpent: false };
  }
  if (isAuthRetryableFetchError(error) || /network|failed to fetch/i.test(error.message)) {
    return { text: "No connection to the server. Check your internet, then try again.", linkSpent: false };
  }
  if (error.code === "over_request_rate_limit") {
    return { text: "Too many attempts. Wait a minute, then try again.", linkSpent: false };
  }
  if (isAuthSessionMissingError(error) || error.code === "session_expired" || error.code === "session_not_found") {
    return { text: "This link has expired. Ask for a new one from the sign-in page.", linkSpent: true };
  }
  return { text: "The password couldn't be saved. Try again in a moment.", linkSpent: false };
}

/**
 * Landing page for the password-reset email link. The Supabase browser client
 * establishes a recovery session from the URL on load, so all that is left is
 * to set the new password — provided the link still works, which is checked
 * up front rather than after someone has typed a password twice.
 */
export default function ResetPage() {
  const router = useRouter();
  // Not created at render: this page prerenders on the server at build
  // time, and building the client there turns a missing NEXT_PUBLIC_*
  // into a failed BUILD. Every use below is in an effect or a handler.
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  const uid = useId();
  const ids = {
    pw: `${uid}-pw`, pwHint: `${uid}-pw-hint`, pwErr: `${uid}-pw-err`,
    again: `${uid}-again`, againErr: `${uid}-again-err`,
  };
  const pwRef = useRef<HTMLInputElement>(null);
  const againRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    // getSession waits for the client to finish reading the link, so no
    // session afterwards means the link didn't produce one — used, expired, or
    // opened in another browser than the one that asked for it.
    createClient().auth.getSession()
      .then(({ data }) => { if (alive) setLinkState(s => s === "ready" ? s : data.session ? "ready" : "invalid"); })
      .catch(() => { if (alive) setLinkState("invalid"); });

    // Belt and braces: the recovery event can land after getSession resolved.
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      if (alive && session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) setLinkState("ready");
    });
    return () => { alive = false; subscription.unsubscribe(); };
    // No dependency: the client is memoised at module scope, so there is
    // nothing here that can change and re-run this.
  }, []);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (password.length < 8) next.password = "Use at least 8 characters.";
    else if (password !== again) next.again = "The two passwords are not the same.";
    return next;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setNote(null);

    const found = validate();
    setErrors(found);
    if (found.password) { pwRef.current?.focus(); return; }
    if (found.again) { againRef.current?.focus(); return; }

    setBusy(true);
    let error: AuthError | null = null;
    try {
      ({ error } = await createClient().auth.updateUser({ password }));
    } catch {
      setBusy(false);
      setNote({ text: "No connection to the server. Check your internet, then try again.", ok: false });
      return;
    }
    if (error) {
      setBusy(false);
      const { text, linkSpent } = describeError(error);
      if (linkSpent) setLinkState("invalid");
      else setNote({ text, ok: false });
      return;
    }
    setNote({ text: "Password changed. Taking you in…", ok: true });
    // Straight into the app — the old code sent people to /chat, which stopped
    // existing when the workspace replaced it.
    setTimeout(() => router.replace("/dashboard"), 1100);
  }

  return (
    <main className="auth">
      <div className="auth-form-col">
        <div className="auth-card">
          <div className="auth-brand">
            <BrandLogo size={32} />
          </div>

          {linkState === "checking" && (
            <div className="auth-checking" role="status">
              <span className="spinner spinner-lg" aria-hidden="true" />
              <span>Checking your reset link…</span>
            </div>
          )}

          {linkState === "invalid" && (
            <>
              <h1>This link no longer works</h1>
              <p className="auth-sub">
                Reset links can be used once and expire after a while. It also has to be opened in the
                browser you asked for it from. Ask for a new one from the sign-in page.
              </p>
              <Link className="btn-primary-wide" href="/login">
                Back to sign in<IconArrow />
              </Link>
            </>
          )}

          {linkState === "ready" && (
            <>
              <h1>Set a new password</h1>
              <p className="auth-sub">Pick something you can remember.</p>

              <form onSubmit={submit} noValidate>
                <div className="field">
                  <label htmlFor={ids.pw}>New password</label>
                  <div className="auth-pw">
                    <input id={ids.pw} ref={pwRef} type={showPw ? "text" : "password"} required value={password}
                      autoComplete="new-password"
                      aria-invalid={errors.password ? true : undefined}
                      aria-describedby={[ids.pwHint, errors.password ? ids.pwErr : ""].filter(Boolean).join(" ")}
                      onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(x => ({ ...x, password: undefined })); }} />
                    {/* One toggle for both fields: they hold the same password,
                        and checking one against the other needs both visible. */}
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      aria-label="Show passwords" aria-pressed={showPw}>
                      {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </button>
                  </div>
                  <p className="field-hint" id={ids.pwHint}>At least 8 characters</p>
                  {errors.password && <p className="field-err" id={ids.pwErr}>{errors.password}</p>}
                </div>
                <div className="field">
                  <label htmlFor={ids.again}>Repeat it</label>
                  <input id={ids.again} ref={againRef} type={showPw ? "text" : "password"} required value={again}
                    autoComplete="new-password"
                    aria-invalid={errors.again ? true : undefined}
                    aria-describedby={errors.again ? ids.againErr : undefined}
                    onChange={e => { setAgain(e.target.value); if (errors.again) setErrors(x => ({ ...x, again: undefined })); }} />
                  {errors.again && <p className="field-err" id={ids.againErr}>{errors.again}</p>}
                </div>

                {note && (
                  <div className={`auth-note ${note.ok ? "ok" : "bad"}`} role="status">
                    {note.ok ? <IconCheck size={13} /> : <span className="mark" aria-hidden="true">!</span>}
                    <span>{note.text}</span>
                  </div>
                )}

                <button className="btn-primary-wide" type="submit" disabled={busy}>
                  {busy
                    ? <><span className="spinner" aria-hidden="true" /><span className="visually-hidden">Saving…</span></>
                    : <>Save password<IconArrow /></>}
                </button>
              </form>
            </>
          )}

          {linkState !== "invalid" && (
            <div className="auth-legal auth-legal-spaced">
              <Link className="auth-back" href="/login"><IconBack size={10} />Back to sign in</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
