import * as Sentry from "@sentry/nextjs";

/** Loaded by instrumentation.ts on the edge runtime — this is where proxy.ts runs. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
