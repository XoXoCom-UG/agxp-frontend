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
  return (await caller(req))?.id ?? null;
}

/** The verified user: id plus the account's own metadata (preferences). */
export async function caller(req: NextRequest): Promise<{ id: string; meta: Record<string, unknown> } | null> {
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
  if (error || !data.user) return null;
  return { id: data.user.id, meta: (data.user.user_metadata ?? {}) as Record<string, unknown> };
}
