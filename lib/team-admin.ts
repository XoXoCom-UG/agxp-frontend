import { createClient } from "@/lib/supabase";

/**
 * team-admin.ts — the client's side of /api/dev, for the team dashboard.
 *
 * The route re-checks every call against the verified token and asks
 * am_i_team() before it answers, so nothing here is what protects anything:
 * it is the plumbing between the dashboard and the route.
 */

export interface ConfigFinding {
  key: string;
  level: "fatal" | "silent" | "optional";
  consequence: string;
}

export interface BetaKey {
  code: string;
  plan: string;
  used_count: number;
  max_uses: number;
  note: string | null;
  /** Who it was emailed to and when (0032); absent before that migration. */
  email?: string | null;
  emailed_at?: string | null;
}

export interface AdminState {
  keys: BetaKey[];
  config: ConfigFinding[];
  /** Whether the server can send email at all. */
  mail: boolean;
  /** Sending from Resend's sandbox address, which only reaches its owner. */
  sandbox: boolean;
}

/** One call to the route. Throws with the route's own sentence. */
export async function callDev(method: "GET" | "POST", body?: unknown) {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");
  const res = await fetch("/api/dev", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "That didn't work.");
  return json;
}

export async function loadAdminState(): Promise<AdminState> {
  const r = await callDev("GET");
  return {
    keys: (r.keys as BetaKey[]) ?? [],
    config: (r.config as ConfigFinding[]) ?? [],
    mail: r.mail !== false,
    sandbox: r.sandbox === true,
  };
}
