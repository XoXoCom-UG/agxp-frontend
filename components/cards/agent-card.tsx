"use client";

import { Badge } from "@/components/ui";
import { cn, dateStr } from "@/lib/utils";
import type { Agent } from "@/lib/agents";
import { ChevronRight } from "lucide-react";

/**
 * A single agent, rendered as a compact horizontal row — not a square card —
 * so a column of "existing agents" reads as a scannable list.
 */
export function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group/agent w-full flex items-center gap-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800",
        "bg-white dark:bg-zinc-900 px-4 py-3.5 text-left transition-colors duration-150",
        "hover:border-green-300 dark:hover:border-green-800 hover:bg-green-50/40 dark:hover:bg-green-950/20"
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/60 ring-1 ring-green-100 dark:ring-green-900 flex items-center justify-center shrink-0 text-xs font-bold text-green-700 dark:text-green-400">
        {agent.avatar_placeholder || agent.name.slice(0, 2).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">{agent.name}</p>
        </div>

        {agent.methods.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {agent.methods.map(m => (
              <Badge key={m.id} variant="secondary" className="font-normal">{m.name}</Badge>
            ))}
          </div>
        )}

        {agent.last_projects.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {agent.last_projects.map(p => (
              <p key={p.id} className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                <span className="text-zinc-500 dark:text-zinc-400">{p.name}</span>
                {" · "}{dateStr(p.created_at)}
              </p>
            ))}
          </div>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0 group-hover/agent:text-green-600 dark:group-hover/agent:text-green-400 transition-colors" strokeWidth={1.5} />
    </button>
  );
}
