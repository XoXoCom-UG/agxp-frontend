"use client";

import { useEffect } from "react";

/** How long a tooltip has to be hovered before the next ones open instantly. */
const WARM_AFTER = 400;
/** How long after leaving the last tooltip the instant mode survives. */
const COOL_AFTER = 600;

/**
 * Tooltips wait before the first one appears, so passing the cursor over the
 * toolbar doesn't set them all off. Once one is open, its neighbours open at
 * once with no animation — the toolbar feels faster without losing the delay
 * that stops accidental ones (Emil Kowalski, tooltips).
 *
 * The tooltips themselves are pure CSS ([data-tooltip]::after). This only
 * flips `data-tips-warm` on <html>; the CSS reads it. One listener for the app.
 */
export function TooltipWarmth() {
  useEffect(() => {
    const root = document.documentElement;
    let warmTimer: ReturnType<typeof setTimeout> | null = null;
    let coolTimer: ReturnType<typeof setTimeout> | null = null;

    function over(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      const el = e.target instanceof Element ? e.target.closest("[data-tooltip]") : null;
      if (!el) return;
      if (coolTimer) { clearTimeout(coolTimer); coolTimer = null; }
      if (root.hasAttribute("data-tips-warm") || warmTimer) return;
      warmTimer = setTimeout(() => { root.setAttribute("data-tips-warm", ""); warmTimer = null; }, WARM_AFTER);
    }
    function out(e: PointerEvent) {
      const el = e.target instanceof Element ? e.target.closest("[data-tooltip]") : null;
      if (!el) return;
      const next = e.relatedTarget instanceof Element ? e.relatedTarget.closest("[data-tooltip]") : null;
      if (next === el) return;
      if (warmTimer) { clearTimeout(warmTimer); warmTimer = null; }
      if (coolTimer) clearTimeout(coolTimer);
      coolTimer = setTimeout(() => { root.removeAttribute("data-tips-warm"); coolTimer = null; }, COOL_AFTER);
    }

    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      if (warmTimer) clearTimeout(warmTimer);
      if (coolTimer) clearTimeout(coolTimer);
      root.removeAttribute("data-tips-warm");
    };
  }, []);
  return null;
}
