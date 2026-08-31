"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { createProject } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { CreateProjectSheet } from "@/components/layout/create-project-sheet";
import { Bell, Moon, Sun, LogOut, User } from "lucide-react";

type Tab = "projects" | "newtask" | "history" | "agents";

function activeTab(pathname: string): Tab {
  if (pathname.startsWith("/dashboard/project/")) return "newtask";
  if (pathname.startsWith("/dashboard/history")) return "history";
  if (pathname.startsWith("/dashboard/agents")) return "agents";
  return "projects";
}

export function AgentNav({ projectName }: { projectName?: string }) {
  const { user, profileName, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [creating, setCreating] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tab = activeTab(pathname);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setAvatarOpen(false); setNotifOpen(false); }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function submitCreateProject(name: string, description: string, type: string) {
    const project = await createProject({ name, description, type });
    setCreating(false);
    router.push(`/dashboard/project/${project.id}/setup`);
  }

  return (
    <header className="no-print flex items-center gap-1 px-4 md:px-5 h-[60px] shrink-0 bg-background/90 backdrop-blur-sm border-b border-border z-30">
      <CreateProjectSheet open={creating} onClose={() => setCreating(false)} onSubmit={submitCreateProject} />

      <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2.5 shrink-0 mr-2">
        <div className="w-[26px] h-[26px] rounded-xs flex items-center justify-center relative shrink-0"
          style={{ background: "linear-gradient(150deg, var(--coach-2) 0%, var(--consultant-1) 100%)" }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={0.92}>
            <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
          </svg>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-semibold tracking-tight text-foreground">Agentix Projects</span>
          <span className="hidden lg:inline text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">AgxP</span>
        </div>
      </button>

      <nav className="flex items-center gap-0.5">
        <NavTab active={tab === "projects"} onClick={() => router.push("/dashboard")}>Projects</NavTab>
        <NavTab active={tab === "newtask"} onClick={() => setCreating(true)}>New Task</NavTab>
        <NavTab active={tab === "history"} onClick={() => router.push("/dashboard/history")}>Task History</NavTab>
        <NavTab active={tab === "agents"} onClick={() => router.push("/dashboard/agents")}>Agent Dashboard</NavTab>
      </nav>

      {projectName && (
        <div className="flex items-center gap-1.5 ml-4 px-3 py-1.5 rounded-pill bg-secondary border border-border text-xs text-secondary-foreground max-w-[220px]">
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          <span className="truncate">{projectName}</span>
        </div>
      )}

      <div className="flex-1" />

      <div ref={ref} className="flex items-center gap-2 relative shrink-0">
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          className="w-[30px] h-[30px] rounded-xs border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors">
          {theme === "light" ? <Moon className="w-3.5 h-3.5" strokeWidth={1.8} /> : <Sun className="w-3.5 h-3.5" strokeWidth={1.8} />}
        </button>

        <button
          onClick={() => { setNotifOpen(o => !o); setAvatarOpen(false); }}
          title="Notifications"
          className="w-[30px] h-[30px] rounded-xs border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors relative">
          <Bell className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span className="absolute top-[5px] right-[6px] w-1.5 h-1.5 rounded-full bg-primary ring-2 ring-secondary" />
        </button>
        {notifOpen && (
          <div className="absolute top-[46px] right-9 min-w-[230px] bg-popover border border-input rounded-md p-2 shadow-xl z-50">
            <p className="text-xs font-semibold text-foreground px-2.5 py-1.5">Notifications</p>
            <p className="text-[11px] text-secondary-foreground px-2.5 py-2 leading-relaxed">Your AI project team is ready.</p>
          </div>
        )}

        <button
          onClick={() => { setAvatarOpen(o => !o); setNotifOpen(false); }}
          className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold bg-primary/15 text-primary border border-primary/30">
          {(profileName || user?.email || "U")[0].toUpperCase()}
        </button>
        {avatarOpen && (
          <div className="absolute top-[46px] right-0 min-w-[210px] bg-popover border border-input rounded-md p-2 shadow-xl z-50">
            <button className="w-full text-left flex items-center gap-2.5 text-xs text-secondary-foreground px-2.5 py-2 rounded-xs hover:bg-accent hover:text-foreground transition-colors">
              <User className="w-3.5 h-3.5" strokeWidth={1.8} />Profile
            </button>
            <hr className="border-border my-1.5" />
            <button onClick={() => signOut()} className="w-full text-left flex items-center gap-2.5 text-xs text-secondary-foreground px-2.5 py-2 rounded-xs hover:bg-accent hover:text-foreground transition-colors">
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.8} />Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function NavTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn(
        "relative text-xs font-medium px-3.5 py-2.5 rounded-xs transition-colors",
        active ? "text-foreground bg-primary/10" : "text-muted-foreground hover:text-secondary-foreground"
      )}>
      {children}
      {active && <span className="absolute left-3.5 right-3.5 bottom-0.5 h-px rounded-full bg-primary" />}
    </button>
  );
}
