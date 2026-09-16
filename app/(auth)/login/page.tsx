"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const supabase = createClient(); const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg(null);
    if (tab === "signup" && password.length < 8) {
      setMsg({ text: "Passwort muss mindestens 8 Zeichen lang sein.", ok: false });
      setLoading(false);
      return;
    }
    if (tab === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ text: "E-Mail oder Passwort ist falsch.", ok: false }); else router.push("/dashboard");
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMsg({ text: error.message, ok: false });
      else { setMsg({ text: "Fast geschafft! Bestätige deine E-Mail über den Link, den wir dir gerade geschickt haben.", ok: true }); setTab("login"); }
    }
    setLoading(false);
  }

  async function handleForgot() {
    if (!email) { setMsg({ text: "Bitte zuerst deine E-Mail-Adresse eingeben.", ok: false }); return; }
    setLoading(true); setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
    setMsg(error
      ? { text: error.message, ok: false }
      : { text: "Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen geschickt.", ok: true });
    setLoading(false);
  }

  async function handleGoogle() {
    setLoading(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser redirects to Google, so we only reset on error.
    if (error) { setMsg({ text: "Google-Anmeldung fehlgeschlagen. Bitte versuche es erneut.", ok: false }); setLoading(false); }
  }

  const inp: React.CSSProperties = { width: "100%", height: 42, borderRadius: 10, border: "1px solid #E4E4E7", background: "#fff", color: "#18181B", padding: "0 13px", fontSize: 14, fontFamily: "inherit", outline: "none", transition: "border-color 0.15s" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#fff" }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px", borderRight: "1px solid #EDEDF0", background: "#fff", minWidth: 0 }}>
        <div style={{ maxWidth: 400, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 1, marginBottom: 36 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#18181B", letterSpacing: "-0.02em" }}>AgentiX</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)", letterSpacing: "-0.02em" }}>.projects</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#18181B", letterSpacing: "-0.02em", marginBottom: 6 }}>{tab === "login" ? "Willkommen zurück" : "Account erstellen"}</h1>
          <p style={{ fontSize: 14, color: "#71717A", marginBottom: 28 }}>{tab === "login" ? "Logge dich ein, um fortzufahren." : "Starte kostenlos mit deinem Coach & Consultant-Team."}</p>
          <div style={{ display: "flex", gap: 4, background: "#F4F4F5", padding: 4, borderRadius: 10, marginBottom: 24 }}>
            {(["login", "signup"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", background: tab === t ? "#fff" : "transparent", color: tab === t ? "#18181B" : "#71717A", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                {t === "login" ? "Einloggen" : "Registrieren"}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#3F3F46", marginBottom: 6 }}>E-Mail</label>
              <input type="email" required value={email} autoComplete="email" inputMode="email"
                onChange={e => setEmail(e.target.value)} placeholder="name@example.com" style={inp}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "var(--primary)"}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#E4E4E7"} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#3F3F46" }}>
                  Passwort
                  {tab === "signup" && <span style={{ fontWeight: 400, color: "#71717A" }}> · min. 8 Zeichen</span>}
                </label>
                {tab === "login" && (
                  <button type="button" onClick={handleForgot}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "var(--primary)", fontFamily: "inherit" }}>
                    Passwort vergessen?
                  </button>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} required value={password}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  minLength={tab === "signup" ? 8 : undefined}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  style={{ ...inp, paddingRight: 44 }}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = "var(--primary)"}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#E4E4E7"} />
                <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                  aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
                  style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, border: "none", background: "transparent", cursor: "pointer", color: "#A1A1AA", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>
            {msg && <div style={{ padding: "9px 13px", borderRadius: 9, marginBottom: 14, fontSize: 13, background: msg.ok ? "#EFF9F1" : "#FDEEEC", color: msg.ok ? "#1F7A37" : "#B3261E", border: `1px solid ${msg.ok ? "#BEE6C7" : "#F6C6C0"}` }}>{msg.text}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", height: 44, borderRadius: 10, border: "none", background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
              {loading ? "Bitte warten…" : tab === "login" ? "Einloggen →" : "Account erstellen →"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#E4E4E7" }} />
            <span style={{ fontSize: 12, color: "#71717A" }}>oder</span>
            <div style={{ flex: 1, height: 1, background: "#E4E4E7" }} />
          </div>

          {/* Google OAuth */}
          <button type="button" onClick={handleGoogle} disabled={loading}
            style={{ width: "100%", height: 44, borderRadius: 10, border: "1px solid #E4E4E7", background: "#fff", color: "#18181B", fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "border-color 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 6px rgba(0,0,0,0.06)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E4E4E7"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Mit Google anmelden
          </button>
          <div style={{ display: "flex", gap: 16, marginTop: 24, fontSize: 12 }}>
            <a href="/impressum" style={{ color: "#71717A", textDecoration: "none" }}>Impressum</a>
            <a href="/datenschutz" style={{ color: "#71717A", textDecoration: "none" }}>Datenschutz</a>
            <a href="/agb" style={{ color: "#71717A", textDecoration: "none" }}>AGB</a>
          </div>
        </div>
      </div>
      {/* Right panel — hidden on mobile */}
      <div className="hidden md:flex" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 48, background: "var(--background)" }}>
        <div style={{ maxWidth: 380, width: "100%" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 16 }}>KI-Projektteam</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.025em", lineHeight: 1.2, marginBottom: 16 }}>Train your AI Project-Agents.</h2>
          <p style={{ fontSize: 14, color: "var(--secondary-foreground)", lineHeight: 1.65, marginBottom: 28 }}>Arbeite gleichzeitig mit zwei spezialisierten KI-Agenten an deinem Projekt: einem Coach für die Prozessarbeit und einem Consultant für die strategische Sicht.</p>
          {[["🧭", "Coach", "Begleitet dich strukturiert durch Projekt-Discovery, Anforderungsklärung und Umsetzung."], ["📈", "Consultant", "Liefert strategische Analyse und fundierte Empfehlungen für deine IT- und KI-Transformation."]].map(([icon, title, desc]) => (
            <div key={title} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{icon}</div>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>{title}</div><div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{desc}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
