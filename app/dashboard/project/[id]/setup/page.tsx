"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProject, type Project } from "@/lib/projects";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { AgentPickerPanel } from "@/components/layout/agent-picker-panel";
import { IconArrow } from "@/components/layout/agxp-icons";

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

  const bothSelected = !!(project.coach_agent_id && project.consultant_agent_id);

  return (
    <div className="app">
      <AgentNav projectName={project.name} projectId={project.id} />
      <div className="view-root">
        <div className="page-head">
          <div><h1>Build your AI project team</h1><p>Choose the Coach and Consultant best suited for <b style={{ color: "var(--text-primary)", fontWeight: 600 }}>{project.name}</b>.</p></div>
          <button className="btn btn-hero" disabled={!bothSelected} onClick={() => router.push(`/dashboard/project/${project.id}/workspace`)}
            data-tooltip={bothSelected ? undefined : "Select both a Coach and a Consultant first"}>
            Enter Project Workspace <IconArrow />
          </button>
        </div>
        <main className="workspace">
          <AgentPickerPanel role="coach" project={project} agents={agents}
            onAssigned={setProject} onAgentCreated={a => setAgents(prev => [...prev, a])} />
          <AgentPickerPanel role="consultant" project={project} agents={agents}
            onAssigned={setProject} onAgentCreated={a => setAgents(prev => [...prev, a])} />
        </main>
      </div>
    </div>
  );
}
