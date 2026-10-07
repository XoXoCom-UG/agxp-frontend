"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { ACCENTS, readAccent, applyAccent, type Accent } from "@/lib/accent";
import { SPLIT_PRESETS, useChatSplit, useSplitLocked, broadcastSplit, broadcastSplitLocked, presetFor } from "@/lib/chat-split";
import { BACKGROUND_OPTIONS, GLASS_OPTIONS, useAppearance, setAppearance } from "@/lib/appearance";
import { IconX, IconCheck, IconMonitor, IconSun, IconMoon } from "@/components/layout/agxp-icons";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useExit } from "@/lib/use-exit";
import { useEntitlement } from "@/lib/entitlement";
import { PLANS, projectsLabel, type Plan } from "@/lib/plans";
import { DevPlanTools } from "@/components/layout/dev-plan-tools";
import { DevMemory } from "@/components/layout/dev-memory";

type Tab = "profile" | "plan" | "appearance";
const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "plan", label: "Plan" },
  { id: "appearance", label: "Appearance" },
];

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
  const split = useChatSplit();
  const splitLocked = useSplitLocked();
  const appearance = useAppearance();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const firstField = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const uid = useId();
  const titleId = `${uid}-title`;

  // Focus lands on the name field once, Tab stays inside, and focus goes
  // back to whatever opened the sheet when it closes.
  useDialogFocus(sheetRef, firstField);

  // The parent passes a fresh arrow every render. Held in a ref, the Escape
  // listener is attached once instead of being torn down and re-added — the
  // old version also re-focused the name field on every parent render.
  const [closing, exitThen] = useExit();
  const close = () => exitThen(onClose);
  const onCloseRef = useRef(close);
  useEffect(() => { onCloseRef.current = close; });
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCloseRef.current(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /** Left/Right/Home/End between the two tabs; Tab itself goes to the panel. */
  function onTabKey(e: React.KeyboardEvent<HTMLElement>) {
    const i = TABS.findIndex(t => t.id === tab);
    const next = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length]
      : e.key === "ArrowLeft" ? TABS[(i - 1 + TABS.length) % TABS.length]
      : e.key === "Home" ? TABS[0]
      : e.key === "End" ? TABS[TABS.length - 1]
      : null;
    if (!next) return;
    e.preventDefault();
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  }

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
    <div className={`modal-overlay${closing ? " is-closing" : ""}`}
      onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div ref={sheetRef} className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="ss-head">
          <h2 id={titleId}>Settings</h2>
          <button className="ss-close" onClick={close} aria-label="Close settings"><IconX size={14} /></button>
        </header>

        <div className="ss-tabs" role="tablist" aria-label="Settings sections" onKeyDown={onTabKey}>
          {TABS.map(t => (
            <button key={t.id} role="tab" id={`${uid}-tab-${t.id}`} aria-selected={tab === t.id}
              aria-controls={`${uid}-panel`} tabIndex={tab === t.id ? 0 : -1}
              ref={el => { tabRefs.current[t.id] = el; }}
              className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="ss-body" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`}>
          {tab === "plan" ? <PlanTab /> : tab === "profile" ? (
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
                    ["system", "System", <IconMonitor key="s" size={13} />],
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
                <span className="ss-hint">Changes every accent in the app, including the light in the room behind the panels. Saved on this browser.</span>
              </div>

              {/* The room, and how much of it shows through. Both land as you
                  click — you are looking at the thing you are changing, so a
                  Save button in between would only hide the answer. */}
              <div className="ss-field">
                <span className="ss-label">Background</span>
                <div className="ss-segment" role="group" aria-label="Background pattern">
                  {BACKGROUND_OPTIONS.map(opt => (
                    <button key={opt.id} className={appearance.background === opt.id ? "on" : ""}
                      aria-pressed={appearance.background === opt.id} data-tooltip={opt.hint}
                      onClick={() => setAppearance({ background: opt.id })}>{opt.label}</button>
                  ))}
                </div>
                <span className="ss-hint">Drifting moves about a third of a pixel a second — enough to feel alive, not enough to follow.</span>
              </div>

              <div className="ss-field">
                <span className="ss-label">Glass</span>
                <div className="ss-segment" role="group" aria-label="How much glass">
                  {GLASS_OPTIONS.map(opt => (
                    <button key={opt.id} className={appearance.glass === opt.id ? "on" : ""}
                      aria-pressed={appearance.glass === opt.id} data-tooltip={opt.hint}
                      onClick={() => setAppearance({ glass: opt.id })}>{opt.label}</button>
                  ))}
                </div>
                <span className="ss-hint">How much the bars, the sheets and the panels blur what is behind them. Solid is also the faster one.</span>
              </div>

              {/* Asked for on 2026-09-26: the drag on the seam is the quick
                  way, this is where the answer sticks. Only the ratio is a
                  setting — the sides themselves are swapped in the workspace,
                  where you can see what you are swapping. */}
              <div className="ss-field">
                <span className="ss-label">Conversation width</span>
                <div className="ss-segment" role="group" aria-label="How the two conversations share the screen">
                  {SPLIT_PRESETS.map(p => {
                    const on = presetFor(split) === p.id;
                    return (
                      <button key={p.id} className={on ? "on" : ""} aria-pressed={on}
                        data-tooltip={p.hint}
                        onClick={() => broadcastSplit(p.share)}>
                        <span className="ss-split-ic" style={{ ["--lead" as string]: `${(p.share / (p.share + 1)) * 100}%` }} />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <span className="ss-hint">
                  How much room the conversation you are in takes.
                  {splitLocked ? " The seam between them is locked." : " You can also drag the seam between them."}
                </span>
              </div>

              {/* Asked for on 2026-09-28: the seam sits right where you reach
                  for the swap button, so the width changes by accident. Locked,
                  the presets above are the only way to change it. */}
              <div className="ss-field">
                <span className="ss-label">Dragging the seam</span>
                <div className="ss-segment" role="group" aria-label="Whether the seam can be dragged">
                  {([[false, "Free"], [true, "Locked"]] as const).map(([value, label]) => (
                    <button key={label} className={splitLocked === value ? "on" : ""}
                      aria-pressed={splitLocked === value}
                      onClick={() => broadcastSplitLocked(value)}>{label}</button>
                  ))}
                </div>
                <span className="ss-hint">Locked, the width only changes here — the seam keeps its swap button.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The plan, and what is left of it.
 *
 * Shows the allowance as a count rather than as tokens. Tokens are our unit,
 * not the customer's: a ceiling exists behind every plan (cost grows with the
 * square of conversation length, so "unlimited" always has a real number
 * behind it) but quoting it here would mean explaining our billing instead of
 * their allowance. If someone ever hits the ceiling, the chat route says so
 * in words at the moment it matters.
 */
function PlanTab() {
  const { plan, projects, projectsLeft, loading, canSwitch, refresh } = useEntitlement();
  const order: Plan[] = [PLANS.free, PLANS.mid, PLANS.max];
  const window = plan.period === "week" ? "this week" : "this month";
  const resets = plan.period === "week" ? "Resets Monday." : "Resets on the 1st.";
  const pct = plan.projects >= 1000 ? 0 : Math.min(100, (projects / plan.projects) * 100);

  return (
    <>
      <div className="ss-field">
        <span className="ss-label">Your plan</span>
        <div className="ss-plan-now">
          <b>{plan.label}</b>
          {plan.projects >= 1000
            ? <span className="ss-plan-left">Unlimited projects</span>
            : <span className={`ss-plan-left${projectsLeft <= 1 ? " low" : ""}`}>
                {loading ? "…" : `${projectsLeft} of ${plan.projects} projects left ${window}`}
              </span>}
        </div>
        {plan.projects < 1000 && (
          <div className="ss-plan-bar" role="presentation"><span style={{ width: `${pct}%` }} /></div>
        )}
        <span className="ss-hint">{resets} A project is one conversation — rebuilding its document as often as you like costs nothing extra.</span>
      </div>

      <div className="ss-field">
        <span className="ss-label">What each plan includes</span>
        <div className="ss-plans">
          {order.map(p => (
            <div key={p.id} className={`ss-plan${p.id === plan.id ? " on" : ""}`}>
              <div className="ss-plan-h">
                <b>{p.label}</b>
                {p.id === plan.id && <span className="ss-plan-tag">Current</span>}
              </div>
              <ul>
                <li><b>{projectsLabel(p)}</b> projects per {p.period}</li>
                <li>{p.stations === null ? "Full interview" : `${p.stations} of 8 interview steps`}</li>
                <li>{p.peerReading === "full"
                  ? "Coach reads the consultation"
                  : "Coach reads it once, as a preview"}</li>
                <li>{p.nudges ? "Coach speaks up on its own" : "Coach answers when asked"}</li>
                <li>{p.agentSlots === null ? "Every agent" : `${p.agentSlots} agents`}
                  {p.createAgents ? ", and you can build your own" : ""}</li>
              </ul>
            </div>
          ))}
        </div>
        <span className="ss-hint">Upgrading isn&apos;t wired up yet — get in touch and we&apos;ll move your account.</span>
      </div>

      {canSwitch && <DevPlanTools current={plan.id} onChanged={refresh} />}
      {canSwitch && <DevMemory />}
    </>
  );
}
