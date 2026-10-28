"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useEntitlement } from "@/lib/entitlement";
import { AgentNav } from "@/components/layout/agent-nav";
import { FeedbackDashboard } from "@/components/layout/feedback-dashboard";

/**
 * /dashboard/feedback — team only.
 *
 * Reached from the team's button in Settings → Plan. Anyone else who types the
 * address gets a short line and a way back; the real refusal is in the database
 * (team_feedback() asks is_team_member about the caller), so this check only
 * decides what to draw.
 */
export default function FeedbackPage() {
  const { loading: authLoading, token } = useAuth();
  const { canSwitch, loading } = useEntitlement();

  if (authLoading || !token || loading) return (
    <main className="app app-wait">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span className="visually-hidden" role="status">Loading…</span>
    </main>
  );

  return (
    <div className="app">
      <AgentNav />
      <main className="view-root view-enter" id="main-content" tabIndex={-1}>
        {canSwitch ? <FeedbackDashboard /> : (
          <div className="fbd">
            <header className="fbd-head"><div><h1>Feedback</h1></div></header>
            <p className="fbd-note">This page is for the AgentiX team.</p>
            <p><Link className="fbd-link" href="/dashboard">Back to the workspace</Link></p>
          </div>
        )}
      </main>
    </div>
  );
}
