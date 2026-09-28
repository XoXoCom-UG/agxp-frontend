"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { AgentType } from "@/lib/agents";
import { useMascotLevel, MAX_MASCOT_LEVEL } from "@/lib/mascot-level";

export type MascotState = "idle" | "listening" | "thinking" | "working" | "speaking" | "success" | "error";

/**
 * A short reaction to something that just happened, played once and then
 * dropped. Reactions are what make the character read as alive — idle motion
 * only makes it read as busy.
 */
export type MascotMood = "nod" | "curious" | "pleased" | "proud" | "levelUp" | null;

/**
 * Where the eyes look. A preset points at a rough, fixed direction relative
 * to the mascot (there is no real layout geometry to query for "the composer"
 * or "the choice card" — these are small UI regions, not measured targets),
 * `{x,y}` is a real viewport point the mascot turns toward, `null` resumes
 * following the cursor.
 */
export type LookTarget = "input" | "card" | "result" | "up" | { x: number; y: number } | null;

const LOOK_PRESETS: Record<Exclude<LookTarget, null | { x: number; y: number }>, [number, number]> = {
  input: [0, 2.1],
  card: [1.3, 1.6],
  result: [0, 1.7],
  up: [0, -2.2],
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Moves the eyes: follows the cursor at a couple of px, or turns toward
 * `lookAt` when one is set. Writes the `translate` property straight onto
 * each eye — no React state, so it never causes a render, and no variable on
 * a parent that the rest of the face would have to recalculate for. Consultant tracks slower and
 * more contained than Coach.
 *
 * The loop only runs while the eyes are still moving: a mouse move (or a new
 * `lookAt`) starts it, and it stops once they have settled. The mascot's box
 * is measured when a run starts and again after scroll or resize, not on
 * every frame — a page of list rows used to hold one forced layout per
 * mascot per frame, forever.
 */
function useEyeTracking(ref: React.RefObject<HTMLSpanElement | null>, personality: AgentType, lookAt: LookTarget) {
  const lookAtRef = useRef(lookAt);
  const kick = useRef<() => void>(() => {});
  useEffect(() => { lookAtRef.current = lookAt; kick.current(); }, [lookAt]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const node = ref.current;
    const tracks = node ? Array.from(node.querySelectorAll<SVGGElement>(".m-eye-track")) : [];
    if (!node || tracks.length === 0) return;

    let raf = 0;
    let mouseX = 0;
    let mouseY = 0;
    let hasMouse = false;
    let curX = 0;
    let curY = 0;
    let box: DOMRect | null = null;
    const k = personality === "consultant" ? 0.1 : 0.18;

    function centre() {
      if (!box) box = node!.getBoundingClientRect();
      return { cx: box.left + box.width / 2, cy: box.top + box.height / 2 };
    }

    function target(): [number, number] {
      const look = lookAtRef.current;
      if (look && typeof look === "object") {
        const { cx, cy } = centre();
        const dx = look.x - cx, dy = look.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const mag = Math.min(2.4, dist / 30);
        return [(dx / dist) * mag, (dy / dist) * mag];
      }
      if (look) return LOOK_PRESETS[look];
      if (!hasMouse) return [0, 0];
      const { cx, cy } = centre();
      const dx = mouseX - cx, dy = mouseY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      // Standing further than this, the mascot still glances the right way,
      // just at a smaller, calmer amplitude — up close it looks right at you.
      const max = dist < 120 ? 3 : 2;
      const mag = Math.min(max, dist / 40);
      return [(dx / dist) * mag, (dy / dist) * mag];
    }

    function tick() {
      raf = 0;
      if (!node!.isConnected) return;
      const [tx, ty] = target();
      curX += (tx - curX) * k;
      curY += (ty - curY) * k;
      // The `translate` property on each eye itself, not a variable on a
      // parent: nothing else recalculates, and it composes with the
      // scaleY(--eye-scale) state transform the CSS keeps on the same node.
      const t = `${curX.toFixed(2)}px ${curY.toFixed(2)}px`;
      for (const track of tracks) track.style.translate = t;
      if (Math.abs(tx - curX) > 0.02 || Math.abs(ty - curY) > 0.02) raf = requestAnimationFrame(tick);
    }

    function start() {
      if (raf) return;
      // A fresh run re-measures: the panel may have been resized or folded
      // since the eyes last moved.
      box = null;
      raf = requestAnimationFrame(tick);
    }
    function onMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      hasMouse = true;
      start();
    }
    function invalidate() { box = null; }

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", invalidate, { passive: true, capture: true });
    window.addEventListener("resize", invalidate);
    kick.current = start;
    start();

    return () => {
      cancelAnimationFrame(raf);
      kick.current = () => {};
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", invalidate, { capture: true });
      window.removeEventListener("resize", invalidate);
    };
  }, [ref, personality]);
}

/** The parts a level can add: rings, ears, helmets, caps, the mic. */
const LEVEL_PARTS = ".m-ring, .m-ear, .m-ear-line, [class^='lv-'], [class*=' lv-']";

/**
 * When the level goes up, only the parts that did not exist a moment ago
 * grow in (scale 0.9 → 1 with a fade, just after the level-up ring) — the
 * rest of the face stays put. React keeps the DOM nodes of parts that
 * survive a level change, so "new" is simply "a node we have not seen".
 * Nothing plays on the first render: that is just where the agent already is.
 */
function useLevelPartsEnter(ref: React.RefObject<HTMLSpanElement | null>, level: number) {
  const seen = useRef<WeakSet<Element> | null>(null);
  const prev = useRef(level);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const parts = Array.from(node.querySelectorAll(LEVEL_PARTS));
    const grew = seen.current !== null && level > prev.current;
    if (!seen.current) seen.current = new WeakSet();
    for (const el of parts) {
      if (grew && !seen.current.has(el)) {
        // A part with its own SVG transform (a rotated LED, the mic tip)
        // would lose it under a CSS transform, so those only fade.
        el.classList.add(el.hasAttribute("transform") ? "lv-enter-fade" : "lv-enter");
      }
      seen.current.add(el);
    }
    prev.current = level;
  }, [ref, level]);
}

/** Prefix for the shared gradients in <MascotDefs/> — mounted once in the
 *  root layout, because a gradient that lives inside a display:none mascot
 *  (the folded Coach) stops painting for every other mascot that uses it. */
const G = (name: string) => `url(#agxpm-${name})`;

function EarTab({ side }: { side: "l" | "r" }) {
  const x = side === "l" ? 6.6 : 36.4;
  const lx = side === "l" ? 7.9 : 40.1;
  return (<>
    <rect className="m-ear" x={x} y="20.2" width="5.0" height="8.2" rx="2.1" />
    <path className="m-ear-line" d={`M${lx},21.9 V26.7`} />
  </>);
}
function EarPad({ side }: { side: "l" | "r" }) {
  const x = side === "l" ? 5.0 : 37.0;
  const lx = side === "l" ? 6.5 : 41.5;
  return (<>
    <rect className="m-ear" x={x} y="18.8" width="6.0" height="10.4" rx="2.6" />
    <path className="m-ear-line" d={`M${lx},20.9 V27.1`} />
  </>);
}

/** The antenna grows with the level: a ring added at L2, L3 and L4, and a
 *  brighter tip at L5. */
function Antenna({ level }: { level: number }) {
  return (<>
    {level >= 4 && <circle className="m-ring" cx="24" cy="5" r="8.4" strokeWidth=".28" opacity=".38" />}
    {level >= 3 && <circle className="m-ring" cx="24" cy="5" r="6.3" strokeWidth=".32" opacity=".6" />}
    {level >= 2 && <circle className="m-ring" cx="24" cy="5" r="4.2" strokeWidth=".38" opacity=".9" />}
    <path className="m-antenna" d="M24,12.4 V7.2" />
    <circle className={`m-antenna-dot${level >= 5 ? " is-max" : ""}`} cx="24" cy="5" r="2.45" />
  </>);
}

/** What sits behind the head, over the face panel, and in front of the head,
 *  for each role and level — copied one to one from design-mascots/preview.html. */
function levelParts(role: AgentType, L: number) {
  let behind: React.ReactNode = null;
  let overPanel: React.ReactNode = null;
  let front: React.ReactNode = null;

  if (role === "consultant") {
    behind = (<>
      {(L === 1 || L === 4) && <><EarTab side="l" /><EarTab side="r" /></>}
      {L >= 2 && L <= 3 && <EarTab side="l" />}
      {L >= 2 && L <= 3 && (
        // right-side data module — sits behind the head, only its outer part shows
        <>
          <rect className="lv-mod" x="35.4" y="19.3" width="7.4" height="10.9" rx="3.2" />
          <rect className="lv-bar" x="39.6" y="21.2" width="2.6" height="1.0" rx="0.5" />
          <rect className="lv-bar" x="39.6" y="23.4" width="2.6" height="1.0" rx="0.5" />
          <rect className="lv-bar" x="39.6" y="25.6" width="2.6" height="1.0" rx="0.5" />
        </>
      )}
    </>);
    if (L >= 3 && L <= 4) {
      // HUD lens over the right eye: thin bright ring + broken outer arc
      overPanel = (<>
        <circle className="lv-hud" cx="28.5" cy="23.5" r="4.7" strokeWidth=".42" />
        <path className="lv-hud" strokeWidth=".36" d="M29.9,17.4 A6.3,6.3 0 0 1 34.3,21.3" />
        <path className="lv-hud" strokeWidth=".36" d="M34.5,25.3 A6.3,6.3 0 0 1 30.4,29.5" />
        <path className="lv-hud" strokeWidth=".3" d="M33.5,23.2 H34.9" />
      </>);
    }
    if (L === 4) {
      // tilted armour plate over the top-left corner, with indicator LEDs
      front = (<>
        <path className="lv-rim-thin" d="M9.0,17.1 A8.4,8.4 0 0 1 14.0,12.1" />
        <g className="lv-plate-led">
          <rect x="10.6" y="15.3" width="1.6" height="0.8" rx="0.4" transform="rotate(-52 11.4 15.7)" />
          <rect x="11.7" y="14.2" width="1.6" height="0.8" rx="0.4" transform="rotate(-39 12.5 14.6)" />
          <rect x="13.0" y="13.3" width="1.6" height="0.8" rx="0.4" transform="rotate(-26 13.8 13.7)" />
        </g>
        <path className="lv-scan" d="M32.6,23.5 H35.0" />
        <path className="lv-scan" d="M33.8,22.4 V24.6" />
        <path className="lv-scan" d="M36.6,21.7 H40.4" />
        <path className="lv-scan" d="M36.6,22.9 H42.0" />
        <path className="lv-scan" d="M36.6,24.1 H39.6" />
        <path className="lv-scan" d="M36.6,25.3 H41.2" />
      </>);
    }
    if (L === 5) {
      // full helmet: faceted dome, brow that dips in the middle, side pillars
      front = (<>
        <path className="lv-helmet" d="M7.8,20.8 C7.8,14.8 11.6,10.4 24,10.4 C36.4,10.4 40.2,14.8 40.2,20.8 L37.4,17.6 C34.8,19.6 31.0,19.9 24,19.9 C17.0,19.9 13.2,19.6 10.6,17.6 Z" />
        <path className="lv-helmet-edge" d="M7.8,20.8 C7.8,14.8 11.6,10.4 24,10.4 C36.4,10.4 40.2,14.8 40.2,20.8" />
        <path className="lv-wedge" d="M22.6,10.8 L25.4,10.8 L24,16.9 Z" />
        <path className="lv-gloss-panel" d="M12.8,14.8 L17.6,11.8 L18.9,12.9 L13.9,16.1 Z" />
        <g className="lv-gloss-panel">
          <path d="M29.8,14.8 L31.2,12.1 L32.4,12.1 L31.0,14.8 Z" />
          <path d="M32.1,14.8 L33.5,12.1 L34.7,12.1 L33.3,14.8 Z" />
          <path d="M34.4,14.8 L35.8,12.1 L37.0,12.1 L35.6,14.8 Z" />
        </g>
        <path className="lv-brow" strokeWidth=".46" d="M10.6,17.6 C13.2,19.6 17.0,19.9 24,19.9 C31.0,19.9 34.8,19.6 37.4,17.6" />
        <path className="lv-brow-core" d="M11.6,17.8 C14.0,19.4 17.6,19.6 24,19.6 C30.4,19.6 34.0,19.4 36.4,17.8" />
        <rect className="lv-pillar" x="6.6" y="17.2" width="5.0" height="12.2" rx="2.5" />
        <rect className="lv-pillar" x="36.4" y="17.2" width="5.0" height="12.2" rx="2.5" />
        <path className="lv-pillar-line" d="M10.4,19.0 V27.6" />
        <path className="lv-pillar-line" d="M37.6,19.0 V27.6" />
      </>);
    }
  }

  if (role === "coach") {
    behind = L <= 3
      ? <><EarTab side="l" /><EarTab side="r" /></>
      : <><EarPad side="l" /><EarPad side="r" /></>;

    const mic = L >= 2 ? (
      // headset mic: pale arm off the right ear, blue tip beside the mouth
      <>
        <path className="lv-mic-arm" strokeWidth=".6" d="M39.4,25.6 C40.6,29.4 38.6,31.8 35.2,32.3" />
        <rect className="lv-mic-tip" x="30.2" y="30.7" width="5.0" height="2.9" rx="1.45" transform="rotate(-13 32.7 32.15)" />
      </>
    ) : null;

    let hat: React.ReactNode = null;
    if (L === 3) {
      // headband across the crown: narrow dark band between two bright rims
      hat = (
        <g clipPath={G("clipHead")}>
          <path className="lv-band" d="M6,11.2 H42 V16.6 C33.6,15.2 14.4,15.2 6,16.6 Z" />
          <path className="lv-rim" d="M8.6,16.5 C14.4,15.1 33.6,15.1 39.4,16.5" />
          <path className="lv-rim-thin" d="M9.2,15.4 C9.8,12.7 14.2,11.9 24,11.9 C33.8,11.9 38.2,12.7 38.8,15.4" />
          <g className="lv-stripe" strokeWidth=".95">
            <path d="M30.3,15.2 L31.7,12.7" />
            <path d="M32.6,15.1 L34.0,12.6" />
          </g>
        </g>
      );
    }
    if (L === 4) {
      // cap: filled crown, glowing brim arch, two slashes, one LED left
      hat = (
        <g clipPath={G("clipHead")}>
          <path className="lv-band" d="M6,10 H42 V17.8 C33,15.3 15,15.3 6,17.8 Z" />
          <g className="lv-stripe" strokeWidth="1.3">
            <path d="M29.4,15.0 L31.8,11.4" />
            <path d="M32.4,14.8 L34.8,11.3" />
          </g>
          <rect className="lv-bar" x="11.6" y="12.7" width="1.4" height="2.8" rx="0.65" transform="rotate(10 12.3 14.1)" />
          <path className="lv-rim" d="M8.6,17.5 C15,15.3 33,15.3 39.4,17.6" />
          <path className="lv-rim-thin" d="M9.0,18.8 C8.8,17.2 8.9,16.4 9.4,15.4" />
          <path className="lv-rim-thin" d="M39.0,18.9 C39.2,17.3 39.1,16.5 38.6,15.5" />
        </g>
      );
    }
    if (L === 5) {
      // full cap: crown rises past the head line, thick brim, three stripes
      hat = (<>
        <path className="lv-helmet" d="M7.2,19.6 C7.2,11.5 13.8,8.3 24,8.3 C34.2,8.3 40.8,11.5 40.8,19.6 C33.6,15.7 14.4,15.7 7.2,19.6 Z" />
        <path className="lv-helmet-edge" d="M7.2,19.6 C7.2,11.5 13.8,8.3 24,8.3 C34.2,8.3 40.8,11.5 40.8,19.6" />
        <g className="lv-stripe" strokeWidth="1.55">
          <path d="M28.4,15.0 L31.2,10.4" />
          <path d="M31.8,14.6 L34.6,10.2" />
        </g>
        <g className="lv-stripe-soft" strokeWidth="1.45">
          <path d="M35.2,14.8 L37.6,10.9" />
        </g>
        <g className="lv-stripe" strokeWidth=".95">
          <path d="M10.8,15.4 L12.4,12.3" />
          <path d="M13.4,14.6 L14.9,11.8" />
        </g>
        <path className="lv-rim" strokeWidth=".7" d="M7.4,19.2 C14.4,15.8 33.6,15.8 40.6,19.2" />
        <path className="lv-brow-core" d="M9.0,18.6 C15.4,15.9 32.6,15.9 39.0,18.6" />
      </>);
    }
    front = <>{mic}{hat}</>;
  }
  return { behind, overPanel, front };
}

/**
 * The agent's face. Geometry, gradients and glows are copied one to one from
 * design-mascots/preview.html — five levels per role, the same 48x48
 * coordinate system the app always used, so every size on every screen stays
 * where it was. Parts overhang the box at the top levels (rings, helmet), so
 * the svg draws with overflow visible.
 *
 * Consultant: ear tabs and a diamond chin at every level; a data module (L2-3),
 * a HUD lens (L3-4), an armour plate with scan lines (L4), a full helmet (L5).
 * Coach: ear tabs, then ear pads from L4; a headset mic from L2; a headband
 * (L3), a cap (L4), a full cap (L5). The antenna gains a ring per level.
 *
 * Motion lives in CSS (agxp-design.css) so one prefers-reduced-motion rule
 * switches it all off; eye tracking is the one JS exception.
 */
export function AgentMascot({
  role, state = "idle", size = 48, enter = false, attentive = false, mood = null, level = 1, lookAt = null, agentId,
}: {
  role: AgentType;
  state?: MascotState;
  size?: number;
  /** Play the pop-in (used when the agent joins the project). */
  enter?: boolean;
  /** The user is typing to this agent — it looks towards the composer. */
  attentive?: boolean;
  /** One-off reaction, cleared by the caller after it has played. */
  mood?: MascotMood;
  /** 1-5, used when there is no agentId to read the earned level from. */
  level?: number;
  /** Where to look right now; falls back to following the cursor when null. */
  lookAt?: LookTarget;
  /** The agent this face belongs to — its earned level is read from lib/mascot-level.ts. */
  agentId?: string | null;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const earned = useMascotLevel(agentId);
  const L = agentId ? earned : Math.max(1, Math.min(MAX_MASCOT_LEVEL, Math.round(level || 1)));
  // Ana, 2026-09-27: every mascot on every screen 10% bigger, then 5% back
  // down (1.1 × 0.95). Scaled here, once, rather than at each call site.
  const px = Math.round(size * 1.045);
  // The eyes keep following the cursor in every state and at every level —
  // `attentive` only tilts the head (CSS). `lookAt` is honoured for the brief,
  // deliberate glances the caller triggers itself.
  useEyeTracking(ref, role, lookAt);
  useLevelPartsEnter(ref, L);

  const cls = [
    "mascot",
    "v2",
    `mascot-${role}`,
    `lv-${L}`,
    `is-${state}`,
    enter ? "mascot-enter" : "",
    attentive ? "is-attentive" : "",
    // CSS class names are lower-case; "levelUp" never matched .mood-levelup.
    mood ? `mood-${mood.toLowerCase()}` : "",
  ].filter(Boolean).join(" ");

  const p = levelParts(role, L);

  return (
    <span ref={ref} className={cls} style={{ width: px, height: px }} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <Antenna level={L} />
        {p.behind}
        {/* the consultant keeps the diamond chin at every level; the coach has none */}
        {role === "consultant" && (<>
          <g className="m-chin"><path d="M24,36.2 L26.7,39.4 L24,43.9 L21.3,39.4 Z" /></g>
          <path className="m-chin-in" d="M24,38.0 L25.5,39.6 L24,41.3 L22.5,39.6 Z" />
        </>)}
        <g className="m-head">
          <rect className="m-face" x="8.5" y="11.6" width="31" height="25" rx="8.4" />
          <path className="m-gloss" d="M11.2,18.4 C12.0,14.3 15.6,12.4 24,12.4 C32.4,12.4 36.0,14.3 36.8,18.4 C32.0,15.6 16.0,15.6 11.2,18.4 Z" />
          <rect className="m-face-edge" x="8.5" y="11.6" width="31" height="25" rx="8.4" />
          <rect className="m-face-panel" x="12.8" y="17.6" width="22.4" height="11.9" rx="4.8" />
          {p.overPanel}
          <g className="m-eyes">
            <g className="m-eye-track"><circle className="m-eye" cx="19.5" cy="23.5" r="2.55" /></g>
            <g className="m-eye-track"><circle className="m-eye" cx="28.5" cy="23.5" r="2.55" /></g>
          </g>
          <rect className="m-mouth" x="20.9" y="31.1" width="6.2" height="2.3" rx="1.15" />
          <g className="m-dots">
            <circle className="m-dot" cx="21.1" cy="32.25" r="1" />
            <circle className="m-dot" cx="24" cy="32.25" r="1" />
            <circle className="m-dot" cx="26.9" cy="32.25" r="1" />
          </g>
          {p.front}
        </g>
      </svg>
    </span>
  );
}

/** The gradients and clip paths every mascot paints with — exactly the
 *  <defs> of design-mascots/preview.html, ids prefixed. Mounted once. */
export function MascotDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="agxpm-gHead" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a5462" /><stop offset=".22" stopColor="#333c48" />
          <stop offset=".62" stopColor="#1b212a" /><stop offset="1" stopColor="#0c1015" />
        </linearGradient>
        <linearGradient id="agxpm-gEdge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,.62)" /><stop offset=".32" stopColor="rgba(255,255,255,.22)" />
          <stop offset=".72" stopColor="rgba(255,255,255,.07)" /><stop offset="1" stopColor="rgba(255,255,255,.14)" />
        </linearGradient>
        <linearGradient id="agxpm-gGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,.085)" /><stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="agxpm-gGlossBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(160,215,255,.85)" /><stop offset="1" stopColor="rgba(90,165,245,.35)" />
        </linearGradient>
        <radialGradient id="agxpm-gEye" cx="42%" cy="36%" r="70%">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dae9fb" />
        </radialGradient>
        <linearGradient id="agxpm-gWing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(60,140,235,.30)" /><stop offset="1" stopColor="rgba(35,95,175,.14)" />
        </linearGradient>
        <linearGradient id="agxpm-gHelmet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4c5765" /><stop offset=".3" stopColor="#2c3540" />
          <stop offset=".75" stopColor="#151a22" /><stop offset="1" stopColor="#0d1116" />
        </linearGradient>
        <linearGradient id="agxpm-gPillar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2c343f" /><stop offset="1" stopColor="#151a21" />
        </linearGradient>
        <linearGradient id="agxpm-gBand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b323d" /><stop offset="1" stopColor="#11161d" />
        </linearGradient>
        <linearGradient id="agxpm-gPanel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151a21" /><stop offset="1" stopColor="#05080c" />
        </linearGradient>
        <linearGradient id="agxpm-gBlue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc8fb" /><stop offset="1" stopColor="#2f7ede" />
        </linearGradient>
        <linearGradient id="agxpm-gEar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8ed2fb" /><stop offset=".55" stopColor="#3f92ef" /><stop offset="1" stopColor="#2464bd" />
        </linearGradient>
        <linearGradient id="agxpm-gChin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc4fb" /><stop offset="1" stopColor="#2a66c8" />
        </linearGradient>
        <linearGradient id="agxpm-gStem" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6edf6" /><stop offset="1" stopColor="#9aa8b8" />
        </linearGradient>
        <linearGradient id="agxpm-gWedge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9e4ff" /><stop offset="1" stopColor="#3f9dff" />
        </linearGradient>
        <linearGradient id="agxpm-gPlate" x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" stopColor="#46515f" /><stop offset="1" stopColor="#161d26" />
        </linearGradient>
        <linearGradient id="agxpm-gModule" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#20293a" /><stop offset="1" stopColor="#101720" />
        </linearGradient>
        <radialGradient id="agxpm-gDot" cx="36%" cy="30%" r="72%">
          <stop offset="0" stopColor="#bfe8ff" /><stop offset=".45" stopColor="#4fa2f4" /><stop offset="1" stopColor="#2367c4" />
        </radialGradient>
        <clipPath id="agxpm-clipHead"><rect x="8.5" y="11.6" width="31" height="25" rx="8.4" /></clipPath>
        <clipPath id="agxpm-clipHeadWide"><rect x="7.3" y="10.4" width="33.4" height="27.4" rx="9.2" /></clipPath>
      </defs>
    </svg>
  );
}
