"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProject, PLACEHOLDER_PROJECT_NAME, type Project } from "@/lib/projects";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { ProjectChatPanel } from "@/components/layout/project-chat-panel";
import { IconBack } from "@/components/layout/agxp-icons";

export default function ProjectWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
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
    if (project && (!project.coach_agent_id || !project.consultant_agent_id)) {
      router.replace(`/dashboard/project/${project.id}/setup`);
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

  const coach = agents.find(a => a.id === project.coach_agent_id);
  const consultant = agents.find(a => a.id === project.consultant_agent_id);
  if (!coach || !consultant) return null; // redirecting to setup

  const named = project.name !== PLACEHOLDER_PROJECT_NAME;

  return (
    <div className="app">
      <AgentNav projectName={named ? project.name : undefined} projectId={project.id} />
      <div className="view-root">
        <div className="page-head">
          <div><h1>{named ? project.name : "New conversation"}</h1><p>Coach and Consultant operate as two independent, persistent conversations on this project.</p></div>
          <button className="btn btn-ghost" onClick={() => router.push(`/dashboard/project/${project.id}/setup`)}>
            <IconBack size={11} />Change agents
          </button>
        </div>
        {/* Consultant leads (larger, left) — Coach supports (smaller, right), matching Matfit. */}
        <main className="workspace">
          <ProjectChatPanel project={project} role="consultant" agent={consultant} primary
            onProjectNamed={name => setProject(p => p && { ...p, name })} />
          <ProjectChatPanel project={project} role="coach" agent={coach}
            onProjectNamed={name => setProject(p => p && { ...p, name })} />
        </main>
      </div>
    </div>
  );
}
