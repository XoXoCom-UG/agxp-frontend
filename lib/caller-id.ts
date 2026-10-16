import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

/**
 * Who is calling. The routes under /api/agent are not guarded by the proxy —
 * it only watches /dashboard — and nothing there checked a session, so anyone
 * who knew the URL could spend the Anthropic budget. The browser sends its
 * Supabase access token, which is verified against Supabase here.
 */
export async function callerId(req: NextRequest): Promise<string | null> {
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
