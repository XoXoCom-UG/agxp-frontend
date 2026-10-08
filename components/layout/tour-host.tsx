"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import {
  TOUR_META_KEY, TOUR_VERSION, tourSeen, readLocalTour, writeLocalTour, clearLocalTour,
} from "@/lib/tour";
import { Tour } from "@/components/layout/tour";

/** Settings asks for a replay through this, so it never has to own the tour. */
export const TOUR_REPLAY_EVENT = "agxp:tour-replay";

/** Anything can ask for the tour: `replayTour()` from a button, anywhere. */
export function replayTour(): void {
  clearLocalTour();
  window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));
}

/**
 * Decides whether the tour runs, and remembers that it did.
 *
 * Mounted once, inside Admitted, so it covers every signed-in screen and a
 * screen added later inherits it instead of being the one that forgot — the
 * same reason the beta gate lives there.
 *
 * It renders nothing of its own. The two jobs are "should this person see it"
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
  const [open, setOpen] = useState(() => {
    const meta = (user.user_metadata as Record<string, unknown> | undefined)?.[TOUR_META_KEY];
    return !tourSeen(meta, readLocalTour());
  });

  useEffect(() => {
    function onReplay() { setOpen(true); }
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
  }, []);

  const done = useCallback(() => {
    setOpen(false);
    // This browser first, and synchronously: it is what stops a replay on
    // reload if the account write is slow, refused or offline.
    writeLocalTour();
    // Then the account, so a second machine starts already settled.
    // Deliberately not awaited and deliberately not surfaced — the tour is
    // over either way, and an error about a tutorial flag is worse than
    // quietly asking again on a device that has never seen it.
    createClient().auth.updateUser({ data: { [TOUR_META_KEY]: TOUR_VERSION } }).catch(() => {});
  }, []);

  if (!open) return null;
  return <Tour onDone={done} />;
}
