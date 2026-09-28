"use client";

/* The step after Create / Train, shared by every variant in this round: the
   subject being designed is the empty state, not what comes after it. */

import type { AgentType } from "@/lib/agents";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconArrow, IconBack } from "@/components/layout/agxp-icons";
import { KINDS, ROSTER, fromKind, useSeats, type MockAgent } from "./shared";

export function NextStep({ role, mode, seats, onBack }: {
  role: AgentType; mode: "new" | "known"; seats: ReturnType<typeof useSeats>; onBack: () => void;
}) {
  return (
    <div className="ns pq-enter">
      <button className="ns-back" onClick={onBack}><IconBack size={11} />Back</button>
      <p className="ns-title">{mode === "new" ? "Step 1 of 2: what kind of help?" : "People you have worked with"}</p>
      <div className="ns-list">
        {mode === "new"
          ? KINDS[role].map(k => (
            <button key={k.type} className="ns-row" onClick={() => seats.set(role, fromKind(role, k))}>
              <span><b>{k.type}</b><em>{k.description}</em></span><IconArrow size={13} />
            </button>
          ))
          : ROSTER[role].map(a => (
            <button key={a.id} className="ns-row" onClick={() => seats.set(role, a)}>
              <AgentMascot role={role} size={28} level={a.stage} />
              <span><b>{a.name}</b><em>{a.level} · {a.projects} {a.projects === 1 ? "project" : "projects"}</em></span><IconArrow size={13} />
            </button>
          ))}
      </div>
    </div>
  );
}

/** Chosen, waiting for Start — the same summary the real panel shows. */
export function Chosen({ role, agent, seats }: { role: AgentType; agent: MockAgent; seats: ReturnType<typeof useSeats> }) {
  return (
    <div className="ns-chosen pq-enter">
      <AgentMascot role={role} size={64} level={agent.stage} />
      <b>{agent.name}</b>
      <em>{agent.tagline} · {agent.level}, {agent.projects} {agent.projects === 1 ? "project" : "projects"} together</em>
      <button className="ns-change" onClick={() => seats.set(role, null)}>Change agent</button>
    </div>
  );
}
