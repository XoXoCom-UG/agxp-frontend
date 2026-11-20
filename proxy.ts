import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isTeamOnly, teamVerdict } from "./lib/team-gate";

/**
 * Route protection (Next.js 16 "Proxy", formerly Middleware).
 *
 * Optimistic check: Supabase (@supabase/ssr) stores the session in cookies
 * named `sb-<project-ref>-auth-token`. If no such cookie exists, the user is
 * definitely not logged in — redirect to /login before the page even renders.
 *
 * This is defense-in-depth / UX only. Real authorization happens on the
 * backend: every API call is validated against the Bearer token server-side.
 */
const PROTECTED_PREFIXES = ["/dashboard"];

function hasSupabaseSession(req: NextRequest): boolean {
  return req.cookies
    .getAll()
    .some(c => c.name.startsWith("sb-") && c.name.includes("-auth-token") && c.value.length > 0);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = hasSupabaseSession(req);

  // Not logged in → block app pages. "/" is NOT one of them any more: it is
  // the public landing page now, and sending anonymous visitors to /login
  // was what left agentics-projects.com — linked from the company site —
  // showing a sign-in box and no explanation of what the product is.
  if (!authed && PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Back to this page after signing in (lib/safe-next.ts checks it there):
    // a shared link to a project used to end on the dashboard home.
    const back = pathname + req.nextUrl.search;
    if (back !== "/dashboard") url.searchParams.set("next", back);
    return NextResponse.redirect(url);
  }

  // The team's pages are checked for real, not just for a cookie: the session
  // is validated and the database asked whether this account is on the team
  // (lib/team-gate.ts). Anyone else gets the ordinary 404, so the page does not
  // even confirm that it exists. The data behind it refuses off the team too.
  if (authed && isTeamOnly(pathname)) {
    const { result, cookies } = await teamVerdict(req);
    let res: NextResponse;
    if (result === "team") {
      res = NextResponse.next();
    } else if (result === "no-session") {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname + req.nextUrl.search);
      res = NextResponse.redirect(url);
    } else {
      res = NextResponse.rewrite(new URL("/_not-team", req.url), { status: 404 });
    }
    for (const c of cookies) res.cookies.set(c.name, c.value, c.options);
    // Never kept by a shared cache: what it says depends on who is asking.
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  // NOTE: there used to be an "already logged in → skip /login" redirect here.
  // It was removed because it closed a redirect loop with no exit:
  //
  //   proxy sees the cookie      → "authed" → lets /dashboard render
  //   client resolves no session → no token → redirects to /login
  //   proxy sees the cookie      → "authed" → redirects back to /dashboard   ↺
  //
  // The two disagree whenever the cookie is present but its session is expired
  // or invalid, which this check cannot detect (see "Optimistic" above). The app
  // then sat on its loading skeleton forever, burning CPU, and a hard reload
  // could not escape it because the cookie survived. Landing a signed-in user on
  // /login is a cosmetic issue; an inescapable loop is not. The client redirects
  // to /dashboard on its own anyway (app/page.tsx, and the login form after sign-in).
  //
  // The same reason keeps "/" with a cookie on the client: sending it to
  // /dashboard from here would trust the cookie just as blindly, and an expired
  // one would loop the same way. The landing page checks the real session.
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/login"],
};
