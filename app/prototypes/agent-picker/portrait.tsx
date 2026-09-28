"use client";

/* Variant 2 — Portrait. Axis: what fills the card. Same head, same two
   cards; the empty middle of each card becomes the thing it leads to — a
   blank first-level agent for Create, the faces of the agents you already
   have for Train. The picture tells you the difference before the words. */

import { useState } from "react";
import type { AgentType } from "@/lib/agents";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconArrow } from "@/components/layout/agxp-icons";
import { ROSTER, ROLE_WORD, useSeats, Shell } from "./shared";
import { SeatHead, COPY } from "./seat-head";
import { NextStep, Chosen } from "./next-step";

function Seat({ role, seats }: { role: AgentType; seats: ReturnType<typeof useSeats> }) {
  const [mode, setMode] = useState<"new" | "known" | null>(null);
  const chosen = role === "consultant" ? seats.consultant : seats.coach;
  const locked = seats.locked(role);
  const word = ROLE_WORD[role];
  const team = ROSTER[role];
  if (chosen) return <div className="vp"><SeatHead role={role} locked={false} /><Chosen role={role} agent={chosen} seats={seats} /></div>;
  return (
    <div className="vp">
      <SeatHead role={role} locked={locked} />
      {mode ? <NextStep role={role} mode={mode} seats={seats} onBack={() => setMode(null)} /> : (
        <div className="vp-cards">
          <button className="vp-card" disabled={locked} onClick={() => setMode("new")}>
            <span className="vp-art vp-art-new" aria-hidden="true">
              <AgentMascot role={role} size={58} level={1} />
            </span>
            <span className="vp-t">Create new AI {word}</span>
            <span className="vp-d">{COPY[role].create}</span>
            <span className="vp-a">Create new agent<IconArrow size={13} /></span>
          </button>
          <button className="vp-card" disabled={locked} onClick={() => setMode("known")}>
            <span className="vp-art" aria-hidden="true">
              <span className="vp-pile">
                {team.slice(0, 3).map(a => (
                  <span key={a.id} className="vp-face"><AgentMascot role={role} size={42} level={a.stage} /></span>
                ))}
              </span>
              <span className="vp-count">{team.length} with you</span>
            </span>
            <span className="vp-t">Train existing AI {word}</span>
            <span className="vp-d">{COPY[role].train}</span>
            <span className="vp-a">Train existing agent<IconArrow size={13} /></span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Portrait() {
  const seats = useSeats();
  return <Shell seats={seats} consultant={<Seat role="consultant" seats={seats} />} coach={<Seat role="coach" seats={seats} />} />;
}
