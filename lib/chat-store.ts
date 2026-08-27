"use client";

import { create } from "zustand";
import { Message, Session, Project, ConceptData, RoadmapData } from "@/lib/api";
import { newSessionId } from "@/lib/utils";

/** Which box the assistant is currently editing (assisted Concept/Roadmap edit). */
export interface EditContext {
  kind: "concept" | "roadmap";
  target: string; // human label of the box being edited
}

/** A snippet the user wants to discuss with the assistant (selected text, a
 *  roadmap tool, a concept row). Pushed from any page into the shared panel. */
export interface AssistantContext {
  quote: string;
  question?: string;
}

/** A deletion waiting out its 15-minute undo window. The real API delete only
 *  fires when `deleteAt` passes; clicking undo drops it before then. */
export interface PendingDelete {
  id: string;
  kind: "project" | "session";
  item: Project | Session;
  deleteAt: number;
  label: string;
}

interface ChatStore {
  // current session
  sessionId: string;
  sessionTitle: string;
  messages: Message[];
  history: Session[];
  projects: Project[];
  projectSessions: Record<string, Session[]>;
  activeProjectId: string | null;
  sending: boolean;
  mode: "chat" | "research";
  guidedProject: boolean;
  // Assistant reply style, chosen in Settings (default: Tier-1-Berater).
  persona: "berater" | "kritiker";
  thinkingPhase: string;
  sidebarOpen: boolean;

  // shared assistant panel (right side, present on every screen)
  assistantContext: AssistantContext | null;
  assistantContextNonce: number;
  assistantOpenMobile: boolean;
  // Bumped when the user clicks "Schnelle Frage" — the right assistant pops open.
  assistantGreetNonce: number;
  // A short description of what the user currently sees on the left (chat /
  // concept / roadmap), so the right-side assistant knows the context.
  leftContext: string;
  // Deletions inside their 15-minute undo window.
  pendingDeletes: PendingDelete[];
  // Cache of fully-loaded sessions so re-opening a conversation is instant.
  sessionCache: Record<string, { title: string; messages: Message[] }>;
  // Guided onboarding tour (delivered through the assistant coach + spotlight).
  // tourStep lives here so the tour survives page navigation between chapters.
  tourActive: boolean;
  tourStep: number;
  // When the tour is showing the bundled example (populated Concept/Roadmap).
  demoActive: boolean;

  // Assisted editing: the current Concept/Roadmap live in the store so the
  // right-side assistant can edit them and the page re-renders. `editContext`
  // is the box the user clicked "Edit" on.
  activeConcept: ConceptData | null;
  activeRoadmap: RoadmapData | null;
  editContext: EditContext | null;

  // actions
  setSessionId: (id: string) => void;
  setSessionTitle: (t: string) => void;
  setMessages: (m: Message[]) => void;
  addMessage: (m: Message) => void;
  setHistory: (h: Session[]) => void;
  setProjects: (p: Project[]) => void;
  setProjectSessions: (pid: string, s: Session[]) => void;
  setActiveProject: (id: string | null) => void;
  setSending: (b: boolean) => void;
  setMode: (m: "chat" | "research") => void;
  setGuidedProject: (b: boolean) => void;
  setPersona: (p: "berater" | "kritiker") => void;
  setThinkingPhase: (p: string) => void;
  setSidebarOpen: (b: boolean) => void;
  reorderProjects: (ids: string[]) => void;
  pushAssistant: (ctx: AssistantContext) => void;
  setAssistantOpenMobile: (b: boolean) => void;
  popAssistantGreeting: () => void;
  setLeftContext: (c: string) => void;
  queueDelete: (d: PendingDelete) => void;
  dropPending: (id: string) => void;
  cacheSession: (id: string, data: { title: string; messages: Message[] }) => void;
  setTourStep: (n: number) => void;
  startTour: () => void;
  endTour: () => void;
  setActiveConcept: (c: ConceptData | null) => void;
  setActiveRoadmap: (r: RoadmapData | null) => void;
  startEdit: (kind: "concept" | "roadmap", target: string) => void;
  clearEdit: () => void;
  newChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  sessionId: newSessionId(),
  sessionTitle: "Neue Konversation",
  messages: [],
  history: [],
  projects: [],
  projectSessions: {},
  activeProjectId: null,
  sending: false,
  mode: "chat",
  guidedProject: false,
  persona: "berater",
  thinkingPhase: "",
  sidebarOpen: false,
  assistantContext: null,
  assistantContextNonce: 0,
  assistantOpenMobile: false,
  assistantGreetNonce: 0,
  leftContext: "",
  pendingDeletes: [],
  sessionCache: {},
  tourActive: false,
  tourStep: 0,
  demoActive: false,
  activeConcept: null,
  activeRoadmap: null,
  editContext: null,

  setSessionId: (id) => set({ sessionId: id }),
  setSessionTitle: (t) => set({ sessionTitle: t }),
  setMessages: (m) => set({ messages: m }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setHistory: (h) => set({ history: h }),
  setProjects: (p) => set({ projects: p }),
  setProjectSessions: (pid, s) =>
    set((state) => ({ projectSessions: { ...state.projectSessions, [pid]: s } })),
  setActiveProject: (id) => set({ activeProjectId: id }),
  setSending: (b) => set({ sending: b }),
  setMode: (m) => set({ mode: m }),
  setGuidedProject: (b) => set({ guidedProject: b }),
  setPersona: (p) => { localStorage.setItem("matfit_persona", p); set({ persona: p }); },
  setThinkingPhase: (p) => set({ thinkingPhase: p }),
  setSidebarOpen: (b) => set({ sidebarOpen: b }),
  reorderProjects: (ids) =>
    set((state) => {
      const byId = new Map(state.projects.map((p) => [p.project_id, p]));
      const next = ids.map((id) => byId.get(id)).filter(Boolean) as Project[];
      // keep any projects not present in ids (safety) at the end
      for (const p of state.projects) if (!ids.includes(p.project_id)) next.push(p);
      return { projects: next };
    }),
  pushAssistant: (ctx) =>
    set((s) => ({
      assistantContext: ctx,
      assistantContextNonce: s.assistantContextNonce + 1,
      assistantOpenMobile: true,
    })),
  setAssistantOpenMobile: (b) => set({ assistantOpenMobile: b }),
  popAssistantGreeting: () => set((s) => ({ assistantGreetNonce: s.assistantGreetNonce + 1, assistantOpenMobile: true })),
  setLeftContext: (c) => set({ leftContext: c }),
  queueDelete: (d) => set((s) => ({ pendingDeletes: [...s.pendingDeletes.filter(p => p.id !== d.id), d] })),
  dropPending: (id) => set((s) => ({ pendingDeletes: s.pendingDeletes.filter(p => p.id !== id) })),
  cacheSession: (id, data) => set((s) => ({ sessionCache: { ...s.sessionCache, [id]: data } })),
  setTourStep: (n) => set({ tourStep: n }),
  startTour: () => set({ tourActive: true, tourStep: 0, demoActive: true }),
  endTour: () => set({ tourActive: false, tourStep: 0, demoActive: false }),
  setActiveConcept: (c) => set({ activeConcept: c }),
  setActiveRoadmap: (r) => set({ activeRoadmap: r }),
  startEdit: (kind, target) => set({ editContext: { kind, target }, assistantOpenMobile: true }),
  clearEdit: () => set({ editContext: null }),
  newChat: () =>
    set({
      sessionId: newSessionId(),
      sessionTitle: "Neue Konversation",
      messages: [],
      guidedProject: false,
      activeProjectId: null,
      demoActive: false,
      activeConcept: null,
      activeRoadmap: null,
      editContext: null,
    }),
}));
