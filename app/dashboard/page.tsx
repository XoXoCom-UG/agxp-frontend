"use client";

import { NewTaskScreen } from "@/components/layout/new-task-screen";

// The start screen is New Task itself (Patryk, 2026-09-02) — no project list,
// no create-project form in between.
export default function DashboardPage() {
  return <NewTaskScreen />;
}
