"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProject, type Project } from "@/lib/projects";
import { listAgents, type Agent } from "@/lib/agents";
import { AgentNav } from "@/components/layout/agent-nav";
import { AgentPickerPanel } from "@/components/layout/agent-picker-panel";
import { Button } from "@/components/ui";
import { ArrowRight } from "lucide-react";

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

  // Both agents already assigned (e.g. returning to this URL directly) — the
  // workspace is the natural place to be, not the picker.
  useEffect(() => {
    if (project?.coach_agent_id && project?.consultant_agent_id) {
      router.replace(`/dashboard/project/${project.id}/workspace`);
    }
  }, [project, router]);

  if (authLoading || !token) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="thinking-spinner" style={{ width: 24, height: 24 }} />
    </div>
  );

  if (notFound) {
    return (
      <div className="flex flex-col bg-background" style={{ height: "100vh" }}>
        <AgentNav />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Project not found.</p>
        </div>
      </div>
    );
  }

  if (!project) return (
    <div className="flex flex-col bg-background" style={{ height: "100vh" }}>
      <AgentNav />
      <div className="flex-1 flex items-center justify-center">
        <div className="thinking-spinner" style={{ width: 24, height: 24 }} />
      </div>
    </div>
  );

  const bothSelected = !!(project.coach_agent_id && project.consultant_agent_id);

  return (
    <div className="flex flex-col bg-background" style={{ height: "100vh", overflow: "hidden" }}>
      <AgentNav projectName={project.name} />

      <div className="px-6 pt-5 pb-4 flex items-end justify-between gap-5 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1.5">Build your AI project team</h1>
          <p className="text-sm text-secondary-foreground">
            Choose the Coach and Consultant best suited for <b className="text-foreground font-semibold">{project.name}</b>.
          </p>
        </div>
        <Button disabled={!bothSelected} onClick={() => router.push(`/dashboard/project/${project.id}/workspace`)}>
          Enter Project Workspace <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.2} />
        </Button>
      </div>

      <div className="flex-1 flex gap-4 px-6 pb-6 min-h-0">
        <AgentPickerPanel role="coach" project={project} agents={agents}
          onAssigned={setProject} onAgentCreated={a => setAgents(prev => [...prev, a])} />
        <AgentPickerPanel role="consultant" project={project} agents={agents}
          onAssigned={setProject} onAgentCreated={a => setAgents(prev => [...prev, a])} />
      </div>
    </div>
  );
}
