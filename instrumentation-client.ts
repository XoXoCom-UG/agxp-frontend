import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side Sentry.
 *
 * This replaces sentry.client.config.ts, which was in the repo but never ran:
 * the SDK only picks that file up through its webpack plugin, and this project
 * builds with Turbopack. The SDK says so itself — see the deprecation warning
 * in @sentry/nextjs/build/cjs/config/webpack.js. Next loads this file natively,
 * before hydration, so it works under either bundler.
 *
 * No session replay. @sentry/nextjs v10 does not export `replayIntegration`
 * anyway, but the real reason is that replay records the user's screen, and
 * these screens contain a customer's business figures. Turning it on is a
 * privacy decision with a Datenschutz consequence, not a config tweak.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Errors are always sent; this only samples performance traces, which are
  // not what we are watching for. A tenth is enough to spot a slow route.
  tracesSampleRate: 0.1,

  // Never attach IP addresses, cookies or headers to an event. The useful part
  // of a report here is the stack, and the rest is a customer's data.
  sendDefaultPii: false,
});

/** Lets Sentry tie an error to the navigation that led to it. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
