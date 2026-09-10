"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { IconDiamond, IconArrow } from "@/components/layout/agxp-icons";

/**
 * Landing page for the e-mail confirmation and the Google redirect. Google's
 * PKCE flow needs the ?code= exchanged explicitly — the browser client does not
 * do it on its own — while e-mail links arrive with the session already set or
 * carried in the hash, hence the short poll at the end.
 */
export default function AuthCallbackPage() {
  const supabase = createClient();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let iv: ReturnType<typeof setInterval> | undefined;

    (async () => {
      const { data: s0 } = await supabase.auth.getSession();
      if (s0.session) { router.replace("/dashboard"); return; }

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (!error) { router.replace("/dashboard"); return; }
      }

      let tries = 0;
      iv = setInterval(async () => {
        tries++;
        const { data } = await supabase.auth.getSession();
        if (data.session) { clearInterval(iv); router.replace("/dashboard"); }
        else if (tries > 12) { clearInterval(iv); setFailed(true); }
      }, 400);
    })();

    return () => { cancelled = true; if (iv) clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth">
      <div className="auth-form-col">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-brand" style={{ justifyContent: "center" }}>
            <span className="brand-mark"><IconDiamond size={12} /></span>
            <span className="brand-text stacked" style={{ alignItems: "flex-start" }}>
              <span className="name">Agentix Projects</span>
              <span className="sub">AGXP</span>
            </span>
          </div>

          {failed ? (
            <>
              <h1>That didn&apos;t work</h1>
              <p className="auth-sub">The link is invalid or has expired. Sign in again to get a fresh one.</p>
              <a className="btn-primary-wide" href="/login" style={{ textDecoration: "none" }}>
                Back to sign in<IconArrow />
              </a>
            </>
          ) : (
            <>
              <div className="spinner" style={{
                width: 22, height: 22, margin: "var(--sp-4) auto var(--sp-5)",
                borderColor: "var(--border-strong)", borderTopColor: "var(--primary)",
              }} />
              <h1>Signing you in</h1>
              <p className="auth-sub">One moment — confirming your account.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
