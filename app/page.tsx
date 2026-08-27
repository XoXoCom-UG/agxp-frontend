"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Root() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(session ? "/chat" : "/login");
    }
  }, [session, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="thinking-spinner" />
    </div>
  );
}
