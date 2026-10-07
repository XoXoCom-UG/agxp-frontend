"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NewTaskScreen } from "@/components/layout/new-task-screen";
import { HomeScreen } from "@/components/layout/home-screen";
import { AgentNav } from "@/components/layout/agent-nav";
import { useAuth } from "@/lib/auth-context";
import { listProjects } from "@/lib/projects";

/*
 * The start screen was New Task itself (Patryk, 2026-09-02) — no project
 * list, no create-project form in between. That still holds for an empty
 * account, and it is what this renders there.
 *
 * It stopped holding for a returning one: with twelve projects in flight you
 * landed on "Build your AI team" with no sign any of them existed. So when
 * there IS work to come back to, Home goes first — "what was I doing?" ahead
 * of "what do I start?" — and `?new=1` skips it, which is where the bar's
 * New Task button points.
 *
 * Deciding here rather than inside NewTaskScreen keeps that component exactly
 * as it is: the two-panel workspace has one job and this is not it.
 */
export default function DashboardPage() {
  const params = useSearchParams();
  const wantsNew = params.get("new") === "1";
  const { token, loading: authLoading } = useAuth();

  /** null while unknown — neither screen is shown until we know which. */
  const [hasWork, setHasWork] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (authLoading || !token || wantsNew) return;
    let alive = true;
    listProjects()
      .then(all => { if (alive) setHasWork(all.some(p => p.status !== "Archived")); })
      // Unreadable projects must not strand you on a blank screen: fall
      // through to the workspace, which is what this always used to do.
      .catch(() => { if (alive) setHasWork(false); });
    return () => { alive = false; };
  }, [token, authLoading, wantsNew]);

  if (wantsNew || dismissed || hasWork === false) return <NewTaskScreen />;

  if (hasWork === null) {
    // The bar is drawn straight away so the page does not jump when the
    // answer arrives; only the middle waits.
    return (
      <div className="app">
        <AgentNav />
        <main className="view-root app-wait">
          <span className="spinner spinner-lg" aria-hidden="true" />
          <span className="visually-hidden" role="status">Loading…</span>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <AgentNav />
      <main className="view-root view-enter" id="main-content" tabIndex={-1}>
        <HomeScreen onNew={() => setDismissed(true)} />
      </main>
    </div>
  );
}
