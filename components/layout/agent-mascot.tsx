"use client";

import type { AgentType } from "@/lib/agents";

export type MascotState = "idle" | "thinking" | "speaking";

/**
 * The agent's face. A geometric little character rather than a cartoon
 * animal — the audience is IT consulting — but it has actual eyes, blinks,
 * and moves its mouth when it talks, so you can tell it's alive at a glance.
 *
 * Consultant wears a tie, Coach wears a headset; everything else is shared.
 * All motion lives in CSS (agxp-design.css, ".mascot" block) so a single
 * prefers-reduced-motion rule can switch it all off.
 */
export function AgentMascot({ role, state = "idle", size = 44, enter = false }: {
  role: AgentType;
  state?: MascotState;
  size?: number;
  /** Play the pop-in (used when the agent joins the project). */
  enter?: boolean;
}) {
  return (
    <span
      className={`mascot mascot-${role} is-${state}${enter ? " mascot-enter" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" fill="none">
        {/* antenna */}
        <path className="m-antenna" d="M24 12 V7" strokeWidth="2" strokeLinecap="round" />
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
