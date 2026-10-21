import * as Sentry from "@sentry/nextjs";
import { readConsent, startErrorReporting } from "@/lib/consent";

/**
 * Browser-side Sentry — only with consent.
 *
 * This replaces sentry.client.config.ts, which was in the repo but never ran:
 * the SDK only picks that file up through its webpack plugin, and this project
 * builds with Turbopack. The SDK says so itself — see the deprecation warning
 * in @sentry/nextjs/build/cjs/config/webpack.js. Next loads this file natively,
 * before hydration, so it works under either bundler.
 *
 * It used to start for everyone. It now starts only when the person accepted
 * error reporting in the cookie banner (lib/consent.ts); otherwise the banner
 * starts it later, at the moment they click "Akzeptieren".
 *
 * No session replay. @sentry/nextjs v10 does not export `replayIntegration`
 * anyway, but the real reason is that replay records the user's screen, and
 * these screens contain a customer's business figures. Turning it on is a
 * privacy decision with a Datenschutz consequence, not a config tweak.
 */
if (readConsent() === "accepted") startErrorReporting();

/** Lets Sentry tie an error to the navigation that led to it. A no-op until it has started. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
