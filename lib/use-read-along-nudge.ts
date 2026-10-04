"use client";

import { useEffect, useRef } from "react";
import { READ_ALONG_PROMPT, REVIEW_PROMPT, NUDGE_EVERY, NUDGE_AFTER } from "@/lib/peer-context";

/**
 * The Coach speaks up by itself once the Consultant has got somewhere.
 * Guarded by refs rather than state: this fires a paid model call, and a
 * re-render must never be able to fire a second one.
 */
export function useReadAlongNudge({ enabled, loaded, hasHistory, peerTurns, peerDocs, sending, sendRef }: {
  /** Only the Coach reads along. */
  enabled: boolean;
  loaded: boolean;
  /** This conversation already held messages when it loaded. */
  hasHistory: boolean;
  /** How often the other agent has answered. */
  peerTurns: number;
  /** Finished documents the other agent has produced. */
  peerDocs: number;
  sending: boolean;
  sendRef: React.RefObject<(text: string) => unknown>;
}) {
  const nudgedAt = useRef(0);
  const reviewedAt = useRef(0);
  const armed = useRef(false);

  // Arm once, the moment history has loaded. A project opened halfway
  // through must not fire a nudge for the ten turns it just read out of the
  // database; a fresh one starts from zero and may nudge as soon as the
  // Consultant has actually got somewhere. The `armed` guard is what makes
  // this run once — the other dependencies only keep the values current.
  useEffect(() => {
    if (!loaded || !enabled || armed.current) return;
    armed.current = true;
    nudgedAt.current = hasHistory ? peerTurns : 0;
    // A project reopened after the document was written must not review it
    // again on every page load.
    reviewedAt.current = peerDocs;
  }, [loaded, enabled, hasHistory, peerTurns, peerDocs]);

  // A finished document outranks the periodic nudge: it is the one moment
  // where a second pair of eyes is worth a paid call, and the version
  // counter makes it once per document rather than once per render.
  useEffect(() => {
    if (!armed.current || sending) return;
    if (peerDocs <= reviewedAt.current) return;
    reviewedAt.current = peerDocs;
    // The periodic nudge would otherwise fire on top of the review and say
    // much the same thing twice.
    nudgedAt.current = peerTurns;
    sendRef.current(REVIEW_PROMPT);
  }, [peerDocs, peerTurns, sending, sendRef]);

  useEffect(() => {
    if (!armed.current || sending) return;
    if (peerTurns < NUDGE_AFTER) return;
    if (peerTurns - nudgedAt.current < NUDGE_EVERY) return;
    nudgedAt.current = peerTurns;
    sendRef.current(READ_ALONG_PROMPT);
  }, [peerTurns, sending, sendRef]);
}
