/**
 * Short date for lists and timelines: "18 Jul 2026". The one date format for
 * every list in the app, so History and the agent pages can't drift apart.
 * An unparseable value renders as nothing rather than "Invalid Date".
 */
export function dateStr(d: string) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Keyboard activation for an element that acts as a button without being
 * one (`role="button"` rows): Enter and Space do what a click does. Keys
 * pressed on a real control inside the row (its ⋯ menu) are left alone.
 */
export function activateOnKey(action: () => void) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };
}

/**
 * Keys for an open `role="menu"` popover: arrows (and Home/End) move focus
 * between its items and wrap, Escape and Tab close it. Escape hands focus back
 * to whoever opened the menu (`onClose(true)`); Tab lets it move on naturally.
 */
export function menuKeyDown(onClose: (restoreFocus: boolean) => void) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(true); return; }
    if (e.key === "Tab") { onClose(false); return; }
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (i + 1) % items.length;
    else if (e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    items[next].focus();
  };
}

/** Puts focus on the first item of a menu that has just opened. */
export function focusFirstMenuItem(menu: HTMLElement | null) {
  menu?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
}
