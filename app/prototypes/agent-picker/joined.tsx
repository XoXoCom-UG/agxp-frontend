"use client";

/* Variant 3 — Joined. Axis: composition. Same head, same two choices; they
   are two halves of one surface split by a hairline instead of two cards
   floating apart. One object with two ways in reads calmer than two objects
   competing, and the pair lines up exactly with the head above it. */

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
  if (chosen) return <div className="vj"><SeatHead role={role} locked={false} /><Chosen role={role} agent={chosen} seats={seats} /></div>;
  return (
    <div className="vj">
      <SeatHead role={role} locked={locked} />
      {mode ? <NextStep role={role} mode={mode} seats={seats} onBack={() => setMode(null)} /> : (
        <div className={`vj-surface${locked ? " is-locked" : ""}`}>
          <button className="vj-half" disabled={locked} onClick={() => setMode("new")}>
            <span className="vj-t">Create new AI {word}</span>
            <span className="vj-d">{COPY[role].create}</span>
            <span className="vj-a">Create new agent<IconArrow size={13} /></span>
          </button>
          <button className="vj-half" disabled={locked} onClick={() => setMode("known")}>
            <span className="vj-t">Train existing AI {word}</span>
            <span className="vj-d">{COPY[role].train}</span>
            <span className="vj-a">Train existing agent · {ROSTER[role].length}<IconArrow size={13} /></span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Joined() {
  const seats = useSeats();
  return <Shell seats={seats} consultant={<Seat role="consultant" seats={seats} />} coach={<Seat role="coach" seats={seats} />} />;
}
