import type { Metadata } from "next";
import { Admitted } from "@/components/layout/admitted";

// The pages below are client components, which can't export metadata. This titles
// /dashboard itself; History, Agents and a project override it with their own.
// A plain string title here would drop the root template for everything below
// ("History" instead of "History · AgentiX"), so it is restated.
export const metadata: Metadata = {
  title: { default: "Workspace", template: "%s · AgentiX" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  // Every signed-in screen sits behind the invitation while we are in closed
  // beta. One wrapper, so a screen added later inherits the gate instead of
  // being the one that forgot it.
  return <Admitted>{children}</Admitted>;
}
