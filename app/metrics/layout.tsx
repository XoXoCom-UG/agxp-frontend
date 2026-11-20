import type { Metadata } from "next";
import "./metrics.css";

export const metadata: Metadata = {
  title: "Metrics",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * /metrics sits outside /dashboard on purpose: it is not behind the beta-key
 * gate (Admitted), it has its own permission (agxp_metrics_viewers, migration
 * 0033), and one path prefix is what Cloudflare Access protects in front of it.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
