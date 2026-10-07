"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconArrow, IconClock, IconDoc, IconPlus } from "@/components/layout/agxp-icons";
import { listProjects, type Project } from "@/lib/projects";
import { loadProjectStats, type ProjectStats } from "@/lib/project-stats";
import { listAgents, type Agent } from "@/lib/agents";
import { dateStr } from "@/lib/utils";

/**
 * What you see when you come back.
 *
 * The workspace used to be the first thing after signing in, which is right
 * for a new account and wrong for a returning one: someone with twelve
 * projects in flight landed on "Build your AI team" with no sign that any of
 * them existed. The bar's Current Project button covers part of that, but it
 * lives in localStorage — on another machine, or after clearing site data,
 * there is nothing.
 *
 * So this screen answers "what was I doing?" before "what do I start?", and
 * it is deliberately NOT a menu. Patryk, 2026-09-30, on a dropdown in the
 * bar: "lieber kein Dropdown, weil das verwirrt." The same objection applies
 * to a hub of links, so there is one obvious thing to continue, a short row
 * of recent work, and one button to start something new.
 *
 * Nobody with an empty account ever sees it — NewTaskScreen is still the
 * first screen there, unchanged. A new user pays nothing for this.
 */

const RECENT = 4;

export function HomeScreen({ onNew }: { onNew: () => void }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    let alive = true;
    listProjects()
      .then(async all => {
        if (!alive) return;
        const live = all.filter(p => p.status !== "Archived").slice(0, RECENT + 1);
        setProjects(live);
        // Agents and numbers are decoration around the list: a failure in
        // either must not cost you the way back into your work.
        listAgents().then(a => { if (alive) setAgents(a); }).catch(() => {});
        loadProjectStats(live.map(p => p.id))
          .then(s => { if (alive) setStats(s); })
          .catch(() => {});
      })
      .catch(() => { if (alive) setProjects([]); });
    return () => { alive = false; };
  }, []);

  // Still loading, or nothing to come back to: the caller decides what to
  // show instead, so this renders nothing rather than a flash of empty state.
  if (!projects || projects.length === 0) return null;

  const [latest, ...rest] = projects;
  const nameOf = (id: string | null) => (id ? agents.find(a => a.id === id)?.name : undefined);
  const open = (id: string) => router.push(`/dashboard/project/${id}`);

  return (
    <section className="home" aria-labelledby="home-title">
      <p className="home-eyebrow">Welcome back</p>
      <h1 id="home-title" className="home-title">Pick up where you left off.</h1>

      <button className="home-last" onClick={() => open(latest.id)}>
        <span className="hl-faces" aria-hidden="true">
          <AgentMascot role="consultant" size={44} level={2} agentId={latest.consultant_agent_id ?? undefined} />
          <AgentMascot role="coach" size={44} level={2} agentId={latest.coach_agent_id ?? undefined} />
        </span>
        <span className="hl-body">
          <b>{latest.name}</b>
          <span className="hl-meta">
            {[nameOf(latest.consultant_agent_id), nameOf(latest.coach_agent_id)].filter(Boolean).join(" + ")
              || "No agents yet"}
            <i>·</i><IconClock size={11} />{dateStr(latest.last_activity_at)}
            {stats[latest.id]?.docs ? <><i>·</i><IconDoc size={11} />{stats[latest.id].docs}</> : null}
          </span>
          {stats[latest.id]?.progress !== null && stats[latest.id] !== undefined && (
            <span className="hl-bar" aria-hidden="true">
              <i style={{ width: `${stats[latest.id].progress}%` }} />
            </span>
          )}
        </span>
        <span className="hl-go"><IconArrow size={15} /></span>
      </button>

      {rest.length > 0 && (
        <>
          <p className="home-sub">Also open</p>
          <ul className="home-recent">
            {rest.slice(0, RECENT).map(p => (
              <li key={p.id}>
                <button onClick={() => open(p.id)}>
                  <b>{p.name}</b>
                  <span>{dateStr(p.last_activity_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="home-actions">
        <button className="home-new" onClick={onNew}>
          <IconPlus size={15} /> Start a new task
        </button>
        <Link href="/dashboard/history" className="home-all">All projects</Link>
      </div>
    </section>
  );
}
