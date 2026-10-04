import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { missingConfig } from "@/lib/config-check";
import { sendInvite, mailConfigured, usingSandboxSender, inviteTemplate } from "@/lib/send-mail";

/**
 * The team's own switches: change your plan, mint an invitation, list them.
 *
 * Every one of these is privileged, and the privilege is a single boolean on
 * the entitlement row (`can_switch_plan`, migration 0010). The check lives
 * inside the database functions rather than here, so this route cannot
 * forget it and a second caller written later inherits it for free. All this
 * file does is verify who is asking and pass it on with the service role.
 *
 * The flag is false for everyone by default. A tester who finds this
 * endpoint gets the same refusal as an anonymous caller.
 */

async function callerId(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

/**
 * The team flag, read with the CALLER's own token rather than the service
 * role. That matters for one case only, and it is the case that matters most:
 * when SUPABASE_SERVICE_ROLE_KEY is the thing that is missing, admin() is null
 * and the usual path would 500 before it could ever say so. agxp_entitlements
 * is select-own under RLS, so this works with nothing but the user's session —
 * and it still cannot be spoofed, because RLS decides which row comes back.
 */
async function callerCanSwitch(req: NextRequest, userId: string): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return false;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await supabase
    .from("agxp_entitlements")
    .select("can_switch_plan")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.can_switch_plan === true;
}

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * P0001 is a refusal written for the person reading it. Everything else used
 * to collapse into "Something went wrong on our side", which is true and
 * useless: the actual cause is almost always a migration that was never run,
 * and the only person who sees this is on the team and can run it. So the
 * Postgres code is translated the way lib/db-error.ts does for RLS.
 */
const DB_HINTS: Record<string, string> = {
  // undefined_table / undefined_function: the object the function needs does
  // not exist here. A plpgsql body is not resolved when it is created, so
  // 0010 can be applied while 0009 is not and nothing complains until now.
  "42P01": "A table this needs is missing. Run supabase/migrations/0009_beta_keys.sql.",
  "42883": "A function this needs is missing. Run supabase/migrations/0010_dev_plan_switch.sql.",
  "42703": "A column this needs is missing. Run supabase/migrations/0010_dev_plan_switch.sql.",
  "42501": "The database refused the write. Check supabase/ensure_policies.sql.",
};

function fail(error: { code?: string; message: string }, where: string) {
  if (error.code === "P0001") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error(`[dev] ${where}:`, error.code, error.message);
  const hint = error.code ? DB_HINTS[error.code] : undefined;
  return NextResponse.json(
    {
      // Team-only endpoint, so the real cause is safe to show and is the
      // whole point. supabase/health_check.sql lists everything at once.
      error: hint ?? `${where} failed: ${error.message}`,
      code: error.code,
    },
    { status: 500 },
  );
}

/**
 * Where the invitation tells people to go. The request's own origin is right
 * in every environment we actually run in — localhost, a preview deploy, and
 * production each send the link to themselves — and NEXT_PUBLIC_SITE_URL
 * overrides it when the app sits behind a different public domain.
 */
function siteUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || req.nextUrl.origin;
}

/** The invitations, for the panel that hands them out. */
export async function GET(req: NextRequest) {
  const userId = await callerId(req);
  if (!userId) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  if (!(await callerCanSwitch(req, userId))) {
    return NextResponse.json({ error: "Not for this account." }, { status: 403 });
  }

  // Names of variables, never their values, and only to the team.
  const config = missingConfig();

  const db = admin();
  if (!db) return NextResponse.json({ keys: [], config, mail: mailConfigured(), sandbox: usingSandboxSender() });

  const { data, error } = await db.rpc("list_beta_keys", { p_user: userId });
  if (error) return fail(error, "list_beta_keys");
  return NextResponse.json({ keys: data ?? [], config, mail: mailConfigured(), sandbox: usingSandboxSender() });
}

export async function POST(req: NextRequest) {
  const userId = await callerId(req);
  if (!userId) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { action?: "plan" | "key"; plan?: string; uses?: number; note?: string; email?: string }
    | null;

  const db = admin();
  if (!db) {
    // Name it. This is the same trap the GET reports, and a team member
    // clicking a plan that silently refuses has no way to connect the two.
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server, so plans cannot be written." },
      { status: 500 },
    );
  }

  if (body?.action === "plan") {
    const { data, error } = await db.rpc("set_own_plan", { p_user: userId, p_plan: body.plan });
    if (error) return fail(error, "set_own_plan");
    return NextResponse.json({ plan: data as string });
  }

  if (body?.action === "key") {
    const { data, error } = await db.rpc("mint_beta_key", {
      p_user: userId,
      p_plan: body.plan ?? "max",
      p_uses: body.uses ?? 1,
      p_note: (body.note ?? "").trim() || null,
    });
    if (error) return fail(error, "mint_beta_key");

    const code = data as string;
    const email = (body.email ?? "").trim();

    /*
     * The key exists from here on, whatever happens next. Sending is a
     * separate thing that can fail for reasons that have nothing to do with
     * the key — an unverified domain, a provider having a bad minute — and
     * failing the request over that would throw away a key already written
     * to the database. So the mail result rides along and the panel shows
     * the code either way.
     */
    const mail = email
      ? await sendInvite(email, code, siteUrl(req))
      : { sent: false, reason: null, via: undefined };

    return NextResponse.json({
      code,
      emailed: mail.sent,
      emailError: mail.reason,
      via: mail.via,
      template: inviteTemplate(),
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
