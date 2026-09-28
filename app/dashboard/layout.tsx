import type { Metadata } from "next";

// The pages below are client components, which can't export metadata. This titles
// /dashboard itself; History, Agents and a project override it with their own.
// A plain string title here would drop the root template for everything below
// ("History" instead of "History · AgentiX"), so it is restated.
export const metadata: Metadata = {
  title: { default: "Workspace", template: "%s · AgentiX" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
