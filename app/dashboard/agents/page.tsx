"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listAgents, setAgentArchived, type Agent } from "@/lib/agents";
import { useT } from "@/lib/language";
import { useEntitlement } from "@/lib/entitlement";
import { loadTeamStats, compactNumber, EMPTY_STATS, type TeamStats } from "@/lib/team-stats";
import { applyWork } from "@/lib/mascot-level";
import { describeDbError } from "@/lib/db-error";
import { AgentNav } from "@/components/layout/agent-nav";
import { EmptyState } from "@/components/layout/empty-state";
import { Stat, Bars, Meter, AgentBoard } from "@/components/layout/agent-dashboard";
import {
  IconPlus, IconAlert, IconRefresh,
} from "@/components/layout/agxp-icons";

export default function AgentDashboardPage() {
  const tr = useT();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const { plan } = useEntitlement();
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
        // The level is stored on the agent and raised after each answer; the
        // stats count the work again from the messages, which also catches a
        // document the database function does not (one the model forgot to
        // mark). applyWork only ever raises, so it cannot undo a stored level.
        for (const [id, u] of Object.entries(s.byAgent)) applyWork(id, { replies: u.replies, docProjects: u.docs });
      })
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, attempt]);

  function retry() { setLoading(true); setLoadError(false); setAttempt(n => n + 1); }

  // The plan's places for consultants (1 or 5): how much of the team is hired.
  // The Assistant is not counted, and archived agents hold no place.
  const slots = plan.maxAgents;
  const filled = Math.min(slots, agents.filter(a => !a.archived_at && a.type === "consultant").length);

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
      <span className="visually-hidden" role="status">{tr("Loading…")}</span>
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
          <h1 className="visually-hidden">{tr("Your AI team")}</h1>
          <ul className="agx-stats" aria-label={tr("Your team at a glance")}>
            <Stat label={tr("Projects in progress")} value={String(stats.projectsInProgress)} />
            <Stat label={tr("Tokens used, est.")} value={compactNumber(stats.tokens)}
              hint={tr("Estimated from the length of your conversations. The bars are the last 8 days.")}>
              <Bars values={stats.tokensByDay} />
            </Stat>
            <Stat label={tr("Consultants")} value={`${filled}/${slots}`}>
              <Meter value={filled} max={slots} />
            </Stat>
          </ul>
        </header>

        <div className="agx-board">
          {actionError && (
            <div className="load-error" role="alert">
              <IconAlert size={14} />
              <span className="le-text">{tr(actionError)}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActionError(null)}>{tr("Dismiss")}</button>
            </div>
          )}
          {loadError && (
            <div className="load-error" role="alert">
              <IconAlert size={14} />
              <span className="le-text">{tr("Your agents couldn't be loaded. Check your connection and try again.")}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={retry}><IconRefresh size={12} />{tr("Retry")}</button>
            </div>
          )}
          {loading && <div className="ag-loading" role="status"><span className="spinner" aria-hidden="true" />{tr("Loading your team…")}</div>}

          {!loading && !loadError && agents.length === 0 && (
            <EmptyState title={tr("No agents yet")}
              body={tr("Agents appear here once you create one. Start a task and pick “Create new agent”, and this is where you will watch them grow.")}
              action={<button className="btn btn-hero" onClick={() => router.push("/dashboard")}><IconPlus />{tr("New task")}</button>} />
          )}

          {!loading && !loadError && agents.length > 0 && (
            // An agent opens in a card over its own role, not on a page of
            // its own (Ana, 2026-10-01): the team stays in view behind it.
            <AgentBoard agents={agents} usage={stats.byAgent} plan={plan}
              onArchive={a => setArchived(a, true)} onRestore={a => setArchived(a, false)}
              onAdd={() => router.push("/dashboard")} />
          )}
        </div>
      </main>
    </div>
  );
}
