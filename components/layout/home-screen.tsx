"use client";

import { useEffect, useState } from "react";
import { AgentHero, type HeroAgent } from "@/components/layout/agent-hero";
import { IconArrow } from "@/components/layout/agxp-icons";
import { listAgents, type AgentType } from "@/lib/agents";
import { projectCountsByAgent } from "@/lib/agent-progress";

/**
 * The agent you have done the most with, per seat. Ties go to the one made
 * first, so the pair does not swap places between visits.
 */
async function leadAgents(): Promise<Partial<Record<AgentType, HeroAgent>>> {
  const [agents, counts] = await Promise.all([listAgents(), projectCountsByAgent()]);
  const team: Partial<Record<AgentType, HeroAgent>> = {};
  for (const a of agents) {
    if (a.archived_at) continue;
    const projects = counts[a.id] ?? 0;
    const held = team[a.type];
    if (!held || projects > held.projects) team[a.type] = { id: a.id, name: a.name, projects };
  }
  return team;
}

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
 * Gamification, without a box (Ana, 2026-10-09: "mai mult in directia
 * gamification"): under each mascot sits the user's own agent for that seat —
 * its name, the three-step level bar the picker already uses, and how many
 * projects until the next level. The look of the mascot follows the level it
 * has earned. Nothing here costs height: it hangs under the pair, which is
 * what the screen is already about. If the agents cannot be read the pair
 * simply shows without a caption, as before.
 *
 * Whether this screen appears at all is decided by the page, not here
 * (app/dashboard/page.tsx): an empty account goes straight to the workspace,
 * because a splash with a Start button is no use to someone who has not
 * started anything.
 */
export function HomeScreen({ onNew }: { onNew: () => void }) {
  const [team, setTeam] = useState<Partial<Record<AgentType, HeroAgent>>>();
  useEffect(() => {
    let alive = true;
    leadAgents().then(t => { if (alive) setTeam(t); }).catch(() => { /* no caption, no harm */ });
    return () => { alive = false; };
  }, []);

  return (
    <section className="home" aria-labelledby="home-title">
      <AgentHero
        kicker="AgentiX Projects"
        title={<h1 id="home-title" className="home-title">Two agents.<br /><span>One project.</span></h1>}
        lede="Bring an idea. A consultant works it out with you, step by step."
        team={team}
      >
        <button className="home-start" onClick={onNew}>
          Start a new chat <IconArrow size={16} />
        </button>
      </AgentHero>
    </section>
  );
}
