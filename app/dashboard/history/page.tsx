"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listProjects, renameProject, archiveProject, PLACEHOLDER_PROJECT_NAME, type Project } from "@/lib/projects";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { IconFolder, IconArrow, IconMore, IconSearch, IconPlus } from "@/components/layout/agxp-icons";

function statusClass(s: Project["status"]) { return s.toLowerCase().replace(/\s+/g, "-"); }

export default function ProjectHistoryPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Project | null>(null);

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

  async function doRename(p: Project) {
    setMenuFor(null);
    const val = window.prompt("Rename project", p.name);
    if (!val || !val.trim()) return;
    await renameProject(p.id, val.trim());
    setProjects(prev => prev.map(x => x.id === p.id ? { ...x, name: val.trim() } : x));
  }
  async function doArchive() {
    if (!confirmArchive) return;
    await archiveProject(confirmArchive.id);
    setProjects(prev => prev.filter(x => x.id !== confirmArchive.id));
    setConfirmArchive(null);
  }

  const visible = projects.filter(p => p.status !== "Archived");
  const filtered = visible.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (authLoading || !token) return (
    <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" style={{ width: 24, height: 24, borderColor: "var(--border-strong)", borderTopColor: "var(--primary)" }} />
    </div>
  );

  return (
    <div className="app">
      <AgentNav />
      {confirmArchive && (
        <ConfirmDialog title="Archive project?" body={`"${confirmArchive.name}" will be moved out of your active projects.`}
          confirmLabel="Archive" onConfirm={doArchive} onCancel={() => setConfirmArchive(null)} />
      )}
      <div className="view-root view-enter">
        <div className="page-head">
          <div><h1>Project History</h1><p>Every task you started, with the AI team that worked on it.</p></div>
          <button className="btn btn-hero" onClick={() => router.push("/dashboard")}><IconPlus />New Task</button>
        </div>
        <div className="flat-view" onClick={() => setMenuFor(null)}>
          <div className="flat-col">
            <div className="list-toolbar" style={{ padding: "0 0 16px", border: "none" }}>
              <div className="search-box"><IconSearch size={13} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." />
              </div>
            </div>

            {loading && <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>Loading…</p>}

            {!loading && filtered.length === 0 && (
              <div className="projects-empty">
                <h3>Nothing here yet</h3>
                <p>Start a task and it shows up here automatically, with the agents that worked on it.</p>
                <button className="btn btn-hero" onClick={() => router.push("/dashboard")}><IconPlus />New Task</button>
              </div>
            )}

            <div className="project-list">
              {!loading && filtered.map(p => (
                <div key={p.id} className="project-row" tabIndex={0} role="button" aria-label={`Open ${p.name}`}
                  onClick={() => router.push(`/dashboard/project/${p.id}`)}>
                  <div className="pr-icon"><IconFolder /></div>
                  <div className="pr-main">
                    <div className="pr-top">
                      <span className="pr-name">{p.name === PLACEHOLDER_PROJECT_NAME ? "Untitled task" : p.name}</span>
                      <span className={`status-pill ${statusClass(p.status)}`}><span className="sd" />{p.status}</span>
                    </div>
                    <div className="pr-meta">
                      <span className="m">{teamLabel(p)}</span><span className="sep">·</span>
                      <span className="m">Updated {new Date(p.last_activity_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="open-action" aria-hidden="true"><IconArrow /></span>
                  <button className="overflow-btn" data-tooltip="More"
                    onClick={e => { e.stopPropagation(); setMenuFor(menuFor === p.id ? null : p.id); }}>
                    <IconMore />
                  </button>
                  {menuFor === p.id && (
                    <div className="popover" style={{ top: 44, right: 36 }} onClick={e => e.stopPropagation()}>
                      <button className="mi" onClick={() => doRename(p)}><IconFolder size={13} />Rename project</button>
                      <button className="mi" onClick={() => { setMenuFor(null); setConfirmArchive(p); }}>Archive project</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
