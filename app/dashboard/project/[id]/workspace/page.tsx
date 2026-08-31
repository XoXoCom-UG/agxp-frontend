"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProject, type Project } from "@/lib/projects";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { ProjectChatPanel } from "@/components/layout/project-chat-panel";
import { Button } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="thinking-spinner" style={{ width: 24, height: 24 }} />
    </div>
  );

  if (notFound || !project) {
    return (
      <div className="flex flex-col bg-background" style={{ height: "100vh" }}>
        <AgentNav />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Project not found.</p>
        </div>
      </div>
    );
  }

  const coach = agents.find(a => a.id === project.coach_agent_id);
  const consultant = agents.find(a => a.id === project.consultant_agent_id);
  if (!coach || !consultant) return null; // redirecting to setup

  return (
    <div className="flex flex-col bg-background" style={{ height: "100vh", overflow: "hidden" }}>
      <AgentNav projectName={project.name} />

      <div className="px-6 pt-5 pb-4 flex items-end justify-between gap-5 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1.5">{project.name}</h1>
          <p className="text-sm text-secondary-foreground">Coach and Consultant operate as two independent, persistent conversations on this project.</p>
        </div>
        <Button variant="secondary" onClick={() => router.push(`/dashboard/project/${project.id}/setup`)}>
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.2} />Change agents
        </Button>
      </div>

      <div className="flex-1 flex gap-4 px-6 pb-6 min-h-0">
        <ProjectChatPanel project={project} role="coach" agent={coach} />
        <ProjectChatPanel project={project} role="consultant" agent={consultant} />
      </div>
    </div>
  );
}
