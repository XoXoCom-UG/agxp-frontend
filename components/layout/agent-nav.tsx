"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { IconDiamond, IconSun, IconMoon, IconUser, IconLogout, IconArrow } from "@/components/layout/agxp-icons";
import { SettingsSheet } from "@/components/layout/settings-sheet";
import { readAccent, applyAccent } from "@/lib/accent";

type Tab = "newtask" | "history" | "agents";

function activeTab(pathname: string): Tab {
  if (pathname.startsWith("/dashboard/history")) return "history";
  if (pathname.startsWith("/dashboard/agents")) return "agents";
  return "newtask";
}

type PopoverName = "avatar" | null;

export function AgentNav({ startEnabled, startHint, onStart }: {
  /** Both halves chosen? The Start button lights up. */
  startEnabled?: boolean;
  /** Everything is picked and nothing has started — say so, once. */
  startHint?: boolean;
  /** Omitted once the conversation has started — then there is nothing to start. */
  onStart?: () => void;
}) {
  const { user, profileName, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [popover, setPopover] = useState<PopoverName>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Paint the saved accent before anything else renders with the default.
  // Reading localStorage during render would differ between server and
  // client, so it waits for mount — the default is correct in the meantime.
  useEffect(() => { applyAccent(readAccent(), false); }, []);

  // Cmd/Ctrl+, opens settings: settings.md — "people often use the standard
  // Command-Comma shortcut to open an app's settings".
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "," && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSettingsOpen(true); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const ref = useRef<HTMLDivElement>(null);
  const tab = activeTab(pathname);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPopover(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function toggle(name: Exclude<PopoverName, null>) {
    setPopover(p => p === name ? null : name);
  }

  // "New Task" is the start screen — it doesn't create anything yet. The
  // project row appears the moment the user actually picks an agent or sends
  // a message (see NewTaskScreen.ensureProject), so abandoned starts don't
  // leave empty projects behind.
  function newTask() { setPopover(null); router.push("/dashboard"); }


  return (
    <header onClick={e => e.stopPropagation()}>
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      <div className="head-left">
        <button className="brand" onClick={newTask}>
          <div className="brand-mark"><IconDiamond size={12} /></div>
          <div className="brand-text stacked"><span className="name">Agentix Projects</span><span className="sub">AGXP</span></div>
        </button>

        <nav>
          <button className={tab === "newtask" ? "active" : ""} onClick={newTask}>New Task</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => router.push("/dashboard/history")}>Project History</button>
          <button className={tab === "agents" ? "active" : ""} onClick={() => router.push("/dashboard/agents")}>Agent Dashboard</button>
        </nav>
      </div>

      <div className="util" ref={ref}>

        <button className="icon-btn" data-tooltip="Switch light or dark theme"
          onClick={e => { e.stopPropagation(); setTheme(document.documentElement.classList.contains("light") ? "dark" : "light"); }}>
          {/* Both icons, one hidden by the theme class — picking in JS made the
              server and client markup differ, which broke hydration. */}
          <IconSun className="ico-when-dark" />
          <IconMoon className="ico-when-light" />
        </button>

        {/* Its own positioned wrapper — the popover anchors to the avatar's own
            edge, not the whole header's, now that the avatar isn't the last
            child of .util any more (Start sits to its right). */}
        <div className="avatar-wrap">
          <button className="avatar" onClick={e => { e.stopPropagation(); toggle("avatar"); }}>
            {(profileName || user?.email || "U").slice(0, 2).toUpperCase()}
          </button>

          {popover === "avatar" && (
            <div className="popover" onClick={e => e.stopPropagation()}>
              <button className="mi" onClick={() => { setPopover(null); setSettingsOpen(true); }}>
              <IconUser size={13} />Profile &amp; settings
              <span className="mi-key">{"⌘,"}</span>
            </button>
              <hr />
              <button className="mi" onClick={() => signOut()}><IconLogout size={13} />Sign out</button>
            </div>
          )}
        </div>

        {onStart && (
          <div className="start-wrap">
            <button className={`btn btn-start${startHint ? " is-ready" : ""}`}
              disabled={!startEnabled} onClick={onStart}
              data-tooltip={startEnabled ? undefined : "Pick a Consultant first"}>
              Start <IconArrow />
            </button>
            {startHint && <span className="start-nudge">Both agents ready — press Start</span>}
          </div>
        )}
      </div>
    </header>
  );
}
