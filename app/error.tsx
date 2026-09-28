"use client";

import { useEffect } from "react";
import Link from "next/link";
import { IconArrow, IconRefresh } from "@/components/layout/agxp-icons";
import { BrandLogo } from "@/components/layout/brand-logo";

/**
 * Last-resort boundary for a render that threw. Same shell as the sign-in
 * screen. The digest is the one thing worth showing: it is how a report from
 * a user is matched to the server log, and it says nothing about the internals.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The message never reaches the screen, so it has to reach the console.
  useEffect(() => { console.error(error); }, [error]);

  return (
    <main className="auth">
      <div className="auth-form-col">
        <div className="auth-card status-card">
          <div className="auth-brand">
            <BrandLogo size={32} />
          </div>
          <h1>Something went wrong</h1>
          <p className="auth-sub">
            This page ran into an unexpected error. Your projects are saved, so trying again is safe.
          </p>
          <div className="status-actions">
            <button className="btn-primary-wide" type="button" onClick={reset}>
              <IconRefresh size={13} />Try again
            </button>
            <Link className="btn-secondary-wide" href="/dashboard">
              Go to your workspace<IconArrow />
            </Link>
          </div>
          {error.digest && <p className="status-digest">Error reference: {error.digest}</p>}
        </div>
      </div>
    </main>
  );
}
