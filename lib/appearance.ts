"use client";

import { useSyncExternalStore } from "react";

/**
 * How much the room moves, and how much of it you can see through.
 *
 * Ana, 2026-09-28: "liquid glass asemănător cu cel de pe iPhone, să poți
 * alege în setări cât liquid glass să fie" and a background that drifts
 * "super lent […] cât să pară că e moving, dar nu distracting".
 *
 * Two preferences, one store. Both are written onto <html> as data
 * attributes and read back by the stylesheet — every glass surface already
 * resolves from --blur-* and --glass-*, so overriding those on the root
 * re-frosts the whole app without a single component knowing about it.
 *
 * Stored per browser, like the accent (lib/accent.ts): it is a preference
 * about this screen on this machine, not a fact about the user. The defaults
 * are exactly what the stylesheet does with no attribute set, so the first
 * paint before this lands is already correct — no flash.
 */

/** The dot field behind everything. */
export type BackgroundMode = "plain" | "dots" | "drift";
/** How much of the room shows through the floating surfaces. */
export type GlassLevel = "solid" | "light" | "full";

export interface Appearance {
  background: BackgroundMode;
  glass: GlassLevel;
}

export const DEFAULT_APPEARANCE: Appearance = { background: "drift", glass: "full" };

export const BACKGROUND_OPTIONS: { id: BackgroundMode; label: string; hint: string }[] = [
  { id: "plain", label: "Plain", hint: "Just the room, no pattern" },
  { id: "dots", label: "Dots", hint: "A still field of dots" },
  { id: "drift", label: "Drifting", hint: "The dots move, slowly enough to notice only if you look" },
];

export const GLASS_OPTIONS: { id: GlassLevel; label: string; hint: string }[] = [
  { id: "solid", label: "Solid", hint: "No blur — every bar and sheet is opaque" },
  { id: "light", label: "Light", hint: "A little blur, the room still legible through it" },
  { id: "full", label: "Full", hint: "The full frosted material" },
];

const KEY = "agxp.appearance";
export const APPEARANCE_EVENT = "agxp:appearance";

function isBackground(v: unknown): v is BackgroundMode {
  return v === "plain" || v === "dots" || v === "drift";
}
function isGlass(v: unknown): v is GlassLevel {
  return v === "solid" || v === "light" || v === "full";
}

/**
 * The last parsed value, kept so `readAppearance` hands back the SAME object
 * while the stored string hasn't changed. useSyncExternalStore compares
 * snapshots with Object.is, so a fresh object on every read is an infinite
 * render loop, not a small waste.
 */
let cachedRaw: string | null = null;
let cached: Appearance = DEFAULT_APPEARANCE;

export function readAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // Private mode or blocked storage — the default is a fine answer.
    return DEFAULT_APPEARANCE;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const o = (parsed ?? {}) as Partial<Record<keyof Appearance, unknown>>;
    cached = {
      background: isBackground(o.background) ? o.background : DEFAULT_APPEARANCE.background,
      glass: isGlass(o.glass) ? o.glass : DEFAULT_APPEARANCE.glass,
    };
  } catch {
    // Something else's key, or half-written JSON: a broken preference should
    // not break the screen.
    cached = DEFAULT_APPEARANCE;
  }
  return cached;
}

/** Paints the choice. The attributes are only written when they differ from
 *  the default, so the plain stylesheet keeps describing the plain case. */
export function applyAppearance(a: Appearance): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (a.background === DEFAULT_APPEARANCE.background) delete root.dataset.bg;
  else root.dataset.bg = a.background;
  if (a.glass === DEFAULT_APPEARANCE.glass) delete root.dataset.glass;
  else root.dataset.glass = a.glass;
}

/** Saves, paints and tells every subscriber — Settings and the workspace are
 *  different React trees, so one event is what keeps them agreeing. */
export function setAppearance(patch: Partial<Appearance>): Appearance {
  const next = { ...readAppearance(), ...patch };
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not worth failing over */ }
  applyAppearance(next);
  window.dispatchEvent(new CustomEvent<Appearance>(APPEARANCE_EVENT, { detail: next }));
  return next;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(APPEARANCE_EVENT, onChange);
  // Another tab of the same app changed it.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(APPEARANCE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * useSyncExternalStore rather than an effect reading into state: localStorage
 * plus a custom event IS an external store, and the server snapshot is simply
 * the default — no render-then-correct flicker.
 *
 * The object is rebuilt on every read, so this returns a new identity each
 * time the store changes. That is fine for a value this small, and callers
 * read fields off it rather than putting it in a dependency array.
 */
export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, readAppearance, () => DEFAULT_APPEARANCE);
}
