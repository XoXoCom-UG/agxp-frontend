import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * The sitemap.
 *
 * Only the pages a signed-out visitor can actually open. Listing a page the
 * crawler is then redirected away from is how a site ends up with a column
 * of "Page with redirect" in Search Console, and it tells a reader nothing.
 *
 * So: the sign-in page, and the three legal pages. Everything else in this
 * app needs an account and an invitation, and /reset is a page you arrive at
 * from an email, never from a search.
 *
 * `lastModified` is the build time rather than a hand-kept date. A date
 * somebody has to remember to bump is a date that is wrong, and these pages
 * change when the app is deployed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/impressum`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/datenschutz`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/agb`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
