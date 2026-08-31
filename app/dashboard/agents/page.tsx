"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { Input, Badge } from "@/components/ui";
import { cn, dateStr } from "@/lib/utils";
import { ChevronRight, ArrowLeft, UserRoundCog, HeartHandshake } from "lucide-react";

type Filter = "All" | "Coach" | "Consultant";

export default function AgentDashboardPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="thinking-spinner" style={{ width: 24, height: 24 }} />
    </div>
  );

  return (
    <div className="flex flex-col bg-background" style={{ height: "100vh", overflow: "hidden" }}>
      <AgentNav />
      <div className="px-6 pt-5 pb-4 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1.5">Agent Dashboard</h1>
        <p className="text-sm text-secondary-foreground">Your full AI team — Coaches and Consultants, independent of any single project.</p>
      </div>

      <div className="flex-1 overflow-y-auto flex justify-center px-6 pb-8">
        <div className="w-full max-w-[900px]">
          {detail ? (
            <div className="pt-2">
              <button onClick={() => setDetailId(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary border border-border rounded-xs px-2.5 py-1.5 mb-4 hover:text-foreground hover:border-border-strong transition-colors">
                <ArrowLeft className="w-3 h-3" strokeWidth={2.2} />Back to team
              </button>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn("w-[7px] h-[7px] rounded-full", detail.type === "coach" ? "bg-coach-2" : "bg-consultant-2")} />
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{detail.type === "coach" ? "Coach" : "Consultant"}</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">{detail.name}</h2>
              {detail.description && <p className="text-xs text-secondary-foreground leading-relaxed max-w-[420px] mb-5">{detail.description}</p>}
              {detail.primaryMethods.length > 0 && (
                <div className="mb-5">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Primary Methods</span>
                  <ol className="flex flex-col gap-1.5">
                    {detail.primaryMethods.map((m, i) => (
                      <li key={m.id} className="text-sm text-foreground flex gap-2.5 items-baseline">
                        <span className="text-[11px] text-primary-soft font-bold w-4 shrink-0">0{i + 1}</span>{m.name}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {detail.secondaryMethods.length > 0 && (
                <div className="mb-5">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Secondary</span>
                  <p className="text-xs text-secondary-foreground">{detail.secondaryMethods.map(m => m.name).join(" · ")}</p>
                </div>
              )}
              <div className="flex gap-8 mb-5">
                <div><span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Knowledge Level</span><b className="text-base font-semibold text-foreground">{detail.knowledge_level}</b></div>
                <div><span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Previous Projects</span><b className="text-base font-semibold text-foreground">{detail.last_projects.length}</b></div>
              </div>
              {detail.last_projects.length > 0 && (
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Recent Projects</span>
                  <div className="flex flex-col">
                    {detail.last_projects.map(p => (
                      <div key={p.id} className="pl-4 pb-3 border-l border-input last:border-transparent relative">
                        <span className="absolute -left-[3.5px] top-1 w-[7px] h-[7px] rounded-full bg-primary" />
                        <p className="text-xs text-foreground font-medium">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{dateStr(p.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents, roles or methods..." />
                {(["All", "Coach", "Consultant"] as Filter[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn("shrink-0 text-xs font-medium px-3.5 py-2 rounded-sm border transition-colors",
                      filter === f ? "text-foreground border-border-strong bg-secondary" : "text-secondary-foreground border-border bg-secondary")}>
                    {f}
                  </button>
                ))}
              </div>
              {loading && <div className="flex flex-col gap-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-md" />)}</div>}
              {!loading && filtered.map(a => (
                <div key={a.id} onClick={() => setDetailId(a.id)}
                  className="flex items-center gap-4 py-4 px-2 border-b border-border cursor-pointer hover:bg-accent/40 transition-colors">
                  <div className="w-[34px] h-[34px] rounded-xs bg-secondary border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                    {a.type === "coach" ? <HeartHandshake className="w-4 h-4" strokeWidth={1.8} /> : <UserRoundCog className="w-4 h-4" strokeWidth={1.8} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                    <p className="text-xs text-secondary-foreground mt-0.5">
                      {a.type === "coach" ? "Coach" : "Consultant"} · Knowledge: {a.knowledge_level} · {a.last_projects.length} Projects
                    </p>
                  </div>
                  {a.tagline && <Badge variant="secondary" className="hidden md:inline-flex">{a.tagline}</Badge>}
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={2} />
                </div>
              ))}
              {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-16">No agents found.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
