"use client";

import { useEffect, useState } from "react";

// Per-cell delay for the 3x3 grid's chevron wavefront (two fronts always in
// flight since the cycle is shorter than the full sweep) — ported from the
// reference, pure math, no styling dependency.
const CHEVRON_DELAYS = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

/** The 3x3 pixel-grid wavefront on its own — small enough to sit inside a
 * compact icon button (the Roadmap's download buttons), not just the full
 * LoadingState row below. */
export function LoaderGrid({ dur = 650 }: { dur?: number }) {
  return (
    <span aria-hidden className="loading-grid">
      {CHEVRON_DELAYS.map((delay, i) => (
        <span key={i} className="loading-cell" style={{ animationDelay: `${delay}ms`, animationDuration: `${dur}ms` }} />
      ))}
    </span>
  );
}

function useElapsed() {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDs(d => d + 1), 100);
    return () => clearInterval(t);
  }, []);
  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

/** Pixel-grid loader + shimmering label + live elapsed timer — the "agent is
 * replying" wait (label cycles through project-chat-panel's own contextual
 * pool) and the Roadmap's PDF-generation wait. */
export function LoadingState({ label = "Working" }: { label?: string }) {
  const elapsed = useElapsed();
  return (
    <div role="status" className="loading-state">
      <LoaderGrid />
      <span className="shimmer-text loading-label">{label}</span>
      <span className="loading-timer">{elapsed}</span>
    </div>
  );
}
