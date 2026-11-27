"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import { MetricsMfa } from "@/components/layout/metrics-mfa";
import { MetricsDashboard } from "@/components/layout/metrics-dashboard";

type Access = { viewer: boolean; mfa: boolean } | { error: string } | null;

/**
 * /metrics — the dashboard for the people who run the company, not the product.
 *
 * Three doors, in order, each also enforced by the database (migration 0033):
 *   1. signed in            (else /login)
 *   2. in agxp_metrics_viewers on a confirmed @xoxocom.net address
 *   3. this session passed the authenticator code (aal2)
 * This page only decides what to draw; metrics_overview() refuses on its own.
 */
export default function MetricsPage() {
  const { loading, token, user, signOut } = useAuth();
  const router = useRouter();
  const [access, setAccess] = useState<Access>(null);

  useEffect(() => {
    if (!loading && !token) router.replace("/login?next=/metrics");
  }, [loading, token, router]);

  const check = useCallback(async () => {
    const { data, error } = await createClient().rpc("metrics_access");
    if (error) {
      setAccess({ error: /metrics_access/.test(error.message) || error.code === "PGRST202"
        ? "The metrics functions are missing: run supabase/migrations/0033_metrics_dashboard.sql in the SQL editor."
        : error.message });
      return;
    }
    setAccess(data as { viewer: boolean; mfa: boolean });
  }, []);

  // Re-asked whenever the token changes — passing the 2FA step issues a new one.
  useEffect(() => {
    if (!token) return;
    void Promise.resolve().then(check);
  }, [token, check]);

  async function leave() {
    await signOut();
    router.replace("/login?next=/metrics");
  }

  let body: React.ReactNode;
  if (loading || !token || !access) {
    body = <p className="mx-muted" role="status">Checking access…</p>;
  } else if ("error" in access) {
    body = <p className="mx-error" role="alert">{access.error}</p>;
  } else if (!access.viewer) {
    body = (
      <div className="mx-hidden">
        <p>This page is not available for this account.</p>
        <Link className="fbd-link" href="/dashboard">Back to the workspace</Link>
      </div>
    );
  } else if (!access.mfa) {
    body = <MetricsMfa onVerified={() => void check()} />;
  } else {
    body = <MetricsDashboard token={token} onMfaLost={() => setAccess({ viewer: true, mfa: false })} />;
  }

  return (
    <div className="mx-page">
      <header className="mx-top">
        <div>
          <h1>Metrics</h1>
          <p className="mx-muted">How AgentiX is doing — totals only.</p>
        </div>
        {user && (
          <div className="mx-who">
            <span className="mx-muted">{user.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => void leave()}>Sign out</button>
          </div>
        )}
      </header>
      <main id="main-content" className="mx-main">{body}</main>
    </div>
  );
}
