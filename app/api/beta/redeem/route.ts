import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Redeeming a beta key.
 *
 * A server route rather than a client call, for the same reason plans are
 * written with the service role: the key table has no RLS policy at all, so
 * a signed-in user cannot read the list, guess at an unused code, or write
 * their own entitlement. All they can do is post a string here and be told
 * yes or no.
 *
 * The work itself is one atomic function in the database (0009), so two
 * people redeeming the last seat of the same key at the same moment cannot
 * both get in.
 */

/** Same shape the chat route uses: verify the bearer token against Supabase. */
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
 * A key is a short string someone typed off a message. Guessing is the only
 * attack, and the keyspace is the defence — but a handful of attempts a
 * minute costs an attacker nothing, so this costs them a minute. Per
 * instance, like the chat route's limiter: a seatbelt, not a wall.
 */
const WINDOW_MS = 60_000;
const MAX_TRIES = 8;
const tries = new Map<string, number[]>();

function tooManyTries(userId: string): boolean {
  const now = Date.now();
  const recent = (tries.get(userId) ?? []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  tries.set(userId, recent);
  if (tries.size > 500) {
    for (const [k, v] of tries) if (!v.some(t => now - t < WINDOW_MS)) tries.delete(k);
  }
  return recent.length > MAX_TRIES;
}

export async function POST(req: NextRequest) {
  const userId = await callerId(req);
  if (!userId) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }
  if (tooManyTries(userId)) {
    return NextResponse.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = (body?.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "Enter the key you were given." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Named in the server log, where the person who can fix it looks.
    console.error("[beta/redeem] SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json(
      { error: "Invitations aren't set up on the server yet. Tell us and we'll sort it out." },
      { status: 500 },
    );
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("redeem_beta_key", { p_user: userId, p_code: code });

  if (error) {
    // P0001 is the function's own refusal, already written for the person
    // reading it. Anything else is ours to fix, so it is logged and the user
    // gets a sentence that doesn't blame them.
    if (error.code === "P0001") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[beta/redeem] failed:", error.message);
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment." }, { status: 500 });
  }

  return NextResponse.json({ plan: data as string });
}
