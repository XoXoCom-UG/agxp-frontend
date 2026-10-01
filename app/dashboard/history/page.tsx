"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listProjects, renameProject, archiveProject, PLACEHOLDER_PROJECT_NAME, type Project } from "@/lib/projects";
import { listAgents, type Agent, type AgentType } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { IconFolder, IconArrow, IconMore, IconSearch, IconPlus, IconAlert, IconRefresh } from "@/components/layout/agxp-icons";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { SkeletonRows } from "@/components/layout/skeleton";
import { EmptyState } from "@/components/layout/empty-state";
import { dateStr, menuKeyDown, focusFirstMenuItem } from "@/lib/utils";

function statusClass(s: Project["status"]) { return s.toLowerCase().replace(/\s+/g, "-"); }
/** A project that was never renamed from its first message still has the
 *  placeholder name; show it as what it is. */
function displayName(name: string) { return name === PLACEHOLDER_PROJECT_NAME ? "Untitled task" : name; }

export default function ProjectHistoryPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  /** Bumped by Retry, which re-runs the load effect. */
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Project | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  /** A rename or archive that didn't go through. Shown above the list. */
  const [actionError, setActionError] = useState<string | null>(null);

  const uid = useId();
  const searchId = `${uid}-search`;
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const moreRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Which row the open rename belongs to, readable synchronously: Enter saves
  // and unmounts the input, and the blur that follows must not save twice.
  const renaming = useRef<string | null>(null);

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    Promise.all([listProjects(), listAgents()])
      .then(([p, a]) => { if (alive) { setProjects(p); setAgents(a); setLoadError(false); } })
      // An empty list here would claim "Nothing here yet" about projects that
      // exist, so a failed load gets its own state with a way out.
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, attempt]);

  useEffect(() => { if (menuFor) focusFirstMenuItem(menuRef.current); }, [menuFor]);
  useEffect(() => {
    if (!renamingId) return;
    renameRef.current?.focus();
    renameRef.current?.select();
  }, [renamingId]);

  function retry() {
    setLoading(true);
    setLoadError(false);
    setAttempt(n => n + 1);
  }

  /** Back to the row's ⋯ button, once the menu or the input it replaced is gone. */
  function focusMore(id: string) {
    setTimeout(() => moreRefs.current[id]?.focus(), 0);
  }

  function closeMenu(restoreFocus: boolean) {
    const id = menuFor;
    setMenuFor(null);
    if (restoreFocus && id) focusMore(id);
  }

  function agentName(id: string | null) { return id ? agents.find(a => a.id === id)?.name : null; }
  /** Roles present on this project, consultant first — drives the face stack. */
  function team(p: Project) {
    return ([["consultant", p.consultant_agent_id], ["coach", p.coach_agent_id]] as const)
      .filter(([, id]) => !!id) as [AgentType, string][];
  }
  function teamLabel(p: Project) {
    const parts = [agentName(p.consultant_agent_id), agentName(p.coach_agent_id)].filter(Boolean);
    return parts.length ? parts.join(" + ") : "No agents assigned yet";
  }

  function startRename(p: Project) {
    setMenuFor(null);
    setActionError(null);
    renaming.current = p.id;
    setRenameDraft(p.name === PLACEHOLDER_PROJECT_NAME ? "" : p.name);
    setRenamingId(p.id);
  }

  function cancelRename(p: Project) {
    renaming.current = null;
    setRenamingId(null);
    focusMore(p.id);
  }

  /** Enter and blur both land here. The new name shows at once and is put
   *  back if the save fails, with a message saying so. */
  async function commitRename(p: Project, restoreFocus: boolean) {
    if (renaming.current !== p.id) return;
    renaming.current = null;
    setRenamingId(null);
    if (restoreFocus) focusMore(p.id);

    const name = renameDraft.trim();
    if (!name || name === p.name) return;
    setProjects(prev => prev.map(x => x.id === p.id ? { ...x, name } : x));
    try {
      await renameProject(p.id, name);
    } catch {
      setProjects(prev => prev.map(x => x.id === p.id ? { ...x, name: p.name } : x));
      setActionError(`"${displayName(p.name)}" couldn't be renamed. Check your connection and try again.`);
    }
  }

  async function doArchive() {
    const p = confirmArchive;
    if (!p || archiving) return;
    setArchiving(true);
    setActionError(null);
    try {
      await archiveProject(p.id);
      setProjects(prev => prev.filter(x => x.id !== p.id));
    } catch {
      setActionError(`"${displayName(p.name)}" couldn't be archived. Check your connection and try again.`);
    } finally {
      setArchiving(false);
      setConfirmArchive(null);
    }
  }

  const visible = projects.filter(p => p.status !== "Archived");
  const filtered = visible.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (authLoading || !token) return (
    <main className="app app-wait">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span className="visually-hidden" role="status">Loading…</span>
    </main>
  );

  return (
    <div className="app">
      <AgentNav />
      {confirmArchive && (
        <ConfirmDialog title="Archive project?" body={`"${displayName(confirmArchive.name)}" will be moved out of your active projects.`}
          confirmLabel="Archive" onConfirm={doArchive}
          onCancel={() => { focusMore(confirmArchive.id); setConfirmArchive(null); }} />
      )}
      <main className="view-root view-enter" id="main-content" tabIndex={-1}>
        {/* The list is the page (Ana, 2026-10-02): no title row and no blue
            "New task" button above it — "New Task" is already in the bar. The
            h1 stays for screen readers. */}
        <h1 className="visually-hidden">Project history</h1>
        <div className="flat-view" onClick={() => setMenuFor(null)}>
          <div className="flat-col">

            {/* One sheet for the whole list: the bar above is a defined
                surface, and a bare column under it read as an unfinished
                screen. Solid, never glass — glass on a content container
                is a defect in the material model this app follows. */}
            <div className="list-sheet">
              <div className="list-toolbar list-toolbar-flat">
                <div className="search-box"><IconSearch size={13} />
                  <label className="visually-hidden" htmlFor={searchId}>Search projects</label>
                  <input id={searchId} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…" />
                </div>
              </div>

              {actionError && (
                <div className="load-error" role="alert">
                  <IconAlert size={14} />
                  <span className="le-text">{actionError}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActionError(null)}>Dismiss</button>
                </div>
              )}

              {loading && <SkeletonRows count={4} />}

              {!loading && loadError && (
                <div className="load-error" role="alert">
                  <IconAlert size={14} />
                  <span className="le-text">Your projects couldn&apos;t be loaded. Check your connection and try again.</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={retry}><IconRefresh size={12} />Retry</button>
                </div>
              )}

              {!loading && !loadError && filtered.length === 0 && (
                search.trim() ? (
                  <EmptyState title="No project by that name"
                    body="Nothing here matches what you typed. Try a shorter word. The search only looks at project names." />
                ) : (
                  <EmptyState title="Nothing here yet"
                    body="Start a task and it turns up here on its own, with the agents that worked on it and everything they produced."
                    action={<button className="btn btn-hero" onClick={() => router.push("/dashboard")}><IconPlus />New task</button>} />
                )
              )}

              <div className="project-list">
                {!loading && !loadError && filtered.map((p, i) => {
                  const name = displayName(p.name);
                  const isRenaming = renamingId === p.id;
                  const menuOpen = menuFor === p.id;
                  const menuId = `${uid}-menu-${p.id}`;
                  const content = (
                    <>
                      {/* Who worked on it, not a folder glyph — you recognise a
                          project by its team faster than by its name. */}
                      {team(p).length > 0 ? (
                        <div className="pr-team" aria-hidden="true">
                          {team(p).map(([r, id]) => (
                            <span key={r} className={`pr-team-face ${r}`}><AgentMascot role={r} size={34} agentId={id} /></span>
                          ))}
                        </div>
                      ) : (
                        <div className="pr-icon" aria-hidden="true"><IconFolder /></div>
                      )}
                      <div className="pr-main">
                        <div className="pr-top">
                          {isRenaming ? (
                            <input ref={renameRef} className="pr-rename-input" type="text" value={renameDraft}
                              aria-label="Project name" placeholder="Untitled task"
                              onChange={e => setRenameDraft(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") { e.preventDefault(); commitRename(p, true); }
                                else if (e.key === "Escape") { e.preventDefault(); cancelRename(p); }
                              }}
                              onBlur={() => commitRename(p, false)} />
                          ) : (
                            <span className="pr-name">{name}</span>
                          )}
                          <span className={`status-pill ${statusClass(p.status)}`}><span className="sd" />{p.status}</span>
                        </div>
                        <div className="pr-meta">
                          <span className="m">{teamLabel(p)}</span><span className="sep" aria-hidden="true">·</span>
                          <span className="m">Updated {dateStr(p.last_activity_at)}</span>
                        </div>
                      </div>
                      <span className="open-action" aria-hidden="true"><IconArrow /></span>
                    </>
                  );
                  return (
                    // The row is a link (the whole of it is clickable, see
                    // .pr-link) with the ⋯ button beside it, not inside it.
                    <div key={p.id} className="project-row row-in" style={{ "--i": i } as React.CSSProperties}>
                      {isRenaming
                        ? <div className="pr-link">{content}</div>
                        : <Link href={`/dashboard/project/${p.id}`} className="pr-link">{content}</Link>}
                      {!isRenaming && (
                        <button ref={el => { moreRefs.current[p.id] = el; }} type="button" className="overflow-btn"
                          data-tooltip="More" aria-label={`More actions for ${name}`}
                          aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined}
                          onClick={e => { e.stopPropagation(); setMenuFor(menuOpen ? null : p.id); }}>
                          <IconMore />
                        </button>
                      )}
                      {menuOpen && (
                        <div ref={menuRef} id={menuId} className="popover row-menu" role="menu" aria-label={`Actions for ${name}`}
                          onClick={e => e.stopPropagation()} onKeyDown={e => menuKeyDown(closeMenu)(e)}>
                          <button type="button" role="menuitem" tabIndex={-1} className="mi" onClick={() => startRename(p)}>
                            <IconFolder size={13} />Rename project
                          </button>
                          <button type="button" role="menuitem" tabIndex={-1} className="mi"
                            onClick={() => { setMenuFor(null); setConfirmArchive(p); }}>
                            Archive project
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
