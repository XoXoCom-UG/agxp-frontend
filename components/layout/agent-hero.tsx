"use client";

import { useRef, useState, type ReactNode } from "react";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { useMascotLevel } from "@/lib/mascot-level";
import { LEVEL_ORDER, levelFor, nextLevel } from "@/lib/agent-progress";
import type { AgentType } from "@/lib/agents";

/**
 * The user's own agent for one seat, when there is one. Home passes these in;
 * the public landing page does not, and its pair stays the showpiece it was.
 */
export interface HeroAgent {
  id: string;
  name: string;
  /** Projects this agent has worked on for this user — what its level is built from. */
  projects: number;
}

/**
 * One seat: the mascot, and — for a real agent — its name and how far along it
 * is. The look follows the level the agent has earned (mascot-level.ts), the
 * label follows the experience it has built (agent-progress.ts), so the seat
 * answers "who is this and how much have we done together" without a box.
 */
function Seat({ role, agent, cheer, at }: {
  role: AgentType;
  agent?: HeroAgent;
  cheer: boolean;
  at: { x: number; y: number } | null;
}) {
  const earned = useMascotLevel(agent?.id);
  const level = agent ? levelFor(agent.projects) : null;
  const next = agent ? nextLevel(agent.projects) : null;
  return (
    <span className={`hh-slot ${role}`}>
      <AgentMascot role={role} size={150} state="idle" level={agent ? earned : 4}
        mood={cheer ? "pleased" : null} lookAt={at} />
      {agent && level && next && (
        <span className="hh-tag">
          <b className="hh-tag-name">{agent.name}</b>
          <span className="hh-tag-lv" aria-hidden="true">
            {LEVEL_ORDER.map((l, i) => <i key={l} className={i <= LEVEL_ORDER.indexOf(level) ? "on" : ""} />)}
          </span>
          <span className="hh-tag-note">
            {next.next
              ? `${level} · ${next.remaining} more to ${next.next}`
              : `${level} · top level`}
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * The two agents on their orbit, with whatever words and button the caller
 * wants in the middle.
 *
 * Shared on purpose. It is the Home screen's hero and the public landing
 * page's hero, and those two must be the same picture — the landing page is
 * the promise and Home is the first thing you see after accepting it. Two
 * copies would drift the first time one of them was tuned, and this one has
 * been tuned a great many times.
 *
 * Everything here is drawn: the sphere, the net over it and the two paths.
 * A photograph blended with the accent is what used to be here, and it put
 * hard bands across the hero on any warm accent.
 */
export function AgentHero({ kicker, title, lede, children, team }: {
  kicker: string;
  /** The heading itself, so each caller owns its own level and id. */
  title: ReactNode;
  lede: string;
  /** The call to action. It is measured, so the pair look at it. */
  children: ReactNode;
  /** The user's own agents, by seat. Absent on the public page. */
  team?: Partial<Record<AgentType, HeroAgent>>;
}) {
  /*
   * The two agents notice the button. Hovering or focusing it makes them
   * look down and give one small bounce — the mascot already owns both
   * behaviours (lookAt, mood="pleased"), so this is the app's own character
   * reacting, not a new animation bolted beside it.
   *
   * A coordinate LookTarget is a point on the SCREEN, not a direction, so
   * this is the button's real centre, measured when it is noticed.
   */
  const cta = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [cheer, setCheer] = useState(false);

  function notice(on: boolean) {
    if (!on) { setAt(null); return; }
    const b = cta.current?.querySelector("a,button")?.getBoundingClientRect();
    setAt(b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null);
    setCheer(true);
    window.setTimeout(() => setCheer(false), 300);
  }

  return (
    <div className="home-hero">
      {/* The net lives inside the sphere's own element, so the two scale
          together and can never drift apart. */}
      <span className="hh-planet" aria-hidden="true">
        <svg className="hh-net" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <polygon className="hn-ring" points="12,26 34,8 68,7 90,28 93,62 72,90 34,92 9,64" />
          <path className="hn-web" d="M12,26 L93,62 M34,8 L72,90 M68,7 L9,64 M90,28 L34,92 M12,26 L72,90 M90,28 L9,64" />
          <circle className="hn-core" cx="50" cy="50" r="27" />
        </svg>
      </span>

      {/* One path per agent, each ending in a light. */}
      <svg className="hh-orbit" viewBox="0 0 1000 420" preserveAspectRatio="none"
        aria-hidden="true" focusable="false">
        <path className="ho-a" d="M470 24 C 215 60, 80 215, 302 364" />
        <circle className="ho-dot a" cx="302" cy="364" r="7" />
        <path className="ho-b" d="M530 24 C 785 60, 920 215, 698 364" />
        <circle className="ho-dot b" cx="698" cy="364" r="7" />
      </svg>

      {/* Agent, words, agent. The pair are grid columns, so the gap between
          them is simply the room the words do not take — it cannot run a
          mascot off a narrow screen the way a viewport-relative gap did. */}
      <div className="hh-stage">
        <div className="hh-words">
          <span className="hh-kicker">{kicker}</span>
          {title}
          <p className="home-lede">{lede}</p>
          <div ref={cta} className="hh-cta"
            onPointerEnter={() => notice(true)} onPointerLeave={() => notice(false)}
            onFocus={() => notice(true)} onBlur={() => notice(false)}>
            {children}
          </div>
        </div>

        <Seat role="consultant" agent={team?.consultant} cheer={cheer} at={at} />
        <Seat role="coach" agent={team?.coach} cheer={cheer} at={at} />
      </div>
    </div>
  );
}
