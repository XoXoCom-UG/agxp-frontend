import { NextRequest, NextResponse } from "next/server";
import { ipGate } from "@/lib/ip-gate";
import { bearerOf, userClient } from "@/lib/server-db";

/**
 * The metrics dashboard's only data path (/metrics).
 *
 * Deliberately has NO service role. It reads with the caller's own token, and
 * every function it calls (migration 0033) decides for itself: the account must
 * be in agxp_metrics_viewers, on a confirmed @xoxocom.net address, and the token
 * must be aal2 (signed in with the authenticator code). So even a bug here can
 * hand out no more than a signed-in, 2FA-verified viewer would see anyway — and
 * that is totals only, never a customer's email, project or conversation.
 *
 * This route exists, rather than the page calling Supabase directly, for what it
 * adds in front: the per-network limit, no-store/noindex headers, and one path
 * (/api/metrics) that Cloudflare Access can put a second login in front of.
 */

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

export async function GET(req: NextRequest) {
  const limited = await ipGate(req, "metrics");
  if (limited) {
    for (const [k, v] of Object.entries(HEADERS)) limited.headers.set(k, v);
    return limited;
  }

  const token = bearerOf(req);
  const db = userClient(token);
  if (!db) return reply({ error: "Sign in first." }, 401);

  const params = req.nextUrl.searchParams;
  const view = params.get("view") === "log" ? "log" : "overview";

  const { data, error } = view === "log"
    ? await db.rpc("metrics_access_log")
    : await db.rpc("metrics_overview", {
        p_days: Number.parseInt(params.get("days") ?? "30", 10) || 30,
        p_include_team: params.get("team") === "1",
      });

  if (error) {
    // The token itself was refused by Supabase: expired or forged.
    if (error.code === "PGRST301" || /jwt/i.test(error.message)) return reply({ error: "Sign in again." }, 401);
    if (error.code === "42883" || error.code === "PGRST202" || /metrics_/.test(error.message)) {
      return reply({ error: "The metrics functions are missing: run supabase/migrations/0033_metrics_dashboard.sql in the SQL editor." }, 503);
    }
    console.error("[metrics]", error.code, error.message);
    return reply({ error: "Couldn't read the metrics." }, 500);
  }

  const refused = (data as { refused?: string } | null)?.refused;
  if (refused) return reply({ refused }, 403);
  return reply(data);
}
