import { NextRequest, NextResponse } from "next/server";
import { callerId } from "@/lib/caller-id";
import { serviceClient, userClient, bearerOf } from "@/lib/server-db";
import { takeRateSlot } from "@/lib/entitlement-server";

/**
 * Deleting your own account — Art. 17 DSGVO as a button, not as an email to
 * support.
 *
 * Order matters, and each step is one the next one depends on:
 *
 *   1. Attachments, through the Storage API. The bytes are not reachable by
 *      a foreign key — a message only carries their path — so nothing else
 *      would remove them, and they are the most sensitive thing we hold.
 *   2. Projects. Messages go with them (foreign key, on delete cascade).
 *   3. Agents. agents.created_by is `on delete set null` (0001), so deleting
 *      the user alone would leave every agent they built behind, invisible
 *      but still stored. Their method and project links cascade.
 *   4. The auth user. Entitlement, usage and rate-limit rows cascade.
 *
 * A failure part-way leaves less data than before, never more, and running
 * the same request again carries on from where it stopped.
 *
 * The caller must type their own email address: a stolen session token
 * alone should not be one click away from erasing someone's work.
 */

const BUCKET = "project-files";

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** Every object under `<user id>/`, which is how 0011 lays the bucket out. */
async function removeFiles(db: NonNullable<ReturnType<typeof serviceClient>>, userId: string): Promise<string | null> {
  const bucket = db.storage.from(BUCKET);
  const { data: folders, error } = await bucket.list(userId, { limit: 1000 });
  if (error) return error.message;

  for (const folder of folders ?? []) {
    // A folder entry has no id; a file directly under the user's prefix has one.
    const prefix = `${userId}/${folder.name}`;
    if (folder.id) {
      const { error: rm } = await bucket.remove([prefix]);
      if (rm) return rm.message;
      continue;
    }
    for (;;) {
      const { data: files, error: listErr } = await bucket.list(prefix, { limit: 1000 });
      if (listErr) return listErr.message;
      if (!files?.length) break;
      const { error: rm } = await bucket.remove(files.map(f => `${prefix}/${f.name}`));
      if (rm) return rm.message;
      if (files.length < 1000) break;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const userId = await callerId(req);
  if (!userId) return fail(401, "Your session has expired. Sign in again.");
  if (!(await takeRateSlot(userId, "account", 5, 600))) {
    return fail(429, "Too many attempts. Wait a few minutes and try again.");
  }

  const db = serviceClient();
  if (!db) {
    console.error("[account/delete] SUPABASE_SERVICE_ROLE_KEY is not set");
    return fail(500, "Account deletion isn't available right now. Write to us and we'll delete it by hand.");
  }

  // The address the account really has, read under the caller's own token.
  const me = userClient(bearerOf(req));
  const { data: auth } = me ? await me.auth.getUser(bearerOf(req)) : { data: null };
  const email = auth?.user?.email?.trim().toLowerCase() ?? "";
  const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
  const typed = (body?.confirm ?? "").trim().toLowerCase();
  if (!email || typed !== email) {
    return fail(400, "Type your email address exactly as it is on the account to confirm.");
  }

  const filesErr = await removeFiles(db, userId);
  if (filesErr) {
    console.error("[account/delete] files:", filesErr);
    return fail(500, "Your files couldn't be removed. Nothing else was deleted — try again.");
  }

  const { error: projErr } = await db.from("agxp_projects").delete().eq("owner_id", userId);
  if (projErr) {
    console.error("[account/delete] projects:", projErr.code, projErr.message);
    return fail(500, "Your projects couldn't be removed. Try again in a moment.");
  }

  const { error: agentErr } = await db.from("agents").delete().eq("created_by", userId);
  if (agentErr) {
    console.error("[account/delete] agents:", agentErr.code, agentErr.message);
    return fail(500, "Your agents couldn't be removed. Try again in a moment.");
  }

  const { error: userErr } = await db.auth.admin.deleteUser(userId);
  if (userErr) {
    console.error("[account/delete] user:", userErr.message);
    return fail(500, "Your data is deleted, but the account itself couldn't be. Try again in a moment.");
  }

  return NextResponse.json({ deleted: true });
}
