import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// One shared browser client for the whole app. Creating a new client per
// component gave each its own auth listeners, so a session established in the
// OAuth callback didn't reliably propagate to the rest of the app.
let client: SupabaseClient | undefined;

/**
 * Call this from an effect or a handler, never from a component's render.
 * Client components are prerendered on the server at build time, and
 * building the client there turns a missing environment variable into a
 * FAILED BUILD rather than a running app that can say what is wrong — which
 * is exactly what happened on the first preview deployment, where
 * NEXT_PUBLIC_* were set for Production only and the build died prerendering
 * /_not-found.
 */
export function createClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Supabase's own message here names neither variable nor the environment
  // they are missing from, and NEXT_PUBLIC_* are baked in at BUILD time — so
  // on Vercel they have to be set for the environment being built, and the
  // deployment rebuilt, not just restarted.
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set " +
      "for this build. On Vercel they must be enabled for this environment " +
      "(Production, Preview) and the deployment rebuilt.",
    );
  }
  client = createBrowserClient(url, key);
  return client;
}
