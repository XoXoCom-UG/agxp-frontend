"use client";

import { loadTeamUsage } from "@/lib/team-usage";
import { loadTeamFeedback } from "@/lib/team-feedback";
import { loadMemoryAudit, rate } from "@/lib/memory-audit";
import { loadAdminState } from "@/lib/team-admin";
import { useLoad } from "@/lib/use-load";
import { useEntitlement } from "@/lib/entitlement";
import { IconRefresh } from "@/components/layout/agxp-icons";
import {
  ConfigPanel, FeedbackPanel, InvitesPanel, MemoryPanel, PlanPanel, UsagePanel,
  configTone, feedbackCounts, keyCounts, memoryQuiet, tokens, usd,
} from "@/components/layout/team-panels";

type Tone = "ok" | "warn" | "bad";

/** One number along the top: what it counts, the value, a line of context. */
function Kpi({ label, value, sub, tone, meter }: {
  label: string; value: string; sub?: string; tone?: Tone | null;
  /** 0-100: a thin bar under the value. */
  meter?: number;
}) {
  return (
    <li className="td-kpi" data-tone={tone ?? undefined}>
      <span className="td-kpi-l">{label}</span>
      <b className="td-kpi-v">{value}</b>
      {meter !== undefined && <span className="td-meter" aria-hidden="true"><i style={{ width: `${meter}%` }} /></span>}
      <span className="td-kpi-s">{sub ?? " "}</span>
    </li>
  );
}

const monthLabel = (month: string) =>
  new Date(`${month}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The team dashboard, at /dashboard/team.
 *
 * Everything the team watches or hands out, on one screen: what the month has
 * cost, who spent it, what is misconfigured, which invitations are out, what
 * testers sent and whether the agents are still learning — plus the plan
 * switch for the team's own account. It replaces the six boxes that used to be
 * stacked at the bottom of Settings → Plan.
 *
 * Each card reads for itself, so one failing query shows its own error and
 * leaves the rest alone. The numbers along the top are folded from the same
 * reads, not asked for twice.
 */
export function TeamDashboard() {
  const { plan, refresh } = useEntitlement();
  const usage = useLoad(loadTeamUsage);
  const admin = useLoad(loadAdminState);
  const feedback = useLoad(loadTeamFeedback);
  const memory = useLoad(loadMemoryAudit);

  const all = [usage, admin, feedback, memory];
  const busy = all.some(l => l.busy);
  const reloadAll = () => all.forEach(l => l.reload());

  const u = usage.data;
  const fb = feedback.data ? feedbackCounts(feedback.data) : null;
  const keys = admin.data ? keyCounts(admin.data.keys) : null;
  const cfgTone = admin.data ? configTone(admin.data.config) : null;
  const pct = memory.data ? rate(memory.data.withMemory, memory.data.replies) : null;
  const urgent = fb ? fb.critical + fb.high : 0;

  return (
    <div className="td">
      <header className="td-head">
        <div>
          <span className="td-eyebrow">Team only</span>
          <h1>Team dashboard</h1>
          <p>Cost, invitations, feedback and server health{u ? ` · ${monthLabel(u.month)}` : ""}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reloadAll} disabled={busy}>
          <IconRefresh size={12} />{busy ? "Reading…" : "Refresh"}
        </button>
      </header>

      <ul className="td-kpis" aria-label="This month at a glance">
        <Kpi label="Spend this month" value={u ? usd(u.totalUsd) : "–"}
          sub={u ? `${u.totalRequests.toLocaleString("en")} requests` : undefined} />
        <Kpi label="Tokens" value={u ? tokens(u.totalTokens) : "–"}
          sub={u ? `${u.users.length} ${u.users.length === 1 ? "account" : "accounts"} active` : undefined} />
        <Kpi label="Feedback" value={fb ? String(feedback.data!.length) : "–"}
          tone={fb ? (urgent > 0 ? "bad" : fb.unrated > 0 ? "warn" : "ok") : null}
          sub={fb ? (urgent > 0 ? `${urgent} critical or high` : fb.unrated > 0 ? `${fb.unrated} not rated` : "nothing urgent") : undefined} />
        <Kpi label="Agents learning" value={pct === null ? "–" : `${pct}%`}
          tone={memory.data ? (memoryQuiet(memory.data) ? "bad" : null) : null}
          meter={pct ?? undefined}
          sub={memory.data ? `of ${memory.data.replies} replies` : undefined} />
        <Kpi label="Invitations" value={keys ? String(keys.open) : "–"}
          sub={keys ? `open · ${keys.used} used` : undefined} />
        <Kpi label="Server" value={admin.data ? (cfgTone ? `${admin.data.config.length} to fix` : "All set") : "–"}
          tone={admin.data ? (cfgTone ?? "ok") : null}
          sub={admin.data ? (cfgTone === "bad" ? "something is wrong" : cfgTone === "warn" ? "optional only" : "nothing missing") : undefined} />
      </ul>

      <div className="td-cols">
        <div className="td-col">
          <UsagePanel load={usage} />
          <InvitesPanel load={admin} />
          <MemoryPanel load={memory} />
        </div>
        <div className="td-col">
          <ConfigPanel load={admin} />
          <FeedbackPanel load={feedback} />
          <PlanPanel current={plan.id} onChanged={refresh} />
        </div>
      </div>
    </div>
  );
}
