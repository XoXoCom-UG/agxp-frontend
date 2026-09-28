import type { Metadata } from "next";

// Same word as the nav tab that leads here.
export const metadata: Metadata = { title: "History" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
