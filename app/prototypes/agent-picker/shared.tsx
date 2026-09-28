"use client";

/* Prototype only — nothing in production imports from app/prototypes. */

import { useState } from "react";
import type { AgentType } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";

export interface MockAgent {
  id: string;
  role: AgentType;
  name: string;
  tagline: string;
  level: "New" | "Medium" | "High";
  projects: number;
  /** 1-5, what the mascot looks like. */
  stage: number;
  helpsWith: string[];
}

export interface AgentKind { type: string; sub: string; description: string }

/** Shaped like the real catalog in agent-picker-panel.tsx. */
export const KINDS: Record<AgentType, AgentKind[]> = {
  consultant: [
    { type: "AI Strategy Consultant", sub: "Strategy & AI transformation", description: "Where you are, where you want to be, and what is missing in between." },
    { type: "Solution Architect", sub: "Systems & integration", description: "Designs the target systems and how they connect." },
    { type: "Digital Transformation Manager", sub: "Roadmap & adoption", description: "Turns the plan into a roadmap teams can follow." },
  ],
  coach: [
    { type: "IT-Coaching Coach", sub: "Change & adoption", description: "Keeps the people side on track: who is affected and how." },
    { type: "Agile Coach", sub: "Delivery & team flow", description: "Coaches the team on rhythm, rituals and iteration." },
    { type: "Change Manager", sub: "Change & communication", description: "Plans the communication and the support people need." },
  ],
};

export const ROSTER: Record<AgentType, MockAgent[]> = {
  consultant: [
    { id: "c1", role: "consultant", name: "AI Strategy Consultant", tagline: "Strategy & AI transformation", level: "High", projects: 32, stage: 5, helpsWith: ["Where you are, where you want to be", "What is missing"] },
    { id: "c2", role: "consultant", name: "Solution Architect", tagline: "Systems & integration", level: "Medium", projects: 2, stage: 3, helpsWith: ["What is missing", "Your steps, written down"] },
    { id: "c3", role: "consultant", name: "Logistics Consultant", tagline: "Strategy & AI transformation", level: "New", projects: 0, stage: 1, helpsWith: ["Where you are, where you want to be"] },
  ],
  coach: [
    { id: "k1", role: "coach", name: "IT-Coaching Coach", tagline: "Change & adoption", level: "High", projects: 5, stage: 4, helpsWith: ["Who is affected", "What will change"] },
    { id: "k2", role: "coach", name: "Team Rollout Coach", tagline: "Delivery & team flow", level: "Medium", projects: 1, stage: 2, helpsWith: ["Your team's rhythm"] },
  ],
};

export const ROLE_WORD: Record<AgentType, string> = { consultant: "consultant", coach: "coach" };
export const ROLE_PURPOSE: Record<AgentType, string> = {
  consultant: "Works out what to change and how.",
  coach: "Keeps an eye on the people side.",
};

/** A newly created agent, as the real Create flow would return it. */
export function fromKind(role: AgentType, k: AgentKind): MockAgent {
  return { id: `new-${role}-${k.type}`, role, name: k.type, tagline: k.sub, level: "New", projects: 0, stage: 1, helpsWith: [] };
}

/** Both seats. The coach seat opens once there is a consultant — the real rule. */
export function useSeats() {
  const [consultant, setConsultant] = useState<MockAgent | null>(null);
  const [coach, setCoach] = useState<MockAgent | null>(null);
  const [started, setStarted] = useState(false);
  return {
    consultant, coach, started,
    set(role: AgentType, a: MockAgent | null) {
      if (role === "consultant") setConsultant(a); else setCoach(a);
      setStarted(false);
    },
    locked(role: AgentType) { return role === "coach" && !consultant; },
    start() { setStarted(true); },
  };
}

/**
 * The real screen around the variant: the app shell, the real navbar with
 * Start, and the two slots split the way NewTaskScreen splits them before
 * Start (a chosen consultant hands the room to the empty coach seat).
 */
export function Shell({ seats, consultant, coach }: {
  seats: ReturnType<typeof useSeats>;
  consultant: React.ReactNode;
  coach: React.ReactNode;
}) {
  const coachLeads = !!seats.consultant && !seats.coach;
  return (
    <div className="app">
      <AgentNav
        startEnabled={!!seats.consultant}
        startHint={!!seats.consultant && !!seats.coach && !seats.started}
        onStart={seats.started ? undefined : seats.start} />
      <div className="view-root">
        <main className="workspace" id="main-content" tabIndex={-1}>
          <div className="slot" data-role="consultant" style={{ flexGrow: coachLeads ? 1 : 2.3 }}>
            <section className="panel consultant">{consultant}</section>
          </div>
          <div className="seam" aria-hidden="true"><span className="seam-rail" /></div>
          <div className="slot coach-slot split" data-role="coach" style={{ flexGrow: coachLeads ? 2.3 : 1 }}>
            <section className="panel coach">{coach}</section>
          </div>
        </main>
      </div>
      {seats.started && (
        <div className="pv-started" role="status">Started: {seats.consultant?.name} with {seats.coach?.name ?? "no coach yet"}</div>
      )}
    </div>
  );
}
