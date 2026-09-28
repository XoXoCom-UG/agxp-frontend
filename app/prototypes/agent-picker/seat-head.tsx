"use client";

import type { AgentType } from "@/lib/agents";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { ROLE_WORD, ROLE_PURPOSE } from "./shared";

/** The panel head, identical in every variant: the structure stays as it is. */
export function SeatHead({ role, locked }: { role: AgentType; locked: boolean }) {
  return (
    <header className="sh">
      <AgentMascot role={role} size={44} />
      <div>
        <h2 className="sh-title">Your {ROLE_WORD[role]}</h2>
        <p className="sh-sub">{locked ? "Opens once you have a consultant." : ROLE_PURPOSE[role]}</p>
      </div>
    </header>
  );
}

export const COPY: Record<AgentType, { create: string; train: string }> = {
  consultant: {
    create: "Choose the kind of help you need, then give your consultant a name.",
    train: "Pick one you have worked with. It keeps what it learned in your earlier projects.",
  },
  coach: {
    create: "Choose the kind of support you need, then give your coach a name.",
    train: "Pick one you have worked with. It keeps what it learned about your team.",
  },
};
