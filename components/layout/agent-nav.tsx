"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { listProjects, PLACEHOLDER_PROJECT_NAME, type Project } from "@/lib/projects";
import {
  IconDiamond, IconSun, IconMoon, IconChevronDown, IconUser, IconLogout, IconFolder, IconPlus,
} from "@/components/layout/agxp-icons";

type Tab = "newtask" | "history" | "agents";

function activeTab(pathname: string): Tab {
  if (pathname.startsWith("/dashboard/history")) return "history";
  if (pathname.startsWith("/dashboard/agents")) return "agents";
  return "newtask";
}

type PopoverName = "avatar" | "switcher" | null;

export function AgentNav({ projectName, projectId }: { projectName?: string; projectId?: string }) {
  const { user, profileName, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [popover, setPopover] = useState<PopoverName>(null);
  const [switcherProjects, setSwitcherProjects] = useState<Project[] | null>(null);
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
    if (name === "switcher" && !switcherProjects) {
      listProjects().then(setSwitcherProjects).catch(() => setSwitcherProjects([]));
    }
  }

  // "New Task" is the start screen — it doesn't create anything yet. The
  // project row appears the moment the user actually picks an agent or sends
  // a message (see NewTaskScreen.ensureProject), so abandoned starts don't
  // leave empty projects behind.
  function newTask() { setPopover(null); router.push("/dashboard"); }

  function openProject(p: Project) {
    setPopover(null);
    router.push(`/dashboard/project/${p.id}`);
  }

  return (
    <header onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
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
        <button className="workspace-pill" onClick={e => { e.stopPropagation(); toggle("switcher"); }}>
          {projectName && projectName !== PLACEHOLDER_PROJECT_NAME ? projectName : "Transformation Workspace"}
          <IconChevronDown size={10} />
        </button>

        <button className="icon-btn" data-tooltip={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          onClick={e => { e.stopPropagation(); setTheme(theme === "light" ? "dark" : "light"); }}>
          {theme === "light" ? <IconMoon /> : <IconSun />}
        </button>

        <button className="avatar" onClick={e => { e.stopPropagation(); toggle("avatar"); }}>
          {(profileName || user?.email || "U").slice(0, 2).toUpperCase()}
        </button>

        {popover === "avatar" && (
          <div className="popover" onClick={e => e.stopPropagation()}>
            <button className="mi"><IconUser size={13} />Profile</button>
            <hr />
            <button className="mi" onClick={() => signOut()}><IconLogout size={13} />Sign out</button>
          </div>
        )}
        {popover === "switcher" && (
          <div className="popover switcher" style={{ right: 96 }} onClick={e => e.stopPropagation()}>
            <div className="ph">Switch Project</div>
            {(switcherProjects ?? []).filter(p => p.status !== "Archived").map(p => (
              <button key={p.id} className="mi switcher-row" style={{ width: "100%" }} onClick={() => openProject(p)}>
                {p.id === projectId ? <span className="cur" /> : <span style={{ width: 6, flexShrink: 0 }} />}
                <span className="sn">{p.name}</span>
              </button>
            ))}
            <hr />
            <button className="mi" onClick={newTask}><IconPlus size={13} />New Task</button>
            <button className="mi" onClick={() => { setPopover(null); router.push("/dashboard/history"); }}><IconFolder size={13} />Project History</button>
          </div>
        )}
      </div>
    </header>
  );
}
