"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listProjects, type Project } from "@/lib/projects";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Folder, ChevronRight } from "lucide-react";

function statusDotClass(status: Project["status"]) {
  if (status === "In Progress") return "bg-primary";
  if (status === "Completed") return "bg-success";
  return "bg-muted-foreground";
}

export default function TaskHistoryPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    Promise.all([listProjects(), listAgents()]).then(([p, a]) => { if (alive) { setProjects(p); setAgents(a); } })
      .catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  function agentName(id: string | null) { return id ? agents.find(a => a.id === id)?.name : null; }
  function teamLabel(p: Project) {
    const parts = [agentName(p.consultant_agent_id), agentName(p.coach_agent_id)].filter(Boolean);
    return parts.length ? parts.join(" + ") : "No agents assigned yet";
  }

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (authLoading || !token) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="thinking-spinner" style={{ width: 24, height: 24 }} />
    </div>
  );

  return (
    <div className="flex flex-col bg-background" style={{ height: "100vh", overflow: "hidden" }}>
      <AgentNav />
      <div className="px-6 pt-5 pb-4 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1.5">Task History</h1>
        <p className="text-sm text-secondary-foreground">Review activity and outcomes across every Agentix project.</p>
      </div>
      <div className="flex-1 overflow-y-auto flex justify-center px-6 pb-8">
        <div className="w-full max-w-[900px]">
          <div className="mb-4"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." /></div>
          {loading && <div className="flex flex-col gap-2.5">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-md" />)}</div>}
          {!loading && filtered.map(p => (
            <div key={p.id} onClick={() => router.push(p.coach_agent_id && p.consultant_agent_id ? `/dashboard/project/${p.id}/workspace` : `/dashboard/project/${p.id}/setup`)}
              className="flex items-center gap-4 py-4 px-2 border-b border-border cursor-pointer hover:bg-accent/40 transition-colors">
              <div className="w-[34px] h-[34px] rounded-xs bg-secondary border border-border flex items-center justify-center shrink-0">
                <Folder className="w-[15px] h-[15px] text-muted-foreground" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-foreground truncate">{p.name}</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-secondary-foreground shrink-0">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDotClass(p.status))} />{p.status}
                  </span>
                </div>
                <p className="text-xs text-secondary-foreground mt-1 truncate">{teamLabel(p)} · Updated {new Date(p.last_activity_at).toLocaleDateString()}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={2} />
            </div>
          ))}
          {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-16">No projects found.</p>}
        </div>
      </div>
    </div>
  );
}
