"use client";

import { useEffect, useState } from "react";
import type { MascotState, MascotMood, LookTarget } from "@/components/layout/agent-mascot";

/** The success / error flourish, then back to idle. */
const FLOURISH_MS = 700;
/** A reaction's default length. */
const REACTION_MS = 1000;
/** A glance's default length, before the eyes follow the cursor again. */
const GLANCE_MS = 1500;
const LEVEL_UP_MS = 1500;

/** Something that plays once and then clears itself. `key` makes the same
 *  reaction twice in a row count as a new one, restarting its timer. */
type Timed<T> = { value: T; ms: number; key: number } | null;

/**
 * What the mascot in the head is doing: its state (thinking, speaking…), a
 * one-off reaction, and where it looks. Reactions are what read as alive —
 * they have to end, or they turn into noise in the corner of the eye — so
 * each one clears itself after its time, from an effect keyed on the
 * reaction rather than from timers the caller has to remember.
 */
export function useMascotChoreography(level: number) {
  const [orb, setOrb] = useState<MascotState>("idle");
  const [mood, setMood] = useState<Timed<Exclude<MascotMood, null>>>(null);
  /** Where the mascot looks right now; null resumes following the cursor. */
  const [look, setLook] = useState<Timed<Exclude<LookTarget, null>>>(null);

  // A brief, restrained flourish once the reply has landed (or failed):
  // antenna flash and a small bounce, or a dimmed, narrowed look — then idle.
  useEffect(() => {
    if (orb !== "success" && orb !== "error") return;
    const id = setTimeout(() => setOrb("idle"), FLOURISH_MS);
    return () => clearTimeout(id);
  }, [orb]);

  useEffect(() => {
    if (!mood) return;
    const id = setTimeout(() => setMood(null), mood.ms);
    return () => clearTimeout(id);
  }, [mood]);

  useEffect(() => {
    if (!look) return;
    const id = setTimeout(() => setLook(null), look.ms);
    return () => clearTimeout(id);
  }, [look]);

  // The level-up animation whenever the level goes up — not on the first
  // render, which is just where it already was. Adjusted during render,
  // React's pattern for state that follows a prop.
  const [seenLevel, setSeenLevel] = useState(level);
  if (level !== seenLevel) {
    setSeenLevel(level);
    if (level > seenLevel) setMood(prev => ({ value: "levelUp", ms: LEVEL_UP_MS, key: (prev?.key ?? 0) + 1 }));
  }

  /** Plays a reaction once. */
  function react(next: Exclude<MascotMood, null>, ms = REACTION_MS) {
    setMood(prev => ({ value: next, ms, key: (prev?.key ?? 0) + 1 }));
  }

  /** A brief glance toward a UI region, then back to following the cursor. */
  function glanceAt(target: Exclude<LookTarget, null>, ms = GLANCE_MS) {
    setLook(prev => ({ value: target, ms, key: (prev?.key ?? 0) + 1 }));
  }

  return {
    orb,
    mood: mood?.value ?? null,
    lookAt: look?.value ?? null,
    setOrb,
    playSuccess: () => setOrb("success"),
    playError: () => setOrb("error"),
    react,
    glanceAt,
  };
}
