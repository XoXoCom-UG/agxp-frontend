"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { ACCENTS, readAccent, applyAccent, type Accent } from "@/lib/accent";
import { SPLIT_PRESETS, useChatSplit, useSplitLocked, broadcastSplit, broadcastSplitLocked, presetFor } from "@/lib/chat-split";
import { BACKGROUND_OPTIONS, GLASS_OPTIONS, useAppearance, setAppearance } from "@/lib/appearance";
import { LANG_OPTIONS, useLang, setLang, useT } from "@/lib/language";
import { IconX, IconCheck, IconMonitor, IconSun, IconMoon, IconSpark } from "@/components/layout/agxp-icons";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useExit } from "@/lib/use-exit";
import { useEntitlement } from "@/lib/entitlement";
import { PLANS, projectsLabel, agentsLabel, type Plan } from "@/lib/plans";
import { DevPlanTools } from "@/components/layout/dev-plan-tools";
import { DevMemory } from "@/components/layout/dev-memory";
import { DevUsage } from "@/components/layout/dev-usage";
import { DevFeedback } from "@/components/layout/dev-feedback";
import { replayTour } from "@/components/layout/tour-host";
import { PrivacyTab } from "@/components/layout/privacy-tab";

type Tab = "profile" | "plan" | "data" | "appearance";
const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "plan", label: "Plan" },
  { id: "data", label: "Your data" },
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
  const lang = useLang();
  const t = useT();
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
    const i = TABS.findIndex(x => x.id === tab);
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
      setError(e instanceof Error ? e.message : t("Could not save your name."));
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
          <h2 id={titleId}>{t("Settings")}</h2>
          <button className="ss-close" onClick={close} aria-label={t("Close settings")}><IconX size={14} /></button>
        </header>

        <div className="ss-tabs" role="tablist" aria-label={t("Settings sections")} onKeyDown={onTabKey}>
          {TABS.map(x => (
            <button key={x.id} role="tab" id={`${uid}-tab-${x.id}`} aria-selected={tab === x.id}
              aria-controls={`${uid}-panel`} tabIndex={tab === x.id ? 0 : -1}
              ref={el => { tabRefs.current[x.id] = el; }}
              className={tab === x.id ? "on" : ""} onClick={() => setTab(x.id)}>{t(x.label)}</button>
          ))}
        </div>

        <div className="ss-body" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`}>
          {tab === "plan" ? <PlanTab /> : tab === "data" ? <PrivacyTab closeThen={next => exitThen(() => { onClose(); next(); })} /> : tab === "profile" ? (
            <>
              <div className="ss-identity">
                <span className="ss-avatar" aria-hidden="true">{initials}</span>
                <div>
                  <div className="ss-name">{name.trim() || t("Add your name")}</div>
                  <div className="ss-mail">{user?.email}</div>
                </div>
              </div>

              <label className="ss-field">
                <span className="ss-label">{t("Display name")}</span>
                <input ref={firstField} type="text" value={name} maxLength={60}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && dirty) save(); }}
                  placeholder={t("How your agents address you")} />
                <span className="ss-hint">{t("Your agents use this when they talk to you.")}</span>
              </label>

              <label className="ss-field">
                <span className="ss-label">{t("Email")}</span>
                {/* Read-only: changing it means re-verifying an address, which
                    is an account flow, not a preference. */}
                <input type="email" value={user?.email ?? ""} readOnly disabled />
                <span className="ss-hint">{t("Sign-in address. Not changeable here.")}</span>
              </label>

              {error && <p className="ss-error" role="alert">{error}</p>}

              <div className="ss-actions">
                <button className="btn btn-hero" disabled={!dirty || saving} onClick={save}>
                  {saving ? t("Saving…") : saved ? <><IconCheck size={13} />{t("Saved")}</> : t("Save changes")}
                </button>
              </div>

              {/* The tour, as often as you like. It is here rather than under
                  Appearance because this is where people look for help, and
                  the sheet closes first — the tour covers the whole screen,
                  so leaving Settings open behind it would strand this dialog
                  underneath with its focus trap still running. */}
              <div className="ss-field ss-tour">
                <span className="ss-label">{t("Guided tour")}</span>
                <div className="ss-tour-row">
                  <p className="ss-hint">
                    {t("The one-minute introduction to the two agents, the documents and the colours.")}
                  </p>
                  <button className="btn btn-ghost" onClick={() => exitThen(() => { onClose(); replayTour(); })}>
                    <IconSpark size={13} />{t("Play it again")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Tudor, 2026-10-30: German or English, nothing more. The
                  app's own words only — lib/language.ts says why. */}
              <div className="ss-field">
                <span className="ss-label">{t("Language")}</span>
                <div className="ss-segment" role="group" aria-label={t("Language")}>
                  {LANG_OPTIONS.map(opt => (
                    <button key={opt.id} lang={opt.id} className={lang === opt.id ? "on" : ""}
                      aria-pressed={lang === opt.id} onClick={() => setLang(opt.id)}>{opt.label}</button>
                  ))}
                </div>
                <span className="ss-hint">{t("The app's buttons and labels. What the agents write is not changed.")}</span>
              </div>

              <div className="ss-field">
                <span className="ss-label">{t("Theme")}</span>
                <div className="ss-segment" role="group" aria-label={t("Theme")}>
                  {([
                    ["system", "System", <IconMonitor key="s" size={13} />],
                    ["light", "Light", <IconSun key="l" size={13} />],
                    ["dark", "Dark", <IconMoon key="d" size={13} />],
                  ] as const).map(([value, label, icon]) => (
                    <button key={value} className={theme === value ? "on" : ""}
                      aria-pressed={theme === value} onClick={() => setTheme(value)}>
                      {icon}{t(label)}
                    </button>
                  ))}
                </div>
                <span className="ss-hint">{t("System follows whatever your computer is set to.")}</span>
              </div>

              <div className="ss-field">
                <span className="ss-label">{t("Accent")}</span>
                <div className="ss-swatches" role="group" aria-label={t("Accent colour")}>
                  {ACCENTS.map(a => (
                    <button key={a.id} className={`ss-swatch${accent.id === a.id ? " on" : ""}`}
                      style={{ ["--sw" as string]: a.soft, ["--sw-deep" as string]: a.primary }}
                      aria-pressed={accent.id === a.id} aria-label={a.label} data-tooltip={a.label}
                      onClick={() => pickAccent(a)}>
                      {accent.id === a.id && <IconCheck size={12} />}
                    </button>
                  ))}
                </div>
                <span className="ss-hint">{t("Changes every accent in the app, including the light in the room behind the panels. Saved on this browser.")}</span>
              </div>

              {/* The room, and how much of it shows through. Both land as you
                  click — you are looking at the thing you are changing, so a
                  Save button in between would only hide the answer. */}
              <div className="ss-field">
                <span className="ss-label">{t("Background")}</span>
                <div className="ss-segment" role="group" aria-label={t("Background pattern")}>
                  {BACKGROUND_OPTIONS.map(opt => (
                    <button key={opt.id} className={appearance.background === opt.id ? "on" : ""}
                      aria-pressed={appearance.background === opt.id} data-tooltip={t(opt.hint)}
                      onClick={() => setAppearance({ background: opt.id })}>{t(opt.label)}</button>
                  ))}
                </div>
                <span className="ss-hint">{t("Drifting moves about a third of a pixel a second — enough to feel alive, not enough to follow.")}</span>
              </div>

              <div className="ss-field">
                <span className="ss-label">{t("Glass")}</span>
                <div className="ss-segment" role="group" aria-label={t("How much glass")}>
                  {GLASS_OPTIONS.map(opt => (
                    <button key={opt.id} className={appearance.glass === opt.id ? "on" : ""}
                      aria-pressed={appearance.glass === opt.id} data-tooltip={t(opt.hint)}
                      onClick={() => setAppearance({ glass: opt.id })}>{t(opt.label)}</button>
                  ))}
                </div>
                <span className="ss-hint">{t("How much the bars, the sheets and the panels blur what is behind them. Solid is also the faster one.")}</span>
              </div>

              {/* Asked for on 2026-09-26: the drag on the seam is the quick
                  way, this is where the answer sticks. Only the ratio is a
                  setting — the sides themselves are swapped in the workspace,
                  where you can see what you are swapping. */}
              <div className="ss-field">
                <span className="ss-label">{t("Conversation width")}</span>
                <div className="ss-segment" role="group" aria-label={t("How the two conversations share the screen")}>
                  {SPLIT_PRESETS.map(p => {
                    const on = presetFor(split) === p.id;
                    return (
                      <button key={p.id} className={on ? "on" : ""} aria-pressed={on}
                        data-tooltip={t(p.hint)}
                        onClick={() => broadcastSplit(p.share)}>
                        <span className="ss-split-ic" style={{ ["--lead" as string]: `${(p.share / (p.share + 1)) * 100}%` }} />
                        {t(p.label)}
                      </button>
                    );
                  })}
                </div>
                <span className="ss-hint">
                  {t("How much room the conversation you are in takes.")}
                  {t(splitLocked ? " The seam between them is locked." : " You can also drag the seam between them.")}
                </span>
              </div>

              {/* Asked for on 2026-09-28: the seam sits right where you reach
                  for the swap button, so the width changes by accident. Locked,
                  the presets above are the only way to change it. */}
              <div className="ss-field">
                <span className="ss-label">{t("Dragging the seam")}</span>
                <div className="ss-segment" role="group" aria-label={t("Whether the seam can be dragged")}>
                  {([[false, "Free"], [true, "Locked"]] as const).map(([value, label]) => (
                    <button key={label} className={splitLocked === value ? "on" : ""}
                      aria-pressed={splitLocked === value}
                      onClick={() => broadcastSplitLocked(value)}>{t(label)}</button>
                  ))}
                </div>
                <span className="ss-hint">{t("Locked, the width only changes here — the seam keeps its swap button.")}</span>
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
  const t = useT();
  const order: Plan[] = [PLANS.free, PLANS.mid, PLANS.max];
  const left = plan.period === "week" ? "{left} of {total} projects left this week" : "{left} of {total} projects left this month";
  const resets = t(plan.period === "week" ? "Resets Monday." : "Resets on the 1st.");
  const pct = plan.projects >= 1000 ? 0 : Math.min(100, (projects / plan.projects) * 100);

  return (
    <>
      <div className="ss-field">
        <span className="ss-label">{t("Your plan")}</span>
        <div className="ss-plan-now">
          <b>{plan.label}</b>
          {plan.projects >= 1000
            ? <span className="ss-plan-left">{t("Unlimited projects")}</span>
            : <span className={`ss-plan-left${projectsLeft <= 1 ? " low" : ""}`}>
                {loading ? "…" : t(left, { left: projectsLeft, total: plan.projects })}
              </span>}
        </div>
        {plan.projects < 1000 && (
          <div className="ss-plan-bar" role="presentation"><span style={{ width: `${pct}%` }} /></div>
        )}
        <span className="ss-hint">{resets} {t("A project is one conversation — rebuilding its document as often as you like costs nothing extra.")}</span>
      </div>

      <div className="ss-field">
        <span className="ss-label">{t("What each plan includes")}</span>
        <div className="ss-plans">
          {order.map(p => (
            <div key={p.id} className={`ss-plan${p.id === plan.id ? " on" : ""}`}>
              <div className="ss-plan-h">
                <b>{p.label}</b>
                {p.id === plan.id && <span className="ss-plan-tag">{t("Current")}</span>}
              </div>
              <ul>
                <li><b>{t(projectsLabel(p))}</b> {t(`projects per ${p.period}`)}</li>
                <li>{p.stations === null ? t("Full interview") : t("First {n} interview steps", { n: p.stations })}</li>
                <li>{t(p.peerReading === "full"
                  ? "Coach reads the consultation"
                  : "Coach reads it once, as a preview")}</li>
                <li>{t(p.nudges ? "Coach speaks up on its own" : "Coach answers when asked")}</li>
                <li>{t(`${agentsLabel(p)[0].toUpperCase() + agentsLabel(p).slice(1)}, all your own`)}</li>
              </ul>
            </div>
          ))}
        </div>
        <span className="ss-hint">{t("Upgrading isn't wired up yet — get in touch and we'll move your account.")}</span>
      </div>

      {canSwitch && <DevPlanTools current={plan.id} onChanged={refresh} />}
      {canSwitch && <DevUsage />}
      {canSwitch && <DevFeedback />}
      {canSwitch && <DevMemory />}
    </>
  );
}
