"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

/**
 * Minimal cookie/consent notice. The app only uses technically necessary
 * storage (login session, settings) — no marketing/tracking cookies — so this
 * is an informational banner with a single "Verstanden" acknowledgement, per
 * the current privacy policy. If tracking is added later, upgrade to a real
 * opt-in consent manager.
 */
export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("matfit_cookie_ack")) {
      const t = setTimeout(() => setShow(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  function accept() {
    localStorage.setItem("matfit_cookie_ack", "1");
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[80] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl shadow-black/20 p-4"
        >
          <p className="text-[12.5px] text-zinc-600 dark:text-zinc-300 leading-relaxed mb-3">
            Wir verwenden nur technisch notwendige Cookies bzw. lokale Speicherung (Login &amp; Einstellungen) —
            kein Tracking. Mehr dazu in der{" "}
            <Link href="/datenschutz" className="text-green-600 underline underline-offset-2">Datenschutzerklärung</Link>.
          </p>
          <button onClick={accept}
            className="w-full text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg py-2 transition-colors">
            Verstanden
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
