"use client";

import { useEffect, useState } from "react";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconArrow, IconCheck } from "@/components/layout/agxp-icons";
import { listProjects } from "@/lib/projects";
import type { Agent } from "@/lib/agents";

/**
 * The New Task entry screen: the two agents facing each other, and one button.
 *
 * It sits in FRONT of the two picker panels rather than replacing them —
 * "Build your team" dismisses it and the existing flow continues untouched.
 * That is deliberate while the redesign is being judged: if the screen is cut,
 * what goes with it is this file and one conditional, and nothing that already
 * works has been rewritten to make room for it.
 *
 * "Your recent teams" is real: pairs are read back from the user's own past
 * projects, which already store a consultant and a coach per row, so a pair is
 * derivable and needed no new table. A user with no history simply has no row
 * there, which is the correct empty state rather than an invented one.
 */

interface Pair {
  key: string;
  consultant: Agent;
  coach: Agent;
  projects: number;
}

const CONSULTANT_CHIPS = ["Analysis", "Solution design", "Deliverables"];
const COACH_CHIPS = ["Team planning", "Change management", "Enablement"];

export function TeamIntro({ agents, onBuild }: { agents: Agent[]; onBuild: () => void }) {
  const [pairs, setPairs] = useState<Pair[]>([]);

  useEffect(() => {
    let alive = true;
    listProjects()
      .then(projects => {
        if (!alive) return;
        const byId = new Map(agents.map(a => [a.id, a]));
        const seen = new Map<string, Pair>();
        for (const p of projects) {
          const consultant = p.consultant_agent_id ? byId.get(p.consultant_agent_id) : undefined;
          const coach = p.coach_agent_id ? byId.get(p.coach_agent_id) : undefined;
          if (!consultant || !coach) continue;
          const key = `${consultant.id}+${coach.id}`;
          const found = seen.get(key);
          if (found) found.projects++;
          else seen.set(key, { key, consultant, coach, projects: 1 });
        }
        // Most-used first, and only two: this is a shortcut, not a directory.
        setPairs([...seen.values()].sort((a, b) => b.projects - a.projects).slice(0, 2));
      })
      .catch(() => { /* a missing shortcut is not worth an error here */ });
    return () => { alive = false; };
  }, [agents]);

  return (
    <section className="ti" aria-labelledby="ti-title">
      <p className="ti-eyebrow">New task</p>
      <h1 id="ti-title" className="ti-title">
        Two agents.<br /><span>One project.</span>
      </h1>
      <p className="ti-sub">One plans the work.<br />The other plans the people.</p>

      <div className="ti-stage">
        {/*
          A lens, not an ellipse: two arcs that leave one mascot and meet at
          the other, crossing in the middle. The box is exactly the height of
          the mascot row so the curve passes BEHIND the heads instead of
          floating under them and cutting through the names.

          preserveAspectRatio="none" lets it stretch to whatever width the
          row happens to be; non-scaling-stroke keeps the line 1px while it
          does. Decorative — the pairing is said in words above and below.
        */}
        <svg className="ti-orbit" viewBox="0 0 900 140" preserveAspectRatio="none"
          aria-hidden="true" focusable="false">
          <path vectorEffect="non-scaling-stroke" d="M150,70 Q450,4 750,70" />
          <path vectorEffect="non-scaling-stroke" d="M150,70 Q450,136 750,70" />
        </svg>
        <span className="ti-node" aria-hidden="true" />

        {([
          { role: "consultant", name: "Consultant", tag: "Execution & expertise", chips: CONSULTANT_CHIPS },
          { role: "coach", name: "Coach", tag: "People & change", chips: COACH_CHIPS },
        ] as const).map(a => (
          <div key={a.role} className={`ti-agent ${a.role}`}>
            <AgentMascot role={a.role} size={128} state="idle" level={3} />
            <h2>{a.name}</h2>
            <p>{a.tag}</p>
            <ul className="ti-chips">
              {a.chips.map(c => <li key={c}>{c}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <button className="ti-cta" onClick={onBuild}>
        Build your team <IconArrow size={15} />
      </button>

      {pairs.length > 0 && (
        <div className="ti-recent">
          <p className="ti-recent-h">Your recent teams</p>
          <ul>
            {pairs.map(p => (
              <li key={p.key}>
                <button onClick={onBuild}>
                  <span className="ti-duo" aria-hidden="true">
                    <AgentMascot role="consultant" size={30} level={2} />
                    <i>+</i>
                    <AgentMascot role="coach" size={30} level={2} />
                  </span>
                  <span className="ti-duo-txt">
                    <b>{p.consultant.name} + {p.coach.name}</b>
                    <em>{p.projects} {p.projects === 1 ? "project" : "projects"}</em>
                  </span>
                  <IconArrow size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** The right-hand rail: who is picked, and what the pairing is for. */
export function TeamRail({ consultant, coach }: { consultant?: Agent; coach?: Agent }) {
  const picked = (consultant ? 1 : 0) + (coach ? 1 : 0);
  return (
    <aside className="tr" aria-label="Your AI team">
      <div className="tr-card">
        <div className="tr-head">
          <h2>Your AI team</h2>
          <span className="tr-count">{picked}/2</span>
        </div>
        <ul className="tr-slots">
          <li className={consultant ? "on" : undefined}>
            <AgentMascot role="consultant" size={38} level={consultant ? 3 : 1} />
            <span>
              <b>Consultant</b>
              <em>{consultant ? consultant.name : "Not selected yet"}</em>
            </span>
          </li>
          <li className={coach ? "on" : undefined}>
            <AgentMascot role="coach" size={38} level={coach ? 3 : 1} />
            <span>
              <b>Coach</b>
              <em>{coach ? coach.name : consultant ? "Not selected yet" : "Select a Consultant first"}</em>
            </span>
          </li>
        </ul>
      </div>

      <div className="tr-card tr-why">
        <span className="tr-rings" aria-hidden="true" />
        <h2>Two perspectives.<br /><span>One plan.</span></h2>
        <p>
          Your Consultant analyses the challenge. Your Coach focuses on the people side.
          Together they turn your answers into a structured, visual deliverable.
        </p>
        <ul className="tr-gains">
          {["Faster results", "Clearer structure", "Better team alignment"].map(g => (
            <li key={g}><IconCheck size={13} />{g}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
