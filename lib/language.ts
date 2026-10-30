"use client";

import { useSyncExternalStore } from "react";
import { translate, type Lang } from "./i18n.ts";

/**
 * Which language the app's own words are in — English or German.
 *
 * Tudor, 2026-10-30: a German/English button in Settings, "și atât". So this
 * is the UI chrome only: the bar, Home, History, the pickers, the chat panel's
 * buttons and Settings. What the agents write is not touched — that is the
 * system prompt's business, and the agents already answer in the language
 * they are written to.
 *
 * Stored per browser, like the accent and the appearance (lib/appearance.ts):
 * it is about this screen, not about one account's work, so lib/user-scope.ts
 * leaves it alone on sign-out the way it leaves the theme alone. The server
 * snapshot is English, which is what the markup says with nothing stored, so
 * the first paint is already right for everyone who never touched it.
 */

export type { Lang } from "./i18n.ts";

export const DEFAULT_LANG: Lang = "en";

export const LANG_OPTIONS: { id: Lang; label: string }[] = [
  { id: "de", label: "Deutsch" },
  { id: "en", label: "English" },
];

const KEY = "agxp.lang";
export const LANG_EVENT = "agxp:lang";

export function readLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === "de" || raw === "en" ? raw : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG; // blocked storage: English is a fine answer
  }
}

/** <html lang> follows, so screen readers pronounce the words right. */
export function applyLang(lang: Lang): void {
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

export function setLang(lang: Lang): void {
  try { window.localStorage.setItem(KEY, lang); } catch { /* not worth failing over */ }
  applyLang(lang);
  window.dispatchEvent(new Event(LANG_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(LANG_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LANG_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, readLang, () => DEFAULT_LANG);
}

/**
 * The translator for the current language. Strings are written in English in
 * the components and looked up in lib/i18n.ts; one missing from the
 * dictionary simply shows in English.
 */
export function useT(): (en: string, vars?: Record<string, string | number>) => string {
  const lang = useLang();
  return (en, vars) => translate(lang, en, vars);
}
