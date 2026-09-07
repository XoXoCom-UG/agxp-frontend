"use client";

import type { AgentType } from "@/lib/agents";

export type OrbState = "idle" | "thinking" | "speaking";

/**
 * The agent's face — an abstract hexagon that ripples while it thinks and
 * gives a short pulse as its reply lands. Deliberately not a mascot: the
 * audience is IT consulting, and Patryk's brief was "ganz ganz wenig".
 * Idle is completely still, so nothing moves unless something happened.
 */
export function AgentOrb({ role, state = "idle", size = 38, enter = false }: {
  role: AgentType;
  state?: OrbState;
  size?: number;
  /** Play the entrance animation (used when the agent joins the project). */
  enter?: boolean;
}) {
  return (
    <span className={`orb orb-${role} orb-${state}${enter ? " orb-enter" : ""}`}
      style={{ width: size, height: size }} aria-hidden="true">
      <span className="orb-ring" />
      <span className="orb-ring r2" />
      <span className="orb-core">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
        </svg>
      </span>
    </span>
  );
}
