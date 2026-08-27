import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
const PROTECTED_PREFIXES = ["/chat", "/concept", "/dashboard"];

function hasSupabaseSession(req: NextRequest): boolean {
  return req.cookies
    .getAll()
    .some(c => c.name.startsWith("sb-") && c.name.includes("-auth-token") && c.value.length > 0);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = hasSupabaseSession(req);

  // Not logged in → block app pages
  if (!authed && PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // NOTE: there used to be an "already logged in → skip /login" redirect here.
  // It was removed because it closed a redirect loop with no exit:
  //
  //   proxy sees the cookie      → "authed" → lets /chat render
  //   client resolves no session → no token → redirects to /login
  //   proxy sees the cookie      → "authed" → redirects back to /chat        ↺
  //
  // The two disagree whenever the cookie is present but its session is expired
  // or invalid, which this check cannot detect (see "Optimistic" above). The app
  // then sat on its loading skeleton forever, burning CPU, and a hard reload
  // could not escape it because the cookie survived. Landing a signed-in user on
  // /login is a cosmetic issue; an inescapable loop is not. The client redirects
  // to /chat on its own anyway (app/page.tsx, and the login form after sign-in).
  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*", "/concept/:path*", "/dashboard/:path*", "/login"],
};
