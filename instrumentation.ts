import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry, plus the one hook that catches errors Next swallows.
 *
 * `register()` runs once per server instance; the runtime check matters
 * because proxy.ts runs on the edge and needs its own init with no Node APIs.
 * `onRequestError` is the part that was missing entirely — without it, an
 * error thrown while rendering a Server Component or inside a route handler
 * never reaches Sentry.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Node only: the edge runtime has its own environment and would say it
    // twice. Quiet when everything is set.
    (await import("./lib/config-check")).reportConfig();
  }
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;
