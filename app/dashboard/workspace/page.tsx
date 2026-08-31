"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAgentWorkspace } from "@/lib/agent-workspace-store";
import { AgentNav } from "@/components/layout/agent-nav";
import { AgentChatColumn } from "@/components/layout/agent-chat-column";

/**
 * Persistent 2-side workspace: Consultant on the left, Coach on the right,
 * both live at the same time — this is the main way of talking to the AI
 * team, not a one-off per-agent page.
 */
export default function WorkspacePage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const consultantAgent = useAgentWorkspace(s => s.consultant.agent);
  const coachAgent = useAgentWorkspace(s => s.coach.agent);

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  // Landed here directly (e.g. a reload) with nothing picked on either side —
  // send back to the picker instead of showing two empty columns.
  useEffect(() => {
    if (!authLoading && token && !consultantAgent && !coachAgent) router.replace("/dashboard");
  }, [authLoading, token, consultantAgent, coachAgent, router]);

  if (authLoading || !token) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-900">
      <div className="thinking-spinner" style={{ width: 24, height: 24 }} />
    </div>
  );

  return (
    <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950" style={{ height: "100vh", overflow: "hidden" }}>
      <AgentNav />
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <AgentChatColumn type="consultant" />
        <div className="hidden md:block w-px bg-zinc-100 dark:bg-zinc-800" />
        <AgentChatColumn type="coach" />
      </div>
    </div>
  );
}
