"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconArrow, IconBack, IconX } from "@/components/layout/agxp-icons";
import { useOnClient } from "@/lib/use-on-client";
import { placeBubble, TOUR_SPOTS, type Placed, type Rect, type Spot } from "@/lib/tour-spots";

/**
 * The walk-through: a light on the real control, and a note beside it.
 *
 * The companion to the concept tour. That one has its own stage and explains
 * what the app is for; this one stays on the actual screen and says where to
 * press, because being told "two agents interview you" still leaves you
 * looking for the box to type in.
 *
 * Two things keep it from rotting:
 *   - it finds targets by `data-tour`, never by a styling class;
 *   - a target that is not on screen is dropped before the walk starts, so
 *     the step count matches what you will actually be shown and there is no
 *     step that highlights nothing.
 */
export function TourWalk({ onDone }: { onDone: () => void }) {
  const onClient = useOnClient();
  /*
   * Which spots exist, decided once at mount.
   *
   * Reading the DOM in a state initializer rather than an effect: by the
   * time this mounts the page is painted, and an effect would mean one
   * render with a list we already know is wrong.
   */
  const [spots] = useState<Spot[]>(() =>
    typeof document === "undefined"
      ? []
      : TOUR_SPOTS.filter(s => document.querySelector(`[data-tour="${s.anchor}"]`)));

  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<Placed | null>(null);
  /** Where the target's centre falls along the bubble's edge, so the arrow
   *  points at the control even when the bubble has been pushed off-centre
   *  by a window edge. */
  const [arrow, setArrow] = useState(0);
  /**
   * How many times anything has been placed. The bubble is laid out
   * off-screen until it has been measured, so animating the FIRST placement
   * means a panel sliding in from -9999px across the whole window. Movement
   * is only wanted between one resting place and the next, so the transition
   * is switched on from the second placement onward.
   */
  const [placements, setPlacements] = useState(0);
  const bubble = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const uid = useId();

  const spot = spots[i];
  const last = i === spots.length - 1;

  const finish = useCallback(() => onDone(), [onDone]);
  const go = useCallback((d: 1 | -1) => {
    setI(prev => {
      const n = prev + d;
      if (n < 0) return prev;
      if (n >= spots.length) { finish(); return prev; }
      return n;
    });
  }, [spots.length, finish]);

  /*
   * Measure, place, and keep doing it.
   *
   * A ResizeObserver rather than a measurement in the effect body: it fires
   * once as soon as it observes, so the first placement comes from the
   * observer's callback like every later one — and anything that moves the
   * target afterwards (a panel opening, the window resizing, a parent
   * scrolling) re-places the bubble instead of leaving it pointing at where
   * the button used to be.
   */
  useEffect(() => {
    if (!spot) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${spot.anchor}"]`);
    const bub = bubble.current;
    // onClient is in the deps for a reason that is invisible otherwise: the
    // first render returns null, so there is no bubble to measure and this
    // bails — and with only [spot] it would never run again, leaving the
    // bubble parked off-screen in its measuring state forever.
    if (!el || !bub) return;

    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });

    function measure() {
      const t = el!.getBoundingClientRect();
      const b = bub!.getBoundingClientRect();
      const view = { width: window.innerWidth, height: window.innerHeight };
      const target: Rect = { x: t.x, y: t.y, width: t.width, height: t.height };
      const placed = placeBubble(target, { width: b.width, height: b.height }, view, spot!.prefer);
      setRect(target);
      setPos(placed);

      const across = placed.side === "top" || placed.side === "bottom";
      const centre = across ? t.x + t.width / 2 : t.y + t.height / 2;
      const start = across ? placed.left : placed.top;
      const span = across ? b.width : b.height;
      // Kept clear of the bubble's rounded corners, where an arrow would
      // stick out of the curve instead of out of the edge.
      setArrow(Math.max(16, Math.min(centre - start - 5.5, span - 27)));
      setPlacements(n => n + 1);
    }

    // The first placement, guaranteed. A ResizeObserver's initial delivery
    // rides on the browser's rendering steps, and a tab that is not
    // rendering — hidden, backgrounded, a pane the user has collapsed —
    // never runs them, so the observer alone left the bubble parked
    // off-screen until something happened to resize. A timer fires anyway.
    const first = window.setTimeout(measure, 0);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(bub);
    // Capture, so a scroll inside a panel counts and not only the window's.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(first);
      ro.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [spot, onClient]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, finish]);

  // Focus the one button people will press, so Enter and Tab both land
  // somewhere sensible and a screen reader is taken to the note.
  useEffect(() => { nextBtn.current?.focus({ preventScroll: true }); }, []);

  // This screen has none of the anchors — a project document open full
  // screen, say. Rendering null and saying nothing would leave the caller
  // waiting on a walk that can never finish.
  const empty = spots.length === 0;
  useEffect(() => { if (empty) onDone(); }, [empty, onDone]);

  if (!onClient || empty || !spot) return null;

  return createPortal(
    <div className={`walk${placements > 1 ? " settled" : ""}`} role="dialog" aria-modal="true"
      aria-labelledby={`${uid}-t`}>
      {/*
        The dim, and the hole in it. One element carrying an enormous spread
        shadow is the whole trick: the box itself is transparent and sits
        exactly on the target, and the shadow is the rest of the screen.
        Four panels around the rect would need four more measurements and
        would show a hairline seam at every corner.
      */}
      <div className="walk-hole" aria-hidden="true"
        style={rect ? {
          left: rect.x - 6, top: rect.y - 6,
          width: rect.width + 12, height: rect.height + 12,
        } : { left: -9999, top: -9999, width: 0, height: 0 }} />

      {/* Catches the click, so pressing anywhere moves on and nothing
          underneath is triggered by accident. Behind the bubble. */}
      <button className="walk-catch" tabIndex={-1} aria-hidden="true" onClick={() => go(1)} />

      <div ref={bubble} className={`walk-bubble${pos ? ` on-${pos.side}` : " measuring"}`}
        style={pos ? { left: pos.left, top: pos.top, ["--arrow" as string]: `${arrow}px` } : undefined}>
        <span className="walk-count">{i + 1} of {spots.length}</span>
        <h2 id={`${uid}-t`}>{spot.title}</h2>
        <p>{spot.body}</p>
        <div className="walk-nav">
          <button className="walk-skip" onClick={finish}>
            Skip <IconX size={12} />
          </button>
          <span className="walk-spacer" />
          <button className="walk-back" onClick={() => go(-1)} disabled={i === 0}>
            <IconBack size={13} /> Back
          </button>
          <button className="walk-next" ref={nextBtn} onClick={() => go(1)}>
            {last ? "Done" : "Next"} <IconArrow size={13} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
