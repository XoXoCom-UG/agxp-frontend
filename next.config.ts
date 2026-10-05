import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";

/*
 * Vercel's preview toolbar — the one that lets a reviewer leave comments on
 * a deployment — loads from vercel.live, which the CSP below blocks. It is
 * allowed only OUTSIDE production: a review tool has no business on the
 * live site, and widening script-src there would be the one change in this
 * file that actually costs something.
 *
 * VERCEL_ENV is "production", "preview" or "development" on Vercel, and
 * unset elsewhere, so a local build gets it too.
 */
const previewToolbar = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";
const live = previewToolbar ? " https://vercel.live" : "";

const securityHeaders = [
  // Prevent the site from being embedded in iframes (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send origin as referrer to other sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful browser features we don't use
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Force HTTPS for 2 years, include subdomains
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Content Security Policy — pragmatic: allows Next.js inline scripts + HTTPS APIs
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'${live}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      `frame-src 'self'${live}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
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
 * this wrapper is applied. The CSP above already allows the ingest endpoint:
 * `connect-src` permits any https origin.
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
