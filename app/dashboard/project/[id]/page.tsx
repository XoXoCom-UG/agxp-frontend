"use client";

import { use } from "react";
import { NewTaskScreen } from "@/components/layout/new-task-screen";

// One screen per project — the picker and the conversation live in the same
// place, per panel, so there is no setup → workspace navigation step.
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <NewTaskScreen projectId={id} />;
}
