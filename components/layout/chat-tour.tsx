"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import {
  CHAT_TOUR_META_KEY, CHAT_TOUR_VERSION, chatTourSeen, readLocalChatTour, writeLocalChatTour,
} from "@/lib/tour";
import { CHAT_SPOTS } from "@/lib/tour-spots";
import { TourWalk } from "@/components/layout/tour-walk";

/** How long the chat gets to lay itself out before the walk measures it. */
const SETTLE_MS = 700;

/**
 * The walk that explains the chat, once, the first time one starts.
 *
 * Mounted by the workspace only while a conversation is running, so the box,
 * the two panels and the progress rail are on screen when it measures them.
 * It waits a moment first: the walk reads the page when it mounts, and a
 * composer that has not rendered yet would be dropped from it.
 *
 * "Seen" is written in both places the long tour uses (this browser at once,
 * the account after), for the same reasons — see components/layout/tour-host.tsx.
 * Skipping counts as seen: showing it again to someone who closed it is nagging.
 */
export function ChatTour() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <ChatTourGate key={user.id} user={user} />;
}

function ChatTourGate({ user }: { user: User }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const meta = (user.user_metadata as Record<string, unknown> | undefined)?.[CHAT_TOUR_META_KEY];
    if (chatTourSeen(meta, readLocalChatTour())) return;
    const t = window.setTimeout(() => setShow(true), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [user]);

  const done = useCallback(() => {
    setShow(false);
    writeLocalChatTour();
    createClient().auth.updateUser({ data: { [CHAT_TOUR_META_KEY]: CHAT_TOUR_VERSION } }).catch(() => {});
  }, []);

  return show ? <TourWalk spots={CHAT_SPOTS} onDone={done} /> : null;
}
