"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { createProject, listProjects, type Project } from "@/lib/projects";
import { CreateProjectSheet } from "@/components/layout/create-project-sheet";
import {
  IconDiamond, IconSun, IconMoon, IconBell, IconChevronDown, IconUser, IconLogout, IconFolder, IconPlus,
} from "@/components/layout/agxp-icons";

type Tab = "projects" | "newtask" | "history" | "agents";

function activeTab(pathname: string): Tab {
  if (pathname.startsWith("/dashboard/project/")) return "newtask";
  if (pathname.startsWith("/dashboard/history")) return "history";
  if (pathname.startsWith("/dashboard/agents")) return "agents";
  return "projects";
}

type PopoverName = "notif" | "avatar" | "switcher" | null;

export function AgentNav({ projectName, projectId }: { projectName?: string; projectId?: string }) {
  const { user, profileName, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [creating, setCreating] = useState(false);
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

  // AgentNav is the single owner of the create-project sheet — pages that
  // also want a "New Project" button (e.g. the Projects list) dispatch this
  // event instead of mounting their own sheet, which used to render two
  // overlapping instances at once.
  useEffect(() => {
    function onOpen() { setCreating(true); }
    window.addEventListener("agxp:new-project", onOpen);
    return () => window.removeEventListener("agxp:new-project", onOpen);
  }, []);

  function toggle(name: Exclude<PopoverName, null>) {
    setPopover(p => p === name ? null : name);
    if (name === "switcher" && !switcherProjects) {
      listProjects().then(setSwitcherProjects).catch(() => setSwitcherProjects([]));
    }
  }

  async function submitCreateProject(name: string, description: string, type: string) {
    const project = await createProject({ name, description, type });
    setCreating(false);
    router.push(`/dashboard/project/${project.id}/setup`);
  }

  function switchProject(p: Project) {
    setPopover(null);
    if (p.coach_agent_id && p.consultant_agent_id) router.push(`/dashboard/project/${p.id}/workspace`);
    else router.push(`/dashboard/project/${p.id}/setup`);
  }

  return (
    <header onClick={e => e.stopPropagation()}>
      <CreateProjectSheet open={creating} onClose={() => setCreating(false)} onSubmit={submitCreateProject} />

      <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
        <button className="brand" onClick={() => router.push("/dashboard")}>
          <div className="brand-mark"><IconDiamond size={12} /></div>
          <div className="brand-text"><span className="name">Agentix Projects</span><span className="sub">AgxP</span></div>
        </button>

        <nav>
          <button className={tab === "projects" ? "active" : ""} onClick={() => router.push("/dashboard")}>Projects</button>
          <button className={tab === "newtask" ? "active" : ""} onClick={() => setCreating(true)}>New Task</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => router.push("/dashboard/history")}>Task History</button>
          <button className={tab === "agents" ? "active" : ""} onClick={() => router.push("/dashboard/agents")}>Agent Dashboard</button>
        </nav>

        {projectName && (
          <button className="project-context" onClick={e => { e.stopPropagation(); toggle("switcher"); }}>
            <span className="dot" /><span className="pname">{projectName}</span><IconChevronDown size={10} />
          </button>
        )}
      </div>

      <div className="util" ref={ref}>
        <button className="icon-btn" data-tooltip={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          onClick={e => { e.stopPropagation(); setTheme(theme === "light" ? "dark" : "light"); }}>
          {theme === "light" ? <IconMoon /> : <IconSun />}
        </button>

        <button className="icon-btn" data-tooltip="Notifications" onClick={e => { e.stopPropagation(); toggle("notif"); }}>
          <IconBell /><span className="notif-dot" />
        </button>

        <button className="avatar" onClick={e => { e.stopPropagation(); toggle("avatar"); }}>
          {(profileName || user?.email || "U").slice(0, 2).toUpperCase()}
        </button>

        {popover === "notif" && (
          <div className="popover" onClick={e => e.stopPropagation()}>
            <div className="ph">Notifications</div>
            <div className="pi">Your AI project team is ready.</div>
          </div>
        )}
        {popover === "avatar" && (
          <div className="popover" onClick={e => e.stopPropagation()}>
            <button className="mi"><IconUser size={13} />Profile</button>
            <hr />
            <button className="mi" onClick={() => signOut()}><IconLogout size={13} />Sign out</button>
          </div>
        )}
        {popover === "switcher" && (
          <div className="popover switcher" onClick={e => e.stopPropagation()}>
            <div className="ph">Switch Project</div>
            {(switcherProjects ?? []).filter(p => p.status !== "Archived").map(p => (
              <button key={p.id} className="mi switcher-row" style={{ width: "100%" }} onClick={() => switchProject(p)}>
                {p.id === projectId ? <span className="cur" /> : <span style={{ width: 6, flexShrink: 0 }} />}
                <span className="sn">{p.name}</span>
              </button>
            ))}
            <hr />
            <button className="mi" onClick={() => { setPopover(null); setCreating(true); }}><IconPlus size={13} />Create New Project</button>
            <button className="mi" onClick={() => { setPopover(null); router.push("/dashboard"); }}><IconFolder size={13} />View All Projects</button>
          </div>
        )}
      </div>
    </header>
  );
}
