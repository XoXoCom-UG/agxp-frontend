"use client";

import { AgentHero } from "@/components/layout/agent-hero";
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
 * The hero itself is shared with the public landing page (AgentHero). The
 * landing page is the promise and this is the first thing you see after
 * accepting it, so they have to be the same picture.
 *
 * Whether this screen appears at all is decided by the page, not here
 * (app/dashboard/page.tsx): an empty account goes straight to the workspace,
 * because a splash with a Start button is no use to someone who has not
 * started anything.
 */
export function HomeScreen({ onNew }: { onNew: () => void }) {
  return (
    <section className="home" aria-labelledby="home-title">
      <AgentHero
        kicker="AgentiX Projects"
        title={<h1 id="home-title" className="home-title">Two agents.<br /><span>One project.</span></h1>}
        lede="One plans the work. The other plans the people."
      >
        <button className="home-start" onClick={onNew}>
          Start a new chat <IconArrow size={16} />
        </button>
      </AgentHero>
    </section>
  );
}
