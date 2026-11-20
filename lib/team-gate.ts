import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

/**
 * team-gate.ts — the server's own answer to "may this request see a team page?",
 * given before the page is rendered or even sent.
 *
 * The pages under TEAM_ONLY used to rely on the client alone: the shell was
 * served to anyone signed in and the browser then decided what to draw. The
 * data was always safe (every read refuses off the team inside the database),
 * but the page itself, its code and its address were reachable. This closes
 * that: the request is checked here, with the caller's own session, against
 * the same am_i_team() every privileged function uses (migration 0012 — the
 * grant AND a confirmed address on the company domain).
 *
 * Fails closed. Anything that is not a clear "yes" from the database — an
 * error, a missing function, an unreachable server — reads as "not team".
 *
 * Unlike the cookie-presence check in proxy.ts, this one validates the
 * session: getUser() asks the auth server, and refreshes an expired access
 * token the standard @supabase/ssr way, handing the new cookies back so the
 * browser's own session keeps working.
 */

export const TEAM_ONLY = ["/dashboard/team", "/dashboard/feedback"];

export function isTeamOnly(pathname: string): boolean {
  return TEAM_ONLY.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };

export interface TeamVerdict {
  /** "team" — let it through. "not-team" — a valid session that is not the team.
   *  "no-session" — nobody (or an expired session that could not be renewed). */
  result: "team" | "not-team" | "no-session";
  /** Refreshed session cookies the response has to carry. */
  cookies: CookieToSet[];
}

export async function teamVerdict(req: NextRequest): Promise<TeamVerdict> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let cookies: CookieToSet[] = [];
  if (!url || !key) return { result: "not-team", cookies };

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: list => { cookies = list as CookieToSet[]; },
      },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { result: "no-session", cookies };

    const { data: isTeam, error: rpcError } = await supabase.rpc("am_i_team");
    return { result: !rpcError && isTeam === true ? "team" : "not-team", cookies };
  } catch {
    return { result: "not-team", cookies };
  }
}
