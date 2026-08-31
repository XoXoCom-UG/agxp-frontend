"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listProjects, type Project } from "@/lib/projects";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { IconFolder, IconArrow } from "@/components/layout/agxp-icons";

function statusClass(s: Project["status"]) { return s.toLowerCase().replace(/\s+/g, "-"); }

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
    <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" style={{ width: 24, height: 24, borderColor: "var(--border-strong)", borderTopColor: "var(--primary)" }} />
    </div>
  );

  return (
    <div className="app">
      <AgentNav />
      <div className="view-root">
        <div className="page-head"><div><h1>Task History</h1><p>Review activity and outcomes across every Agentix project.</p></div></div>
        <div className="flat-view">
          <div className="flat-col">
            <div className="list-toolbar" style={{ padding: "0 0 16px", border: "none" }}>
              <div className="search-box">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." />
              </div>
            </div>
            {loading && <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>Loading…</p>}
            <div className="project-list">
              {!loading && filtered.map(p => (
                <div key={p.id} className="project-row" tabIndex={0} role="button" aria-label={`Open ${p.name}`}
                  onClick={() => router.push(p.coach_agent_id && p.consultant_agent_id ? `/dashboard/project/${p.id}/workspace` : `/dashboard/project/${p.id}/setup`)}>
                  <div className="pr-icon"><IconFolder /></div>
                  <div className="pr-main">
                    <div className="pr-top">
                      <span className="pr-name">{p.name}</span>
                      <span className={`status-pill ${statusClass(p.status)}`}><span className="sd" />{p.status}</span>
                    </div>
                    <div className="pr-meta">
                      <span className="m">{teamLabel(p)}</span><span className="sep">·</span>
                      <span className="m">Updated {new Date(p.last_activity_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="open-action" aria-hidden="true"><IconArrow /></span>
                </div>
              ))}
            </div>
            {!loading && filtered.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", textAlign: "center", padding: "40px 0" }}>No projects found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
