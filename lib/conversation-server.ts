import "server-only";
import type { AgentType } from "@/lib/agents";
import { serviceClient, userClient } from "@/lib/server-db";
import { isDeliverableCommand } from "@/lib/deliverables";
import { isReadAlongCommand, isReviewCommand } from "@/lib/peer-context";

/**
 * The conversation, as the DATABASE has it — never as the browser says it is.
 *
 * The route used to take the whole history from the request body. Anyone with
 * a session could then send any history they liked: replies "from the agent"
 * that it never gave, a peer transcript that never happened, and the model
 * would treat all of it as true. That is the cheapest prompt injection there
 * is, and it turned the route into a general-purpose model proxy paid for by
 * us. Now the browser names a project and a panel, and the server reads what
 * was actually said.
 *
 * The read uses the caller's own token, so RLS decides what is visible: a
 * project id that belongs to someone else returns nothing. The agent's reply
 * is written with the service role, because the browser may no longer insert
 * assistant rows at all (migration 0019).
 */

export interface StoredTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LoadedConversation {
  /** This panel's history, oldest first. */
  own: StoredTurn[];
  /** The other panel's history in the same project, oldest first. */
  other: StoredTurn[];
}

export type LoadResult =
  | { ok: true; conversation: LoadedConversation }
  | { ok: false; status: number; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProjectId(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

export async function loadConversation(token: string, projectId: string, column: AgentType): Promise<LoadResult> {
  const db = userClient(token);
  if (!db) return { ok: false, status: 500, error: "The server can't read conversations right now." };

  const { data, error } = await db
    .from("agxp_project_messages")
    .select("role,content,column_type")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    // A hard stop on what one request can pull in. validateMessages() caps
    // the conversation far below this; this only keeps a stuffed table from
    // being read into memory whole.
    .limit(1000);

  if (error) {
    console.error("[conversation] load failed:", error.code, error.message);
    return { ok: false, status: 500, error: "The conversation couldn't be loaded. Try again." };
  }

  const rows = (data ?? []) as { role: string; content: string; column_type: string }[];
  const turn = (r: { role: string; content: string }): StoredTurn | null =>
    (r.role === "user" || r.role === "assistant") && typeof r.content === "string"
      ? { role: r.role, content: r.content }
      : null;

  const own = rows.filter(r => r.column_type === column).map(turn).filter((t): t is StoredTurn => !!t);
  const other = rows.filter(r => r.column_type !== column).map(turn).filter((t): t is StoredTurn => !!t);

  // The question has to be saved before it is asked. An empty panel, or one
  // whose newest message is already an answer, has nothing to answer — and a
  // project the caller does not own reads as empty too.
  if (own.length === 0 || own[own.length - 1].role !== "user") {
    return { ok: false, status: 409, error: "There is no new message to answer. Reload the page and try again." };
  }
  return { ok: true, conversation: { own, other } };
}

/**
 * What the other panel actually said, without the app's own commands (the
 * document buttons, the Coach's read-along and review prompts), which are not
 * something the person wrote. Error lines were never stored.
 */
export function peerTurns(other: StoredTurn[]): StoredTurn[] {
  return other.filter(t =>
    t.role === "assistant" ||
    !(isDeliverableCommand(t.content) || isReadAlongCommand(t.content) || isReviewCommand(t.content)),
  );
}

/**
 * Stores the agent's reply under a pre-chosen id, so the browser — which got
 * the id in a header before the first word arrived — can find it again for
 * Try again. Returns false when it could not be written.
 */
export async function saveReply(id: string, projectId: string, column: AgentType, content: string): Promise<boolean> {
  const db = serviceClient();
  if (!db) {
    console.error("[conversation] SUPABASE_SERVICE_ROLE_KEY is not set — the reply was not saved");
    return false;
  }
  const { error } = await db.from("agxp_project_messages").insert({
    id, project_id: projectId, column_type: column, role: "assistant", content,
  });
  if (error) {
    console.error("[conversation] saving the reply failed:", error.code, error.message);
    return false;
  }
  return true;
}
