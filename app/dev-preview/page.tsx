"use client";

// TEMPORARY, uncommitted preview page — lets you SEE the new chat-hero
// redesign with mock data, no login/Supabase needed. Not part of the app's
// real routes; delete this file (and this folder) whenever you're done.

import { useState } from "react";
import type { Agent, Method } from "@/lib/agents";
import type { Project } from "@/lib/projects";
import { ProjectChatPanel } from "@/components/layout/project-chat-panel";
import { AgentPickerPanel } from "@/components/layout/agent-picker-panel";

function method(name: string, primary: boolean): Method {
  return { id: name, skill_id: name, name, is_primary: primary, description: null };
}

function mockAgent(type: "consultant" | "coach", name: string, tagline: string): Agent {
  const primary = type === "consultant"
    ? ["As-Is/To-Be", "Gap-Analyse", "Requirements Engineering"]
    : ["Requirements Engineering", "Process Mapping"];
  const secondary = type === "consultant" ? ["Process Mapping", "Impact Mapping"] : ["As-Is/To-Be"];
  return {
    id: `mock-${type}`,
    type,
    name,
    avatar_placeholder: null,
    tagline,
    description: "Mock agent for local preview only.",
    expertise: null,
    knowledge_level: "Medium",
    created_at: new Date().toISOString(),
    methods: [...primary, ...secondary].map((n, i) => method(n, i < primary.length)),
    primaryMethods: primary.map(n => method(n, true)),
    secondaryMethods: secondary.map(n => method(n, false)),
    last_projects: [],
  };
}

const mockProject: Project = {
  id: "mock-project",
  owner_id: "mock-user",
  name: "New Project",
  description: null,
  type: "AI Transformation",
  status: "In Progress",
  coach_agent_id: "mock-coach",
  consultant_agent_id: "mock-consultant",
  activity: [],
  created_at: new Date().toISOString(),
  last_activity_at: new Date().toISOString(),
};

export default function DevPreviewPage() {
  const consultant = mockAgent("consultant", "Aria", "Strategy & AI Transformation");
  const coach = mockAgent("coach", "Noah", "Process & Requirements");
  // For the picker demo below: existing agents to browse, plus whatever gets
  // "created" through the flow (the actual Supabase insert will error in this
  // sandbox — no real DB — but every screen up to that click is fully real).
  const [pickerAgents, setPickerAgents] = useState<Agent[]>([consultant, coach]);

  // .view-root is normally a flex:1 column meant for ONE full-height section;
  // stacking two here would otherwise squeeze both to a sliver each, so this
  // preview overrides it to a plain scrollable block with each section given
  // its own explicit height instead of competing for flex space.
  return (
    <div className="app" style={{ height: "auto", overflowY: "auto" }}>
      <div className="view-root view-enter" style={{ display: "block", flex: "none" }}>
        <div className="page-head">
          <div>
            <h1>Dev Preview — chat empty-state hero</h1>
            <p>Mock data, no login required. Delete app/dev-preview/ when done.</p>
          </div>
        </div>
        <main className="workspace" style={{ height: 700 }}>
          <ProjectChatPanel project={mockProject} role="consultant" agent={consultant} flexGrow={2.3} />
          <ProjectChatPanel project={mockProject} role="coach" agent={coach} flexGrow={1} />
        </main>

        <div className="page-head">
          <div>
            <h1>New Task — agent picker / create-agent flow</h1>
            <p>Same mock project, agents un-assigned. "Create Agent" stays disabled here — its "Configure" step needs a real listAllMethods() Supabase call this sandbox has no DB for — everything up to it (type pick, the configure form) is fully real.</p>
          </div>
        </div>
        <main className="workspace" style={{ height: 640 }}>
          <AgentPickerPanel role="consultant" project={null} agents={pickerAgents} flexGrow={2.3}
            ensureProject={async () => mockProject}
            onAssigned={() => {}}
            onAgentCreated={a => setPickerAgents(prev => [...prev, a])} />
          <AgentPickerPanel role="coach" project={null} agents={pickerAgents} flexGrow={1}
            ensureProject={async () => mockProject}
            onAssigned={() => {}}
            onAgentCreated={a => setPickerAgents(prev => [...prev, a])} />
        </main>
      </div>
    </div>
  );
}
