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

/**
 * Asks the agent and streams the answer back.
 *
 * `onDelta` is called with everything received so far, every time a chunk
 * lands — the caller renders that directly, so the reply appears as it is
 * written instead of after a 20-second wait. The full text is returned at the
 * end, which is what gets stored.
 *
 * `memory` carries what this agent learned in the user's earlier projects.
 */
export interface AskOptions {
  agent: Agent;
  messages: ChatTurn[];
  /** What this agent learned in the user's earlier projects. */
  memory?: string[];
  /** How much history the two of them have — the agent's tone follows it. */
  experience?: { level: string; projects: number };
  onDelta?: (soFar: string) => void;
}

export async function askAgent({ agent, messages, memory = [], experience, onDelta }: AskOptions): Promise<string> {
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await accessToken()}`,
    },
    body: JSON.stringify({ agentType: agent.type, agentName: agent.name, messages, memory, experience }),
  });

  // Everything that fails before the answer starts still answers in JSON.
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "The request failed.");
  }
  if (!res.body) throw new Error("No answer came back.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onDelta?.(text);
  }
  text += decoder.decode();

  // The stream can end early if the model call breaks mid-answer; an empty
  // body is a failure, not an answer.
  if (!text.trim()) throw new Error("The agent didn't answer. Try again.");
  return text;
}
