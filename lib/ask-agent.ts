import type { Agent } from "@/lib/agents";
import { createClient } from "@/lib/supabase";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** The route verifies this token, so a missing session must fail here loudly. */
async function accessToken(): Promise<string> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Sign in again.");
  return token;
}

/** `memory` carries what this agent learned in the user's earlier projects. */
export async function askAgent(agent: Agent, messages: ChatTurn[], memory: string[] = []): Promise<string> {
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await accessToken()}`,
    },
    body: JSON.stringify({ agentType: agent.type, agentName: agent.name, messages, memory }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Anfrage fehlgeschlagen.");
  return data.content as string;
}
