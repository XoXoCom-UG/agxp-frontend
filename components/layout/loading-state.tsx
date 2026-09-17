"use client";

// Per-cell delay for the 3x3 grid's chevron wavefront (two fronts always in
// flight since the cycle is shorter than the full sweep) — ported from the
// reference, pure math, no styling dependency.
const CHEVRON_DELAYS = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

/** The 3x3 pixel-grid wavefront — small enough to sit inside a compact icon
 * button, used only by the Roadmap panel's PDF-download buttons while a
 * download is "generating". The full-row "agent is replying" wait uses the
 * simpler .msg-processing/.tline sweep in project-chat-panel.tsx instead. */
export function LoaderGrid({ dur = 650 }: { dur?: number }) {
  return (
    <span aria-hidden className="loading-grid">
      {CHEVRON_DELAYS.map((delay, i) => (
        <span key={i} className="loading-cell" style={{ animationDelay: `${delay}ms`, animationDuration: `${dur}ms` }} />
      ))}
    </span>
  );
}
