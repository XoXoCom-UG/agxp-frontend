import type { Metadata } from "next";
import Link from "next/link";
import { IconArrow } from "@/components/layout/agxp-icons";
import { BrandLogo } from "@/components/layout/brand-logo";

// Collected for the 404 like a page's own metadata, so the tab says what
// happened instead of the default app title.
export const metadata: Metadata = { title: "Page not found" };

/** Unmatched URLs and notFound() calls. Same shell as the sign-in screen, so a
 *  wrong link still lands somewhere that looks like the app. */
export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth-form-col">
        <div className="auth-card status-card">
          <div className="auth-brand">
            <BrandLogo size={32} />
          </div>
          <p className="status-code" aria-hidden="true">404</p>
          <h1>Page not found</h1>
          <p className="auth-sub">The page you were looking for doesn&apos;t exist, or it has moved.</p>
          <Link className="btn-primary-wide" href="/dashboard">
            Go to your workspace<IconArrow />
          </Link>
        </div>
      </div>
    </main>
  );
}
