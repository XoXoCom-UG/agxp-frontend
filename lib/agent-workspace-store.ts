"use client";

import { create } from "zustand";
import type { Agent } from "@/lib/agents";

export interface WorkspaceMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentColumnState {
  agent: Agent | null;
  messages: WorkspaceMessage[];
}

interface AgentWorkspaceState {
  consultant: AgentColumnState;
  coach: AgentColumnState;
  setColumnAgent: (column: "consultant" | "coach", agent: Agent | null) => void;
  addMessage: (column: "consultant" | "coach", message: WorkspaceMessage) => void;
  reset: () => void;
}

const emptyColumn: AgentColumnState = { agent: null, messages: [] };

/**
 * Holds the active Consultant + Coach conversation so either column can, in
 * principle, read what's happening in the other.
 *
 * TODO(context-sharing): nothing reads across columns yet. Once the real
 * agent logic lands, the Consultant/Coach backend calls should pull the
 * other column's `messages` (and maybe `agent.persistent_memory`) into their
 * prompt context here, instead of only sending their own column's history.
 */
export const useAgentWorkspace = create<AgentWorkspaceState>((set) => ({
  consultant: emptyColumn,
  coach: emptyColumn,
  setColumnAgent: (column, agent) =>
    set(state => ({ [column]: { ...state[column], agent, messages: [] } } as Partial<AgentWorkspaceState>)),
  addMessage: (column, message) =>
    set(state => ({
      [column]: { ...state[column], messages: [...state[column].messages, message] },
    } as Partial<AgentWorkspaceState>)),
  reset: () => set({ consultant: emptyColumn, coach: emptyColumn }),
}));
