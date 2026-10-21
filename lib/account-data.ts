import { createClient } from "@/lib/supabase";

/**
 * Everything we hold about the signed-in person, as one JSON file —
 * Art. 15 (access) and Art. 20 (portability) DSGVO as a button.
 *
 * Read in the browser with the user's own session, so RLS decides what is
 * included: it can only ever be this account's rows, and a bug here cannot
 * leak anyone else's. Attachments are listed by name and path; their bytes
 * stay in storage and can be opened from the project they belong to.
 */

export interface AccountExport {
  exportedAt: string;
  account: { id: string; email: string | null; name: string | null; createdAt: string | null };
  plan: unknown;
  usage: unknown[];
  projects: unknown[];
  messages: unknown[];
  agents: unknown[];
  files: { path: string; name: string; size: number | null }[];
}

const BUCKET = "project-files";

export async function exportMyData(): Promise<AccountExport> {
  const db = createClient();
  const { data: auth, error: authErr } = await db.auth.getUser();
  if (authErr || !auth.user) throw new Error("Not signed in.");
  const user = auth.user;

  const [plan, usage, projects, messages, agents] = await Promise.all([
    db.from("agxp_entitlements").select("plan,started_at,updated_at").eq("user_id", user.id).maybeSingle(),
    db.from("agxp_usage").select("*").eq("user_id", user.id),
    db.from("agxp_projects").select("*").eq("owner_id", user.id),
    db.from("agxp_project_messages").select("*").order("created_at", { ascending: true }),
    db.from("agents").select("*, agent_methods(*)").eq("created_by", user.id),
  ]);
  const failed = [plan, usage, projects, messages, agents].find(r => r.error)?.error;
  if (failed) throw new Error(failed.message);

  // Attachments live at <user id>/<project id>/<file>.
  const files: AccountExport["files"] = [];
  const bucket = db.storage.from(BUCKET);
  const { data: folders } = await bucket.list(user.id, { limit: 1000 });
  for (const f of folders ?? []) {
    const { data: inside } = await bucket.list(`${user.id}/${f.name}`, { limit: 1000 });
    for (const file of inside ?? []) {
      files.push({
        path: `${user.id}/${f.name}/${file.name}`,
        name: file.name,
        size: (file.metadata as { size?: number } | null)?.size ?? null,
      });
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
      createdAt: user.created_at ?? null,
    },
    plan: plan.data,
    usage: usage.data ?? [],
    projects: projects.data ?? [],
    messages: messages.data ?? [],
    agents: agents.data ?? [],
    files,
  };
}

/** Hands the export to the browser as a download. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Deletes the account and everything in it. The caller must type their email. */
export async function deleteMyAccount(confirmEmail: string): Promise<void> {
  const db = createClient();
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");
  const res = await fetch("/api/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirm: confirmEmail }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "The account couldn't be deleted. Try again.");
}

/** Ends the session on every device, not just this one. */
export async function signOutEverywhere(): Promise<void> {
  const { error } = await createClient().auth.signOut({ scope: "global" });
  if (error) throw new Error(error.message);
}
