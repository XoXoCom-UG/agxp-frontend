"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "next-themes";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconDiamond, IconSun, IconMoon, IconArrow, IconCheck } from "@/components/layout/agxp-icons";

type Mode = "signin" | "signup";

/**
 * Turns a Supabase auth error into something a person can act on. The raw
 * strings are developer-facing ("Invalid login credentials"), and this is the
 * first screen anyone sees — it has to be plain and calm.
 */
function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match.";
  if (m.includes("email not confirmed")) return "Confirm your email first — the link is in your inbox.";
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
  "You end up with a document you can hand over — not a chat log.",
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
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

  // Already signed in (came back to /login by hand or by an old bookmark).
  useEffect(() => { if (!authLoading && token) router.replace("/dashboard"); }, [token, authLoading, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setNote(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setNote(null);

    if (mode === "signup" && password.length < 8) {
      setNote({ text: "Use at least 8 characters.", ok: false });
      return;
    }

    setBusy("form");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setNote({ text: friendlyError(error.message), ok: false });
        else router.replace("/dashboard");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
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
      setNote({ text: "Almost there — confirm your email with the link we just sent you.", ok: true });
      setMode("signin");
    } finally {
      setBusy(null);
    }
  }

  async function forgotPassword() {
    if (!email) { setNote({ text: "Enter your email address first.", ok: false }); return; }
    setBusy("forgot");
    setNote(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser leaves for Google, so only the failure path returns.
    if (error) { setNote({ text: friendlyError(error.message), ok: false }); setBusy(null); }
  }

  const signup = mode === "signup";

  return (
    <div className="auth">
      <button className="auth-theme icon-btn" type="button" aria-label="Switch light or dark theme"
        onClick={toggleTheme}>
        <IconSun className="ico-when-dark" />
        <IconMoon className="ico-when-light" />
      </button>

      <div className="auth-form-col">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-mark"><IconDiamond size={12} /></span>
            <span className="brand-text stacked">
              <span className="name">Agentix Projects</span>
              <span className="sub">AGXP</span>
            </span>
          </div>

          <h1>{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-sub">
            {signup
              ? "Two agents, one project. It takes a minute to set up."
              : "Sign in to pick up where you left off."}
          </p>

          <div className="auth-tabs" role="tablist">
            <button role="tab" type="button" aria-selected={!signup}
              className={!signup ? "on" : ""} onClick={() => switchMode("signin")}>Sign in</button>
            <button role="tab" type="button" aria-selected={signup}
              className={signup ? "on" : ""} onClick={() => switchMode("signup")}>Create account</button>
          </div>

          <form onSubmit={submit} noValidate={false}>
            {signup && (
              <div className="field">
                <label htmlFor="auth-name">Your name</label>
                <input id="auth-name" type="text" value={name} autoComplete="name"
                  placeholder="Alex" onChange={e => setName(e.target.value)} />
              </div>
            )}

            <div className="field">
              <label htmlFor="auth-email">Email</label>
              <input id="auth-email" type="email" required value={email} autoComplete="email"
                inputMode="email" placeholder="name@company.com"
                onChange={e => setEmail(e.target.value)} />
            </div>

            <div className="field">
              <div className="auth-label-row">
                <label htmlFor="auth-pw">
                  Password
                  {signup && <span className="hint">at least 8 characters</span>}
                </label>
                {!signup && (
                  <button type="button" className="auth-link" onClick={forgotPassword} disabled={!!busy}>
                    Forgot it?
                  </button>
                )}
              </div>
              <div className="auth-pw">
                <input id="auth-pw" type={showPw ? "text" : "password"} required value={password}
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={signup ? 8 : undefined} placeholder="••••••••"
                  onChange={e => setPassword(e.target.value)} />
                <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {note && (
              <div className={`auth-note ${note.ok ? "ok" : "bad"}`} role="status">
                {note.ok ? <IconCheck size={13} /> : <span className="mark">!</span>}
                <span>{note.text}</span>
              </div>
            )}

            <button className="btn-primary-wide" type="submit" disabled={!!busy}>
              {busy === "form"
                ? <span className="spinner" />
                : <>{signup ? "Create account" : "Sign in"}<IconArrow /></>}
            </button>
          </form>

          <div className="auth-sep"><span>or</span></div>

          <button type="button" className="btn-google" onClick={googleSignIn} disabled={!!busy}>
            {busy === "google" ? <span className="spinner" /> : (
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
            <a href="/impressum">Impressum</a>
            <a href="/datenschutz">Datenschutz</a>
            <a href="/agb">AGB</a>
          </div>
        </div>
      </div>

      {/* The two characters you are about to work with, and why in plain words */}
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-mascots">
            <div className="am">
              <AgentMascot role="coach" size={62} enter />
              <span>Coach</span>
            </div>
            <div className="am">
              <AgentMascot role="consultant" size={62} enter />
              <span>Consultant</span>
            </div>
          </div>
          <span className="eyebrow">Train your AI project agents</span>
          <h2>Your project, thought through — by two agents who ask the right questions.</h2>
          <ul className="plist">
            {HERO_POINTS.map(p => <li key={p}>{p}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
