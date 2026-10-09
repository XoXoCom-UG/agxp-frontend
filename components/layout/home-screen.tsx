"use client";

import { useRef, useState } from "react";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconArrow } from "@/components/layout/agxp-icons";

/**
 * What you see when you come back.
 *
 * One screen, one thing to do. It used to carry a box of your projects as
 * well — removed on request (2026-10-09), so this no longer shows anything
 * about the work you have in flight. That is a deliberate trade and worth
 * knowing: the way back to a project is now the bar alone, which has Project
 * History and a button straight to the one you were last in.
 *
 * Whether this screen appears at all is still decided by the page, not here
 * (app/dashboard/page.tsx): an empty account goes straight to the workspace,
 * because a splash with a Start button is no use to someone who has not
 * started anything. That is also why this component loads nothing — it has
 * nothing left to load.
 */
export function HomeScreen({ onNew }: { onNew: () => void }) {
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

  return (
    <section className="home" aria-labelledby="home-title">
      <div className="home-hero">
        {/*
          The planet, and the net over it. Drawn, not photographed: the JPEG
          that used to be here was blended with the accent through two blend
          modes, which is what put the hard bands across the hero and what
          made the result change with the theme and the glass setting. The
          net lives inside the sphere's own element, so it scales with it and
          the two can never drift apart.
        */}
        <span className="hh-planet" aria-hidden="true">
          <svg className="hh-net" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            <polygon className="hn-ring" points="12,26 34,8 68,7 90,28 93,62 72,90 34,92 9,64" />
            <path className="hn-web" d="M12,26 L93,62 M34,8 L72,90 M68,7 L9,64 M90,28 L34,92 M12,26 L72,90 M90,28 L9,64" />
            <circle className="hn-core" cx="50" cy="50" r="27" />
          </svg>
        </span>

        {/*
          One path per agent, each ending in a light. Not two full ellipses
          any more: at full size they crossed the mascots and the screen read
          as tangled wire rather than as an orbit.
        */}
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
    </section>
  );
}
