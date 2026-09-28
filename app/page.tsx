"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * "/" only decides where to go. Without an auth cookie proxy.ts has already
 * sent the visitor to /login, so this only runs for cookie holders — and the
 * cookie alone can't be trusted (see proxy.ts), so the real session decides.
 */
export default function Root() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(session ? "/dashboard" : "/login");
    }
  }, [session, loading, router]);

  return (
    <main className="root-wait">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span className="visually-hidden" role="status">Loading…</span>
    </main>
  );
}
