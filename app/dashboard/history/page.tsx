"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listProjects, renameProject, archiveProject, PLACEHOLDER_PROJECT_NAME, type Project } from "@/lib/projects";
import { listAgents, type Agent, type AgentType } from "@/lib/agents";
import { loadProjectStats, type ProjectStats } from "@/lib/project-stats";
import { templateFor } from "@/lib/agent-types";
import { DELIVERABLES } from "@/lib/deliverables";
import { AgentNav } from "@/components/layout/agent-nav";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { IconFolder, IconArrow, IconMore, IconSearch, IconPlus, IconAlert, IconRefresh, IconChevronDown, IconCheck } from "@/components/layout/agxp-icons";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { SkeletonRows } from "@/components/layout/skeleton";
import { EmptyState } from "@/components/layout/empty-state";
import { agoStr, menuKeyDown, focusFirstMenuItem } from "@/lib/utils";
import { usePresence, phaseClass } from "@/lib/use-presence";

function statusClass(s: Project["status"]) { return s.toLowerCase().replace(/\s+/g, "-"); }
/** A project that was never renamed from its first message still has the
 *  placeholder name; show it as what it is. */
function displayName(name: string) { return name === PLACEHOLDER_PROJECT_NAME ? "Untitled task" : name; }

type StatusFilter = "all" | Project["status"];
type SortKey = "updated" | "name" | "messages";
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All projects" },
  { key: "In Progress", label: "In progress" },
  { key: "Not Started", label: "Not started" },
  { key: "Completed", label: "Completed" },
  { key: "Archived", label: "Archived" },
];
const SORT_LABEL: Record<SortKey, string> = { updated: "Last updated", name: "Name", messages: "Most messages" };

/** A titled block in the filter card that folds shut on its heading. Closed
 *  content is `inert`, so it leaves the tab order as well as the screen. */
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  return (
    <section className={`ph-sec${open ? "" : " is-closed"}`}>
      <h2 className="ph-eyebrow">
        <button type="button" className="ph-sec-btn" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(o => !o)}>
          {title}
          <IconChevronDown size={12} />
        </button>
      </h2>
      <div className="ph-sec-body" id={bodyId}>
        <div className="ph-sec-in" inert={open ? undefined : true}>{children}</div>
      </div>
    </section>
  );
}

/** One group of filters in the side card: pick one, pick it again to clear. */
function FilterGroup<K extends string>({ title, items, value, onChange }: {
  title: string;
  items: { key: K; label: string; n: number; icon?: React.ReactNode }[];
  value: K | null;
  onChange: (k: K | null) => void;
}) {
  if (items.length === 0) return null;
  return (
    <FilterSection title={title}>
      <div className="ph-fl">
        {items.map(it => {
          const on = value === it.key;
          return (
            <button key={it.key} type="button" className="ph-f" aria-pressed={on} onClick={() => onChange(on ? null : it.key)}>
              {it.icon}
              <span className="ph-f-l">{it.label}</span>
              <span className="ph-f-n">{it.n}</span>
            </button>
          );
        })}
      </div>
    </FilterSection>
  );
}

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
  // The menu stays mounted for its exit, by which time menuFor is already
  // null — so remember which row it belonged to (adjusted during render,
  // React's pattern for state that follows another value).
  const [lastMenuFor, setLastMenuFor] = useState<string | null>(null);
  if (menuFor && menuFor !== lastMenuFor) setLastMenuFor(menuFor);
  const menuPhase = usePresence(menuFor !== null);
  const [confirmArchive, setConfirmArchive] = useState<Project | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  /** A rename or archive that didn't go through. Shown above the list. */
  const [actionError, setActionError] = useState<string | null>(null);
  /** Progress, messages and documents per project — read after the list, so
   *  the list never waits on it, and a failure only leaves the numbers out. */
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  /** An agent type ("AI Strategy Consultant", "Change Manager"…), either role. */
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  /** Which deliverable a project has produced — or none yet. */
  const [docFilter, setDocFilter] = useState<AgentType | "none" | null>(null);
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("updated");
  const [sortOpen, setSortOpen] = useState(false);
  const sortPhase = usePresence(sortOpen);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const uid = useId();
  const searchId = `${uid}-search`;
  const sortMenuId = `${uid}-sort`;
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
      .then(([p, a]) => {
        if (!alive) return;
        setProjects(p); setAgents(a); setLoadError(false);
        loadProjectStats(p.map(x => x.id)).then(st => { if (alive) setStats(st); }).catch(() => {});
      })
      // An empty list here would claim "Nothing here yet" about projects that
      // exist, so a failed load gets its own state with a way out.
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, attempt]);

  useEffect(() => { if (menuFor) focusFirstMenuItem(menuRef.current); }, [menuFor]);
  // Opens on the current choice, so the arrow keys start from where you are.
  useEffect(() => {
    if (!sortOpen) return;
    (sortMenuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? sortMenuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]'))?.focus();
  }, [sortOpen]);
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

  function closeSort(restoreFocus: boolean) {
    setSortOpen(false);
    if (restoreFocus) setTimeout(() => sortBtnRef.current?.focus(), 0);
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
      // Kept in the list as archived: the Archived filter is where it lives now.
      setProjects(prev => prev.map(x => x.id === p.id ? { ...x, status: "Archived" } : x));
    } catch {
      setActionError(`"${displayName(p.name)}" couldn't be archived. Check your connection and try again.`);
    } finally {
      setArchiving(false);
      setConfirmArchive(null);
    }
  }

  /** The types of agent on a project. A seeded catalog agent has no
   *  template, but its name already is a type ("Business Analyst"); an agent
   *  of the user's own that matches none is filed under its role. */
  function agentTypes(p: Project): string[] {
    return [p.consultant_agent_id, p.coach_agent_id].flatMap(id => {
      const a = id ? agents.find(x => x.id === id) : null;
      if (!a) return [];
      return [templateFor(a)?.type ?? (a.created_by === null ? a.name : a.type === "coach" ? "Other coach" : "Other consultant")];
    });
  }

  const counts: Record<StatusFilter, number> = {
    all: projects.length,
    "In Progress": projects.filter(p => p.status === "In Progress").length,
    "Not Started": projects.filter(p => p.status === "Not Started").length,
    Completed: projects.filter(p => p.status === "Completed").length,
    Archived: projects.filter(p => p.status === "Archived").length,
  };
  // Every other filter counts within the status you are looking at, so the
  // numbers beside them are what you would actually get by clicking.
  const inStatus = projects.filter(p => statusFilter === "all" ? p.status !== "Archived" : p.status === statusFilter);
  const countBy = <T,>(keyOf: (p: Project) => T | T[] | null) => {
    const m = new Map<T, number>();
    for (const p of inStatus) {
      const k = keyOf(p);
      for (const x of Array.isArray(k) ? k : k == null ? [] : [k]) m.set(x, (m.get(x) ?? 0) + 1);
    }
    return m;
  };
  const agentCounts = countBy(p => [...new Set(agentTypes(p))]);
  const industryCounts = countBy(p => stats[p.id]?.industry ?? null);
  const hasDoc = (p: Project, k: AgentType | "none") =>
    k === "none" ? !stats[p.id]?.docsBy.consultant && !stats[p.id]?.docsBy.coach : !!stats[p.id]?.docsBy[k];
  const docItems = (["consultant", "coach", "none"] as const).map(k => ({
    key: k,
    label: k === "none" ? "Not generated yet" : `${DELIVERABLES[k].title} generated`,
    n: inStatus.filter(p => hasDoc(p, k)).length,
  })).filter(it => it.n > 0);
  const anyFilter = !!(agentFilter || docFilter || industryFilter);
  function clearFilters() {
    setAgentFilter(null); setDocFilter(null); setIndustryFilter(null);
  }

  // "All" is everything still in play; archived projects are behind their own filter.
  const filtered = inStatus
    .filter(p => !agentFilter || agentTypes(p).includes(agentFilter))
    .filter(p => !docFilter || hasDoc(p, docFilter))
    .filter(p => !industryFilter || stats[p.id]?.industry === industryFilter)
    .filter(p => displayName(p.name).toLowerCase().includes(search.toLowerCase()))
    .sort((x, y) => sort === "name" ? displayName(x.name).localeCompare(displayName(y.name))
      : sort === "messages" ? (stats[y.id]?.messages ?? 0) - (stats[x.id]?.messages ?? 0)
      : new Date(y.last_activity_at).getTime() - new Date(x.last_activity_at).getTime());
  const activeCount = counts["In Progress"] + counts["Not Started"];

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
        {/* Overview and filters on the left, the list on the right (Ana,
            2026-10-05). Colour is kept for what it means: progress, and the
            filter you are on. */}
        <div className="ph" onClick={() => { setMenuFor(null); setSortOpen(false); }}>
          <aside className="ph-side" aria-label="Overview and filters">
            <section className="ph-card ph-overview">
              <h2 className="ph-eyebrow">Project overview</h2>
              <div className="ph-ov-total">
                <b>{counts.all}</b>
                <span>Total projects</span>
              </div>
              <ul className="ph-ov-list">
                <li><span className="sd in-progress" aria-hidden="true" /><b>{activeCount}</b> Active</li>
                <li><span className="sd completed" aria-hidden="true" /><b>{counts.Completed}</b> Completed</li>
                <li><span className="sd archived" aria-hidden="true" /><b>{counts.Archived}</b> Archived</li>
              </ul>
            </section>

            <nav className="ph-card ph-filters" aria-label="Filter projects">
              <FilterSection title="Filter by status">
              <div className="ph-fl">
                {STATUS_FILTERS.filter(f => f.key === "all" || counts[f.key] > 0 || f.key === statusFilter).map(f => (
                  <button key={f.key} type="button" className="ph-f" aria-pressed={statusFilter === f.key}
                    onClick={() => setStatusFilter(f.key)}>
                    <span className={`sd ${f.key === "all" ? "all" : statusClass(f.key as Project["status"])}`} aria-hidden="true" />
                    <span className="ph-f-l">{f.label}</span>
                    <span className="ph-f-n">{counts[f.key]}</span>
                  </button>
                ))}
              </div>
              </FilterSection>
              <FilterGroup title="Agents" value={agentFilter} onChange={setAgentFilter}
                items={[...agentCounts.entries()].sort((x, y) => y[1] - x[1]).map(([type, n]) => ({ key: type, label: type, n }))} />
              <FilterGroup title="Industry" value={industryFilter} onChange={setIndustryFilter}
                items={[...industryCounts.entries()].sort((x, y) => y[1] - x[1]).map(([k, n]) => ({ key: k, label: k, n }))} />
              <FilterGroup title="Documents" value={docFilter} onChange={setDocFilter} items={docItems} />
              {anyFilter && <button type="button" className="ph-clear" onClick={clearFilters}>Clear filters</button>}
            </nav>
          </aside>

          <section className="ph-main">
            <header className="ph-head">
              <div className="ph-title">
                <h1>Project History</h1>
              </div>
              <div className="ph-tools">
                <div className="search-box"><IconSearch size={13} />
                  <label className="visually-hidden" htmlFor={searchId}>Search projects</label>
                  <input id={searchId} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…" />
                </div>
                <div className="ph-sort-wrap">
                  <button ref={sortBtnRef} type="button" className="ph-sort" aria-haspopup="menu" aria-expanded={sortOpen}
                    aria-controls={sortOpen ? sortMenuId : undefined}
                    onClick={e => { e.stopPropagation(); setMenuFor(null); setSortOpen(o => !o); }}>
                    <span className="ph-sort-k">Sort by</span>
                    <span className="ph-sort-v">{SORT_LABEL[sort]}</span>
                    <IconChevronDown size={13} />
                  </button>
                  {sortPhase !== "closed" && (
                    <div ref={sortMenuRef} id={sortMenuId} className={`popover ph-sort-menu t-dropdown${phaseClass(sortPhase)}`}
                      data-origin="top-right" role="menu" aria-label="Sort projects by"
                      onClick={e => e.stopPropagation()} onKeyDown={e => menuKeyDown(closeSort)(e)}>
                      {(Object.keys(SORT_LABEL) as SortKey[]).map(k => (
                        <button key={k} type="button" role="menuitemradio" aria-checked={sort === k} tabIndex={-1} className="mi"
                          onClick={() => { setSort(k); closeSort(true); }}>
                          <span className="mi-l">{SORT_LABEL[k]}</span>
                          {sort === k && <IconCheck size={13} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </header>

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
              ) : projects.length > 0 ? (
                <EmptyState title="Nothing in this filter"
                  body="No project matches the filters on the left."
                  action={<button className="btn btn-ghost" onClick={() => { setStatusFilter("all"); clearFilters(); }}>Show all projects</button>} />
              ) : (
                <EmptyState title="Nothing here yet"
                  body="Start a task and it turns up here on its own, with the agents that worked on it and everything they produced."
                  action={<button className="btn btn-hero" onClick={() => router.push("/dashboard")}><IconPlus />New task</button>} />
              )
            )}

            <div className="ph-list">
              {!loading && !loadError && filtered.map((p, i) => {
                const name = displayName(p.name);
                const isRenaming = renamingId === p.id;
                const menuOpen = menuFor === p.id;
                const menuId = `${uid}-menu-${p.id}`;
                const st = stats[p.id];
                const members = team(p);
                const content = (
                  <>
                    {/* Who worked on it — you recognise a project by its team
                        faster than by its name. */}
                    <span className={`ph-thumb${members.length === 2 ? " duo" : ""}`} aria-hidden="true">
                      {members.length > 0
                        ? members.map(([r, id]) => (
                          <span key={r} className={`ph-face ${r}`}><AgentMascot role={r} size={members.length === 2 ? 40 : 52} agentId={id} /></span>
                        ))
                        : <IconFolder size={20} />}
                    </span>
                    <span className="ph-body">
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
                        <span className="ph-name">{name}</span>
                      )}
                      {/* The agent's one-line description, under the name it
                          also gave (Patryk, 2026-10-09). Only when there is
                          one: older projects have none, and an empty line
                          would push every row taller for nothing. */}
                      {p.description && <span className="ph-desc">{p.description}</span>}
                      <span className="ph-team">{teamLabel(p)}</span>
                    </span>
                    <span className="ph-facts">
                      <span className={`status-pill ${statusClass(p.status)}`}><span className="sd" />{p.status}</span>
                      <span>{st ? `${st.messages} ${st.messages === 1 ? "message" : "messages"}` : ""}{st?.docs ? ` · ${st.docs} ${st.docs === 1 ? "document" : "documents"}` : ""}</span>
                      <span>Updated {agoStr(p.last_activity_at)}</span>
                    </span>
                    <span className="ph-open" aria-hidden="true"><IconArrow /></span>
                  </>
                );
                return (
                  // The row is a link (the whole of it is clickable) with the
                  // ⋯ button beside it, not inside it.
                  <div key={p.id} className="ph-row row-in" style={{ "--i": i } as React.CSSProperties}>
                    {isRenaming
                      ? <div className="ph-link">{content}</div>
                      : <Link href={`/dashboard/project/${p.id}`} className="ph-link">{content}</Link>}
                    {!isRenaming && (
                      <button ref={el => { moreRefs.current[p.id] = el; }} type="button" className="overflow-btn"
                        data-tooltip="More" aria-label={`More actions for ${name}`}
                        aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined}
                        onClick={e => { e.stopPropagation(); setMenuFor(menuOpen ? null : p.id); }}>
                        <IconMore />
                      </button>
                    )}
                    {menuPhase !== "closed" && (menuFor ?? lastMenuFor) === p.id && (
                      <div ref={menuRef} id={menuId} className={`popover row-menu t-dropdown${phaseClass(menuPhase)}`}
                        data-origin="top-right" role="menu" aria-label={`Actions for ${name}`}
                        onClick={e => e.stopPropagation()} onKeyDown={e => menuKeyDown(closeMenu)(e)}>
                        <button type="button" role="menuitem" tabIndex={-1} className="mi" onClick={() => startRename(p)}>
                          <IconFolder size={13} />Rename project
                        </button>
                        {p.status !== "Archived" && (
                          <button type="button" role="menuitem" tabIndex={-1} className="mi"
                            onClick={() => { setMenuFor(null); setConfirmArchive(p); }}>
                            Archive project
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
