import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The two ways the server talks to Supabase, in one place.
 *
 *   serviceClient()  the service role. Bypasses RLS, so it is only for writes
 *                    the user must not be able to make themselves: plans,
 *                    usage, and the agent's own replies.
 *   userClient(t)    the anon key with the caller's bearer token. RLS applies
 *                    exactly as in the browser, so a read through it can only
 *                    ever see what this user owns.
 */

let service: SupabaseClient | null = null;

/** Null when the key isn't configured — the caller decides what that means. */
export function serviceClient(): SupabaseClient | null {
  if (service) return service;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return service;
}

export function userClient(token: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !token) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** The bearer token from the request, or "" when there is none. */
export function bearerOf(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
