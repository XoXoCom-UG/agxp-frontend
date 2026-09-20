"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { ACCENTS, readAccent, applyAccent, type Accent } from "@/lib/accent";
import { IconX, IconCheck, IconUser, IconSun, IconMoon } from "@/components/layout/agxp-icons";

type Tab = "profile" | "appearance";

/**
 * Settings, in one place.
 *
 * HIG settings.md: "Minimize the number of settings you offer" and avoid
 * duplicating system-wide options. So this holds exactly what belongs to this
 * app — who you are, and how it looks — and the theme's default is System,
 * which defers to the machine instead of overriding it.
 *
 * Opened with Cmd/Ctrl+, the way every desktop app does, closed with Escape.
 */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { user, profileName, setProfileName, saveProfileName } = useAuth();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState(profileName);
  const [accent, setAccent] = useState<Accent>(() => readAccent());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    firstField.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Live preview: the colour lands as you click, before anything is saved. */
  function pickAccent(a: Accent) {
    setAccent(a);
    applyAccent(a);
  }

  async function save() {
    const clean = name.trim();
    setSaving(true);
    setError("");
    try {
      await saveProfileName(clean);
      setProfileName(clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your name.");
    } finally {
      setSaving(false);
    }
  }

  const initials = (name || user?.email || "U").slice(0, 2).toUpperCase();
  const dirty = name.trim() !== profileName.trim();

  return createPortal(
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-sheet" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="ss-head">
          <h2>Settings</h2>
          <button className="ss-close" onClick={onClose} aria-label="Close settings"><IconX size={14} /></button>
        </header>

        <nav className="ss-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "profile"}
            className={tab === "profile" ? "on" : ""} onClick={() => setTab("profile")}>Profile</button>
          <button role="tab" aria-selected={tab === "appearance"}
            className={tab === "appearance" ? "on" : ""} onClick={() => setTab("appearance")}>Appearance</button>
        </nav>

        <div className="ss-body">
          {tab === "profile" ? (
            <>
              <div className="ss-identity">
                <span className="ss-avatar" aria-hidden="true">{initials}</span>
                <div>
                  <div className="ss-name">{name.trim() || "Add your name"}</div>
                  <div className="ss-mail">{user?.email}</div>
                </div>
              </div>

              <label className="ss-field">
                <span className="ss-label">Display name</span>
                <input ref={firstField} type="text" value={name} maxLength={60}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && dirty) save(); }}
                  placeholder="How your agents address you" />
                <span className="ss-hint">Your agents use this when they talk to you.</span>
              </label>

              <label className="ss-field">
                <span className="ss-label">Email</span>
                {/* Read-only: changing it means re-verifying an address, which
                    is an account flow, not a preference. */}
                <input type="email" value={user?.email ?? ""} readOnly disabled />
                <span className="ss-hint">Sign-in address. Not changeable here.</span>
              </label>

              {error && <p className="ss-error" role="alert">{error}</p>}

              <div className="ss-actions">
                <button className="btn btn-hero" disabled={!dirty || saving} onClick={save}>
                  {saving ? "Saving…" : saved ? <><IconCheck size={13} />Saved</> : "Save changes"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="ss-field">
                <span className="ss-label">Theme</span>
                <div className="ss-segment" role="group" aria-label="Theme">
                  {([
                    ["system", "System", <IconUser key="s" size={13} />],
                    ["light", "Light", <IconSun key="l" size={13} />],
                    ["dark", "Dark", <IconMoon key="d" size={13} />],
                  ] as const).map(([value, label, icon]) => (
                    <button key={value} className={theme === value ? "on" : ""}
                      aria-pressed={theme === value} onClick={() => setTheme(value)}>
                      {icon}{label}
                    </button>
                  ))}
                </div>
                <span className="ss-hint">System follows whatever your computer is set to.</span>
              </div>

              <div className="ss-field">
                <span className="ss-label">Accent</span>
                <div className="ss-swatches" role="group" aria-label="Accent colour">
                  {ACCENTS.map(a => (
                    <button key={a.id} className={`ss-swatch${accent.id === a.id ? " on" : ""}`}
                      style={{ ["--sw" as string]: a.soft, ["--sw-deep" as string]: a.primary }}
                      aria-pressed={accent.id === a.id} aria-label={a.label} data-tooltip={a.label}
                      onClick={() => pickAccent(a)}>
                      {accent.id === a.id && <IconCheck size={12} />}
                    </button>
                  ))}
                </div>
                <span className="ss-hint">Changes every accent in the app. Saved on this browser.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
