"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listAgents, setAgentArchived, type Agent, type AgentType } from "@/lib/agents";
import { MAX_PER_TYPE, TYPE_CATALOG, groupByType } from "@/lib/agent-types";
import { loadTeamStats, compactNumber, EMPTY_STATS, type TeamStats } from "@/lib/team-stats";
import { syncReplies } from "@/lib/mascot-level";
import { describeDbError } from "@/lib/db-error";
import { AgentNav } from "@/components/layout/agent-nav";
import { EmptyState } from "@/components/layout/empty-state";
import { Stat, Bars, RoleSection } from "@/components/layout/agent-dashboard";
import {
  IconPlus, IconAlert, IconRefresh,
} from "@/components/layout/agxp-icons";

const ROLES: { id: AgentType; label: string }[] = [
  { id: "consultant", label: "Consultants" },
  { id: "coach", label: "Coaches" },
];

export default function AgentDashboardPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<TeamStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    // The numbers are a garnish: if they fail, the team still shows.
    Promise.all([listAgents(), loadTeamStats().catch(() => EMPTY_STATS)])
      .then(([a, s]) => {
        if (!alive) return;
        setAgents(a); setStats(s); setLoadError(false);
        // The mascot's level lives in this browser and only grew while a chat
        // was open in it. The stored answers are the truth, so every face on
        // this page (and everywhere else) catches up to them here.
        for (const [id, u] of Object.entries(s.byAgent)) syncReplies(id, u.replies);
      })
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, attempt]);

  function retry() { setLoading(true); setLoadError(false); setAttempt(n => n + 1); }

  // Every slot of every type, across both roles: how much of the team is hired.
  const slots = (TYPE_CATALOG.consultant.length + TYPE_CATALOG.coach.length) * MAX_PER_TYPE;
  // Archived agents keep their history but hold no slot and are not "on the team".
  const active = agents.filter(a => !a.archived_at);
  const filled = ROLES.reduce((n, r) => n + groupByType(active, r.id).columns
    .reduce((m, c) => m + Math.min(MAX_PER_TYPE, c.agents.length), 0), 0);

  // Archive or restore. Undoable both ways, so no "are you sure?" — the
  // agent simply moves to (or back from) its role's Archived tab.
  async function setArchived(target: Agent, archived: boolean) {
    setActionError(null);
    try {
      const at = await setAgentArchived(target.id, archived);
      setAgents(list => list.map(a => a.id === target.id ? { ...a, archived_at: at } : a));
    } catch (e) {
      setActionError(describeDbError(e, `${archived ? "Archiving" : "Restoring"} ${target.name}`));
    }
  }

  if (authLoading || !token) return (
    <main className="app app-wait">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span className="visually-hidden" role="status">Loading…</span>
    </main>
  );

  return (
    <div className="app agx-page">
      <AgentNav />
      <main className="view-root view-enter agx-main" id="main-content" tabIndex={-1}>
        {/* The numbers in a pill drawn like the navbar, centred under it; no
            visible title (Ana, 2026-10-01 mockup). The h1 stays for screen
            readers — the page still needs a name. */}
        <header className="agx-head">
          <h1 className="visually-hidden">Your AI team</h1>
          <dl className="agx-stats">
            <Stat label="Projects in progress" value={String(stats.projectsInProgress)} />
            <Stat label="Tokens used, est." value={compactNumber(stats.tokens)}
              hint="Estimated from the length of your conversations. The bars are the last 8 days.">
              <Bars values={stats.tokensByDay} />
            </Stat>
            <Stat label="Slots filled" value={`${filled} / ${slots}`} />
          </dl>
        </header>

        <div className="agx-board">
          {actionError && (
            <div className="load-error" role="alert">
              <IconAlert size={14} />
              <span className="le-text">{actionError}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActionError(null)}>Dismiss</button>
            </div>
          )}
          {loadError && (
            <div className="load-error" role="alert">
              <IconAlert size={14} />
              <span className="le-text">Your agents couldn&apos;t be loaded. Check your connection and try again.</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={retry}><IconRefresh size={12} />Retry</button>
            </div>
          )}
          {loading && <div className="ag-loading" role="status"><span className="spinner" aria-hidden="true" />Loading your team…</div>}

          {!loading && !loadError && agents.length === 0 && (
            <EmptyState title="No agents yet"
              body="Agents appear here once you create one. Start a task and pick “Create new agent”, and this is where you will watch them grow."
              action={<button className="btn btn-hero" onClick={() => router.push("/dashboard")}><IconPlus />New task</button>} />
          )}

          {!loading && !loadError && agents.length > 0 && (
            // An agent opens in a card over its own role, not on a page of
            // its own (Ana, 2026-10-01): the team stays in view behind it.
            <div className="agx-split">
              {ROLES.map(r => (
                <RoleSection key={r.id} role={r.id} label={r.label} agents={agents} usage={stats.byAgent}
                  onArchive={a => setArchived(a, true)} onRestore={a => setArchived(a, false)}
                  onAdd={() => router.push("/dashboard")} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
