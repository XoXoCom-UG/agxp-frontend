/**
 * Where this deployment lives.
 *
 * Three files need the absolute origin — the root layout's `metadataBase`,
 * robots.txt and the sitemap — and a robots.txt pointing at one host while
 * the sitemap lists another is worse than having neither. So it is computed
 * once, here.
 *
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every deployment, including
 * previews, and it always names the PRODUCTION host — which is what these
 * three want. A preview that advertised its own throwaway URL as canonical
 * would invite the crawler to index it.
 */
export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/** True when this build is not the production deployment. Previews must not
 *  be indexed: the same pages on a second host is duplicate content, and a
 *  half-finished branch is not what anyone should find in a search. */
export const IS_PREVIEW: boolean =
  process.env.VERCEL_ENV !== undefined && process.env.VERCEL_ENV !== "production";
