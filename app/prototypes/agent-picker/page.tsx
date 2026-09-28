"use client";

/* Prototype harness — the agent picker's empty state, three directions.
   Delete this folder once a variant has been promoted. */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./proto.css";
import { Anchored } from "./anchored";
import { Portrait } from "./portrait";
import { Joined } from "./joined";

/* Round 2 (Ana, 2026-09-27): keep the structure exactly — head, then
   Create and Train — and only design it better. */
const VARIANTS = [
  { name: "Anchored", Comp: Anchored },
  { name: "Portrait", Comp: Portrait },
  { name: "Joined", Comp: Joined },
];

export default function Page() {
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const highlightRef = useRef<HTMLSpanElement>(null);

  // Selection persists across reload via ?v=N.
  useEffect(() => {
    // Read after mount (the server has no URL to read), then enable the
    // highlight slide a frame later so the initial position doesn't animate.
    // A timeout, not rAF, for the read: rAF never fires in a background tab.
    let inner = 0;
    const id = setTimeout(() => {
      const v = parseInt(new URLSearchParams(location.search).get("v") ?? "", 10);
      if (v >= 1 && v <= VARIANTS.length) setCurrent(v - 1);
      inner = requestAnimationFrame(() => setReady(true));
    }, 0);
    return () => { clearTimeout(id); cancelAnimationFrame(inner); };
  }, []);

  useLayoutEffect(() => {
    const el = itemRefs.current[current];
    const hl = highlightRef.current;
    if (!el || !hl) return;
    hl.style.width = `${el.offsetWidth}px`;
    hl.style.transform = `translateX(${el.offsetLeft}px)`;
    // Only once the initial ?v has been read — writing it earlier would
    // overwrite the very value the first frame is about to read.
    if (!ready) return;
    const url = new URL(location.href);
    url.searchParams.set("v", String(current + 1));
    history.replaceState(null, "", url);
  }, [current, ready]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= VARIANTS.length) setCurrent(n - 1);
      else if (e.key === "ArrowRight") setCurrent(c => (c + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft") setCurrent(c => (c - 1 + VARIANTS.length) % VARIANTS.length);
    }
    function onResize() {
      const el = itemRefs.current[current];
      const hl = highlightRef.current;
      if (el && hl) { hl.style.width = `${el.offsetWidth}px`; hl.style.transform = `translateX(${el.offsetLeft}px)`; }
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); };
  }, [current]);

  const { Comp } = VARIANTS[current];
  return (
    <>
      {/* Keyed: switching re-mounts the variant, so its state starts fresh. */}
      <Comp key={current} />
      <nav className="proto-picker" aria-label="Prototype variants" data-ready={ready ? "" : undefined}>
        <span className="proto-picker-highlight" aria-hidden="true" ref={highlightRef} />
        {VARIANTS.map((v, i) => (
          <button key={v.name} ref={el => { itemRefs.current[i] = el; }}
            className="proto-picker-item" data-active={i === current ? "" : undefined}
            aria-current={i === current ? "true" : undefined} onClick={() => setCurrent(i)}>
            {v.name}
          </button>
        ))}
      </nav>
    </>
  );
}
