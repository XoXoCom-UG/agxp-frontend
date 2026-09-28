"use client";

import { useEffect, useRef } from "react";

/** Somewhere a digit is text, not a shortcut. */
function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLElement && el.isContentEditable;
}

/** Hidden by `display:none` (the stacked layout's other tab) or folded away. */
function isShown(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (typeof el.checkVisibility === "function") return el.checkVisibility({ visibilityProperty: true });
  return el.getClientRects().length > 0;
}

/**
 * 1, 2, 3… pick a suggested answer. Both panels are mounted at once, so the
 * listener is on the document and every guard is about which panel — if any —
 * the key was meant for: only the active one, only while it is on screen,
 * never while a dialog is open above it, never while an answer is still
 * arriving, and never while focus is somewhere a digit is typed ("2 weeks"
 * must not send an answer instead of the digit).
 *
 * The listener is bound once; what it reads lives in a ref that is refreshed
 * after every render, so it never picks from a stale list.
 */
export function useChoiceKeys({ choices, active, sending, panelRef, onPick }: {
  choices: string[];
  active: boolean;
  sending: boolean;
  panelRef: React.RefObject<HTMLElement | null>;
  onPick: React.RefObject<(choice: string) => unknown>;
}) {
  const live = useRef({ choices, enabled: active && !sending });
  useEffect(() => { live.current = { choices, enabled: active && !sending }; });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const { choices, enabled } = live.current;
      if (!enabled || e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > choices.length) return;
      if (isTypingTarget(document.activeElement)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (!isShown(panelRef.current)) return;
      e.preventDefault();
      onPick.current(choices[n - 1]);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelRef, onPick]);
}
