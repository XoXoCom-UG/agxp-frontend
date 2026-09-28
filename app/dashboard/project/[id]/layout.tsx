import type { Metadata } from "next";

// The project's name only exists client-side (owner-scoped rows), so the title stays generic.
export const metadata: Metadata = { title: "Project" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
