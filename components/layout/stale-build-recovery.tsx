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
 *
 * Only a failed chunk load counts. Any other error that merely happened inside
 * a file under _next/static (which is every file of the app) used to trigger
 * the reload too, throwing away whatever the user had typed.
 */

const GUARD = "mf_stale_build_reloaded";
/** A tab that has run this long without a chunk failure is on a good build:
 *  the guard is cleared so a later deploy can recover it again. */
const HEALTHY_AFTER_MS = 10_000;

// What Next/Turbopack and the browsers throw when a chunk can't be fetched.
const MESSAGES = [
  "Loading chunk",
  "Loading CSS chunk",
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
];

function isChunkLoadFailure(name: string | undefined, message: string | undefined): boolean {
  if (name === "ChunkLoadError") return true;
  const text = message ?? "";
  return MESSAGES.some(p => text.includes(p));
}

// sessionStorage throws in some privacy modes and sandboxed frames. Failing
// closed (treat as "already reloaded") is what keeps a broken build from
// looping when the guard can't be written.
function guardSet(): boolean {
  try { return sessionStorage.getItem(GUARD) !== null; } catch { return true; }
}
function setGuard(): boolean {
  try { sessionStorage.setItem(GUARD, "1"); return true; } catch { return false; }
}
function clearGuard(): void {
  try { sessionStorage.removeItem(GUARD); } catch { /* nothing to clear */ }
}

export function StaleBuildRecovery() {
  useEffect(() => {
    function recover(name: string | undefined, message: string | undefined) {
      if (!isChunkLoadFailure(name, message)) return;
      // Only ever once per tab: a build that is actually broken must surface the
      // error instead of being hidden behind a reload loop.
      if (guardSet()) return;
      if (!setGuard()) return;
      location.reload();
    }

    const onError = (e: ErrorEvent) => {
      const err = e.error as { name?: string; message?: string } | null | undefined;
      recover(err?.name, err?.message ?? e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string } | string | null | undefined;
      if (typeof r === "string") recover(undefined, r);
      else recover(r?.name, r?.message);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    const healthy = setTimeout(clearGuard, HEALTHY_AFTER_MS);
    return () => {
      clearTimeout(healthy);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
