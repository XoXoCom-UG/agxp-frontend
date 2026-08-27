"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Landing page for the "Passwort zurücksetzen" email link. The Supabase browser
// client auto-establishes a recovery session from the URL on load; here the user
// sets a new password via updateUser.
export default function ResetPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setMsg({ text: "Passwort muss mindestens 8 Zeichen lang sein.", ok: false }); return; }
    setLoading(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg({ text: "Link ungültig oder abgelaufen. Bitte fordere einen neuen an.", ok: false });
      setLoading(false);
    } else {
      setMsg({ text: "Passwort geändert! Du wirst weitergeleitet…", ok: true });
      setTimeout(() => router.push("/chat"), 1200);
    }
  }

  const inp: React.CSSProperties = { width: "100%", height: 42, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", padding: "0 13px", fontSize: 14, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#fff" }}>
      <div style={{ maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 1, marginBottom: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>matfit</span>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--green)" }}>.ai</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: 6 }}>Neues Passwort setzen</h1>
        <p style={{ fontSize: 14, color: "var(--text-3)", marginBottom: 24 }}>Wähle ein neues Passwort für dein Konto.</p>
        <form onSubmit={submit}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
            Neues Passwort <span style={{ fontWeight: 400, color: "var(--text-3)" }}>· min. 8 Zeichen</span>
          </label>
          <input type="password" required minLength={8} value={password} autoComplete="new-password"
            onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} />
          {msg && <div style={{ padding: "9px 13px", borderRadius: 9, margin: "14px 0", fontSize: 13, background: msg.ok ? "var(--green-light)" : "var(--red-bg)", color: msg.ok ? "var(--green-dark)" : "var(--red)", border: `1px solid ${msg.ok ? "var(--green-mid)" : "#fca5a5"}` }}>{msg.text}</div>}
          <button type="submit" disabled={loading} style={{ width: "100%", height: 44, borderRadius: 10, border: "none", background: "var(--green)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit", marginTop: 14 }}>
            {loading ? "Bitte warten…" : "Passwort speichern →"}
          </button>
        </form>
        <a href="/login" style={{ display: "inline-block", marginTop: 20, fontSize: 12, color: "var(--text-3)", textDecoration: "none" }}>← Zurück zum Login</a>
      </div>
    </div>
  );
}
