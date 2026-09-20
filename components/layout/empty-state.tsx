"use client";

import type { ReactNode } from "react";
import type { AgentType } from "@/lib/agents";
import { AgentMascot } from "@/components/layout/agent-mascot";

/**
 * An empty list, with someone standing in it.
 *
 * "Nothing here yet" over blank space reads like a dead end. The agent turning
 * up to say what happens next turns the same screen into the start of
 * something — and it is the one place a mascot can be large without competing
 * with anything, because there is nothing else on the page.
 */
export function EmptyState({ role = "consultant", title, body, action }: {
  role?: AgentType;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="es-art">
        <AgentMascot role={role} size={92} enter />
        <span className="es-shadow" aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
