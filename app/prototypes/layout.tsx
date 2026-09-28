import { notFound } from "next/navigation";

// Design prototypes are for the team, not the public: in a production build
// every route under /prototypes answers with the 404 page.
export default function PrototypesLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
