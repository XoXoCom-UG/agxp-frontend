"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useEntitlement } from "@/lib/entitlement";
import { AgentNav } from "@/components/layout/agent-nav";
import { TeamDashboard } from "@/components/layout/team-dashboard";

/**
 * /dashboard/team — team only.
 *
 * Reached from the account menu, under "Profile & settings", for accounts the
 * team check lets through. Anyone else who types the address gets a short line
 * and a way back; the real refusal is in the database and the API route
 * (is_team_member / am_i_team), so this check only decides what to draw.
 */
export default function TeamPage() {
  const { loading: authLoading, token } = useAuth();
  const { canSwitch, loading } = useEntitlement();

  if (authLoading || !token || loading) return (
    <main className="app app-wait">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span className="visually-hidden" role="status">Loading…</span>
    </main>
  );

  return (
    <div className="app agx-page">
      <AgentNav />
      <main className="view-root view-enter td-main" id="main-content" tabIndex={-1}>
        {canSwitch ? <TeamDashboard /> : (
          <div className="td">
            <header className="td-head"><div><h1>Team dashboard</h1></div></header>
            <p className="td-hint">This page is for the AgentiX team.</p>
            <p><Link className="td-linkbtn" href="/dashboard">Back to the workspace</Link></p>
          </div>
        )}
      </main>
    </div>
  );
}
