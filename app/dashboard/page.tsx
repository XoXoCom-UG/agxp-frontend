"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const wantsNew = params.get("new") === "1";
  const { token, loading: authLoading } = useAuth();

  /*
   * The logo links to /dashboard from everywhere, and it has to land on Home
   * every time. Two things got in the way: the workspace moves the address to
   * /dashboard/project/<id> with history.replaceState once a project exists
   * (so this page stays mounted under a project URL), and "Start" on Home was
   * a state flag here that nothing ever cleared. So "Start" is now ?new=1 in
   * the address, and every arrival back on a bare /dashboard counts as a new
   * visit: the projects are asked for again and the workspace starts fresh.
   */
  const atHome = pathname === "/dashboard" && !wantsNew;
  const [visit, setVisit] = useState(0);
  const [wasHome, setWasHome] = useState(atHome);
  if (atHome !== wasHome) {
    setWasHome(atHome);
    if (atHome) setVisit(v => v + 1);
  }

  /** Known only for the visit it was read in — null shows neither screen. */
  const [work, setWork] = useState<{ visit: number; has: boolean } | null>(null);
  const hasWork = work?.visit === visit ? work.has : null;

  useEffect(() => {
    if (authLoading || !token || !atHome) return;
    let alive = true;
    listProjects()
      .then(all => { if (alive) setWork({ visit, has: all.some(p => p.status !== "Archived") }); })
      // Unreadable projects must not strand you on a blank screen: fall
      // through to the workspace, which is what this always used to do.
      .catch(() => { if (alive) setWork({ visit, has: false }); });
    return () => { alive = false; };
  }, [token, authLoading, atHome, visit]);

  // Not at home means ?new=1, or a project this screen has just created —
  // either way the workspace, and the same one: the key only changes on a
  // new visit, so a live stream is never thrown away mid-answer.
  if (!atHome || hasWork === false) return <NewTaskScreen key={visit} />;

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
      {/* home-root: Home is sized to fit one screen, so this scroll is the
          safety net, not the plan — .app is fixed and clips, and a window
          too short for the content would otherwise lose its bottom rather
          than scrolling. The workspace still manages its own panes. */}
      <main className="view-root view-enter home-root" id="main-content" tabIndex={-1}>
        <HomeScreen onNew={() => router.push("/dashboard?new=1")} />
      </main>
    </div>
  );
}
