import type { Agent } from "@/lib/agents";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// Three real, distinct request shapes (see app/api/agent/chat/route.ts),
// not cosmetic labels: Instant trims max_tokens for a snappier reply,
// Medium is the everyday default, High turns on the model's extended
// thinking with a larger token budget.
export type Effort = "Instant" | "Medium" | "High";

export async function askAgent(agent: Agent, messages: ChatTurn[], effort: Effort = "Medium"): Promise<string> {
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentType: agent.type, agentName: agent.name, messages, effort }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Anfrage fehlgeschlagen.");
  return data.content as string;
}
