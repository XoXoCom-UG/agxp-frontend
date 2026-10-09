import type { Metadata } from "next";
import { Landing } from "@/components/layout/landing";

/**
 * "/" is the public landing page.
 *
 * It used to be a redirect — proxy.ts sent anonymous visitors to /login and
 * this page only decided where cookie holders went. That left
 * agentics-projects.com, which is linked from the company site, showing a
 * sign-in box and nothing else (2026-10-09 call).
 *
 * A server component so it can carry its own metadata; the session check
 * that forwards a signed-in visitor to the workspace lives in <Landing>,
 * which is the client half.
 */
export const metadata: Metadata = {
  title: "AgentiX Projects",
  description:
    "Two AI agents work one transformation with you: a Consultant who writes the "
    + "Transformation Concept, and a Coach who writes the Change Plan.",
  alternates: { canonical: "/" },
};

export default function Page() {
  return <Landing />;
}
