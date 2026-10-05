"use client";

import { useId } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import { levelFor } from "@/lib/agent-progress";
import { methodLabel } from "@/lib/method-labels";
import { useMediaQuery } from "@/lib/use-media-query";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconBack, IconCheck, IconLock } from "@/components/layout/agxp-icons";

const ROLES: AgentType[] = ["consultant", "coach"];
const ROLE_NAME: Record<AgentType, string> = { consultant: "Consultant", coach: "Coach" };

/** "Build your AI team", with the accent on the part you are building. */
export function TeamHeading({ suffix }: { suffix?: string }) {
  return (
    <h2 className="team-title">
      {suffix ? <span className="team-grad-all">Your AI team {suffix}</span> : <>Build your <span className="team-grad">AI team</span></>}
    </h2>
  );
}

/** The step chip above the heading: which seat you are filling right now. */
export function TeamStep({ role }: { role: AgentType }) {
  const n = ROLES.indexOf(role) + 1;
  return (
    <span className="team-step">
      <span className="ts-pips" aria-hidden="true">
        {ROLES.map((r, i) => <span key={r} className={`ts-pip${i < n ? " on" : ""}`} />)}
      </span>
      Step {n} of {ROLES.length} · {ROLE_NAME[role]}
    </span>
  );
}

/**
 * The team rail (Ana, 2026-10-05): a thin glass column beside the picker, two
 * seats that fill as you choose. No explanation in it — the seats are the
 * whole message. The Consultant is picked first, then the Coach, both in the
 * big panel on the left; the rail only shows where you are.
 */
export function TeamRail({ agents, onChange }: {
  agents: Record<AgentType, Agent | null>;
  onChange: (role: AgentType) => void;
}) {
  const filled = ROLES.filter(r => agents[r]).length;
  const active = ROLES.find(r => !agents[r]) ?? null;

  return (
    <aside className={`team-rail${filled === ROLES.length ? " is-full" : ""}`} aria-label="Your AI team">
      <div className="tr-head">
        <h2 className="tr-title">Your AI team</h2>
        {/* Keyed on the count so the bump replays every time a seat fills. */}
        <span key={filled} className={`tr-count${filled ? " bump" : ""}`}>
          {filled}/{ROLES.length}<span className="visually-hidden"> chosen</span>
        </span>
      </div>

      <ol className="tr-seats">
        {ROLES.map((role, i) => {
          const agent = agents[role];
          // Ana's rule still holds: the Coach seat opens once there is a Consultant.
          const locked = !agent && i > 0 && !agents[ROLES[i - 1]];
          const state = agent ? "filled" : role === active ? "active" : locked ? "locked" : "empty";
          return (
            <li key={role} className="tr-seat" data-state={state} aria-current={state === "active" ? "step" : undefined}>
              {/* Keyed on the agent so the pop and the ring replay on a change. */}
              <span key={agent?.id ?? "empty"} className="ts-orb">
                {agent && <AgentMascot role={role} size={42} enter agentId={agent.id} />}
                {agent && <span className="ts-check" aria-hidden="true"><IconCheck size={10} /></span>}
              </span>
              {i < ROLES.length - 1 && <span className="ts-link" aria-hidden="true" />}
              <span className="ts-text">
                <span className="ts-role">{ROLE_NAME[role]}</span>
                <span className="ts-sub">
                  {agent ? agent.name
                    : state === "active" ? "Choose on the left"
                    : locked ? `Select a ${ROLE_NAME[ROLES[i - 1]]} first`
                    : "Not selected yet"}
                </span>
              </span>
              {agent && agent.methods.length > 0 && (
                <ul className="ts-methods" aria-label={`What ${agent.name} works with`}>
                  {[...agent.primaryMethods, ...agent.secondaryMethods].map(m => (
                    <li key={m.id}>{methodLabel(m.name)}</li>
                  ))}
                </ul>
              )}
              <span className="ts-end">
                {agent ? (
                  <button className="ts-change" onClick={() => onChange(role)}
                    aria-label={`Change the ${ROLE_NAME[role].toLowerCase()}, ${agent.name}`}>
                    Change
                  </button>
                ) : state === "active" ? <IconBack size={14} />
                  : locked ? <IconLock size={14} /> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/* The two loops of the figure eight, each starting and ending where they
   cross, so drawing a stroke from 0 runs out from the star and back to it. */
const LOOP_L = "M500,160 C420,70 40,40 40,160 C40,280 420,250 500,160";
const LOOP_R = "M500,160 C580,70 960,40 960,160 C960,280 580,250 500,160";
/* The same figure eight stood upright (x and y swapped), for tall screens. */
const LOOP_T = "M160,500 C70,420 40,40 160,40 C280,40 250,420 160,500";
const LOOP_B = "M160,500 C70,580 40,960 160,960 C280,960 250,580 160,500";

function Loops({ id, vertical, still }: { id: string; vertical: boolean; still: boolean }) {
  const [a, b] = vertical ? [LOOP_T, LOOP_B] : [LOOP_L, LOOP_R];
  // Each gradient runs from the crossing, bright, out to the loop's far end.
  // Colours are CSS variables (set in style, which SVG attributes can't take)
  // so the loops follow the accent picked in Settings.
  const ends = vertical
    ? { x1: 0, y1: 500, ax: 0, ay: 40, bx: 0, by: 960 }
    : { x1: 500, y1: 0, ax: 40, ay: 0, bx: 960, by: 0 };
  return (
    <svg className={`orbit-svg ${vertical ? "v" : "h"}`} viewBox={vertical ? "0 0 320 1000" : "0 0 1000 320"} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} gradientUnits="userSpaceOnUse" x1={ends.x1} y1={ends.y1} x2={ends.ax} y2={ends.ay}>
          <stop offset="0" style={{ stopColor: "var(--acc-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--acc)" }} stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`${id}b`} gradientUnits="userSpaceOnUse" x1={ends.x1} y1={ends.y1} x2={ends.bx} y2={ends.by}>
          <stop offset="0" style={{ stopColor: "var(--acc-2-hi)" }} />
          <stop offset="1" style={{ stopColor: "var(--acc-2)" }} stopOpacity="0.45" />
        </linearGradient>
        <filter id={`${id}g`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <g filter={`url(#${id}g)`} className="orbit-haze">
        <path className="orbit-loop" d={a} pathLength={1} style={{ stroke: "var(--acc)" }} />
        <path className="orbit-loop" d={b} pathLength={1} style={{ stroke: "var(--acc-2)" }} />
      </g>
      <path className="orbit-loop" d={a} pathLength={1} stroke={`url(#${id}a)`} />
      <path className="orbit-loop" d={b} pathLength={1} stroke={`url(#${id}b)`} />
      {!still && (
        <>
          <circle className="orbit-dot l" r="7">
            <animateMotion dur="12s" repeatCount="indefinite" path={a} begin="-7s" />
          </circle>
          <circle className="orbit-dot r" r="7">
            <animateMotion dur="12s" repeatCount="indefinite" path={b} begin="-2s" />
          </circle>
        </>
      )}
    </svg>
  );
}

/**
 * Both seats taken (Ana, 2026-10-05): the two of them on one figure eight,
 * blue for the work, violet for the people, crossing at a star. Nothing to
 * press here — Start is in the bar.
 */
export function TeamReady({ consultant, coach, projectCounts }: {
  consultant: Agent;
  coach: Agent;
  projectCounts: Record<string, number>;
}) {
  // SMIL ignores prefers-reduced-motion, so the orbiting dots are left out.
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const uid = useId().replace(/:/g, "");
  const name = (role: AgentType, a: Agent) => {
    const total = a.last_projects.length + (projectCounts[a.id] ?? 0);
    return (
      <div className={`orbit-name ${role}`}>
        <span className="on-role">{ROLE_NAME[role]}</span>
        <span className="on-name">{a.name}</span>
        <span className="on-lvl">{levelFor(total)} · {total} {total === 1 ? "project" : "projects"} together</span>
      </div>
    );
  };

  return (
    <section className="panel team-ready">
      <div className="tready">
        {/* The stage takes whatever room the panel has: as wide as it can be
            while its height still fits, so the scene fills any display. The
            title is part of it, so it stays with the loops at every size. */}
        <div className="orbit-wrap">
        <div className="orbit">
          <TeamHeading suffix="is ready" />
          {/* Both drawings are always there; the stylesheet shows the one
              that fits the room — side by side, or one above the other. */}
          <Loops id={`${uid}h`} vertical={false} still={still} />
          <Loops id={`${uid}v`} vertical still={still} />

          <span className="orbit-star" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M12 1.5 14 10l8.5 2-8.5 2-2 8.5-2-8.5L1.5 12 10 10Z" fill="#fff" />
            </svg>
          </span>

          <span className="orbit-bot consultant">
            <AgentMascot role="consultant" size={150} agentId={consultant.id} />
          </span>
          <span className="orbit-bot coach">
            <AgentMascot role="coach" size={150} agentId={coach.id} />
          </span>

          {name("consultant", consultant)}
          {name("coach", coach)}
        </div>
        </div>
      </div>
    </section>
  );
}
