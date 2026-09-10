import type { Agent } from "@/lib/agents";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** `memory` carries what this agent learned in the user's earlier projects. */
export async function askAgent(agent: Agent, messages: ChatTurn[], memory: string[] = []): Promise<string> {
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentType: agent.type, agentName: agent.name, messages, memory }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Anfrage fehlgeschlagen.");
  return data.content as string;
}
