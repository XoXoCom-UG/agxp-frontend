import { create } from "zustand";

// Manual override for the Coach/Consultant panel split — toggled from a
// button in the Coach's own chat-head. Shared via a tiny store rather than
// props because the toggle button and the panels it resizes live in
// different components (project-chat-panel.tsx vs new-task-screen.tsx).
interface PanelSizeState {
  swapped: boolean;
  toggle: () => void;
}

export const usePanelSizeStore = create<PanelSizeState>(set => ({
  swapped: false,
  toggle: () => set(s => ({ swapped: !s.swapped })),
}));
