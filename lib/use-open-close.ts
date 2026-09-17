import { useRef, useState } from "react";

/**
 * Backs a dropdown/popover that needs a real closing transition instead of
 * an instant unmount (paired with the .t-dropdown CSS in agxp-design.css).
 *
 * "opening" mounts the element with the base (pre-transition) look for one
 * paint, then flips to "open" a couple frames later — without that step,
 * React would mount it with .is-open already applied and the browser would
 * never observe the "before" state to transition from, so the scale+fade-in
 * would just pop instead of animating. "closing" stays mounted for
 * `closeDur` so the fade-out actually plays, then unmounts.
 */
export function useOpenClose(closeDur = 150) {
  const [state, setState] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const stateRef = useRef(state);
  stateRef.current = state;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function open() {
    if (timer.current) clearTimeout(timer.current);
    setState("opening");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setState(s => (s === "opening" ? "open" : s)));
    });
  }
  function close() {
    if (stateRef.current !== "open" && stateRef.current !== "opening") return;
    setState("closing");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(s => (s === "closing" ? "closed" : s)), closeDur);
  }
  function toggle() {
    if (stateRef.current === "open" || stateRef.current === "opening") close(); else open();
  }

  return {
    mounted: state !== "closed",
    className: state === "open" ? "is-open" : state === "closing" ? "is-closing" : "",
    open,
    close,
    toggle,
  };
}
