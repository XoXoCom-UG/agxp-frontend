"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEntitlement } from "@/lib/entitlement";
import { BetaGate } from "@/components/layout/beta-gate";
import { TourHost } from "@/components/layout/tour-host";
import { FeedbackButton } from "@/components/layout/feedback-button";

/**
 * Wraps every signed-in page while the product is invite-only.
 *
 * One wrapper rather than a check in each screen: there are four of them and
 * a new one would be written without the check. It is still only the polite
 * half of the gate — an account nobody invited is refused by the chat route
 * whatever the browser renders.
 */
export function Admitted({ children }: { children: React.ReactNode }) {
  const { admitted, loading, refresh } = useEntitlement();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const signedOut = !authLoading && !user;

  // No session — signed out in another tab, or it expired — goes to the
  // login page from here, for every signed-in screen at once. Only some
  // screens did it themselves, and the others sat on a blank page until a
  // refresh. /login is never sent back by proxy.ts, so this cannot loop.
  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  // Nothing while we find out. Showing the workspace and then replacing it
  // with the gate reads as the app breaking; showing the gate and then
  // replacing it with the workspace tells an invited tester they are not
  // invited. A short blank is the honest state.
  if (signedOut || loading) return null;
  if (!admitted) return <BetaGate onAdmitted={refresh} />;
  // The tour rides along for the same reason the gate does: mounted once
  // here, every signed-in screen has it, including the next one somebody
  // adds. It draws nothing until it decides this account has not seen it.
  return <><TourHost />{children}<FeedbackButton /></>;
}
