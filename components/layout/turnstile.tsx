"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Cloudflare Turnstile — the bot check in front of sign-up, sign-in and the
 * password reset.
 *
 * Why: sign-up is where an attacker multiplies themselves. Every account gets
 * a free allowance, so ten thousand scripted accounts are ten thousand
 * allowances. Supabase verifies the token itself when CAPTCHA protection is
 * switched on (Authentication → Attack Protection), so this component only
 * has to obtain one; nothing in our code checks it, and nothing in our code
 * can forget to.
 *
 * Turnstile mostly decides without a puzzle, so a real person rarely sees
 * anything but a small box that ticks itself.
 *
 * Without NEXT_PUBLIC_TURNSTILE_SITE_KEY it renders nothing and the forms work
 * as before — which is right only while CAPTCHA is also off in Supabase. Turn
 * them on together: the site key here first, then the switch in Supabase.
 */

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loading: Promise<TurnstileApi> | null = null;

/** Loads the script once per page, however many widgets ask for it. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    s.onerror = () => { loading = null; reject(new Error("turnstile failed to load")); };
    document.head.appendChild(s);
  });
  return loading;
}

export interface TurnstileHandle {
  /** A token is good for one request. Call this after every use. */
  reset(): void;
}

export const Turnstile = forwardRef<TurnstileHandle, {
  onToken: (token: string | null) => void;
  /** Set when the widget could not load at all — the form says so. */
  onFail?: () => void;
}>(function Turnstile({ onToken, onFail }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef({ onToken, onFail });
  useEffect(() => { cb.current = { onToken, onFail }; });

  useImperativeHandle(ref, () => ({
    reset() {
      cb.current.onToken(null);
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    },
  }), []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let alive = true;
    loadTurnstile()
      .then(api => {
        if (!alive || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "auto",
          size: "flexible",
          callback: (t: string) => cb.current.onToken(t),
          "expired-callback": () => cb.current.onToken(null),
          "error-callback": () => { cb.current.onToken(null); },
        });
      })
      .catch(err => {
        console.warn("[turnstile]", err);
        cb.current.onFail?.();
      });
    return () => {
      alive = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="auth-captcha" />;
});
