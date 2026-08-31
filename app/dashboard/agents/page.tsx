"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { dateStr } from "@/lib/utils";
import { IconCoach, IconConsultant, IconArrow, IconBack, IconFilter } from "@/components/layout/agxp-icons";

type Filter = "All" | "Coach" | "Consultant";

export default function AgentDashboardPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    listAgents().then(a => { if (alive) setAgents(a); }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

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
        <div className="page-head"><div><h1>Agent Dashboard</h1><p>Your full AI team — Coaches and Consultants, independent of any single project.</p></div></div>
        <div className="flat-view" onClick={() => setFilterOpen(false)}>
          <div className="flat-col">
            {detail ? (
              <div style={{ paddingTop: 8 }}>
                <button className="back-link" style={{ marginBottom: 16 }} onClick={() => setDetailId(null)}><IconBack size={11} />Back to team</button>
                <div className="role-line"><span className={`role-dot ${detail.type}`} /><span className="role-eyebrow">{detail.type === "coach" ? "Coach" : "Consultant"}</span></div>
                <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 650, margin: "5px 0 9px" }}>{detail.name}</h2>
                {detail.description && <div className="detail-desc">{detail.description}</div>}
                {detail.primaryMethods.length > 0 && (
                  <div className="detail-section"><span className="lbl">Primary Methods</span>
                    <ol className="num-list">{detail.primaryMethods.map((m, i) => <li key={m.id}><span className="no">0{i + 1}</span>{m.name}</li>)}</ol>
                  </div>
                )}
                {detail.secondaryMethods.length > 0 && (
                  <div className="detail-section"><span className="lbl">Secondary</span><div className="val">{detail.secondaryMethods.map(m => m.name).join(" · ")}</div></div>
                )}
                <div className="detail-row-inline">
                  <div><span className="lbl">Knowledge Level</span><b>{detail.knowledge_level}</b></div>
                  <div><span className="lbl">Previous Projects</span><b>{detail.last_projects.length}</b></div>
                </div>
                {detail.last_projects.length > 0 && (
                  <div className="detail-section"><span className="lbl">Recent Projects</span>
                    <div className="timeline">{detail.last_projects.map(p => (
                      <div key={p.id} className="t-item"><div className="pn">{p.name}</div><div className="pd">{dateStr(p.created_at)}</div></div>
                    ))}</div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="list-toolbar" style={{ padding: "0 0 16px", border: "none", position: "relative" }}>
                  <div className="search-box"><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents, roles or methods..." /></div>
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
                          <span className="sep">·</span><span className="m">Knowledge: {a.knowledge_level}</span>
                          <span className="sep">·</span><span className="m">{a.last_projects.length} Projects</span>
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
