"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAgentWorkspace } from "@/lib/agent-workspace-store";
import { SettingsModal } from "./settings-modal";

/**
 * Minimal topbar for the AgxP agent screens (dashboard + per-agent chat).
 * Deliberately separate from the legacy `AppShell` — that one carries the old
 * project/session model (Projekte dropdown, Transformation Concept / Roadmap
 * buttons) which doesn't apply here.
 */
export function AgentNav() {
  const { user, profileName } = useAuth();
  const router = useRouter();
  const reset = useAgentWorkspace(s => s.reset);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function newTask() {
    reset();
    router.push("/dashboard");
  }

  return (
    <header className="no-print flex items-center gap-3 px-4 md:px-5 h-14 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900 z-30">
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <button onClick={newTask} className="flex items-center gap-px shrink-0">
        <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-50">AgxP</span>
      </button>
      <span className="hidden md:inline text-[10px] font-semibold tracking-[0.14em] uppercase text-zinc-400 ml-1">
        Train your AI Project-Agents
      </span>

      <div className="flex-1" />

      <button
        onClick={newTask}
        className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-900 rounded-lg px-3 py-2 hover:bg-green-100 dark:hover:bg-green-900/60 transition-colors"
      >
        New Task
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        title="Profil & Einstellungen"
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-green-800 dark:text-green-400 select-none hover:ring-2 hover:ring-green-200 dark:hover:ring-green-900 transition-all"
        style={{ background: "var(--green-light)", border: "1px solid var(--green-mid)" }}
      >
        {(profileName || user?.email || "U")[0].toUpperCase()}
      </button>
    </header>
  );
}
