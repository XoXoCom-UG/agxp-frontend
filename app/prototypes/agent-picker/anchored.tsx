"use client";

/* Variant 1 — Anchored. Axis: rhythm and alignment. Same head, same two
   cards; the cards move up under the head on one shared left edge, shrink to
   their content, and put the action on its own row under a hairline. */

import { useState } from "react";
import type { AgentType } from "@/lib/agents";
import { IconArrow } from "@/components/layout/agxp-icons";
import { ROSTER, ROLE_WORD, useSeats, Shell } from "./shared";
import { SeatHead, COPY } from "./seat-head";
import { NextStep, Chosen } from "./next-step";

function Seat({ role, seats }: { role: AgentType; seats: ReturnType<typeof useSeats> }) {
  const [mode, setMode] = useState<"new" | "known" | null>(null);
  const chosen = role === "consultant" ? seats.consultant : seats.coach;
  const locked = seats.locked(role);
  const word = ROLE_WORD[role];
  if (chosen) return <div className="va"><SeatHead role={role} locked={false} /><Chosen role={role} agent={chosen} seats={seats} /></div>;
  return (
    <div className="va">
      <SeatHead role={role} locked={locked} />
      {mode ? <NextStep role={role} mode={mode} seats={seats} onBack={() => setMode(null)} /> : (
        <div className="va-cards">
          <button className="va-card" disabled={locked} onClick={() => setMode("new")}>
            <span className="va-t">Create new AI {word}</span>
            <span className="va-d">{COPY[role].create}</span>
            <span className="va-a">Create new agent<IconArrow size={13} /></span>
          </button>
          <button className="va-card" disabled={locked} onClick={() => setMode("known")}>
            <span className="va-t">Train existing AI {word}</span>
            <span className="va-d">{COPY[role].train}</span>
            <span className="va-a">Train existing agent<span className="va-count">{ROSTER[role].length} available</span><IconArrow size={13} /></span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Anchored() {
  const seats = useSeats();
  return <Shell seats={seats} consultant={<Seat role="consultant" seats={seats} />} coach={<Seat role="coach" seats={seats} />} />;
}
