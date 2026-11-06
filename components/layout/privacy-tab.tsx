"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { exportMyData, downloadJson, deleteMyAccount, signOutEverywhere } from "@/lib/account-data";
import { openConsentSettings } from "@/lib/consent";
import { useT } from "@/lib/language";

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
  const t = useT();
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<"export" | "signout" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  const email = user?.email ?? "";
  // The address sits inside the sentence, and German puts it elsewhere than English does.
  const [confirmBefore, confirmAfter] = t("Type {email} to confirm.", { email: "\u0001" }).split("\u0001");
  const matches = typed.trim().toLowerCase() === email.toLowerCase() && !!email;

  async function run(kind: "export" | "signout" | "delete", fn: () => Promise<void>) {
    setError("");
    setBusy(kind);
    try { await fn(); }
    catch (e) { setError((e as Error).message || t("That didn't work. Try again.")); }
    finally { setBusy(null); }
  }

  return (
    <>
      <div className="ss-field ss-tour">
        <span className="ss-label">{t("Download your data")}</span>
        <div className="ss-tour-row">
          <p className="ss-hint">
            {t("Your account, projects, conversations, documents, agents and usage, as one JSON file.")}
          </p>
          <button className="btn btn-ghost" disabled={!!busy}
            onClick={() => run("export", async () => {
              const data = await exportMyData();
              downloadJson(data, `agentix-export-${new Date().toISOString().slice(0, 10)}.json`);
            })}>
            {busy === "export" ? t("Preparing…") : t("Download")}
          </button>
        </div>
      </div>

      <div className="ss-field ss-tour">
        <span className="ss-label">{t("Sign out everywhere")}</span>
        <div className="ss-tour-row">
          <p className="ss-hint">{t("Ends your session on every device and browser, including this one.")}</p>
          <button className="btn btn-ghost" disabled={!!busy}
            onClick={() => run("signout", async () => {
              await signOutEverywhere();
              router.replace("/login");
            })}>
            {busy === "signout" ? t("Signing out…") : t("Sign out everywhere")}
          </button>
        </div>
      </div>

      <div className="ss-field ss-tour">
        <span className="ss-label">{t("Cookies")}</span>
        <div className="ss-tour-row">
          <p className="ss-hint">{t("Change whether we may send error reports from your browser.")}</p>
          <button className="btn btn-ghost" onClick={() => closeThen(openConsentSettings)}>
            {t("Cookie settings")}
          </button>
        </div>
      </div>

      <div className="ss-field ss-danger">
        <span className="ss-label">{t("Delete account")}</span>
        <p className="ss-hint">
          {t("Deletes your account, every project and conversation, your documents, attached files and the agents you built. This can’t be undone — download your data first if you want a copy.")}
        </p>
        {!confirming ? (
          <div className="ss-actions">
            <button className="btn btn-ghost ss-danger-btn" disabled={!!busy} onClick={() => setConfirming(true)}>
              {t("Delete my account…")}
            </button>
          </div>
        ) : (
          <>
            <label className="ss-field">
              <span className="ss-hint">{confirmBefore}<b>{email}</b>{confirmAfter}</span>
              <input type="email" value={typed} autoComplete="off" spellCheck={false}
                onChange={e => setTyped(e.target.value)} aria-label={t("Your email address, to confirm")} />
            </label>
            <div className="ss-actions ss-danger-row">
              <button className="btn btn-ghost" disabled={!!busy} onClick={() => { setConfirming(false); setTyped(""); }}>
                {t("Cancel")}
              </button>
              <button className="btn btn-ghost ss-danger-btn" disabled={!matches || !!busy}
                onClick={() => run("delete", async () => {
                  await deleteMyAccount(typed);
                  // The session belongs to an account that no longer exists.
                  await signOutEverywhere().catch(() => {});
                  router.replace("/");
                })}>
                {busy === "delete" ? t("Deleting…") : t("Delete everything")}
              </button>
            </div>
          </>
        )}
      </div>

      {error && <p className="ss-error" role="alert">{error}</p>}

      <p className="ss-hint">
        {t("How we handle your data:")} <Link href="/datenschutz" target="_blank">{t("Privacy policy")}</Link>.
      </p>
    </>
  );
}
