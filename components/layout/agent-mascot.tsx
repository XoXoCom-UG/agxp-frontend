"use client";

import { useEffect, useRef } from "react";
import type { AgentType } from "@/lib/agents";
import { evolutionFor } from "@/lib/mascot-evolution";

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
 * `lookAt` when one is set. Writes straight to CSS custom properties on the
 * mounted node every animation frame — no React state, so this never causes
 * a render. Consultant tracks slower and more contained than Coach.
 */
function useEyeTracking(ref: React.RefObject<HTMLSpanElement | null>, personality: AgentType, lookAt: LookTarget) {
  const lookAtRef = useRef(lookAt);
  useEffect(() => { lookAtRef.current = lookAt; }, [lookAt]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const node = ref.current;
    if (!node) return;

    let raf = 0;
    let mouseX = 0;
    let mouseY = 0;
    let hasMouse = false;
    let curX = 0;
    let curY = 0;
    const k = personality === "consultant" ? 0.1 : 0.18;

    function onMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      hasMouse = true;
    }
    window.addEventListener("mousemove", onMove, { passive: true });

    function tick() {
      const el = ref.current;
      if (!el) { raf = requestAnimationFrame(tick); return; }
      const look = lookAtRef.current;
      let tx = 0, ty = 0;

      if (look && typeof look === "object") {
        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
        const dx = look.x - cx, dy = look.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const mag = Math.min(2.4, dist / 30);
        tx = (dx / dist) * mag;
        ty = (dy / dist) * mag;
      } else if (look) {
        [tx, ty] = LOOK_PRESETS[look];
      } else if (hasMouse) {
        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
        const dx = mouseX - cx, dy = mouseY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        // Standing further than this, the mascot still glances the right way,
        // just at a smaller, calmer amplitude — up close it looks right at you.
        const near = dist < 120;
        const max = near ? 3 : 2;
        const mag = Math.min(max, dist / 40);
        tx = (dx / dist) * mag;
        ty = (dy / dist) * mag;
      }

      curX += (tx - curX) * k;
      curY += (ty - curY) * k;
      el.style.setProperty("--eye-x", `${curX.toFixed(2)}px`);
      el.style.setProperty("--eye-y", `${curY.toFixed(2)}px`);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); window.removeEventListener("mousemove", onMove); };
  }, [ref, personality]);
}

/**
 * The agent's face. A geometric little character rather than a cartoon
 * animal — the audience is IT consulting — but it has actual eyes, blinks,
 * breathes, follows the cursor a couple of px, looks at the thing you are
 * doing, and reacts to what it just said.
 *
 * Consultant wears a tie, Coach wears a headset — always, regardless of
 * level. On top of that, both grow through 3 purely visual levels
 * (lib/mascot-evolution.ts): a pulsing antenna glow at 2, small glasses at 3.
 *
 * All motion lives in CSS (agxp-design.css, the AGENT MASCOT / CHARACTER /
 * MASCOT EVOLUTION blocks) so a single prefers-reduced-motion rule can switch
 * it all off; eye tracking is the one exception (it is inherently continuous
 * JS), and it checks the same media query itself.
 */
export function AgentMascot({
  role, state = "idle", size = 48, enter = false, attentive = false, mood = null, level = 1, lookAt = null,
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
  /** Drives the visual evolution stage, 1-3. Purely decorative — see lib/mascot-evolution.ts. */
  level?: number;
  /** Where to look right now; falls back to following the cursor when null. */
  lookAt?: LookTarget;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const evo = evolutionFor(level);
  // The eyes keep following the cursor in every state and at every level —
  // `attentive` only tilts the head (CSS), it no longer parks the eyes on
  // the composer for as long as you're typing. `lookAt` is still honored for
  // the brief, deliberate glances (a choice list appearing, a document
  // opening) the caller triggers itself.
  useEyeTracking(ref, role, lookAt);

  const cls = [
    "mascot",
    `mascot-${role}`,
    `is-${state}`,
    enter ? "mascot-enter" : "",
    attentive ? "is-attentive" : "",
    mood ? `mood-${mood}` : "",
    evo.glow ? "has-glow" : "",
    evo.accessory ? "has-accessory" : "",
  ].filter(Boolean).join(" ");

  return (
    <span ref={ref} className={cls} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        {/* antenna, glowing and pulsing from level 2, plus a spinner ring while working */}
        <path className="m-antenna" d="M24 12 V7" strokeWidth="2" strokeLinecap="round" />
        <circle className="m-work-ring" cx="24" cy="5" r="7.4" strokeWidth="1" strokeDasharray="4 3.4" />
        <circle className="m-rank" cx="24" cy="5" r="4.6" strokeWidth="1" />
        <circle className="m-antenna-dot" cx="24" cy="5" r="2.6" />

        {/* coach headset — a band over the head with an ear pad each side,
            the pads glow at level 3 (CSS only, see .has-accessory) */}
        <g className="m-headset">
          <path d="M11 24 A13 13 0 0 1 37 24" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="7.5" y="22" width="5" height="9" rx="2.5" />
          <rect x="35.5" y="22" width="5" height="9" rx="2.5" />
        </g>
        {/* coach visor + mic — level 3 */}
        {role === "coach" && evo.accessory && (
          <>
            <g className="m-visor">
              <rect x="13" y="13" width="22" height="4" rx="2" />
              <path className="m-visor-line" d="M14 16.6 H34" strokeWidth="1" strokeLinecap="round" />
            </g>
            <g className="m-mic">
              <path className="m-mic-arm" d="M38 29.5 Q32.5 35 27 33.6" strokeWidth="1" strokeLinecap="round" fill="none" />
              <circle className="m-mic-tip" cx="27" cy="33.6" r="1.15" />
            </g>
          </>
        )}

        {/* head */}
        <g className="m-head">
          <rect className="m-face" x="9" y="12" width="30" height="25" rx="9" />
          <rect className="m-face-panel" x="12.5" y="17" width="23" height="13.5" rx="6.5" />
          <g className="m-eyes">
            <g className="m-eye-track"><circle className="m-eye" cx="19.5" cy="23.5" r="2.7" /></g>
            <g className="m-eye-track"><circle className="m-eye" cx="28.5" cy="23.5" r="2.7" /></g>
          </g>
          <rect className="m-mouth" x="21" y="32" width="6" height="2.2" rx="1.1" />
          <g className="m-dots">
            <circle className="m-dot" cx="21" cy="33" r="1.05" />
            <circle className="m-dot" cx="24" cy="33" r="1.05" />
            <circle className="m-dot" cx="27" cy="33" r="1.05" />
          </g>
          {/* consultant HUD lens over one eye — level 3 */}
          {role === "consultant" && evo.accessory && (
            <g className="m-hud-lens">
              <circle className="m-hud-ring" cx="28.5" cy="23.5" r="4.3" strokeWidth="1" />
              <circle className="m-hud-inner" cx="28.5" cy="23.5" r="3.1" />
              <circle className="m-hud-spark" cx="31.6" cy="20.9" r=".65" />
              <path className="m-hud-scan" d="M33 22 H36.4" strokeWidth=".8" strokeLinecap="round" />
              <path className="m-hud-scan" d="M33 23.6 H35.2" strokeWidth=".8" strokeLinecap="round" />
              <path className="m-hud-scan" d="M33 25.2 H36.8" strokeWidth=".8" strokeLinecap="round" />
            </g>
          )}
        </g>

        {/* consultant tie, with a small star at level 3 */}
        <g className="m-tie">
          <path d="M24 37 L21.6 39.4 L24 45 L26.4 39.4 Z" />
          {role === "consultant" && evo.accessory && (
            <g className="m-star" transform="translate(20.76 37.56) scale(0.27)">
              <path d="M12 8.5 13.4 11l2.6 1-2.6 1L12 15.5 10.6 13 8 12l2.6-1Z" />
            </g>
          )}
        </g>
      </svg>
    </span>
  );
}
