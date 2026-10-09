import type { MetadataRoute } from "next";
import { SITE_URL, IS_PREVIEW } from "@/lib/site-url";

/**
 * robots.txt.
 *
 * Almost all of this app is behind a sign-in, so the question is not "what
 * may be crawled" but "what is worth crawling": the sign-in page and the
 * three legal pages, which German law wants publicly reachable anyway.
 *
 * Everything else is disallowed explicitly rather than left to the gate.
 * A crawler that follows a link into /dashboard gets a redirect and learns
 * nothing, but it still spends a request on every one — and /api routes
 * answer 401 to a crawler, which looks like a broken site in Search Console.
 *
 * A preview deployment is disallowed whole: the same pages on a second host
 * is duplicate content, and an unfinished branch is not what anyone should
 * find in a search.
 */
export default function robots(): MetadataRoute.Robots {
  if (IS_PREVIEW) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/api/", "/auth/", "/reset"],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
