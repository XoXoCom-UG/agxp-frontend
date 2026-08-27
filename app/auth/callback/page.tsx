"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Landing page for the e-mail confirmation link. The Supabase browser client
// exchanges the code in the URL automatically; once a session exists we send the
// user into the app. If it doesn't appear, we fall back to the login page.
export default function AuthCallbackPage() {
  const supabase = createClient();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let iv: ReturnType<typeof setInterval> | undefined;

    (async () => {
      // 1) Session already established (implicit flow / already exchanged).
      const { data: s0 } = await supabase.auth.getSession();
      if (s0.session) { router.replace("/chat"); return; }

      // 2) PKCE: explicitly exchange the ?code= for a session. This is what
      //    Google OAuth needs — the browser client does NOT auto-exchange it.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (!error) { router.replace("/chat"); return; }
      }

      // 3) Fallback: poll briefly (e.g. hash-based e-mail confirmation links).
      let tries = 0;
      iv = setInterval(async () => {
        tries++;
        const { data } = await supabase.auth.getSession();
        if (data.session) { clearInterval(iv); router.replace("/chat"); }
        else if (tries > 12) { clearInterval(iv); setFailed(true); }
      }, 400);
    })();

    return () => { cancelled = true; if (iv) clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, marginBottom: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>matfit</span>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--green)" }}>.ai</span>
        </div>
        {failed ? (
          <>
            <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 16 }}>
              Bestätigung fehlgeschlagen oder Link abgelaufen.
            </p>
            <a href="/login" style={{ fontSize: 14, color: "var(--green)", textDecoration: "none", fontWeight: 600 }}>Zum Login →</a>
          </>
        ) : (
          <p style={{ fontSize: 14, color: "var(--text-3)" }}>E-Mail wird bestätigt…</p>
        )}
      </div>
    </div>
  );
}
