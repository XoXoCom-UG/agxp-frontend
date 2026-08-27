"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  token: string | null;
  loading: boolean;
  // The display name, sourced from the backend profile (scoped to the
  // authenticated account via the token) — never cached in a global place,
  // so it can't leak between accounts sharing a browser.
  profileName: string;
  setProfileName: (n: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  token: null,
  loading: true,
  profileName: "",
  setProfileName: () => {},
  signOut: async () => {},
});

/**
 * Drop the Supabase auth cookies when the client has decided there is no valid
 * session.
 *
 * proxy.ts gates the app pages on the mere PRESENCE of `sb-<ref>-auth-token`, so
 * a cookie left behind by an expired or invalidated session makes the proxy treat
 * the visitor as signed in while this provider resolves no session at all. The
 * page then redirects to /login and the proxy waves it back — the app never got
 * past its skeleton. Clearing the cookie here makes both sides agree again and
 * lands the user on a working login page.
 *
 * Returns how many cookies were cleared, so the caller can tell "signed out
 * normally" (0) from "stale session cleaned up" (>0).
 */
function clearStaleAuthCookies(): number {
  if (typeof document === "undefined") return 0;
  // Chunked tokens are named `...-auth-token.0`, `.1` — matched by `includes`.
  const names = document.cookie
    .split(";")
    .map(c => c.split("=")[0].trim())
    .filter(n => n.startsWith("sb-") && n.includes("-auth-token"));

  for (const n of names) {
    // Both forms: the cookie may or may not carry an explicit domain.
    document.cookie = `${n}=; Max-Age=0; path=/`;
    document.cookie = `${n}=; Max-Age=0; path=/; domain=${location.hostname}`;
  }
  return names.length;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const supabase = createClient();

  const userId = session?.user?.id ?? null;
  const token = session?.access_token ?? null;

  // Fetch the display name from the backend profile whenever the signed-in
  // account changes. The backend resolves the profile from the token, so this
  // is always scoped to the correct account — no cross-account leakage.
  useEffect(() => {
    if (!token || !userId) { setProfileName(""); return; }
    let alive = true;
    api.getProfile(token)
      .then(p => { if (alive) setProfileName(p.display_name || p.name || ""); })
      .catch(() => { if (alive) setProfileName(""); });
    return () => { alive = false; };
  }, [token, userId]);

  useEffect(() => {
    // Always resolve loading — even on error — so the app never hangs on the
    // skeleton (a corrupt session cookie used to strand it forever).
    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
        // No session, but the proxy's gate cookie is still around: stale. Clear it
        // before any page acts on the missing token, or the redirect it triggers
        // bounces straight back here.
        if (!data.session) clearStaleAuthCookies();
      })
      .catch(() => { setSession(null); clearStaleAuthCookies(); })
      .finally(() => setLoading(false));

    // Safety net: if getSession never settles (network stall), stop loading.
    const failsafe = setTimeout(() => setLoading(false), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
      // Covers the case that produced the loop in the first place: a refresh token
      // that stops working mid-session leaves the cookie in place.
      if (!s) clearStaleAuthCookies();
    });

    return () => { subscription.unsubscribe(); clearTimeout(failsafe); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      token,
      loading,
      profileName,
      setProfileName,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
