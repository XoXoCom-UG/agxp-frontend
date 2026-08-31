import type { Agent } from "@/lib/agents";
import type { WorkspaceMessage } from "@/lib/agent-workspace-store";

export async function askAgent(agent: Agent, messages: WorkspaceMessage[]): Promise<string> {
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentType: agent.type, agentName: agent.name, messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Anfrage fehlgeschlagen.");
  return data.content as string;
}
