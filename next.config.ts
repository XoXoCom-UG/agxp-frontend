import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import path from "node:path";

/**
 * Where the browser may connect. It used to be any https/wss origin, which
 * means a script injected through some future XSS could post a user's session
 * or documents anywhere. The browser only ever talks to this site, Supabase
 * (REST, auth, storage, realtime) and Sentry's ingest, so that is the list.
 * Resend is called from the server, never the browser.
 */
function originOf(url: string | undefined): string | null {
  try { return url ? new URL(url).origin : null; } catch { return null; }
}
const supabase = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const sentry = originOf(process.env.NEXT_PUBLIC_SENTRY_DSN);
// Cloudflare Turnstile, the bot check on the login page: its script, the
// iframe it draws in, and the calls it makes from there.
const TURNSTILE = "https://challenges.cloudflare.com";

const connectSrc = [
  "'self'",
  TURNSTILE,
  supabase,
  supabase?.replace(/^https:/, "wss:"),
  sentry,
].filter(Boolean).join(" ");

// React's dev tooling needs eval; a production build does not, and allowing
// it there only helps an injected script.
const scriptSrc = process.env.NODE_ENV === "production"
  ? `script-src 'self' 'unsafe-inline' ${TURNSTILE}`
  : `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${TURNSTILE}`;

const securityHeaders = [
  // Prevent the site from being embedded in iframes (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send origin as referrer to other sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful browser features we don't use
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // A page opened from here (or that opened us) gets no handle on this window,
  // so a malicious tab cannot navigate or probe it. Sign-in with a provider is
  // a full-page redirect, not a popup, so nothing here needs the opener.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Force HTTPS for 2 years, include subdomains
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Content Security Policy — pragmatic: allows Next.js inline scripts + HTTPS APIs
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      // No https: here. Nothing in the app shows a picture from another site, and
      // an image whose address carries data is how a model that was talked into it
      // would send that data away without a click (lib/markdown.ts never draws one
      // either; this is the second lock).
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      `frame-src ${TURNSTILE}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "worker-src 'self' blob:",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // There is an unrelated package-lock.json in the user's home directory, and
  // Turbopack picks the outermost lockfile as the workspace root. Left alone
  // it watches and resolves from C:\Users\<name>, which is slower and not
  // what anyone meant. Pinning it is a one-line fix that does not require
  // deleting a file outside this repository.
  turbopack: { root: path.join(__dirname) },

  /*
   * Sentry's Node SDK instruments other modules at require() time through
   * require-in-the-middle, which Turbopack cannot bundle: the dev server
   * died on boot with "Cannot find module
   * require-in-the-middle-<hash>" the moment instrumentation.ts loaded it.
   * Sentry only works around this on the webpack path, so these have to be
   * left to Node's own resolver here.
   */
  serverExternalPackages: [
    "@sentry/nextjs",
    "@sentry/node",
    "require-in-the-middle",
    "import-in-the-middle",
  ],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

/**
 * Sentry is wired here, not by the two sentry.*.config.ts files alone — those
 * only ever load because something imports them (instrumentation.ts) or because
 * this wrapper is applied. The CSP above allows the ingest endpoint by taking
 * its origin from NEXT_PUBLIC_SENTRY_DSN.
 *
 * Source maps are only uploaded when SENTRY_AUTH_TOKEN, SENTRY_ORG and
 * SENTRY_PROJECT are set in the build environment. Without them the build still
 * succeeds and errors still arrive — the stack traces are just minified.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Nothing about our build goes to Sentry's own analytics.
  telemetry: false,
  // Quiet unless CI is reading the log.
  silent: !process.env.CI,
  // No disableLogger here: it is deprecated, and it was never applied under
  // Turbopack, which is what this project builds with.
});
