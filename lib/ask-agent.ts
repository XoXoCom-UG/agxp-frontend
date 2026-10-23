import type { Agent } from "@/lib/agents";
import { kindFor } from "@/lib/agent-types";
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
  /** This account already has as many answers in flight as it may (the lease
   *  in migration 0021) — not the same as sending too much. */
  | "busy"
  /** A plan or budget limit (402). The server's message is written for the
   *  person and says what ran out, so it is the one shown. */
  | "limit"
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
  if (status === 402) return "limit";
  if (status === 400) return "bad_request";
  return "server";
}

const CODES = new Set<AgentErrorCode>(["unauthorized", "rate_limited", "busy", "not_configured", "bad_request", "network", "empty", "server", "limit"]);

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
  /** The project and panel to answer. The server reads the conversation from
   *  the database itself; the browser no longer sends it. */
  projectId: string;
  /** What this agent learned in the user's earlier projects. */
  memory?: string[];
  /** How much history the two of them have — the agent's tone follows it. */
  experience?: { level: string; projects: number };
  /** The other agent, so the two aren't blind to each other. Only its role
   *  and name travel; the server reads what it was told. */
  peer?: Pick<PeerContext, "role" | "name">;
  onDelta?: (soFar: string) => void;
  signal?: AbortSignal;
}

export interface AskResult {
  text: string;
  /** True when `signal` ended the answer early. */
  stopped: boolean;
  /** Where the server stored the reply, for Try again. */
  messageId: string | null;
}

export async function askAgent({ agent, projectId, memory = [], experience, peer, onDelta, signal }: AskOptions): Promise<AskResult> {
  let text = "";
  let messageId: string | null = null;
  try {
    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await accessToken()}`,
      },
      body: JSON.stringify({
        projectId, agentType: agent.type, agentKind: kindFor(agent), agentName: agent.name, memory, experience,
        peer: peer ? { role: peer.role, name: peer.name } : undefined,
      }),
      signal,
    });

    // Everything that fails before the answer starts still answers in JSON.
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
      const code = data.code && CODES.has(data.code as AgentErrorCode) ? data.code as AgentErrorCode : codeForStatus(res.status);
      // A limit's message is the user-facing text itself, not a detail for the console.
      if ((code === "limit" || code === "busy") && data.error) throw new AgentError(code, data.error);
      throw new AgentError(code, `${res.status} ${data.error ?? res.statusText}`);
    }
    if (!res.body) throw new AgentError("empty", "response had no body");
    messageId = res.headers.get("X-Message-Id");

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
    if (signal?.aborted) return { text, stopped: true, messageId };
    if (e instanceof AgentError) throw e;
    // fetch rejects with a TypeError when the network is down or the
    // connection drops mid-stream.
    throw new AgentError("network", (e as Error)?.message ?? String(e));
  }

  // The stream can end early if the model call breaks mid-answer; an empty
  // body is a failure, not an answer.
  if (!text.trim()) throw new AgentError("empty", "stream ended without text");
  return { text, stopped: false, messageId };
}
