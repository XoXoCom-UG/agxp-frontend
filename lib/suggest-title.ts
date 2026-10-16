import { createClient } from "@/lib/supabase";
import type { SuggestedTitle } from "@/lib/project-title";

/**
 * Asks the server for a name, a one-line description and an industry for a
 * project, from the start of its conversation. Returns null on any failure —
 * the project simply keeps the name it has, and the next message asks again
 * only if nothing was named.
 */
export async function suggestTitle(messages: { role: "user" | "assistant"; content: string }[]): Promise<SuggestedTitle | null> {
  try {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch("/api/agent/title", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) return null;
    const json = await res.json() as Partial<SuggestedTitle>;
    return json?.name ? { name: json.name, description: json.description ?? "", industry: json.industry ?? null } : null;
  } catch {
    return null;
  }
}
