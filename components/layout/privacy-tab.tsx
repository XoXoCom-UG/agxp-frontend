"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { exportMyData, downloadJson, deleteMyAccount, signOutEverywhere } from "@/lib/account-data";
import { openConsentSettings } from "@/lib/consent";

/**
 * Settings → Your data. The rights the Datenschutzerklärung promises, as
 * things a person can do themselves instead of writing to us: take a copy
 * (Art. 15/20), end every session, and delete the account (Art. 17).
 *
 * `closeThen` closes Settings before running something that needs the whole
 * screen — the cookie banner, here. Opened on top of Settings it sat under
 * the dialog's backdrop, and the dialog's focus trap kept Tab from reaching
 * it: the same reason the guided tour closes Settings first.
 */
export function PrivacyTab({ closeThen }: { closeThen: (next: () => void) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<"export" | "signout" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  const email = user?.email ?? "";
  const matches = typed.trim().toLowerCase() === email.toLowerCase() && !!email;

  async function run(kind: "export" | "signout" | "delete", fn: () => Promise<void>) {
    setError("");
    setBusy(kind);
    try { await fn(); }
    catch (e) { setError((e as Error).message || "That didn't work. Try again."); }
    finally { setBusy(null); }
  }

  return (
    <>
      <div className="ss-field ss-tour">
        <span className="ss-label">Download your data</span>
        <div className="ss-tour-row">
          <p className="ss-hint">
            Your account, projects, conversations, documents, agents and usage, as one JSON file.
          </p>
          <button className="btn btn-ghost" disabled={!!busy}
            onClick={() => run("export", async () => {
              const data = await exportMyData();
              downloadJson(data, `agentix-export-${new Date().toISOString().slice(0, 10)}.json`);
            })}>
            {busy === "export" ? "Preparing…" : "Download"}
          </button>
        </div>
      </div>

      <div className="ss-field ss-tour">
        <span className="ss-label">Sign out everywhere</span>
        <div className="ss-tour-row">
          <p className="ss-hint">Ends your session on every device and browser, including this one.</p>
          <button className="btn btn-ghost" disabled={!!busy}
            onClick={() => run("signout", async () => {
              await signOutEverywhere();
              window.location.assign("/login");
            })}>
            {busy === "signout" ? "Signing out…" : "Sign out everywhere"}
          </button>
        </div>
      </div>

      <div className="ss-field ss-tour">
        <span className="ss-label">Cookies</span>
        <div className="ss-tour-row">
          <p className="ss-hint">Change whether we may send error reports from your browser.</p>
          <button className="btn btn-ghost" onClick={() => closeThen(openConsentSettings)}>
            Cookie-Einstellungen
          </button>
        </div>
      </div>

      <div className="ss-field ss-danger">
        <span className="ss-label">Delete account</span>
        <p className="ss-hint">
          Deletes your account, every project and conversation, your documents, attached files and
          the agents you built. This can&apos;t be undone — download your data first if you want a copy.
        </p>
        {!confirming ? (
          <div className="ss-actions">
            <button className="btn btn-ghost ss-danger-btn" disabled={!!busy} onClick={() => setConfirming(true)}>
              Delete my account…
            </button>
          </div>
        ) : (
          <>
            <label className="ss-field">
              <span className="ss-hint">Type <b>{email}</b> to confirm.</span>
              <input type="email" value={typed} autoComplete="off" spellCheck={false}
                onChange={e => setTyped(e.target.value)} aria-label="Your email address, to confirm" />
            </label>
            <div className="ss-actions ss-danger-row">
              <button className="btn btn-ghost" disabled={!!busy} onClick={() => { setConfirming(false); setTyped(""); }}>
                Cancel
              </button>
              <button className="btn btn-ghost ss-danger-btn" disabled={!matches || !!busy}
                onClick={() => run("delete", async () => {
                  await deleteMyAccount(typed);
                  // The session belongs to an account that no longer exists.
                  await signOutEverywhere().catch(() => {});
                  window.location.assign("/");
                })}>
                {busy === "delete" ? "Deleting…" : "Delete everything"}
              </button>
            </div>
          </>
        )}
      </div>

      {error && <p className="ss-error" role="alert">{error}</p>}

      <p className="ss-hint">
        How we handle your data: <Link href="/datenschutz" target="_blank">Datenschutzerklärung</Link>.
      </p>
    </>
  );
}
