"use client";

import { useEffect, useRef } from "react";
import { READ_ALONG_PROMPT, REVIEW_PROMPT, NUDGE_EVERY, NUDGE_AFTER } from "@/lib/peer-context";

/**
 * The Coach speaks up by itself once the Consultant has got somewhere.
 * Guarded by refs rather than state: this fires a paid model call, and a
 * re-render must never be able to fire a second one.
 */
export function useReadAlongNudge({ enabled, loaded, hasHistory, peerTurns, peerDocs, userTurns, spokeUnanswered, sending, sendRef }: {
  /** Only the Coach reads along. */
  enabled: boolean;
  loaded: boolean;
  /** This conversation already held messages when it loaded. */
  hasHistory: boolean;
  /** How often the other agent has answered. */
  peerTurns: number;
  /** Finished documents the other agent has produced. */
  peerDocs: number;
  /** How often the user has written to this agent themselves. */
  userTurns: number;
  /** It already spoke up by itself and the user has not written since. */
  spokeUnanswered: boolean;
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

  // The count restarts when the user writes here: the Coach just answered
  // them, so a nudge on the heels of that answer would be two in a row.
  const userAt = useRef(userTurns);
  useEffect(() => {
    if (userTurns <= userAt.current) return;
    userAt.current = userTurns;
    nudgedAt.current = peerTurns;
  }, [userTurns, peerTurns]);

  // Once, then wait. A nudge ends in a question; a second one before the user
  // has answered the first piles question on question (six in a row in one
  // live project), each of them a paid call nobody asked for.
  useEffect(() => {
    if (!armed.current || sending || spokeUnanswered) return;
    if (peerTurns < NUDGE_AFTER) return;
    if (peerTurns - nudgedAt.current < NUDGE_EVERY) return;
    nudgedAt.current = peerTurns;
    sendRef.current(READ_ALONG_PROMPT);
  }, [peerTurns, sending, spokeUnanswered, sendRef]);
}
