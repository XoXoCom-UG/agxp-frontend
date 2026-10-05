"use client";

import { AgentMascot } from "@/components/layout/agent-mascot";
import {
  IconArrow, IconBack, IconCheck, IconChart, IconList, IconSpark, IconUser,
} from "@/components/layout/agxp-icons";
import type { Agent, AgentType } from "@/lib/agents";

/**
 * Choosing an agent, one role at a time, on the whole page.
 *
 * The old picker put both roles side by side in their panels. This is the
 * redesign's flow: pick a Consultant, then a Coach, with the rail showing
 * the team filling up. AgentPickerPanel stays where it is — it is still what
 * "change agent" opens mid-project, and it is the only place an agent can be
 * created.
 *
 * Every card is drawn from the catalogue, never from the mockup: the names,
 * the description and the bullets are whatever is in `agents`. A design
 * showing three Coaches does not put a third Coach in the database.
 */

const ROLE_WORD: Record<AgentType, string> = { consultant: "Consultant", coach: "Coach" };

const BLURB: Record<AgentType, string> = {
  consultant: "Pick the type of expertise that best fits your project. You can always change this later.",
  coach: "Pick the type of coaching that best fits your project. You can always change this later.",
};

/** A glyph per card, by position — stable, and distinct at a glance. */
const GLYPHS = [IconSpark, IconList, IconChart, IconUser];

/**
 * The four lines under a card. Real method names first, because those are
 * what the agent actually runs; `expertise` is a "A · B · C" string and
 * fills any gap. Short of four, the card simply shows fewer.
 */
function bullets(agent: Agent): string[] {
  const fromMethods = agent.primaryMethods.map(m => m.name);
  const fromExpertise = (agent.expertise ?? "").split("·").map(s => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of [...fromMethods, ...fromExpertise]) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length === 4) break;
  }
  return out;
}

export function TeamPicker({
  role, step, agents, busy, error, onSelect, onBack,
}: {
  role: AgentType;
  /** 1 while choosing the Consultant, 2 for the Coach. */
  step: 1 | 2;
  agents: Agent[];
  /** The agent currently being assigned, so only its card shows a spinner. */
  busy: string | null;
  error: string | null;
  onSelect: (agentId: string) => void;
  onBack: () => void;
}) {
  const mine = agents.filter(a => a.type === role && !a.archived_at);

  return (
    <section className="tp" aria-labelledby="tp-title">
      <button className="tp-back" onClick={onBack}>
        <IconBack size={13} /> Back
      </button>

      <div className="tp-step">
        <span>Step {step} of 2</span>
        <span className="tp-bar" aria-hidden="true">
          <i style={{ width: step === 1 ? "50%" : "100%" }} />
        </span>
      </div>

      <h1 id="tp-title" className="tp-title">
        Choose your <span className={role}>{ROLE_WORD[role]}</span>
      </h1>
      <p className="tp-sub">{BLURB[role]}</p>

      {error && <p className="tp-error" role="alert">{error}</p>}

      {mine.length === 0 ? (
        <p className="tp-empty">
          No {ROLE_WORD[role]} is available yet. One has to exist in the catalogue
          before it can be picked.
        </p>
      ) : (
        <ul className="tp-cards">
          {mine.map((a, i) => {
            const Glyph = GLYPHS[i % GLYPHS.length];
            const lines = bullets(a);
            return (
              <li key={a.id} className={`tp-card ${role}`}>
                <div className="tp-art" aria-hidden="true">
                  <AgentMascot role={role} size={104} state="idle" level={3} agentId={a.id} />
                </div>
                <span className="tp-glyph" aria-hidden="true"><Glyph size={17} /></span>
                <h2>{a.name}</h2>
                {a.description && <p className="tp-desc">{a.description}</p>}
                {lines.length > 0 && (
                  <ul className="tp-lines">
                    {lines.map(l => <li key={l}><IconCheck size={13} />{l}</li>)}
                  </ul>
                )}
                <button className="tp-select" disabled={!!busy} onClick={() => onSelect(a.id)}>
                  {busy === a.id
                    ? <span className="spinner" aria-hidden="true" />
                    : <>Select <IconArrow size={14} /></>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
