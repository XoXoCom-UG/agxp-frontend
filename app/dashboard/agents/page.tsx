"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listAgents, type Agent } from "@/lib/agents";
import { levelFor, LEVEL_ORDER, projectCountsByAgent } from "@/lib/agent-progress";
import { methodLabel } from "@/lib/method-labels";
import { loadAgentMemory, EMPTY_MEMORY, type AgentMemory } from "@/lib/agent-memory";
import { AgentNav } from "@/components/layout/agent-nav";
import { dateStr } from "@/lib/utils";
import { IconCoach, IconConsultant, IconArrow, IconBack, IconFilter } from "@/components/layout/agxp-icons";

type Filter = "All" | "Coach" | "Consultant";

/**
 * What this agent picked up in the user's earlier projects. This is the honest
 * answer to "how trained is my agent" — the level only counts projects.
 */
function MemorySection({ agent }: { agent: Agent }) {
  const [memory, setMemory] = useState<AgentMemory>(EMPTY_MEMORY);
  const [loading, setLoading] = useState(true);

  // Mounted with key={agent.id}, so `loading` starts true for each agent and
  // never has to be reset from inside the effect.
  useEffect(() => {
    let alive = true;
    loadAgentMemory(agent.id, agent.type)
      .then(m => { if (alive) setMemory(m); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [agent.id, agent.type]);

  return (
    <div className="detail-section">
      <span className="lbl">
        What it remembers
        {memory.projects > 0 && ` · from ${memory.projects} project${memory.projects === 1 ? "" : "s"}`}
      </span>
      {loading ? (
        <div className="val" style={{ color: "var(--text-muted)" }}>Loading…</div>
      ) : memory.lessons.length === 0 ? (
        <div className="val" style={{ color: "var(--text-muted)" }}>
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

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    Promise.all([listAgents(), projectCountsByAgent().catch(() => ({} as Record<string, number>))])
      .then(([a, c]) => { if (alive) { setAgents(a); setCounts(c); } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

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
    <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" style={{ width: 24, height: 24, borderColor: "var(--border-strong)", borderTopColor: "var(--primary)" }} />
    </div>
  );

  return (
    <div className="app">
      <AgentNav />
      <div className="view-root">
        <div className="page-head"><div><h1>Agent Dashboard</h1><p>Everyone you work with, and what they have learned about you so far.</p></div></div>
        <div className="flat-view" onClick={() => setFilterOpen(false)}>
          <div className="flat-col">
            {detail ? (
              <div style={{ paddingTop: 8 }}>
                <button className="back-link" style={{ marginBottom: 16 }} onClick={() => setDetailId(null)}><IconBack size={11} />Back</button>
                <div className="role-line"><span className={`role-dot ${detail.type}`} /><span className="role-eyebrow">{detail.type === "coach" ? "Coach" : "Consultant"}</span></div>
                <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 650, margin: "5px 0 9px" }}>{detail.name}</h2>
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
              <>
                <div className="list-toolbar" style={{ padding: "0 0 16px", border: "none", position: "relative" }}>
                  <div className="search-box"><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or what they do..." /></div>
                  <button className={`filter-chip ${filter !== "All" ? "active" : ""}`} onClick={e => { e.stopPropagation(); setFilterOpen(o => !o); }}>
                    {filter} <IconFilter size={12} />
                  </button>
                  {filterOpen && (
                    <div className="popover" style={{ top: 52, right: 0, minWidth: 160 }} onClick={e => e.stopPropagation()}>
                      {(["All", "Coach", "Consultant"] as Filter[]).map(f => (
                        <button key={f} className="mi" onClick={() => { setFilter(f); setFilterOpen(false); }}>{f}</button>
                      ))}
                    </div>
                  )}
                </div>
                {loading && <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>Loading…</p>}
                <div className="project-list">
                  {!loading && filtered.map(a => (
                    <div key={a.id} className="project-row" tabIndex={0} role="button" aria-label={`View ${a.name}`}
                      onClick={() => setDetailId(a.id)}>
                      <div className="pr-icon">{a.type === "coach" ? <IconCoach /> : <IconConsultant />}</div>
                      <div className="pr-main">
                        <div className="pr-top"><span className="pr-name">{a.name}</span></div>
                        <div className="pr-meta">
                          <span className="m">{a.type === "coach" ? "Coach" : "Consultant"} · {a.tagline || a.name}</span>
                          <span className="sep">·</span><span className="m">{levelFor(totalProjects(a))}</span>
                          <span className="sep">·</span><span className="m">{totalProjects(a)} projects together</span>
                        </div>
                      </div>
                      <span className="open-action" aria-hidden="true"><IconArrow /></span>
                    </div>
                  ))}
                </div>
                {!loading && filtered.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", textAlign: "center", padding: "40px 0" }}>No agents found.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
