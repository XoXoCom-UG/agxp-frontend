"use client";

import { useEffect } from "react";

/*
 * Recovers a tab that was left open across a deployment.
 *
 * The App Router fetches route code and RSC payloads on demand. After a deploy
 * those URLs are gone, so an already-open tab requests a chunk that 404s. React
 * never resolves the boundary and the page sits on its loading skeleton with no
 * error shown — indistinguishable from a hang, and the only way out is a manual
 * hard reload. That happened on the 2026-08-03 production deploy.
 *
 * So: watch for chunk-load failures and reload once. The sessionStorage guard is
 * the important part — without it a genuinely broken build would reload forever.
 */

const GUARD = "mf_stale_build_reloaded";

// Matches what Next/Turbopack throw when a chunk or RSC payload can't be fetched.
const PATTERNS = [
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "_next/static",
];

function looksStale(text: string): boolean {
  return PATTERNS.some(p => text.includes(p));
}

export function StaleBuildRecovery() {
  useEffect(() => {
    function recover(text: string) {
      if (!looksStale(text)) return;
      // Only ever once per tab: a build that is actually broken must surface the
      // error instead of being hidden behind a reload loop.
      if (sessionStorage.getItem(GUARD)) return;
      sessionStorage.setItem(GUARD, "1");
      location.reload();
    }

    const onError = (e: ErrorEvent) =>
      recover(`${e.message} ${e.error?.name ?? ""} ${e.filename ?? ""}`);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      recover(typeof r === "string" ? r : `${r?.name ?? ""} ${r?.message ?? ""}`);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
