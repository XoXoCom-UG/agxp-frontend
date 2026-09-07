"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProject, PLACEHOLDER_PROJECT_NAME, type Project } from "@/lib/projects";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { AgentPickerPanel } from "@/components/layout/agent-picker-panel";

export default function ProjectSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    Promise.all([getProject(id), listAgents()]).then(([p, a]) => {
      if (!alive) return;
      if (!p) { setNotFound(true); return; }
      setProject(p);
      setAgents(a);
    }).catch(() => { if (alive) setNotFound(true); });
    return () => { alive = false; };
  }, [token, id]);

  // No separate "Enter Workspace" click — the moment both agents are picked,
  // this fires and moves straight into the chat (Patryk, 2026-09-02: as few
  // buttons/steps as possible).
  useEffect(() => {
    if (project?.coach_agent_id && project?.consultant_agent_id) {
      router.replace(`/dashboard/project/${project.id}/workspace`);
    }
  }, [project, router]);

  if (authLoading || !token || (!project && !notFound)) return (
    <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" style={{ width: 24, height: 24, borderColor: "var(--border-strong)", borderTopColor: "var(--primary)" }} />
    </div>
  );

  if (notFound || !project) {
    return (
      <div className="app">
        <AgentNav />
        <div className="view-root" style={{ alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Project not found.</p>
        </div>
      </div>
    );
  }

  const named = project.name !== PLACEHOLDER_PROJECT_NAME;

  return (
    <div className="app">
      <AgentNav projectName={named ? project.name : undefined} projectId={project.id} />
      <div className="view-root">
        <div className="page-head">
          <div>
            <h1>Build your AI project team</h1>
            <p>{named
              ? <>Choose the Coach and Consultant best suited for <b style={{ color: "var(--text-primary)", fontWeight: 600 }}>{project.name}</b>.</>
              : "Choose the Coach and Consultant you want to work with."}</p>
          </div>
        </div>
        {/* Consultant leads (larger, left) — Coach supports (smaller, right), matching Matfit. */}
        <main className="workspace">
          <AgentPickerPanel role="consultant" primary project={project} agents={agents}
            onAssigned={setProject} onAgentCreated={a => setAgents(prev => [...prev, a])} />
          <AgentPickerPanel role="coach" project={project} agents={agents}
            onAssigned={setProject} onAgentCreated={a => setAgents(prev => [...prev, a])} />
        </main>
      </div>
    </div>
  );
}
