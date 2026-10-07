"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconArrow, IconCheck, IconDoc } from "@/components/layout/agxp-icons";
import { listProjects, type Project } from "@/lib/projects";
import { loadProjectStats, type ProjectStats } from "@/lib/project-stats";
import { listAgents, type Agent, type AgentType } from "@/lib/agents";
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
 * One moment, quiet edges. The moment is the project you were in, not a
 * flourish: a launch animation is wonderful once and a toll booth by the
 * fortieth sign-in, and this app has been pushed the other way before
 * (Patryk, 2026-09-02: the start screen is the work itself).
 *
 * The edges are NOT a second navigation bar. History, Agents and Settings
 * are already up there; repeating them would add clicks and no information.
 * What the bar cannot show is state, so that is what the edges carry —
 * how many projects, how many agents you have trained, how many documents
 * came out — each one also the way in.
 *
 * Nobody with an empty account sees any of it: NewTaskScreen is still the
 * first screen there, unchanged.
 */

const RECENT = 4;
const ROLES: AgentType[] = ["consultant", "coach"];

/**
 * The project's progress as one ring in two halves — the Consultant on the
 * left, the Coach on the right. The average alone hides the case that
 * matters: "50%" can be one conversation finished and the other not started.
 *
 * Radius 22, so a half circle is π·22 ≈ 69.1 long; each half is drawn from
 * the top and dashed to its own share.
 */
const HALF = Math.PI * 22;

function DuoRing({ by }: { by: Record<AgentType, number | null> }) {
  const any = ROLES.some(r => by[r] !== null);
  if (!any) return null;
  return (
    <svg className="hl-ring" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      {ROLES.map(role => {
        const pct = Math.max(0, Math.min(100, by[role] ?? 0));
        // Left half sweeps anticlockwise from the top, right half clockwise,
        // so both fill away from 12 o'clock and meet at the bottom.
        const d = role === "consultant"
          ? "M26,4 A22,22 0 0,0 26,48"
          : "M26,4 A22,22 0 0,1 26,48";
        return (
          <g key={role}>
            <path className="hr-track" d={d} />
            <path className={`hr-fill ${role}`} d={d}
              style={{ strokeDasharray: HALF, strokeDashoffset: HALF * (1 - pct / 100) }} />
          </g>
        );
      })}
    </svg>
  );
}

export function HomeScreen({ onNew }: { onNew: () => void }) {
  const router = useRouter();
  /*
   * The two agents notice the button. Hovering or focusing "Start a new
   * chat" makes them look down at it and give one small bounce — the mascot
   * already owns both behaviours (lookAt, mood="pleased"), so this is the
   * app's own character reacting, not a new animation bolted beside it.
   *
   * `pleased` is a one-off the caller has to clear, or it would never fire
   * a second time.
   */
  const startRef = useRef<HTMLButtonElement>(null);
  /**
   * Where to look. A coordinate LookTarget is a point on the SCREEN, not a
   * direction — passing a small vector sent them staring at the top-left
   * corner. So this is the button's real centre, measured when it is
   * noticed, and both heads turn to it on their own.
   */
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [cheer, setCheer] = useState(false);

  function notice(on: boolean) {
    if (!on) { setAt(null); return; }
    const b = startRef.current?.getBoundingClientRect();
    setAt(b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null);
    setCheer(true);
    window.setTimeout(() => setCheer(false), 300);
  }
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [all, setAll] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    let alive = true;
    listProjects()
      .then(list => {
        if (!alive) return;
        const live = list.filter(p => p.status !== "Archived");
        setAll(live);
        setProjects(live.slice(0, RECENT + 1));
        // Agents and numbers are context around the way back into your work:
        // a failure in either must not cost you the way back.
        listAgents().then(a => { if (alive) setAgents(a); }).catch(() => {});
        loadProjectStats(live.slice(0, RECENT + 1).map(p => p.id))
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
  const st = stats[latest.id];
  const nameOf = (id: string | null) => (id ? agents.find(a => a.id === id)?.name : undefined);
  const open = (id: string) => router.push(`/dashboard/project/${id}`);

  const trained = agents.filter(a => !a.archived_at && a.last_projects.length > 0).length;
  const documents = Object.values(stats).reduce((n, s) => n + s.docs, 0);
  const done = all.filter(p => p.status === "Completed").length;

  return (
    <section className="home" aria-labelledby="home-title">
      {/*
       * The hero. The art is real: /brand/core.jpg is the project core with
       * the two agents on their orbit, and the two robots are the same ones
       * the invitation email carries. They are 168px native, so they are
       * never drawn larger than that — scaled up they go soft, and a blurred
       * mascot is worse than a smaller sharp one.
       */}
      <div className="home-hero">
        <span className="hh-art" aria-hidden="true" />
        <BrandLogo size={34} />
        <h1 id="home-title" className="home-title">
          Two agents.<br /><span>One project.</span>
        </h1>
        <p className="home-lede">One plans the work. The other plans the people.</p>

        {/*
          The app's own mascots, the same component the chat and the picker
          draw. Vector, so they are sharp at any size; they blink and follow
          the cursor like everywhere else. The flat PNGs they replaced were
          168px email fallbacks and went soft the moment they were enlarged.
        */}
        {/* Each mascot sits in its own slot so the slow float lives on the
            wrapper: the mascot's own breathing animation stays untouched
            underneath, and the two would otherwise cancel each other out. */}
        <div className="hh-bots" aria-hidden="true">
          <span className="hh-slot">
            <AgentMascot role="consultant" size={152} state="idle" level={4}
              mood={cheer ? "pleased" : null}
              lookAt={at} />
          </span>
          <span className="hh-spark" />
          <span className="hh-slot">
            <AgentMascot role="coach" size={152} state="idle" level={4}
              mood={cheer ? "pleased" : null}
              lookAt={at} />
          </span>
        </div>

        <button ref={startRef} className="home-start" onClick={onNew}
          onPointerEnter={() => notice(true)} onPointerLeave={() => notice(false)}
          onFocus={() => notice(true)} onBlur={() => notice(false)}>
          Start a new chat <IconArrow size={16} />
        </button>
      </div>

      <p className="home-eyebrow">Or pick up where you left off</p>

      <button className="home-last" onClick={() => open(latest.id)}>
        <span className="hl-gauge" aria-hidden="true">
          {st && <DuoRing by={st.progressBy} />}
          <span className="hl-faces">
            <AgentMascot role="consultant" size={34} level={2} agentId={latest.consultant_agent_id ?? undefined} />
            <AgentMascot role="coach" size={34} level={2} agentId={latest.coach_agent_id ?? undefined} />
          </span>
        </span>

        <span className="hl-body">
          <b>{latest.name}</b>
          <span className="hl-pair">
            {[nameOf(latest.consultant_agent_id), nameOf(latest.coach_agent_id)]
              .filter(Boolean).join("  +  ") || "No agents yet"}
          </span>
          {/* What the project is FOR: the two documents, and which exist. */}
          <span className="hl-docs">
            {([["consultant", "Transformation Concept"], ["coach", "Change Plan"]] as const).map(([role, title]) => {
              const has = st?.docsBy[role];
              return (
                <span key={role} className={`hl-doc ${role}${has ? " on" : ""}`}>
                  {has ? <IconCheck size={11} /> : <IconDoc size={11} />}
                  {title}
                </span>
              );
            })}
          </span>
        </span>

        <span className="hl-go"><span>{dateStr(latest.last_activity_at)}</span><IconArrow size={15} /></span>
      </button>

      {rest.length > 0 && (
        <ul className="home-recent" aria-label="Also open">
          {rest.slice(0, RECENT).map(p => (
            <li key={p.id}>
              <button onClick={() => open(p.id)}>
                <b>{p.name}</b>
                <span>{dateStr(p.last_activity_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="home-actions">
        {/* State, not a second menu. History, Agents and Settings are in the
            bar already; these say how much there is and go to the same place. */}
        <ul className="home-state">
          <li>
            <button onClick={() => router.push("/dashboard/history")}>
              <b>{all.length}</b>
              <span>{done > 0 ? `projects · ${done} done` : all.length === 1 ? "project" : "projects"}</span>
            </button>
          </li>
          <li>
            <button onClick={() => router.push("/dashboard/agents")}>
              <b>{trained}</b>
              <span>{trained === 1 ? "agent trained" : "agents trained"}</span>
            </button>
          </li>
          {documents > 0 && (
            <li>
              <button onClick={() => router.push("/dashboard/history")}>
                <b>{documents}</b>
                <span>{documents === 1 ? "document" : "documents"}</span>
              </button>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
