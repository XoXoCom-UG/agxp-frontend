"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { IconDiamond, IconArrow, IconCheck, IconBack } from "@/components/layout/agxp-icons";

/**
 * Landing page for the password-reset email link. The Supabase browser client
 * establishes a recovery session from the URL on load, so all that is left is
 * to set the new password.
 */
export default function ResetPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setNote(null);

    if (password.length < 8) { setNote({ text: "Use at least 8 characters.", ok: false }); return; }
    if (password !== again) { setNote({ text: "The two passwords are not the same.", ok: false }); return; }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setNote({ text: "This link is invalid or has expired. Ask for a new one.", ok: false });
      return;
    }
    setNote({ text: "Password changed. Taking you in…", ok: true });
    // Straight into the app — the old code sent people to /chat, which stopped
    // existing when the workspace replaced it.
    setTimeout(() => router.replace("/dashboard"), 1100);
  }

  return (
    <div className="auth">
      <div className="auth-form-col">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-mark"><IconDiamond size={12} /></span>
            <span className="brand-text stacked">
              <span className="name">Agentix Projects</span>
              <span className="sub">AGXP</span>
            </span>
          </div>

          <h1>Set a new password</h1>
          <p className="auth-sub">Pick something you can remember — at least 8 characters.</p>

          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="pw1">New password</label>
              <input id="pw1" type="password" required minLength={8} value={password}
                autoComplete="new-password" placeholder="••••••••"
                onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pw2">Repeat it</label>
              <input id="pw2" type="password" required minLength={8} value={again}
                autoComplete="new-password" placeholder="••••••••"
                onChange={e => setAgain(e.target.value)} />
            </div>

            {note && (
              <div className={`auth-note ${note.ok ? "ok" : "bad"}`} role="status">
                {note.ok ? <IconCheck size={13} /> : <span className="mark">!</span>}
                <span>{note.text}</span>
              </div>
            )}

            <button className="btn-primary-wide" type="submit" disabled={busy}>
              {busy ? <span className="spinner" /> : <>Save password<IconArrow /></>}
            </button>
          </form>

          <div className="auth-legal" style={{ marginTop: "var(--sp-5)" }}>
            <a className="auth-back" href="/login"><IconBack size={10} />Back to sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
}
