import type { Agent } from "@/lib/agents";
import { createClient } from "@/lib/supabase";
import type { PeerContext } from "@/lib/peer-context";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Why a request failed, as a category the UI can word for a person. The raw
 * detail (a status, a server message, an exception) stays in `message` for
 * the console — it is never shown as it is.
 */
export type AgentErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "not_configured"
  | "bad_request"
  | "network"
  | "empty"
  | "server";

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  constructor(code: AgentErrorCode, detail: string) {
    super(detail);
    this.name = "AgentError";
    this.code = code;
  }
}

/** Status → category, for a response whose body carries no `code`. */
function codeForStatus(status: number): AgentErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status === 400) return "bad_request";
  return "server";
}

const CODES = new Set<AgentErrorCode>(["unauthorized", "rate_limited", "not_configured", "bad_request", "network", "empty", "server"]);

/** The route verifies this token, so a missing session must fail here loudly. */
async function accessToken(): Promise<string> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AgentError("unauthorized", "no Supabase session");
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
 * `signal` stops the answer where it is. That is not a failure: whatever
 * arrived until then comes back with `stopped: true`, so the caller can keep
 * it as the reply the person chose to end.
 */
export interface AskOptions {
  agent: Agent;
  messages: ChatTurn[];
  /** What this agent learned in the user's earlier projects. */
  memory?: string[];
  /** How much history the two of them have — the agent's tone follows it. */
  experience?: { level: string; projects: number };
  /** The other panel's conversation, so the two agents aren't blind to each other. */
  peer?: PeerContext;
  onDelta?: (soFar: string) => void;
  signal?: AbortSignal;
}

export interface AskResult {
  text: string;
  /** True when `signal` ended the answer early. */
  stopped: boolean;
}

export async function askAgent({ agent, messages, memory = [], experience, peer, onDelta, signal }: AskOptions): Promise<AskResult> {
  let text = "";
  try {
    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await accessToken()}`,
      },
      body: JSON.stringify({ agentType: agent.type, agentName: agent.name, messages, memory, experience, peer }),
      signal,
    });

    // Everything that fails before the answer starts still answers in JSON.
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
      const code = data.code && CODES.has(data.code as AgentErrorCode) ? data.code as AgentErrorCode : codeForStatus(res.status);
      throw new AgentError(code, `${res.status} ${data.error ?? res.statusText}`);
    }
    if (!res.body) throw new AgentError("empty", "response had no body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      onDelta?.(text);
    }
    text += decoder.decode();
  } catch (e) {
    // Stopped on purpose: what arrived so far is the answer.
    if (signal?.aborted) return { text, stopped: true };
    if (e instanceof AgentError) throw e;
    // fetch rejects with a TypeError when the network is down or the
    // connection drops mid-stream.
    throw new AgentError("network", (e as Error)?.message ?? String(e));
  }

  // The stream can end early if the model call breaks mid-answer; an empty
  // body is a failure, not an answer.
  if (!text.trim()) throw new AgentError("empty", "stream ended without text");
  return { text, stopped: false };
}
