"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { IconArrow } from "@/components/layout/agxp-icons";
import { useExit } from "@/lib/use-exit";
import { captureBetaKeyFromUrl, clearPendingBetaKey, usePendingBetaKey } from "@/lib/beta-key-handoff";

/**
 * The door, while the product is in closed beta.
 *
 * Shown instead of the workspace to a signed-in account with no entitlement
 * row. It is not the security boundary — that is the chat route, which
 * refuses to spend anything for an account nobody invited. This is the part
 * that tells the person why and what to do about it, which a 402 in the
 * network tab does not.
 */
export function BetaGate({ onAdmitted }: { onAdmitted: () => void }) {
  // What the person typed, or null while they haven't — in which case the
  // field shows the key from the invitation link, if they came that way.
  const [typed, setTyped] = useState<string | null>(null);
  const invited = usePendingBetaKey();
  const code = typed ?? invited ?? "";
  const fromInvite = typed === null && !!invited;
  const [busy, setBusy] = useState(false);
  // The one moment a tester only ever sees once: the gate lets go before the
  // workspace takes its place, instead of being cut away.
  const [leaving, exitThen] = useExit(200, 3000);
  const [error, setError] = useState<string | null>(null);

  // Captured here too, not only on /login: a tester who is already signed in
  // is sent straight to /dashboard with the fragment intact.
  useEffect(() => { captureBetaKeyFromUrl(); }, []);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has expired. Sign in again.");

      const res = await fetch("/api/beta/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "That didn't work. Try again.");
      clearPendingBetaKey();
      exitThen(onAdmitted);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`beta-gate${leaving ? " is-closing" : ""}`}>
      <div className="bg-card">
        <span className="bg-eyebrow">Closed beta</span>
        <h1>You need a key to come in</h1>
        <p>
          AgentiX is open to invited testers while we finish it. Enter the key you were
          given and you are in — it only has to be done once.
        </p>
        <form onSubmit={redeem}>
          <label className="bg-field">
            <span>Your key</span>
            <input
              value={code}
              onChange={e => { setTyped(e.target.value.toUpperCase()); setError(null); }}
              placeholder="AGXP-XXXXXX"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              aria-invalid={!!error}
            />
          </label>
          {fromInvite && !error && <p className="bg-hint">Filled in from your invitation.</p>}
          {error && <p className="bg-error" role="alert">{error}</p>}
          <button className="btn btn-hero" type="submit" disabled={busy || !code.trim()}>
            {busy ? "Checking…" : <>Let me in <IconArrow /></>}
          </button>
        </form>
        <p className="bg-foot">
          Don&apos;t have one? Write to us and we&apos;ll add you to the next round.
        </p>
      </div>
    </div>
  );
}
