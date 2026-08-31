"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listAgents, type Agent, type AgentType } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { AgentCard } from "@/components/cards/agent-card";
import { Plus, UserRoundCog, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";

const COLUMN_META: Record<AgentType, { title: string; icon: React.ReactNode }> = {
  consultant: { title: "Choose your personal AI Consultant", icon: <UserRoundCog className="w-4 h-4" strokeWidth={1.5} /> },
  coach: { title: "Choose your personal AI Coach", icon: <HeartHandshake className="w-4 h-4" strokeWidth={1.5} /> },
};

function AgentColumn({ type, agents, loading }: { type: AgentType; agents: Agent[]; loading: boolean }) {
  const router = useRouter();
  const meta = COLUMN_META[type];

  return (
    <div className="flex-1 min-w-0 flex flex-col px-5 md:px-8 py-8 md:overflow-y-auto">
      <div className="flex items-center gap-2 mb-1 text-green-600">
        {meta.icon}
        <p className="text-[11px] font-semibold tracking-[0.16em] uppercase">{type === "consultant" ? "Consultant" : "Coach"}</p>
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 leading-tight" style={{ letterSpacing: "-0.02em" }}>
        {meta.title}
      </h2>

      <button
        title="Bald verfügbar"
        className={cn(
          "flex items-center gap-3 rounded-xl px-4 py-3.5 mb-6 border border-dashed",
          "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400",
          "hover:border-green-400 hover:text-green-700 dark:hover:text-green-400 transition-colors"
        )}
      >
        <span className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
          <Plus className="w-4 h-4" strokeWidth={1.5} />
        </span>
        <span className="text-sm font-semibold">Create new</span>
      </button>

      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
        Choose from existing AI team
      </p>

      <div className="flex flex-col gap-2.5">
        {loading && Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skeleton h-[86px] w-full rounded-xl" />
        ))}
        {!loading && agents.length === 0 && (
          <p className="text-sm text-zinc-400 py-4">Noch keine Agenten.</p>
        )}
        {!loading && agents.map(a => (
          <AgentCard key={a.id} agent={a} onClick={() => router.push(`/dashboard/agent/${a.id}`)} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardStart() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    listAgents()
      .then(a => { if (alive) setAgents(a); })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingAgents(false); });
    return () => { alive = false; };
  }, [token]);

  if (authLoading || !token) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-900">
      <div className="thinking-spinner" style={{ width: 24, height: 24 }} />
    </div>
  );

  const consultants = agents.filter(a => a.type === "consultant");
  const coaches = agents.filter(a => a.type === "coach");

  return (
    <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950" style={{ height: "100vh", overflow: "hidden" }}>
      <AgentNav />
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0">
        <AgentColumn type="consultant" agents={consultants} loading={loadingAgents} />
        <div className="hidden md:block w-px bg-zinc-100 dark:bg-zinc-800 my-8" />
        <AgentColumn type="coach" agents={coaches} loading={loadingAgents} />
      </div>
    </div>
  );
}
