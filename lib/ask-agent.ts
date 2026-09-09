import type { Agent } from "@/lib/agents";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// Standard = the usual call. Extended turns on the model's extended
// thinking for that one request (see app/api/agent/chat/route.ts) — a real
// difference in what's sent to the model, not a cosmetic label.
export type Effort = "Standard" | "Extended";

export async function askAgent(agent: Agent, messages: ChatTurn[], effort: Effort = "Standard"): Promise<string> {
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentType: agent.type, agentName: agent.name, messages, effort }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Anfrage fehlgeschlagen.");
  return data.content as string;
}
