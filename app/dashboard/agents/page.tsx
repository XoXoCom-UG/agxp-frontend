"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listAgents, type Agent } from "@/lib/agents";
import { levelFor, LEVEL_ORDER, projectCountsByAgent } from "@/lib/agent-progress";
import { methodLabel } from "@/lib/method-labels";
import { loadAgentMemory, EMPTY_MEMORY, type AgentMemory } from "@/lib/agent-memory";
import { AgentNav } from "@/components/layout/agent-nav";
import { dateStr, menuKeyDown } from "@/lib/utils";
import { IconArrow, IconBack, IconFilter, IconAlert, IconRefresh } from "@/components/layout/agxp-icons";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { SkeletonRows } from "@/components/layout/skeleton";
import { EmptyState } from "@/components/layout/empty-state";

type Filter = "All" | "Coach" | "Consultant";
const FILTERS: Filter[] = ["All", "Coach", "Consultant"];

/**
 * What this agent picked up in the user's earlier projects. This is the honest
 * answer to "how trained is my agent" — the level only counts projects.
 */
function MemorySection({ agent }: { agent: Agent }) {
  const [memory, setMemory] = useState<AgentMemory>(EMPTY_MEMORY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  /** Bumped by Retry, which re-runs the load. */
  const [attempt, setAttempt] = useState(0);

  // Mounted with key={agent.id}, so `loading` starts true for each agent and
  // never has to be reset from inside the effect.
  useEffect(() => {
    let alive = true;
    loadAgentMemory(agent.id, agent.type)
      .then(m => { if (alive) { setMemory(m); setFailed(false); } })
      // "Nothing yet" would be a false answer to a failed read — say it failed.
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [agent.id, agent.type, attempt]);

  function retry() {
    setLoading(true);
    setFailed(false);
    setAttempt(n => n + 1);
  }

  return (
    <div className="detail-section">
      <span className="lbl">
        What it remembers
        {memory.projects > 0 && ` · from ${memory.projects} project${memory.projects === 1 ? "" : "s"}`}
      </span>
      {loading ? (
        // Two lines of placeholder, shaped like the list that replaces them.
        <div className="mem-skel" aria-busy="true" aria-label="Loading">
          <div className="skel-line" />
          <div className="skel-line sm" />
        </div>
      ) : failed ? (
        <div className="load-error" role="alert">
          <IconAlert size={14} />
          <span className="le-text">What this agent remembers couldn&apos;t be loaded.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={retry}><IconRefresh size={12} />Retry</button>
        </div>
      ) : memory.lessons.length === 0 ? (
        <div className="val val-muted">
          Nothing yet — it starts remembering while you work with it.
        </div>
      ) : (
        <ul className="plist mem">
          {memory.lessons.map(l => (
            <li key={l.fact} title={`learned in ${l.project}`}>{l.fact}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AgentDashboardPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  /** Bumped by Retry, which re-runs the load effect. */
  const [attempt, setAttempt] = useState(0);

  const uid = useId();
  const searchId = `${uid}-search`;
  const filterMenuId = `${uid}-filter-menu`;
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    // The counts are part of the answer, not garnish: without them every agent
    // reads as "New" with 0 projects. So either both load or the page says so.
    Promise.all([listAgents(), projectCountsByAgent()])
      .then(([a, c]) => { if (alive) { setAgents(a); setCounts(c); setLoadError(false); } })
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, attempt]);

  // Opening the filter lands on the option that is in force, like a select.
  useEffect(() => {
    if (!filterOpen) return;
    filterMenuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [filterOpen]);

  function retry() {
    setLoading(true);
    setLoadError(false);
    setAttempt(n => n + 1);
  }

  function closeFilter(restoreFocus: boolean) {
    setFilterOpen(false);
    if (restoreFocus) setTimeout(() => filterBtnRef.current?.focus(), 0);
  }

  // Same rule as everywhere else: the level comes from the work actually done
  // for this user, not from the stale knowledge_level column on the catalog.
  const totalProjects = (a: Agent) => a.last_projects.length + (counts[a.id] ?? 0);

  const filtered = agents.filter(a => {
    if (filter !== "All" && a.type !== filter.toLowerCase()) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const hay = [a.name, a.expertise ?? "", ...a.methods.map(m => m.name)].join(" ").toLowerCase();
    return hay.includes(q);
  });
  const detail = agents.find(a => a.id === detailId) ?? null;

  if (authLoading || !token) return (
    <main className="app app-wait">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span className="visually-hidden" role="status">Loading…</span>
    </main>
  );

  return (
    <div className="app">
      <AgentNav />
      <main className="view-root view-enter" id="main-content" tabIndex={-1}>
        <div className="page-head"><div><h1>Agent dashboard</h1><p>Everyone you work with, and what they have learned about you so far.</p></div></div>
        <div className="flat-view" onClick={() => setFilterOpen(false)}>
          <div className="flat-col">
            {detail ? (
              <div className="detail-enter detail-pad" key={detail.id}>
                <button type="button" className="back-link detail-back" onClick={() => setDetailId(null)}><IconBack size={11} />Back</button>
                {/* This page is about the agents, so the agent itself leads —
                    the one screen where the mascot can be big without taking
                    attention from something else, because it IS the subject. */}
                <div className="agent-hero">
                  <AgentMascot role={detail.type} size={84} enter agentId={detail.id} />
                  <div className="ah-text">
                    <div className="role-line"><span className={`role-dot ${detail.type}`} /><span className="role-eyebrow">{detail.type === "coach" ? "Coach" : "Consultant"}</span></div>
                    <h2>{detail.name}</h2>
                    {detail.tagline && <div className="ah-tagline">{detail.tagline}</div>}
                  </div>
                </div>
                {detail.description && <div className="detail-desc">{detail.description}</div>}
                {detail.methods.length > 0 && (
                  <div className="detail-section"><span className="lbl">Can help with</span>
                    <ul className="plist">
                      {[...detail.primaryMethods, ...detail.secondaryMethods].map(m => <li key={m.id}>{methodLabel(m.name)}</li>)}
                    </ul>
                  </div>
                )}
                <div className="detail-row-inline">
                  <div>
                    <span className="lbl">Experience</span>
                    <div className="level">
                      <b>{levelFor(totalProjects(detail))}</b>
                      <span className="level-bar">
                        {LEVEL_ORDER.map((l, i) => (
                          <span key={l} className={`level-seg ${i <= LEVEL_ORDER.indexOf(levelFor(totalProjects(detail))) ? "on" : ""}`} />
                        ))}
                      </span>
                    </div>
                  </div>
                  <div><span className="lbl">Projects together</span><b>{totalProjects(detail)}</b></div>
                </div>
                <MemorySection key={detail.id} agent={detail} />
                {detail.last_projects.length > 0 && (
                  <div className="detail-section"><span className="lbl">Worked on</span>
                    <div className="timeline">{detail.last_projects.map(p => (
                      <div key={p.id} className="t-item"><div className="pn">{p.name}</div><div className="pd">{dateStr(p.created_at)}</div></div>
                    ))}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="list-enter">
                <div className="list-toolbar list-toolbar-flat">
                  <div className="search-box">
                    <label className="visually-hidden" htmlFor={searchId}>Search agents</label>
                    <input id={searchId} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or what they do…" />
                  </div>
                  <button ref={filterBtnRef} type="button" className={`filter-chip ${filter !== "All" ? "active" : ""}`}
                    aria-label={`Filter by role: ${filter}`} aria-haspopup="menu" aria-expanded={filterOpen}
                    aria-controls={filterOpen ? filterMenuId : undefined}
                    onClick={e => { e.stopPropagation(); setFilterOpen(o => !o); }}>
                    {filter} <IconFilter size={12} />
                  </button>
                  {filterOpen && (
                    <div ref={filterMenuRef} id={filterMenuId} className="popover filter-menu" role="menu" aria-label="Filter by role"
                      onClick={e => e.stopPropagation()} onKeyDown={e => menuKeyDown(closeFilter)(e)}>
                      {FILTERS.map(f => (
                        <button key={f} type="button" role="menuitemradio" aria-checked={filter === f} tabIndex={-1} className="mi"
                          onClick={() => { setFilter(f); closeFilter(true); }}>{f}</button>
                      ))}
                    </div>
                  )}
                </div>
                {loading && <SkeletonRows count={5} avatar="round" />}
                {!loading && loadError && (
                  <div className="load-error" role="alert">
                    <IconAlert size={14} />
                    <span className="le-text">Your agents couldn&apos;t be loaded. Check your connection and try again.</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={retry}><IconRefresh size={12} />Retry</button>
                  </div>
                )}
                <div className="project-list">
                  {!loading && !loadError && filtered.map((a, i) => (
                    // A real button: the row opens the agent's detail in place,
                    // and there is nothing else inside it to press.
                    <button key={a.id} type="button" className="project-row row-in project-row-btn" style={{ "--i": i } as React.CSSProperties}
                      onClick={() => setDetailId(a.id)}>
                      <span className="pr-face"><AgentMascot role={a.type} size={44} agentId={a.id} /></span>
                      <span className="pr-main">
                        <span className="pr-top"><span className="pr-name">{a.name}</span></span>
                        <span className="pr-meta">
                          <span className="m">{a.type === "coach" ? "Coach" : "Consultant"} · {a.tagline || a.name}</span>
                          <span className="sep" aria-hidden="true">·</span><span className="m">{levelFor(totalProjects(a))}</span>
                          <span className="sep" aria-hidden="true">·</span><span className="m">{totalProjects(a)} projects together</span>
                        </span>
                      </span>
                      <span className="open-action" aria-hidden="true"><IconArrow /></span>
                    </button>
                  ))}
                </div>
                {!loading && !loadError && filtered.length === 0 && (
                  search.trim() || filter !== "All" ? (
                    <EmptyState role={filter === "Coach" ? "coach" : "consultant"}
                      title="Nobody matches that"
                      body="Try a different word, or clear the filter to see everyone you can work with." />
                  ) : (
                    <EmptyState title="No agents yet"
                      body="Agents appear here once you create one. Start a task and pick “Create new agent”, and this is where you will watch it grow." />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
