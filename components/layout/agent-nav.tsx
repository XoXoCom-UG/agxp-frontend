"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { IconSun, IconMoon, IconUser, IconLogout, IconArrow } from "@/components/layout/agxp-icons";
import { BrandLogo } from "@/components/layout/brand-logo";
import { usePresence, phaseClass } from "@/lib/use-presence";
import { SettingsSheet } from "@/components/layout/settings-sheet";
import { readAccent, applyAccent } from "@/lib/accent";
import { readAppearance, applyAppearance } from "@/lib/appearance";

type Tab = "newtask" | "history" | "agents";

function activeTab(pathname: string): Tab {
  if (pathname.startsWith("/dashboard/history")) return "history";
  if (pathname.startsWith("/dashboard/agents")) return "agents";
  return "newtask";
}

/** The two places you can go from the workspace. "New task" is not one of
 *  them — it is the workspace itself, so it sits with the brand on the left
 *  (Ana, 2026-09-28 mockup) instead of in this group. */
const TABS: { id: Tab; href: string; label: string }[] = [
  { id: "history", href: "/dashboard/history", label: "Project history" },
  { id: "agents", href: "/dashboard/agents", label: "Agent dashboard" },
];

type PopoverName = "avatar" | null;

/** Mac, iPhone, iPad: the settings shortcut is Command-Comma there and
 *  Control-Comma everywhere else. */
function detectApple(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}
const noSubscribe = () => () => {};

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
}

/**
 * Read through useSyncExternalStore: the server can't know the platform, so
 * it and the hydrating client both say "Apple", and the real answer lands on
 * the next render — no hydration mismatch, no effect copying it into state.
 */
function useIsApple(): boolean {
  return useSyncExternalStore(noSubscribe, detectApple, () => true);
}

export function AgentNav({ startEnabled, startHint, started, onStart }: {
  /** Both halves chosen? The Start button lights up. */
  startEnabled?: boolean;
  /** Everything is picked and nothing has started — say so, once. */
  startHint?: boolean;
  /** The conversation is running: the green pill turns into a label. */
  started?: boolean;
  /** Omitted once the conversation has started — then there is nothing to start. */
  onStart?: () => void;
}) {
  const { user, profileName, signOut } = useAuth();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [popover, setPopover] = useState<PopoverName>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isApple = useIsApple();
  const menuId = useId();
  const startWhyId = useId();

  // Paint the saved accent and the saved room before anything else renders
  // with the defaults. Reading localStorage during render would differ
  // between server and client, so it waits for mount — the defaults are what
  // the stylesheet already draws, so nothing flashes in the meantime.
  useEffect(() => {
    applyAccent(readAccent(), false);
    applyAppearance(readAppearance());
  }, []);

  // Cmd+, on Apple and Ctrl+, elsewhere opens settings: settings.md — "people
  // often use the standard Command-Comma shortcut to open an app's settings".
  // Only the platform's own modifier counts, so Ctrl+, on a Mac stays free.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = detectApple() ? e.metaKey : e.ctrlKey;
      if (e.key === "," && mod && !e.altKey && !e.shiftKey) { e.preventDefault(); setSettingsOpen(true); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Opened from the keyboard with ArrowUp: land on the last item instead. */
  const focusLast = useRef(false);
  const tab = activeTab(pathname);
  // Scales out of the avatar and fades away on close, like the chat menus.
  const avatarPhase = usePresence(popover === "avatar");
  const menuOpen = popover === "avatar";

  // A click anywhere outside the avatar and its menu closes the menu.
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPopover(null);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [menuOpen]);

  // Focus moves into the menu when it opens — a menu you have to Tab into
  // is not a menu to a screen reader.
  useEffect(() => {
    if (!menuOpen) return;
    const list = menuItems(menuRef.current);
    (focusLast.current ? list[list.length - 1] : list[0])?.focus();
    focusLast.current = false;
  }, [menuOpen]);

  function closeMenu(returnFocus: boolean) {
    setPopover(null);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onMenuKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const list = menuItems(menuRef.current);
    const i = list.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    if (e.key === "ArrowDown") next = list[(i + 1) % list.length];
    else if (e.key === "ArrowUp") next = list[(i - 1 + list.length) % list.length];
    else if (e.key === "Home") next = list[0];
    else if (e.key === "End") next = list[list.length - 1];
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(true); return; }
    // Tab leaves a menu rather than walking through it.
    else if (e.key === "Tab") { closeMenu(false); return; }
    if (next) { e.preventDefault(); next.focus(); }
  }

  function onTriggerKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusLast.current = e.key === "ArrowUp";
      setPopover("avatar");
    }
  }

  function toggle(name: Exclude<PopoverName, null>) {
    setPopover(p => p === name ? null : name);
  }

  return (
    // A glass capsule in two halves (Ana, 2026-09-28 mockup): the brand, the
    // state of this project and New Task on the left — everything about the
    // work in front of you; the two other places, the theme and the account
    // on the right. The blue is a light in the room behind the bar, seen
    // through the glass, not painted on it.
    <>
    {/* First thing a keyboard reaches: jump past the bar to the work. */}
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="navbar" onClick={e => e.stopPropagation()}>
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      <div className="nb-left">
        {/* "New task" is the start screen — it doesn't create anything yet.
            The project row appears the moment the user actually picks an
            agent or sends a message (see NewTaskScreen.ensureProject), so
            abandoned starts don't leave empty projects behind. */}
        <Link className="brand nb-brand" href="/dashboard" aria-label="AgentiX Projects, new task">
          <BrandLogo size={30} />
        </Link>

        {onStart ? (
          <div className="start-wrap">
            {/* aria-disabled, not disabled: it stays focusable, so the reason
                can be reached and read, not only hovered. */}
            <button className={`btn btn-start${startHint ? " is-ready" : ""}`}
              aria-disabled={!startEnabled || undefined}
              aria-describedby={startEnabled ? undefined : startWhyId}
              onClick={() => { if (startEnabled) onStart(); }}
              data-tooltip={startEnabled ? undefined : "Pick a Consultant first"}>
              Start<IconArrow size={12} />
            </button>
            {!startEnabled && <span className="visually-hidden" id={startWhyId}>Pick a Consultant first.</span>}
            {startHint && <span className="start-nudge">Both agents ready — press Start</span>}
          </div>
        ) : started ? (
          /* Started: the green pill stops being a button and becomes the
             label for where you are — the same chip in the same place, so
             pressing Start doesn't make the bar jump. */
          <span className="nb-current">Current project</span>
        ) : null}

        <Link href="/dashboard" className={`nb-tab nb-lead${tab === "newtask" ? " active" : ""}`}
          aria-current={tab === "newtask" ? "page" : undefined}>
          New Task
        </Link>
      </div>

      <div className="nb-right">
        {/* Links, not buttons: they are places, so they open in a new tab,
            show their address on hover and announce which one you are on. */}
        <nav className="nb-tabs" aria-label="Main">
          {TABS.map(t => (
            <Link key={t.id} href={t.href} className={`nb-tab${tab === t.id ? " active" : ""}`}
              aria-current={tab === t.id ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="util">

          <button className="icon-btn" data-tooltip="Switch light or dark theme" aria-label="Switch light or dark theme"
            onClick={e => { e.stopPropagation(); setTheme(document.documentElement.classList.contains("light") ? "dark" : "light"); }}>
            {/* Both icons, one hidden by the theme class — picking in JS made the
                server and client markup differ, which broke hydration. */}
            <IconSun className="ico-when-dark" />
            <IconMoon className="ico-when-light" />
          </button>

          {/* Its own positioned wrapper — the popover anchors to the avatar's own
              edge, not the whole header's, now that the avatar isn't the last
              child of .util any more (Start sits to its right). */}
          <div className="avatar-wrap" ref={wrapRef}>
            <button ref={triggerRef} className="avatar" aria-label="Account menu" aria-haspopup="menu"
              aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined}
              onKeyDown={onTriggerKey}
              onClick={e => { e.stopPropagation(); toggle("avatar"); }}>
              {(profileName || user?.email || "U").slice(0, 2).toUpperCase()}
            </button>

            {avatarPhase !== "closed" && (
              <div ref={menuRef} id={menuId} role="menu" aria-label="Account"
                className={`popover t-dropdown${phaseClass(avatarPhase)}`} data-origin="top-right"
                onKeyDown={onMenuKey}
                onClick={e => e.stopPropagation()}>
                <button className="mi" role="menuitem" tabIndex={-1}
                  aria-keyshortcuts={isApple ? "Meta+Comma" : "Control+Comma"}
                  onClick={() => {
                    // Park focus on the avatar first: the sheet hands focus back
                    // to whatever had it on open, and this menu item is about
                    // to unmount.
                    triggerRef.current?.focus();
                    setPopover(null); setSettingsOpen(true);
                  }}>
                  <IconUser size={13} />Profile &amp; settings
                  <span className="mi-key" aria-hidden="true">{isApple ? "⌘," : "Ctrl ,"}</span>
                </button>
                <hr />
                <button className="mi" role="menuitem" tabIndex={-1} onClick={() => signOut()}><IconLogout size={13} />Sign out</button>
                {/* The legal pages have to be reachable from inside the app,
                    not only from the sign-in screen. Small, at the bottom. */}
                <div className="mi-legal" role="group" aria-label="Legal">
                  <Link role="menuitem" tabIndex={-1} href="/impressum" onClick={() => setPopover(null)}>Impressum</Link>
                  <Link role="menuitem" tabIndex={-1} href="/datenschutz" onClick={() => setPopover(null)}>Datenschutz</Link>
                  <Link role="menuitem" tabIndex={-1} href="/agb" onClick={() => setPopover(null)}>AGB</Link>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
    </>
  );
}
