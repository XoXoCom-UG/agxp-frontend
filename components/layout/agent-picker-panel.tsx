"use client";

import { useEffect, useState } from "react";
import type { Agent, AgentType, Method } from "@/lib/agents";
import { listAllMethods, createAgent } from "@/lib/agents";
import { assignAgent, clearAgent, type Project } from "@/lib/projects";
import { Button, Input, Textarea } from "@/components/ui";
import { cn, dateStr } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Plus, UserRoundCog, HeartHandshake, Check } from "lucide-react";

type PanelState = "empty" | "list" | "detail" | "create";

const ROLE_META: Record<AgentType, { label: string; icon: React.ReactNode; blurb: string }> = {
  consultant: {
    label: "Consultant",
    icon: <UserRoundCog className="w-[22px] h-[22px]" strokeWidth={1.5} />,
    blurb: "Provides strategic analysis and structured guidance for AI and IT transformation.",
  },
  coach: {
    label: "Coach",
    icon: <HeartHandshake className="w-[22px] h-[22px]" strokeWidth={1.5} />,
    blurb: "Supports structured project discovery, requirements clarification and project execution.",
  },
};

export function AgentPickerPanel({ role, project, agents, onAssigned, onAgentCreated }: {
  role: AgentType;
  project: Project;
  agents: Agent[];
  onAssigned: (project: Project) => void;
  onAgentCreated: (agent: Agent) => void;
}) {
  const meta = ROLE_META[role];
  const assignedId = role === "coach" ? project.coach_agent_id : project.consultant_agent_id;
  const assigned = agents.find(a => a.id === assignedId) ?? null;

  const [state, setState] = useState<PanelState>("empty");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const roleAgents = agents.filter(a => a.type === role);
  const filtered = roleAgents.filter(a => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const hay = [a.name, a.tagline ?? "", a.expertise ?? "", ...a.methods.map(m => m.name)].join(" ").toLowerCase();
    return hay.includes(q);
  });

  async function select(agentId: string) {
    setBusy(true);
    try {
      const updated = await assignAgent(project.id, role, agentId, `${meta.label} selected`);
      onAssigned(updated);
    } finally { setBusy(false); }
  }

  async function change() {
    setBusy(true);
    try {
      const updated = await clearAgent(project.id, role);
      onAssigned(updated);
      setState("empty");
    } finally { setBusy(false); }
  }

  return (
    <section className={cn(
      "flex-1 min-w-0 rounded-lg border border-border flex flex-col overflow-hidden",
      role === "coach" ? "bg-gradient-to-b from-coach-3 to-background" : "bg-gradient-to-b from-consultant-3 to-background"
    )}>
      <div className="px-6 pt-5 pb-4 border-b border-border shrink-0 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={cn("w-[7px] h-[7px] rounded-full", role === "coach" ? "bg-coach-2" : "bg-consultant-2")} />
            <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{meta.label}</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Personal AI {meta.label}</h2>
        </div>
        {!assigned && state !== "empty" && (
          <button onClick={() => setState(state === "detail" ? "list" : "empty")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary border border-border rounded-xs px-2.5 py-1.5 hover:text-foreground hover:border-border-strong transition-colors shrink-0">
            <ArrowLeft className="w-3 h-3" strokeWidth={2.2} />Back
          </button>
        )}
      </div>

      {assigned ? (
        <SelectedView agent={assigned} onChange={change} busy={busy} />
      ) : state === "empty" ? (
        <EmptyView role={role} meta={meta} onCreate={() => setState("create")} onList={() => setState("list")} />
      ) : state === "list" ? (
        <ListView agents={filtered} search={search} setSearch={setSearch}
          onOpen={id => { setDetailId(id); setState("detail"); }} />
      ) : state === "detail" ? (
        <DetailView agent={roleAgents.find(a => a.id === detailId) ?? null} role={role} busy={busy} onSelect={select} />
      ) : (
        <CreateAgentView role={role} project={project} onCreated={agent => { onAgentCreated(agent); select(agent.id); }} />
      )}
    </section>
  );
}

function EmptyView({ role, meta, onCreate, onList }: {
  role: AgentType; meta: typeof ROLE_META[AgentType]; onCreate: () => void; onList: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2">
      <div className="w-[52px] h-[52px] rounded-lg bg-card border border-border flex items-center justify-center mb-2 text-muted-foreground">
        {meta.icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">No {meta.label} assigned</h3>
      <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">{meta.blurb}</p>
      <div className="flex flex-col gap-2 w-full max-w-[260px] mt-4">
        <Button className="justify-center" onClick={onCreate}><Plus className="w-3.5 h-3.5" strokeWidth={2} />Create new agent</Button>
        <Button variant="secondary" className="justify-center" onClick={onList}>Choose from existing team</Button>
      </div>
    </div>
  );
}

function ListView({ agents, search, setSearch, onOpen }: {
  agents: Agent[]; search: string; setSearch: (s: string) => void; onOpen: (id: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-border shrink-0">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by agent, type or method..." />
      </div>
      <p className="px-6 pt-4 pb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground shrink-0">Existing AI Team</p>
      <div className="flex-1 overflow-y-auto">
        {agents.length === 0 && <p className="text-xs text-muted-foreground px-6 py-8 text-center">No agents found.</p>}
        {agents.map(a => (
          <div key={a.id} onClick={() => onOpen(a.id)}
            className="px-6 py-4 border-b border-border cursor-pointer hover:bg-accent/40 transition-colors">
            <p className="text-sm font-semibold text-foreground">{a.name}</p>
            {a.tagline && <p className="text-xs text-muted-foreground mt-0.5">{a.tagline}</p>}
            {a.primaryMethods.length > 0 && (
              <p className="text-xs text-secondary-foreground mt-2.5 leading-relaxed">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mr-2">Primary</span>
                {a.primaryMethods.map(m => m.name).join(" · ")}
              </p>
            )}
            {a.secondaryMethods.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mr-2">Secondary</span>
                {a.secondaryMethods.map(m => m.name).join(" · ")}
              </p>
            )}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">{a.last_projects.length} Projects</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-secondary-foreground bg-secondary border border-input rounded-xs px-3 py-1.5">
                Select <ArrowRight className="w-3 h-3" strokeWidth={2.2} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailView({ agent, role, busy, onSelect }: { agent: Agent | null; role: AgentType; busy: boolean; onSelect: (id: string) => void }) {
  if (!agent) return null;
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">{agent.name}</h2>
      {agent.description && <p className="text-xs text-secondary-foreground leading-relaxed max-w-[420px] mb-5">{agent.description}</p>}
      {agent.expertise && (
        <div className="mb-5">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Expertise</span>
          <p className="text-xs text-secondary-foreground">{agent.expertise}</p>
        </div>
      )}
      {agent.primaryMethods.length > 0 && (
        <div className="mb-5">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Primary Methods</span>
          <ol className="flex flex-col gap-1.5">
            {agent.primaryMethods.map((m, i) => (
              <li key={m.id} className="text-sm text-foreground flex gap-2.5 items-baseline">
                <span className="text-[11px] text-primary-soft font-bold w-4 shrink-0">0{i + 1}</span>{m.name}
              </li>
            ))}
          </ol>
        </div>
      )}
      {agent.secondaryMethods.length > 0 && (
        <div className="mb-5">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Secondary</span>
          <p className="text-xs text-secondary-foreground">{agent.secondaryMethods.map(m => m.name).join(" · ")}</p>
        </div>
      )}
      <div className="flex gap-8 mb-5">
        <div><span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Knowledge Level</span><b className="text-base font-semibold text-foreground">{agent.knowledge_level}</b></div>
        <div><span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Previous Projects</span><b className="text-base font-semibold text-foreground">{agent.last_projects.length}</b></div>
      </div>
      {agent.last_projects.length > 0 && (
        <div className="mb-6">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Recent Projects</span>
          <div className="flex flex-col">
            {agent.last_projects.map(p => (
              <div key={p.id} className="pl-4 pb-3 border-l border-input last:border-transparent relative">
                <span className="absolute -left-[3.5px] top-1 w-[7px] h-[7px] rounded-full bg-primary" />
                <p className="text-xs text-foreground font-medium">{p.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{dateStr(p.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <Button className="w-full justify-center" disabled={busy} onClick={() => onSelect(agent.id)}>
        Select {role === "coach" ? "Coach" : "Consultant"} <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.2} />
      </Button>
    </div>
  );
}

function SelectedView({ agent, onChange, busy }: { agent: Agent; onChange: () => void; busy: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2.5">
      <div className={cn("w-[52px] h-[52px] rounded-lg flex items-center justify-center mb-1",
        agent.type === "coach" ? "bg-coach-2" : "bg-consultant-2")}>
        <span className="text-white text-sm font-bold">{agent.avatar_placeholder || agent.name.slice(0, 2).toUpperCase()}</span>
      </div>
      <p className="text-base font-semibold text-foreground">{agent.name}</p>
      <p className="text-xs text-secondary-foreground">Knowledge: {agent.knowledge_level} · {agent.last_projects.length} Projects</p>
      {agent.primaryMethods.length > 0 && <p className="text-xs text-muted-foreground max-w-[300px]">{agent.primaryMethods.map(m => m.name).join(" · ")}</p>}
      <div className="flex items-center gap-1.5 text-[11px] text-secondary-foreground mt-1">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />Ready for project
      </div>
      <button onClick={onChange} disabled={busy}
        className="text-xs text-muted-foreground bg-secondary border border-border rounded-xs px-3 py-1.5 mt-1.5 hover:text-foreground hover:border-border-strong transition-colors">
        Change agent
      </button>
    </div>
  );
}

function CreateAgentView({ role, onCreated }: { role: AgentType; project: Project; onCreated: (a: Agent) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [methods, setMethods] = useState<Method[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => { listAllMethods().then(setMethods).catch(() => {}); }, []);

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const valid = name.trim().length > 0 && selected.size > 0;

  async function submit() {
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    try {
      const agent = await createAgent({ type: role, name: name.trim(), description: description.trim(), methodIds: [...selected] });
      onCreated(agent);
    } finally { setSaving(false); }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Agent Name</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={`e.g. ${role === "coach" ? "Change Coach" : "Strategy Consultant"}`} />
        {touched && !name.trim() && <p className="text-[11px] text-destructive mt-1.5">Agent name is required.</p>}
      </div>
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Description</label>
        <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this agent help with?" />
      </div>
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Methods</label>
        <div className="flex flex-wrap gap-1.5">
          {methods.map(m => {
            const on = selected.has(m.id);
            return (
              <button key={m.id} type="button" onClick={() => toggle(m.id)}
                className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xs border transition-colors",
                  on ? "text-foreground bg-white/5 border-primary/45" : "text-muted-foreground bg-secondary border-input")}>
                {on && <Check className="w-3 h-3" strokeWidth={2.5} />}{m.name}
              </button>
            );
          })}
        </div>
        {touched && selected.size === 0 && <p className="text-[11px] text-destructive mt-1.5">Select at least one method.</p>}
      </div>
      <Button className="mt-auto justify-center" disabled={!valid || saving} onClick={submit}>
        {saving ? <span className="thinking-spinner" style={{ width: 13, height: 13 }} /> : "Create Agent"}
      </Button>
    </div>
  );
}
