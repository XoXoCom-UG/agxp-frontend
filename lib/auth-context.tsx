"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { scopeToUser } from "@/lib/user-scope";
import { forgetEntitlement } from "@/lib/entitlement";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  token: string | null;
  loading: boolean;
  // The display name, taken from the signed-in account's own metadata (set at
  // sign-up, editable in settings). Keyed to the user id below, so it can't
  // leak between accounts sharing a browser.
  profileName: string;
  setProfileName: (n: string) => void;
  /** Writes the name to the account, so it survives a reload. */
  saveProfileName: (n: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  token: null,
  loading: true,
  profileName: "",
  setProfileName: () => {},
  saveProfileName: async () => {},
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

/** The same token for the same account, with nothing about the account changed. */
function sameSession(a: Session | null, b: Session | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.access_token === b.access_token
    && a.user?.id === b.user?.id
    && a.user?.updated_at === b.user?.updated_at
    && JSON.stringify(a.user?.user_metadata) === JSON.stringify(b.user?.user_metadata);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // An edit made in settings, before the session carries it. Stored with the
  // user id it belongs to, so switching accounts can never show the wrong name
  // and no effect is needed to clear it.
  const [nameEdit, setNameEdit] = useState<{ uid: string; name: string } | null>(null);
  const supabase = createClient();

  const userId = session?.user?.id ?? null;
  const token = session?.access_token ?? null;

  // The name comes straight from the account: sign-up writes it into user
  // metadata. This used to call /api/profile on the old Modal backend, which
  // no longer exists — the request 404'd on every sign-in and the name was
  // always empty.
  const metaName = (((session?.user?.user_metadata as { full_name?: string } | undefined)?.full_name) ?? "").trim();
  const profileName = nameEdit && nameEdit.uid === userId ? nameEdit.name : metaName;
  const setProfileName = (n: string) => { if (userId) setNameEdit({ uid: userId, name: n }); };

  /** setProfileName only painted the new name on screen; it was gone on the
   *  next reload. This is the half that actually writes it to the account. */
  const saveProfileName = async (n: string) => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: n } });
    if (error) throw new Error(error.message);
  };

  useEffect(() => {
    /*
     * Supabase announces the session again when the tab comes back into view,
     * as a fresh object holding the same token. Taking it as new re-rendered
     * every screen under this provider — both chats with every message — each
     * time someone switched back to the tab. Only a real change goes in.
     */
    let lastUid: string | null | undefined;
    const take = (s: Session | null) => {
      const uid = s?.user?.id ?? null;
      // A different account: the plan read for the last one is not this one's.
      if (lastUid !== undefined && uid !== lastUid) forgetEntitlement();
      lastUid = uid;
      setSession(prev => (sameSession(prev, s) ? prev : s));
    };

    // Always resolve loading — even on error — so the app never hangs on the
    // skeleton (a corrupt session cookie used to strand it forever).
    supabase.auth.getSession()
      .then(({ data }) => {
        take(data.session);
        scopeToUser(data.session?.user?.id ?? null);
        // No session, but the proxy's gate cookie is still around: stale. Clear it
        // before any page acts on the missing token, or the redirect it triggers
        // bounces straight back here.
        if (!data.session) clearStaleAuthCookies();
      })
      .catch(() => { take(null); clearStaleAuthCookies(); })
      .finally(() => setLoading(false));

    // Safety net: if getSession never settles (network stall), stop loading.
    const failsafe = setTimeout(() => setLoading(false), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      take(s);
      // What the browser remembers about one account's work goes when the
      // account does (lib/user-scope.ts) — a shared computer must not show the
      // next person the last one's project name.
      scopeToUser(s?.user?.id ?? null);
      setLoading(false);
      // Covers the case that produced the loop in the first place: a refresh token
      // that stops working mid-session leaves the cookie in place.
      if (!s) clearStaleAuthCookies();
    });

    return () => { subscription.unsubscribe(); clearTimeout(failsafe); };
    // The shared browser client (lib/supabase.ts): the same object on every render.
  }, [supabase.auth]);

  /*
   * Ends on the login page, always, in a fresh page load. Signing out used to
   * leave you where you were: the signed-in screen lost its session, drew
   * nothing while it waited for one, and stayed black until a refresh (Ana,
   * 2026-11-19). A full load also drops everything this tab still holds in
   * memory about the account — the plan read, agent levels, conversations —
   * which matters on a shared computer.
   */
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Offline or the server refused: this browser still forgets the session.
    }
    clearStaleAuthCookies();
    window.location.replace("/login");
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      token,
      loading,
      profileName,
      setProfileName,
      saveProfileName,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
