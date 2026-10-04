"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "next-themes";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconSun, IconMoon, IconArrow, IconCheck, IconEye, IconEyeOff } from "@/components/layout/agxp-icons";
import { BrandLogo } from "@/components/layout/brand-logo";

type Mode = "signin" | "signup";
const MODES: Mode[] = ["signin", "signup"];

/** Loose on purpose: catches typos like a missing @ or dot, and leaves the
 *  real verdict to the server, which knows what it accepts. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email?: string; password?: string };

/**
 * Turns a Supabase auth error into something a person can act on. The raw
 * strings are developer-facing ("Invalid login credentials"), and this is the
 * first screen anyone sees — it has to be plain and calm.
 */
function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match.";
  if (m.includes("email not confirmed")) return "Confirm your email first. The link is in your inbox.";
  if (m.includes("already registered") || m.includes("already exists")) return "That email may already have an account. Try signing in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute, then try again.";
  if (m.includes("password should be at least")) return "Use at least 8 characters.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "That email address doesn't look right.";
  if (m.includes("network") || m.includes("failed to fetch")) return "No connection to the server. Check your internet.";
  return raw;
}

/** Plain, non-jargon reasons to be here — the right half of the screen. */
const HERO_POINTS = [
  "A consultant works out what to change, and how.",
  "A coach takes care of the people side of it.",
  "You end up with a document you can hand over, not a chat log.",
];

export default function LoginPage() {
  const router = useRouter();
  // Not created at render: this page prerenders on the server at build
  // time, and building the client there turns a missing NEXT_PUBLIC_*
  // into a failed BUILD. Every use below is in an effect or a handler.
  const { token, loading: authLoading } = useAuth();
  const { setTheme } = useTheme();

  /** Reads the current theme off the document, so nothing theme-dependent has
   *  to be rendered (see .ico-when-light in the CSS). */
  function toggleTheme() {
    setTheme(document.documentElement.classList.contains("light") ? "dark" : "light");
  }

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<"form" | "google" | "forgot" | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const uid = useId();
  const ids = {
    tab: (m: Mode) => `${uid}-tab-${m}`,
    panel: `${uid}-panel`,
    name: `${uid}-name`,
    email: `${uid}-email`,
    emailErr: `${uid}-email-err`,
    pw: `${uid}-pw`,
    pwHint: `${uid}-pw-hint`,
    pwErr: `${uid}-pw-err`,
  };
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({});

  // Already signed in (came back to /login by hand or by an old bookmark).
  useEffect(() => { if (!authLoading && token) router.replace("/dashboard"); }, [token, authLoading, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setNote(null);
    setErrors({});
  }

  /** Tabs pattern: one tab stop for the pair, arrows move between them and
   *  switch straight away (there are only two, both cheap to show). */
  function onTabKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const i = MODES.indexOf(mode);
    let next: Mode | null = null;
    if (e.key === "ArrowRight") next = MODES[(i + 1) % MODES.length];
    else if (e.key === "ArrowLeft") next = MODES[(i - 1 + MODES.length) % MODES.length];
    else if (e.key === "Home") next = MODES[0];
    else if (e.key === "End") next = MODES[MODES.length - 1];
    if (!next) return;
    e.preventDefault();
    switchMode(next);
    tabRefs.current[next]?.focus();
  }

  /** The browser's own validation bubbles are off (noValidate): they can't be
   *  styled, vanish on their own and aren't tied to the field for a screen
   *  reader. These messages sit under the field and stay until it changes. */
  function validate(checkPassword: boolean): FieldErrors {
    const next: FieldErrors = {};
    const mail = email.trim();
    if (!mail) next.email = "Enter your email address.";
    else if (!EMAIL_RE.test(mail)) next.email = "That email address doesn't look right.";
    if (checkPassword) {
      if (!password) next.password = "Enter your password.";
      else if (mode === "signup" && password.length < 8) next.password = "Use at least 8 characters.";
    }
    return next;
  }

  /** Shows the errors and puts the cursor in the first field that has one. */
  function reportInvalid(found: FieldErrors): boolean {
    setErrors(found);
    if (found.email) emailRef.current?.focus();
    else if (found.password) pwRef.current?.focus();
    return !!(found.email || found.password);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setNote(null);
    if (reportInvalid(validate(true))) return;

    setBusy("form");
    try {
      if (mode === "signin") {
        const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
        if (error) setNote({ text: friendlyError(error.message), ok: false });
        else router.replace("/dashboard");
        return;
      }

      const { data, error } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: name.trim() ? { full_name: name.trim() } : undefined,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) { setNote({ text: friendlyError(error.message), ok: false }); return; }
      // With email confirmation switched off, sign-up returns a session and the
      // user should just be let in instead of waiting for a mail that never comes.
      if (data.session) { router.replace("/dashboard"); return; }
      setNote({ text: "Almost there. Confirm your email with the link we just sent you.", ok: true });
      setMode("signin");
    } finally {
      setBusy(null);
    }
  }

  async function forgotPassword() {
    setNote(null);
    // Only the address matters here; a half-typed password is not an error.
    if (reportInvalid(validate(false))) return;
    setBusy("forgot");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
    });
    setBusy(null);
    // Deliberately the same answer either way — it must not reveal whether an
    // account with that address exists.
    setNote(error
      ? { text: friendlyError(error.message), ok: false }
      : { text: "If that address has an account, a reset link is on its way.", ok: true });
  }

  async function googleSignIn() {
    setBusy("google");
    setNote(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser leaves for Google, so only the failure path returns.
    if (error) { setNote({ text: friendlyError(error.message), ok: false }); setBusy(null); }
  }

  const signup = mode === "signup";

  return (
    <main className="auth">
      <button className="auth-theme icon-btn" type="button" aria-label="Switch light or dark theme"
        onClick={toggleTheme}>
        <IconSun className="ico-when-dark" />
        <IconMoon className="ico-when-light" />
      </button>

      <div className="auth-form-col">
        <div className="auth-card">
          <div className="auth-brand">
            <BrandLogo size={32} />
          </div>

          <h1>{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-sub">
            {signup
              ? "Two agents, one project. It takes a minute to set up."
              : "Sign in to pick up where you left off."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Sign in or create an account">
            {MODES.map(m => {
              const on = mode === m;
              return (
                <button key={m} ref={el => { tabRefs.current[m] = el; }}
                  role="tab" type="button" id={ids.tab(m)} aria-selected={on} aria-controls={ids.panel}
                  tabIndex={on ? 0 : -1} className={on ? "on" : ""}
                  onClick={() => switchMode(m)} onKeyDown={onTabKey}>
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              );
            })}
          </div>

          <form onSubmit={submit} noValidate role="tabpanel" id={ids.panel} aria-labelledby={ids.tab(mode)}>
            {signup && (
              <div className="field">
                <label htmlFor={ids.name}>Your name</label>
                <input id={ids.name} type="text" value={name} autoComplete="name"
                  placeholder="Alex" onChange={e => setName(e.target.value)} />
              </div>
            )}

            <div className="field">
              <label htmlFor={ids.email}>Email</label>
              <input id={ids.email} ref={emailRef} type="email" required value={email} autoComplete="email"
                inputMode="email" placeholder="name@company.com"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? ids.emailErr : undefined}
                onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(x => ({ ...x, email: undefined })); }} />
              {errors.email && <p className="field-err" id={ids.emailErr}>{errors.email}</p>}
            </div>

            <div className="field">
              <div className="auth-label-row">
                <label htmlFor={ids.pw}>Password</label>
                {!signup && (
                  <button type="button" className="auth-link" onClick={forgotPassword} disabled={!!busy}>
                    Forgot it?
                  </button>
                )}
              </div>
              <div className="auth-pw">
                <input id={ids.pw} ref={pwRef} type={showPw ? "text" : "password"} required value={password}
                  autoComplete={signup ? "new-password" : "current-password"}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={[signup ? ids.pwHint : "", errors.password ? ids.pwErr : ""].filter(Boolean).join(" ") || undefined}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(x => ({ ...x, password: undefined })); }} />
                {/* A toggle, so the label stays put and aria-pressed says which
                    state it is in. */}
                <button type="button" onClick={() => setShowPw(v => !v)}
                  aria-label="Show password" aria-pressed={showPw}>
                  {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
              {signup && <p className="field-hint" id={ids.pwHint}>At least 8 characters</p>}
              {errors.password && <p className="field-err" id={ids.pwErr}>{errors.password}</p>}
            </div>

            {note && (
              <div className={`auth-note ${note.ok ? "ok" : "bad"}`} role="status">
                {note.ok ? <IconCheck size={13} /> : <span className="mark">!</span>}
                <span>{note.text}</span>
              </div>
            )}

            <button className="btn-primary-wide" type="submit" disabled={!!busy}>
              {busy === "form"
                ? <><span className="spinner" aria-hidden="true" /><span className="visually-hidden">{signup ? "Creating your account…" : "Signing in…"}</span></>
                : <>{signup ? "Create account" : "Sign in"}<IconArrow /></>}
            </button>
          </form>

          <div className="auth-sep"><span>or</span></div>

          <button type="button" className="btn-google" onClick={googleSignIn} disabled={!!busy}>
            {busy === "google" ? <span className="spinner" aria-hidden="true" /> : (
              <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="auth-legal">
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/agb">AGB</Link>
          </div>
        </div>
      </div>

      {/* The two characters you are about to work with, and why in plain words */}
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-mascots">
            <div className="am">
              <AgentMascot role="coach" size={68} enter />
              <span>Coach</span>
            </div>
            <div className="am">
              <AgentMascot role="consultant" size={68} enter />
              <span>Consultant</span>
            </div>
          </div>
          <span className="eyebrow">Train your AI project agents</span>
          <h2>Your project, thought through by two agents who ask the right questions.</h2>
          <ul className="plist">
            {HERO_POINTS.map(p => <li key={p}>{p}</li>)}
          </ul>
        </div>
      </div>
    </main>
  );
}
