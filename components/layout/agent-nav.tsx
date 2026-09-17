"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import {
  IconDiamond, IconSun, IconMoon, IconUser, IconLogout, IconArrow,
} from "@/components/layout/agxp-icons";

type Tab = "newtask" | "history" | "agents";

function activeTab(pathname: string): Tab {
  if (pathname.startsWith("/dashboard/history")) return "history";
  if (pathname.startsWith("/dashboard/agents")) return "agents";
  return "newtask";
}

export function AgentNav({ startEnabled, onStart }: { startEnabled?: boolean; onStart?: () => void } = {}) {
  const { user, profileName, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tab = activeTab(pathname);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAvatarOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // "New Task" is the start screen — it doesn't create anything yet. The
  // project row appears the moment the user actually picks an agent or sends
  // a message (see NewTaskScreen.ensureProject), so abandoned starts don't
  // leave empty projects behind.
  function newTask() { setAvatarOpen(false); router.push("/dashboard"); }

  return (
    <header onClick={e => e.stopPropagation()}>
      <div className="head-left">
        <button className="brand" onClick={newTask}>
          <div className="brand-mark"><IconDiamond size={12} /></div>
          <div className="brand-text stacked"><span className="name">AgentiX Projects</span><span className="sub">AGXP</span></div>
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

        <button className="avatar" onClick={e => { e.stopPropagation(); setAvatarOpen(o => !o); }}>
          {(profileName || user?.email || "U").slice(0, 2).toUpperCase()}
        </button>

        {onStart && (
          <button className="btn btn-hero" disabled={!startEnabled} onClick={onStart}
            data-tooltip={startEnabled ? undefined : "Pick a Consultant first"}>
            Start <IconArrow />
          </button>
        )}

        {avatarOpen && (
          <div className="popover" onClick={e => e.stopPropagation()}>
            <button className="mi"><IconUser size={13} />Profile</button>
            <hr />
            <button className="mi" onClick={() => signOut()}><IconLogout size={13} />Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}
