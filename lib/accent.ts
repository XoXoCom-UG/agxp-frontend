"use client";

/**
 * The accent colour, chosen in Settings.
 *
 * Everything visible is drawn from `--primary` and `--primary-soft` — 119
 * rules in agxp-design.css, and as of this change nothing writes a blue by
 * hand any more. So overriding those two variables on <html> re-colours the
 * whole app, including the entry cards, the Start button and the glass.
 *
 * Stored per browser, not per account: it is a preference about this screen,
 * not a fact about the user, and syncing it would need a table for something
 * that costs nothing to re-pick.
 */

export interface Accent {
  id: string;
  /** Shown in Settings. Plain words — the audience is not designers. */
  label: string;
  /** The deep tone: buttons at rest, borders, fills. */
  primary: string;
  /** The lighter tone: hover, rings, highlights, the send button. */
  soft: string;
}

/** Ana's blue stays first and stays the default. */
export const ACCENTS: Accent[] = [
  { id: "blue", label: "Blue", primary: "#154E80", soft: "#2E7BC4" },
  { id: "teal", label: "Teal", primary: "#14625C", soft: "#2A9D8F" },
  { id: "violet", label: "Violet", primary: "#453A8C", soft: "#7A6CD4" },
  { id: "amber", label: "Amber", primary: "#8A5514", soft: "#D89434" },
  { id: "rose", label: "Rose", primary: "#8A2F4A", soft: "#D4607F" },
  { id: "graphite", label: "Graphite", primary: "#3C4450", soft: "#77808D" },
];

export const DEFAULT_ACCENT = ACCENTS[0];

const KEY = "agxp-accent";

export function accentById(id: string | null): Accent {
  return ACCENTS.find(a => a.id === id) ?? DEFAULT_ACCENT;
}

/** Reads the stored choice. Safe on the server and where storage is blocked. */
export function readAccent(): Accent {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    return accentById(window.localStorage.getItem(KEY));
  } catch {
    return DEFAULT_ACCENT;
  }
}

/** Paints the accent and remembers it. */
export function applyAccent(accent: Accent, remember = true): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (accent.id === DEFAULT_ACCENT.id) {
    // Remove rather than set: the stylesheet's own value should win again, so
    // a future change to the default reaches people who never picked one.
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-soft");
  } else {
    root.style.setProperty("--primary", accent.primary);
    root.style.setProperty("--primary-soft", accent.soft);
  }
  if (!remember) return;
  try {
    if (accent.id === DEFAULT_ACCENT.id) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, accent.id);
  } catch {
    // Storage blocked — the colour still applies for this session.
  }
}
