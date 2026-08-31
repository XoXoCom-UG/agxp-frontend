"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listProjects, renameProject, archiveProject, type Project } from "@/lib/projects";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { CreateProjectSheet } from "@/components/layout/create-project-sheet";
import { createProject } from "@/lib/projects";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Folder, Plus, ChevronRight, MoreHorizontal } from "lucide-react";

function statusDotClass(status: Project["status"]) {
  if (status === "In Progress") return "bg-primary";
  if (status === "Completed") return "bg-success";
  return "bg-muted-foreground";
}

export default function ProjectsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    Promise.all([listProjects(), listAgents()])
      .then(([p, a]) => { if (alive) { setProjects(p); setAgents(a); } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  function agentName(id: string | null) {
    return id ? agents.find(a => a.id === id)?.name : null;
  }
  function teamLabel(p: Project) {
    const parts = [agentName(p.consultant_agent_id), agentName(p.coach_agent_id)].filter(Boolean);
    return parts.length ? parts.join(" + ") : "No agents assigned yet";
  }

  async function submitCreateProject(name: string, description: string, type: string) {
    const project = await createProject({ name, description, type });
    setCreating(false);
    router.push(`/dashboard/project/${project.id}/setup`);
  }

  function openProject(p: Project) {
    if (p.coach_agent_id && p.consultant_agent_id) router.push(`/dashboard/project/${p.id}/workspace`);
    else router.push(`/dashboard/project/${p.id}/setup`);
  }

  async function doRename(p: Project) {
    setMenuFor(null);
    const val = window.prompt("Rename project", p.name);
    if (!val || !val.trim()) return;
    await renameProject(p.id, val.trim());
    setProjects(prev => prev.map(x => x.id === p.id ? { ...x, name: val.trim() } : x));
  }
  async function doArchive(p: Project) {
    setMenuFor(null);
    await archiveProject(p.id);
    setProjects(prev => prev.filter(x => x.id !== p.id));
  }

  if (authLoading || !token) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="thinking-spinner" style={{ width: 24, height: 24 }} />
    </div>
  );

  const visible = projects.filter(p => p.status !== "Archived");
  const inProgress = visible.filter(p => p.status === "In Progress").length;
  const completed = visible.filter(p => p.status === "Completed").length;

  return (
    <div className="flex flex-col bg-background" style={{ height: "100vh", overflow: "hidden" }}>
      <AgentNav />
      <CreateProjectSheet open={creating} onClose={() => setCreating(false)} onSubmit={submitCreateProject} />

      <div className="px-6 pt-5 pb-4 flex items-end justify-between gap-5 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1.5">Projects</h1>
          <p className="text-sm text-secondary-foreground max-w-md">
            Start a new transformation initiative or continue working on an existing project.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5" strokeWidth={2} />New Project</Button>
      </div>

      <div className="flex-1 overflow-y-auto flex justify-center px-6 pb-8">
        <div className="w-full max-w-[900px]">
          {loading && (
            <div className="flex flex-col gap-2.5 pt-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-[74px] w-full rounded-md" />)}
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div className="text-center py-20">
              <h3 className="text-base font-semibold text-foreground mb-2">No projects yet</h3>
              <p className="text-xs text-secondary-foreground max-w-sm mx-auto mb-5 leading-relaxed">
                Create your first AI transformation project to begin building your project team.
              </p>
              <Button onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5" strokeWidth={2} />Create New Project</Button>
            </div>
          )}

          {!loading && visible.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <StatTile label="Total Projects" value={String(visible.length)} />
                <StatTile label="In Progress" value={String(inProgress)} accent />
                <StatTile label="Completed" value={String(completed)} />
              </div>

              <div className="flex flex-col">
                {visible.map(p => (
                  <div key={p.id}
                    onClick={() => openProject(p)}
                    className="group/row flex items-center gap-4 py-4 px-2 border-b border-border cursor-pointer hover:bg-accent/40 transition-colors relative"
                  >
                    <div className="w-[34px] h-[34px] rounded-xs bg-secondary border border-border flex items-center justify-center shrink-0">
                      <Folder className="w-[15px] h-[15px] text-muted-foreground" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>}
                    </div>
                    <p className="hidden md:block text-xs text-secondary-foreground w-[190px] truncate">{teamLabel(p)}</p>
                    <p className="hidden sm:block text-xs text-secondary-foreground w-[100px] truncate">
                      {new Date(p.last_activity_at).toLocaleDateString()}
                    </p>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-secondary-foreground shrink-0 w-[100px]">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDotClass(p.status))} />
                      {p.status}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover/row:translate-x-0.5 transition-transform" strokeWidth={2} />
                    <button
                      onClick={e => { e.stopPropagation(); setMenuFor(menuFor === p.id ? null : p.id); }}
                      className="w-7 h-7 rounded-xs flex items-center justify-center text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:bg-secondary hover:text-foreground transition-colors shrink-0">
                      <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
                    </button>
                    {menuFor === p.id && (
                      <div onClick={e => e.stopPropagation()}
                        className="absolute top-11 right-8 min-w-[180px] bg-popover border border-input rounded-md p-1.5 shadow-xl z-40">
                        <button onClick={() => doRename(p)} className="w-full text-left text-xs text-secondary-foreground px-2.5 py-2 rounded-xs hover:bg-accent hover:text-foreground transition-colors">Rename Project</button>
                        <button onClick={() => doArchive(p)} className="w-full text-left text-xs text-secondary-foreground px-2.5 py-2 rounded-xs hover:bg-accent hover:text-foreground transition-colors">Archive Project</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4 rounded-md bg-card border border-border">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-[28px] font-semibold tracking-tight", accent ? "text-primary" : "text-foreground")}>{value}</span>
    </div>
  );
}
