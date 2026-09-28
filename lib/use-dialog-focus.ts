"use client";

import { useEffect } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus for a modal dialog: moves into it when it opens, keeps Tab cycling
 * inside it, and hands focus back to whatever opened it when it closes.
 * Without this a keyboard or screen-reader user opens a dialog and is left
 * behind it, still tabbing through the page underneath.
 *
 * `initial` picks where focus lands instead of the first focusable element —
 * a form wants its first field, not the close button in the corner. The
 * effect runs once per mount, so a parent re-rendering never pulls focus back.
 */
export function useDialogFocus(ref: React.RefObject<HTMLElement | null>, initial?: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    (initial?.current ?? items()[0] ?? node).focus({ preventScroll: true });

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) { e.preventDefault(); return; }
      const first = list[0], last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !node!.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !node!.contains(active))) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // `initial` is read once, on open; it is a ref, so it never changes identity.
  }, [ref, initial]);
}
