"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listProjects, renameProject, archiveProject, type Project } from "@/lib/projects";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { IconFolder, IconPlus, IconArrow, IconMore } from "@/components/layout/agxp-icons";

function statusClass(s: Project["status"]) { return s.toLowerCase().replace(/\s+/g, "-"); }

export default function ProjectsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Project | null>(null);

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

  function openCreateProject() { window.dispatchEvent(new Event("agxp:new-project")); }

  function agentName(id: string | null) { return id ? agents.find(a => a.id === id)?.name : null; }
  function teamLabel(p: Project) {
    const parts = [agentName(p.consultant_agent_id), agentName(p.coach_agent_id)].filter(Boolean);
    return parts.length ? parts.join(" + ") : "No agents assigned yet";
  }

  function openProject(p: Project) {
    router.push(p.coach_agent_id && p.consultant_agent_id ? `/dashboard/project/${p.id}/workspace` : `/dashboard/project/${p.id}/setup`);
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

  if (authLoading || !token) return (
    <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" style={{ width: 24, height: 24, borderColor: "var(--border-strong)", borderTopColor: "var(--primary)" }} />
    </div>
  );

  const list = projects.filter(p => p.status !== "Archived");
  const inProgress = list.filter(p => p.status === "In Progress").length;
  const completed = list.filter(p => p.status === "Completed").length;

  return (
    <div className="app">
      <AgentNav />

      {confirmArchive && (
        <ConfirmDialog title="Archive project?" body={`"${confirmArchive.name}" will be moved out of your active projects.`}
          confirmLabel="Archive" onConfirm={doArchive} onCancel={() => setConfirmArchive(null)} />
      )}

      <div className="view-root">
        <div className="page-head">
          <div><h1>Projects</h1><p>Start a new transformation initiative or continue working on an existing project.</p></div>
          <button className="btn btn-hero" onClick={openCreateProject}><IconPlus />New Project</button>
        </div>

        <div className="projects-view" onClick={() => setMenuFor(null)}>
          <div className="projects-col">
            {loading && <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", padding: "20px 8px" }}>Loading…</p>}

            {!loading && list.length === 0 && (
              <div className="projects-empty">
                <h3>No projects yet</h3>
                <p>Create your first AI transformation project to begin building your project team.</p>
                <button className="btn btn-hero" onClick={openCreateProject}><IconPlus />Create New Project</button>
              </div>
            )}

            {!loading && list.length > 0 && (
              <>
                <div className="stats-grid">
                  <div className="stat-tile"><span className="stat-label">Total Projects</span><span className="stat-value">{list.length}</span></div>
                  <div className="stat-tile"><span className="stat-label">In Progress</span><span className="stat-value accent">{inProgress}</span></div>
                  <div className="stat-tile"><span className="stat-label">Completed</span><span className="stat-value">{completed}</span></div>
                </div>

                <div className="data-head">
                  <span className="col-project">Project</span><span>Team</span><span>Updated</span><span>Status</span>
                </div>

                <div className="project-list">
                  {list.map(p => (
                    <div key={p.id} className="project-row" tabIndex={0} role="button" aria-label={`Open ${p.name}`}
                      onClick={() => openProject(p)}>
                      <div className="pr-icon"><IconFolder /></div>
                      <div className="pr-info">
                        <div className="pr-name">{p.name}</div>
                        <div className="pr-desc">{p.description || "No description provided."}</div>
                      </div>
                      <div className="pr-agents">{teamLabel(p)}</div>
                      <div className="pr-updated">{new Date(p.last_activity_at).toLocaleDateString()}</div>
                      <span className={`status-pill ${statusClass(p.status)}`}><span className="sd" />{p.status}</span>
                      <span className="open-action" aria-hidden="true"><IconArrow /></span>
                      <button className="overflow-btn" data-tooltip="More"
                        onClick={e => { e.stopPropagation(); setMenuFor(menuFor === p.id ? null : p.id); }}>
                        <IconMore />
                      </button>
                      {menuFor === p.id && (
                        <div className="popover" style={{ top: 44, right: 36 }} onClick={e => e.stopPropagation()}>
                          <button className="mi" onClick={() => doRename(p)}><IconFolder size={13} />Rename Project</button>
                          <button className="mi" onClick={() => { setMenuFor(null); setConfirmArchive(p); }}>Archive Project</button>
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
    </div>
  );
}
