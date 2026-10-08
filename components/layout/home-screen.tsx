"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconArchive, IconArrow, IconCheck, IconChart, IconClock, IconDoc, IconPlus, IconUsers } from "@/components/layout/agxp-icons";
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

/**
 * The three ways to look at the list. Real statuses, not decoration: the
 * whole account is loaded here anyway, so filtering is free and the counts
 * are the truth.
 */
type Tab = "recent" | "completed" | "archived";
const TABS: { id: Tab; label: string; Ic: typeof IconClock }[] = [
  { id: "recent", label: "Recent", Ic: IconClock },
  { id: "completed", label: "Completed", Ic: IconCheck },
  { id: "archived", label: "Archived", Ic: IconArchive },
];
/** How many cards the box shows. Four is one row on a wide screen and two
 *  on a laptop; past that it stops being "where was I" and becomes History. */
const SHOWN = 4;

/** What each agent is for, in three words each — the verbs, not the title. */
const ROLE_CARDS = [
  { role: "consultant" as const, who: "Your Consultant", Ic: IconChart, lines: ["Research.", "Structure.", "Execute."] },
  { role: "coach" as const, who: "Your Coach", Ic: IconUsers, lines: ["Reflect.", "Improve.", "Move forward."] },
];

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
  /** Every project, archived included — the box filters, it does not fetch. */
  const [all, setAll] = useState<Project[] | null>(null);
  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tab, setTab] = useState<Tab>("recent");

  useEffect(() => {
    let alive = true;
    listProjects()
      .then(list => {
        if (!alive) return;
        setAll(list);
        // Agents and numbers are context around the way back into your work:
        // a failure in either must not cost you the way back.
        listAgents().then(a => { if (alive) setAgents(a); }).catch(() => {});
        // Only what a tab can actually put on screen: stats are a query per
        // project, and nobody sees the ninth card.
        loadProjectStats(list.slice(0, SHOWN * 3).map(p => p.id))
          .then(s => { if (alive) setStats(s); })
          .catch(() => {});
      })
      .catch(() => { if (alive) setAll([]); });
    return () => { alive = false; };
  }, []);

  // Still loading, or nothing to come back to: the caller decides what to
  // show instead, so this renders nothing rather than a flash of empty state.
  if (!all || all.length === 0) return null;

  const live = all.filter(p => p.status !== "Archived");
  if (live.length === 0) return null;

  const open = (id: string) => router.push(`/dashboard/project/${id}`);
  const byTab = (t: Tab) =>
    t === "archived" ? all.filter(p => p.status === "Archived")
      : t === "completed" ? live.filter(p => p.status === "Completed")
      : live;
  const counts = { recent: live.length, completed: byTab("completed").length, archived: byTab("archived").length };
  const shown = byTab(tab).slice(0, SHOWN);

  const trained = agents.filter(a => !a.archived_at && a.last_projects.length > 0).length;
  const documents = Object.values(stats).reduce((n, s) => n + s.docs, 0);

  return (
    <section className="home" aria-labelledby="home-title">
      {/*
       * The hero: one orbit, the two agents on it, the words at its centre,
       * and what each of them is for at either end. That is the product's
       * own picture — two agents, one project — and the same drawing as the
       * mark in the bar.
       *
       * Everything here is drawn. It replaced a photographic wash
       * (/brand/core.jpg blended to the accent), which brought its own
       * wireframe lines, went muddy on any warm accent, and — being sized to
       * the window — pushed the pair out to the screen edges with half a
       * screen of nothing between them.
       */}
      <div className="home-hero">
        <span className="hh-glow" aria-hidden="true" />
        {/* The planet. /brand/core.jpg is the product's own art — the core
            with the two agents on their orbit — and this is the shape it was
            drawn as. It was washed across the whole window before, 132vw
            wide at low opacity, which is what turned it into red mud on a
            warm accent; contained to a circle behind the title it reads as
            the thing it is. */}
        <span className="hh-planet" aria-hidden="true" />

        <div className="hh-stage">
          {/* preserveAspectRatio="none": the orbit is scenery and should
              stretch to whatever band the hero has, not keep a ratio and
              leave gaps beside the mascots. Each path carries its own
              travelling light, inside the group that spins, so the dot goes
              round the orbit without a second animation to keep in step. */}
          <svg className="hh-orbit" viewBox="0 0 1000 420" preserveAspectRatio="none"
            aria-hidden="true" focusable="false">
            <g className="ho-ga">
              <ellipse className="ho-a" cx="500" cy="210" rx="464" ry="150" transform="rotate(-9 500 210)" />
              <circle className="ho-dot a" cx="36" cy="210" r="6" transform="rotate(-9 500 210)" />
            </g>
            <g className="ho-gb">
              <ellipse className="ho-b" cx="500" cy="210" rx="464" ry="150" transform="rotate(9 500 210)" />
              <circle className="ho-dot b" cx="964" cy="210" r="6" transform="rotate(9 500 210)" />
            </g>
            <ellipse className="ho-c" cx="500" cy="210" rx="300" ry="196" />
          </svg>

          {/*
            The words come first in the DOM so the heading is the first thing
            read, and the five columns are placed by grid rather than by
            source order — otherwise a screen reader meets "Your Consultant"
            before it is told what the screen is.
          */}
          <div className="hh-words">
            <span className="hh-kicker">AgentiX Projects</span>
            <h1 id="home-title" className="home-title">
              Two agents.<br /><span>One project.</span>
            </h1>
            <p className="home-lede">One plans the work. The other plans the people.</p>
            <button ref={startRef} className="home-start" onClick={onNew}
              onPointerEnter={() => notice(true)} onPointerLeave={() => notice(false)}
              onFocus={() => notice(true)} onBlur={() => notice(false)}>
              Start a new chat <IconArrow size={16} />
            </button>
          </div>

          {/* What each one is actually for. The Home screen never said, and
              "Consultant" and "Coach" are job titles, not a description of
              the two documents you get. They drop out below 1200px, where
              five columns would leave the title about six characters. */}
          {ROLE_CARDS.map(r => (
            <article key={r.role} className={`hh-role ${r.role}`}>
              <span className="hh-role-ic" aria-hidden="true"><r.Ic size={16} /></span>
              <div>
                <b>{r.who}</b>
                {/* One verb a line, as in the mockup — and it is also what
                    makes the two cards the same height, where "Reflect.
                    Improve. Move forward." wrapped to one line more than
                    "Research. Structure. Execute." and left the pair
                    visibly uneven. */}
                <p>{r.lines.map(l => <span key={l}>{l}</span>)}</p>
              </div>
            </article>
          ))}

          <span className="hh-slot consultant">
            <AgentMascot role="consultant" size={150} state="idle" level={4}
              mood={cheer ? "pleased" : null} lookAt={at} />
          </span>
          <span className="hh-slot coach">
            <AgentMascot role="coach" size={150} state="idle" level={4}
              mood={cheer ? "pleased" : null} lookAt={at} />
          </span>
        </div>
      </div>

      {/*
        The box: what you have, and the way back into it.
        
        It is one panel rather than a loose eyebrow and a list, because this
        half of the screen answers a different question from the hero — not
        "what is this" but "what am I in the middle of" — and a boxed panel
        is what says so without a heading shouting it.
        
        The tabs are real statuses, not decoration: everything the account
        has is loaded here already, so filtering costs nothing and the counts
        beside them are the truth rather than a guess.
      */}
      <section className="home-panel" aria-labelledby="home-panel-title">
        <header className="hp-head">
          <h2 id="home-panel-title">Your Projects</h2>

          <ul className="home-state">
            <li>
              <button onClick={() => router.push("/dashboard/history")}>
                <b>{live.length}</b><span>{live.length === 1 ? "project" : "projects"}</span>
              </button>
            </li>
            <li>
              <button onClick={() => router.push("/dashboard/agents")}>
                <b>{trained}</b><span>{trained === 1 ? "agent" : "agents"} trained</span>
              </button>
            </li>
            <li>
              <button onClick={() => router.push("/dashboard/history")}>
                <b>{documents}</b><span>{documents === 1 ? "document" : "documents"}</span>
              </button>
            </li>
          </ul>

          <button className="hp-new" onClick={onNew}><IconPlus size={14} />New Project</button>
        </header>

        <div className="hp-tabs" role="tablist" aria-label="Which projects">
          {TABS.map(t => {
            const on = tab === t.id;
            return (
              <button key={t.id} role="tab" aria-selected={on} className={on ? "on" : ""}
                onClick={() => setTab(t.id)}>
                <t.Ic size={13} />{t.label}
                <em>{counts[t.id]}</em>
              </button>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <p className="hp-empty">Nothing {tab === "recent" ? "open" : tab} yet.</p>
        ) : (
          <ul className="hp-grid">
            {shown.map((p, i) => {
              const s = stats[p.id];
              return (
                <li key={p.id}>
                  {/* The first card is the one you were last in, and it is
                      marked rather than made bigger — a different size would
                      break the row the moment there are three of them. */}
                  <button className={`hp-card${i === 0 && tab === "recent" ? " is-last" : ""}`}
                    onClick={() => open(p.id)}>
                    <span className="hp-ic" aria-hidden="true">
                      <span className="hp-faces">
                        <AgentMascot role="consultant" size={22} level={2} agentId={p.consultant_agent_id ?? undefined} />
                        <AgentMascot role="coach" size={22} level={2} agentId={p.coach_agent_id ?? undefined} />
                      </span>
                    </span>
                    <b>{p.name}</b>
                    <span className="hp-date">{dateStr(p.last_activity_at)}</span>
                    <span className="hp-tags">
                      {([["consultant", "Concept"], ["coach", "Plan"]] as const).map(([role, short]) => (
                        <span key={role} className={`hp-tag ${role}${s?.docsBy[role] ? " on" : ""}`}>
                          {s?.docsBy[role] ? <IconCheck size={10} /> : <IconDoc size={10} />}{short}
                        </span>
                      ))}
                      {p.status === "Completed" && <span className="hp-tag done"><IconCheck size={10} />Done</span>}
                    </span>
                    <span className="hp-go" aria-hidden="true"><IconArrow size={14} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </section>
  );
}
