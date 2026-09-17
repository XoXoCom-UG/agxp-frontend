"use client";

import type { AgentType } from "@/lib/agents";
import type { KnowledgeLevel } from "@/lib/agent-progress";

export type MascotState = "idle" | "thinking" | "speaking";

/**
 * A short reaction to something that just happened, played once and then
 * dropped. Reactions are what make the character read as alive — idle motion
 * only makes it read as busy.
 */
export type MascotMood = "nod" | "curious" | "pleased" | "proud" | null;

/**
 * The agent's face. A geometric little character rather than a cartoon
 * animal — the audience is IT consulting — but it has actual eyes, blinks,
 * breathes, looks at the thing you are doing, and reacts to what it just said.
 *
 * Consultant wears a tie, Coach wears a headset. The antenna picks up a ring
 * for every experience level, so an agent you have worked with looks different
 * from a new one — the only visual "score" in the app.
 *
 * All motion lives in CSS (agxp-design.css, ".mascot" block) so a single
 * prefers-reduced-motion rule can switch it all off.
 */
export function AgentMascot({ role, state = "idle", size = 44, enter = false, attentive = false, mood = null, level }: {
  role: AgentType;
  state?: MascotState;
  size?: number;
  /** Play the pop-in (used when the agent joins the project). */
  enter?: boolean;
  /** The user is typing to this agent — it looks towards the composer. */
  attentive?: boolean;
  /** One-off reaction, cleared by the caller after it has played. */
  mood?: MascotMood;
  /** Drives the rank rings on the antenna. */
  level?: KnowledgeLevel;
}) {
  const cls = [
    "mascot",
    `mascot-${role}`,
    `is-${state}`,
    enter ? "mascot-enter" : "",
    attentive ? "is-attentive" : "",
    mood ? `mood-${mood}` : "",
    level ? `lvl-${level.toLowerCase()}` : "",
  ].filter(Boolean).join(" ");

  return (
    <span className={cls} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        {/* antenna, with a rank ring per level earned */}
        <path className="m-antenna" d="M24 12 V7" strokeWidth="2" strokeLinecap="round" />
        <circle className="m-rank r1" cx="24" cy="5" r="4.4" strokeWidth="1" />
        <circle className="m-rank r2" cx="24" cy="5" r="6.2" strokeWidth="1" />
        <circle className="m-antenna-dot" cx="24" cy="5" r="2.6" />

        {/* coach headset — a band over the head with an ear pad each side */}
        <g className="m-headset">
          <path d="M11 24 A13 13 0 0 1 37 24" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="7.5" y="22" width="5" height="9" rx="2.5" />
          <rect x="35.5" y="22" width="5" height="9" rx="2.5" />
        </g>

        {/* head */}
        <g className="m-head">
          <rect className="m-face" x="9" y="12" width="30" height="25" rx="9" />
          <rect className="m-visor" x="12.5" y="17" width="23" height="13.5" rx="6.5" />
          <g className="m-eyes">
            <circle className="m-eye" cx="19.5" cy="23.5" r="2.7" />
            <circle className="m-eye" cx="28.5" cy="23.5" r="2.7" />
          </g>
          <rect className="m-mouth" x="21" y="32" width="6" height="2.2" rx="1.1" />
          <g className="m-dots">
            <circle className="m-dot" cx="21" cy="33" r="1.05" />
            <circle className="m-dot" cx="24" cy="33" r="1.05" />
            <circle className="m-dot" cx="27" cy="33" r="1.05" />
          </g>
        </g>

        {/* consultant tie */}
        <g className="m-tie">
          <path d="M24 37 L21.6 39.4 L24 45 L26.4 39.4 Z" />
        </g>
      </svg>
    </span>
  );
}
