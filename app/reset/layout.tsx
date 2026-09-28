import type { Metadata } from "next";

// The page is a client component, which can't export metadata, so the tab title lives here.
export const metadata: Metadata = { title: "Set a new password" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
