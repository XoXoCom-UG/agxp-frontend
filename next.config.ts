import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";

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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
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
