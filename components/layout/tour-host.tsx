"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import {
  TOUR_META_KEY, TOUR_VERSION, tourSeen, readLocalTour, writeLocalTour, clearLocalTour,
} from "@/lib/tour";
import { Tour } from "@/components/layout/tour";
import { TourWalk } from "@/components/layout/tour-walk";

/** Settings asks for a replay through this, so it never has to own the tour. */
export const TOUR_REPLAY_EVENT = "agxp:tour-replay";

/** Anything can ask for the tour: `replayTour()` from a button, anywhere. */
export function replayTour(): void {
  clearLocalTour();
  window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));
}

/** What is on screen. The two run back to back: the stage explains what the
 *  app is for, then the walk points at where to press. */
type Phase = "none" | "tour" | "walk";

/**
 * Decides whether the introduction runs, and remembers that it did.
 *
 * Mounted once, inside Admitted, so it covers every signed-in screen and a
 * screen added later inherits it instead of being the one that forgot — the
 * same reason the beta gate lives there.
 *
 * It renders nothing of its own. The jobs are "should this person see it"
 * (lib/tour.ts owns that decision, and it is tested) and "write it down
 * afterwards, in both places".
 */
export function TourHost() {
  const { user, loading } = useAuth();
  // Nothing to decide until the session has resolved. Splitting here, and
  // keying the gate on the account, means the decision is a useState
  // initializer on a fresh mount instead of an effect correcting state it
  // just rendered — and switching account re-decides for the new one.
  if (loading || !user) return null;
  return <TourGate key={user.id} user={user} />;
}

function TourGate({ user }: { user: User }) {
  const [phase, setPhase] = useState<Phase>(() => {
    const meta = (user.user_metadata as Record<string, unknown> | undefined)?.[TOUR_META_KEY];
    return tourSeen(meta, readLocalTour()) ? "none" : "tour";
  });

  useEffect(() => {
    function onReplay() { setPhase("tour"); }
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
  }, []);

  const remember = useCallback(() => {
    // This browser first, and synchronously: it is what stops a replay on
    // reload if the account write is slow, refused or offline.
    writeLocalTour();
    // Then the account, so a second machine starts already settled.
    // Deliberately not awaited and deliberately not surfaced — the
    // introduction is over either way, and an error about a tutorial flag is
    // worse than quietly asking again on a device that has never seen it.
    createClient().auth.updateUser({ data: { [TOUR_META_KEY]: TOUR_VERSION } }).catch(() => {});
  }, []);

  /*
   * Finishing the stage hands over to the walk; abandoning it ends the whole
   * introduction. Someone who presses Escape on a tutorial is not asking for
   * the second half of it — and either way it counts as seen, because
   * showing it again tomorrow to someone who chose to skip it is nagging.
   */
  const tourDone = useCallback((completed: boolean) => {
    setPhase(completed ? "walk" : "none");
    if (!completed) remember();
  }, [remember]);

  const walkDone = useCallback(() => {
    setPhase("none");
    remember();
  }, [remember]);

  if (phase === "tour") return <Tour onDone={tourDone} />;
  if (phase === "walk") return <TourWalk onDone={walkDone} />;
  return null;
}
