"use client";

import { useEntitlement } from "@/lib/entitlement";
import { BetaGate } from "@/components/layout/beta-gate";

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

  // Nothing while we find out. Showing the workspace and then replacing it
  // with the gate reads as the app breaking; showing the gate and then
  // replacing it with the workspace tells an invited tester they are not
  // invited. A short blank is the honest state.
  if (loading) return null;
  if (!admitted) return <BetaGate onAdmitted={refresh} />;
  return <>{children}</>;
}
