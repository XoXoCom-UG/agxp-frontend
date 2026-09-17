"use client";

import { useEffect, useState } from "react";
import type { Agent, AgentType, Method } from "@/lib/agents";
import { listAllMethods, createAgent } from "@/lib/agents";
import { assignAgent, type Project } from "@/lib/projects";
import { levelFor, LEVEL_ORDER } from "@/lib/agent-progress";
import { methodLabel } from "@/lib/method-labels";
import { dateStr } from "@/lib/utils";
import { describeDbError } from "@/lib/db-error";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/layout/ui-card";
import {
  IconBack, IconArrow, IconSearch, IconCheck,
} from "@/components/layout/agxp-icons";

type PanelState = "empty" | "list" | "detail" | "type" | "configure";

const ROLE_LABEL: Record<AgentType, string> = { consultant: "Consultant", coach: "Coach" };
const PICKER_COPY: Record<AgentType, { createDesc: string; trainDesc: string }> = {
  consultant: {
    createDesc: "Set up a new AI consultant tailored to your needs.",
    trainDesc: "Improve your consultant with new knowledge and context.",
  },
  coach: {
    createDesc: "Start a new AI coach for your personal growth.",
    trainDesc: "Enhance your coach with new insights and goals.",
  },
};

// Agent "type" catalog — a type carries fixed methods (Patryk, 2026-09-02:
// the user shouldn't pick methods à la carte, the type decides them), all
// grounded in methods that actually exist in the DB.
interface TypeTemplate { type: string; sub: string; description: string; primary: string[]; secondary: string[]; }
const TYPE_CATALOG: Record<AgentType, TypeTemplate[]> = {
  consultant: [
    { type: "AI Strategy Consultant", sub: "Strategy & AI Transformation",
      description: "Strategic analysis and structured guidance for AI and IT transformation projects.",
      primary: ["As-Is/To-Be", "Gap-Analyse", "Requirements Engineering"], secondary: ["Process Mapping", "Impact Mapping"] },
    { type: "Solution Architect", sub: "Systems & Integration",
      description: "Designs target-state systems and integration blueprints.",
      primary: ["Gap-Analyse", "Process Mapping"], secondary: ["Impact Mapping"] },
    { type: "Digital Transformation Manager", sub: "Roadmap & Adoption",
      description: "Coordinates roadmap execution and change adoption across teams.",
      primary: ["Impact Mapping", "Process Mapping"], secondary: ["Requirements Engineering"] },
  ],
  coach: [
    { type: "AI Business Analyst", sub: "Process & Requirements",
      description: "Supports structured project discovery, requirements clarification and project execution.",
      primary: ["Requirements Engineering", "Process Mapping"], secondary: ["As-Is/To-Be"] },
    { type: "Agile Coach / Scrum Master", sub: "Delivery & Team Flow",
      description: "Coaches delivery teams on flow, ceremonies and iterative planning.",
      primary: ["Process Mapping"], secondary: ["Impact Mapping"] },
    { type: "Change Manager", sub: "Change & Adoption",
      description: "Guides teams through the human side of AI/IT transformations.",
      primary: ["Impact Mapping", "As-Is/To-Be"], secondary: ["Gap-Analyse"] },
  ],
};

export function AgentPickerPanel({ role, project, agents, ensureProject, onAssigned, onAgentCreated, grow = 1, projectCounts = {}, assignedAgent, onChangeAgent }: {
  role: AgentType;
  /** Null until the project row exists — it's created lazily on the first real action. */
  project: Project | null;
  agents: Agent[];
  ensureProject: () => Promise<Project>;
  onAssigned: (project: Project) => void;
  onAgentCreated: (agent: Agent) => void;
  /** How much of the row this panel takes (flex-grow). */
  grow?: number;
  /** Projects each agent has worked on for this user — drives its level. */
  projectCounts?: Record<string, number>;
  /** Already chosen, but the chat has not started yet: show who it is. */
  assignedAgent?: Agent | null;
  onChangeAgent?: () => void;
}) {
  const totalProjects = (a: Agent) => a.last_projects.length + (projectCounts[a.id] ?? 0);
  const [state, setState] = useState<PanelState>("empty");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<TypeTemplate | null>(null);

  const roleAgents = agents.filter(a => a.type === role);
  const filtered = roleAgents.filter(a => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const hay = [a.name, a.tagline ?? "", a.expertise ?? "", ...a.methods.map(m => m.name)].join(" ").toLowerCase();
    return hay.includes(q);
  });

  /** Picking is the action — no "are you sure?" in between. If it was the
   *  wrong one you simply pick again (Patryk, 2026-09-11). */
  async function select(agentId: string) {
    setBusy(true);
    try {
      const p = project ?? await ensureProject();
      onAssigned(await assignAgent(p.id, role, agentId, `${ROLE_LABEL[role]} selected`));
    } finally { setBusy(false); }
  }

  const showBack = state !== "empty";
  // Coach comes second — its picker stays idle until a Consultant is
  // assigned, so the two agents are always picked in a fixed order.
  const coachLocked = role === "coach" && !project?.consultant_agent_id;

  // Chosen, waiting for Start. Showing who it is beats an empty panel, and
  // this is the one place changing your mind is free.
  if (assignedAgent) {
    const total = totalProjects(assignedAgent);
    const level = levelFor(total);
    return (
      <section className={`panel panel-picker ${role}`} style={{ flexGrow: grow }}>
        <div className="panel-head">
          <AgentMascot role={role} size={38} enter level={level} />
        </div>
        <div className="selected-summary">
          <div className="sel-name">{assignedAgent.name}</div>
          {assignedAgent.tagline && <div className="sel-type">{assignedAgent.tagline}</div>}
          <div className="sel-type">{level} · {total} {total === 1 ? "project" : "projects"} together</div>
          {assignedAgent.primaryMethods.length > 0 && (
            <div className="sel-methods">{assignedAgent.primaryMethods.map(m => methodLabel(m.name)).join(" · ")}</div>
          )}
          {onChangeAgent && <button className="btn btn-hero" onClick={onChangeAgent}>Change agent</button>}
        </div>
      </section>
    );
  }

  return (
    <section className={`panel panel-picker ${role}`} style={{ flexGrow: grow }}>
      <div className="panel-head">
        <AgentMascot role={role} size={38} enter />
        {showBack && (
          <button className="back-link" onClick={() => setState(state === "detail" ? "list" : state === "configure" ? "type" : "empty")}>
            <IconBack size={11} /> Back
          </button>
        )}
      </div>

      {state === "empty" ? (
        // Two cards, one per way in. They sit side by side in the wide panel
        // and stack in the narrow one — a container query on .panel, so it
        // follows the panel's own width, not the window's.
        <div className="pick-empty">
          <div className="pick-cards">
            <Card>
              <CardHeader>
                <CardTitle>Create new AI {ROLE_LABEL[role]}</CardTitle>
                <CardDescription>{PICKER_COPY[role].createDesc}</CardDescription>
              </CardHeader>
              <CardFooter>
                <button className="btn" disabled={coachLocked}
                  data-tooltip={coachLocked ? "Pick a Consultant first" : undefined}
                  onClick={() => setState("type")}>
                  <span>Create new agent</span><span className="btn-arrow-end">→</span>
                </button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Train existing AI {ROLE_LABEL[role]}</CardTitle>
                <CardDescription>{PICKER_COPY[role].trainDesc}</CardDescription>
              </CardHeader>
              <CardFooter>
                <button className="btn" disabled={coachLocked}
                  data-tooltip={coachLocked ? "Pick a Consultant first" : undefined}
                  onClick={() => setState("list")}>
                  <span>Train existing agent</span><span className="btn-arrow-end">→</span>
                </button>
              </CardFooter>
            </Card>
          </div>
        </div>

      ) : state === "list" ? (
        <>
          <div className="list-toolbar">
            <div className="search-box"><IconSearch size={13} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or what they do..." />
            </div>
          </div>
          <div className="list-section-label">People you have worked with</div>
          {filtered.length === 0 ? (
            <div className="empty-search">
              <div className="t">No agents found</div>
              <div className="d">Try another name, or make a new one.</div>
              <button className="btn btn-ghost" onClick={() => setSearch("")}>Clear search</button>
            </div>
          ) : (
            <div className="directory">
              {filtered.map(a => (
                <div key={a.id} className="dir-row" tabIndex={0} role="button" aria-label={`View ${a.name}`}
                  onClick={() => { setDetailId(a.id); setState("detail"); }}>
                  <div className="dr-name">{a.name}</div>
                  {a.tagline && <div className="dr-sub">{a.tagline}</div>}
                  {a.primaryMethods.length > 0 && <div className="dr-methods"><span className="mlabel">Primary</span>{a.primaryMethods.map(m => m.name).join(" · ")}</div>}
                  {a.secondaryMethods.length > 0 && <div className="dr-methods secondary"><span className="mlabel">Secondary</span>{a.secondaryMethods.map(m => m.name).join(" · ")}</div>}
                  <div className="dr-foot">
                    <span className="proj-count">{levelFor(totalProjects(a))} · {totalProjects(a)} Projects</span>
                    <span className="dr-select" aria-hidden="true">Select <IconArrow /></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>

      ) : state === "detail" ? (
        <DetailView agent={roleAgents.find(a => a.id === detailId) ?? null} role={role} busy={busy}
          totalProjects={totalProjects} onSelect={a => select(a.id)} />

      ) : state === "type" ? (
        <>
          <div className="step-eyebrow">Step 1 of 2 — what kind of help?</div>
          <div className="type-wrap">
            {TYPE_CATALOG[role].map(t => (
              <div key={t.type} className="type-card">
                <div className="type-card-top">
                  <div><h3>{t.type}</h3><div className="desc">{t.description}</div></div>
                  <button className="btn btn-ghost" onClick={() => { setDraft(t); setState("configure"); }}>Select <IconArrow /></button>
                </div>
                <div className="detail-section" style={{ marginBottom: 0 }}>
                  <span className="lbl">Can help with</span>
                  <ul className="plist">
                    {[...t.primary, ...t.secondary].map(m => <li key={m}>{methodLabel(m)}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </>

      ) : (
        <ConfigureView role={role} template={draft} onCreated={agent => { onAgentCreated(agent); select(agent.id); }} />
      )}
    </section>
  );
}

function DetailView({ agent, role, busy, totalProjects, onSelect }: {
  agent: Agent | null; role: AgentType; busy: boolean;
  totalProjects: (a: Agent) => number;
  onSelect: (agent: Agent) => void;
}) {
  if (!agent) return null;
  const total = totalProjects(agent);
  const level = levelFor(total);
  return (
    <div className="detail">
      <div className="role-line"><span className={`role-dot ${role}`} /><span className="role-eyebrow">{ROLE_LABEL[role]}</span></div>
      <h2>{agent.name}</h2>
      {agent.description && <div className="detail-desc">{agent.description}</div>}
      <div className="sb-stats">
        <div>
          <span className="lbl">Experience</span>
          <div className="level">
            <b>{level}</b>
            <span className="level-bar">
              {LEVEL_ORDER.map((l, i) => <span key={l} className={`level-seg ${i <= LEVEL_ORDER.indexOf(level) ? "on" : ""}`} />)}
            </span>
          </div>
        </div>
        <div><span className="lbl">Previous Projects</span><b>{total}</b></div>
        {agent.tagline && <div><span className="lbl">Type</span><b>{agent.tagline}</b></div>}
      </div>
      <div className="sb-methods" style={{ marginBottom: "var(--sp-5)" }}>
        {agent.primaryMethods.length > 0 && (
          <div className="grp"><span className="lbl">Primary Methods</span>
            <div className="chips">{agent.primaryMethods.map(m => <span key={m.id} className="m-chip shimmer-text">{methodLabel(m.name)}</span>)}</div>
          </div>
        )}
        {agent.secondaryMethods.length > 0 && (
          <div className="grp"><span className="lbl">Secondary Methods</span>
            <div className="chips">{agent.secondaryMethods.map(m => <span key={m.id} className="m-chip secondary shimmer-text">{methodLabel(m.name)}</span>)}</div>
          </div>
        )}
      </div>
      {agent.methods.length > 0 && (
        <div className="detail-section">
          <span className="lbl">Can help with</span>
          <ul className="plist">
            {[...agent.primaryMethods, ...agent.secondaryMethods].map(m => (
              <li key={m.id}>{methodLabel(m.name)}</li>
            ))}
          </ul>
        </div>
      )}
      {agent.last_projects.length > 0 && (
        <div className="detail-section"><span className="lbl">Recent Projects</span>
          <div className="timeline">{agent.last_projects.map(p => (
            <div key={p.id} className="t-item"><div className="pn">{p.name}</div><div className="pd">{dateStr(p.created_at)}</div></div>
          ))}</div>
        </div>
      )}
      <button className="detail-select-btn" disabled={busy} onClick={() => onSelect(agent)}>
        Select {ROLE_LABEL[role]} <IconArrow />
      </button>
    </div>
  );
}

function ConfigureView({ role, template, onCreated }: { role: AgentType; template: TypeTemplate | null; onCreated: (a: Agent) => void }) {
  const t = template ?? TYPE_CATALOG[role][0];
  const [name, setName] = useState(t.type);
  const [description, setDescription] = useState(t.description);
  const [allMethods, setAllMethods] = useState<Method[]>([]);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listAllMethods().then(setAllMethods).catch(() => {}); }, []);

  // The type decides the methods — the user names the agent, not its skillset.
  const methodIds = allMethods.filter(m => t.primary.includes(m.name) || t.secondary.includes(m.name)).map(m => m.id);
  const valid = name.trim().length > 0 && methodIds.length > 0;

  async function submit() {
    setTouched(true);
    setError(null);
    if (!valid || saving) return;
    setSaving(true);
    try {
      const agent = await createAgent({ type: role, name: name.trim(), description: description.trim(), tagline: t.sub, methodIds });
      onCreated(agent);
    } catch (e) {
      // The Postgres error code goes on screen — the bare RLS message alone
      // never said which policy was missing.
      setError(describeDbError(e, "Creating the agent"));
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="step-eyebrow">Step 2 of 2 — give them a name</div>
      <div className="configure">
        <div className="field">
          <label>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} />
          {touched && !name.trim() && <div className="field-err">Agent name is required.</div>}
        </div>
        <div className="field"><label>Description</label><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="field">
          <label>Methods (fixed by type)</label>
          <div className="sb-methods">
            <div className="grp"><div className="chips">{t.primary.map(m => <span key={m} className="m-chip shimmer-text">{methodLabel(m)}</span>)}</div></div>
            <div className="grp"><div className="chips">{t.secondary.map(m => <span key={m} className="m-chip secondary shimmer-text">{methodLabel(m)}</span>)}</div></div>
          </div>
        </div>
        <div className="field"><label>Experience</label><div className="val" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>New — you two have not worked together yet</div></div>
        {error && <div className="field-err">{error}</div>}
        <div className="configure-actions">
          <button className="btn btn-solid" disabled={!valid || saving} onClick={submit}>
            {saving ? <span className="spinner" /> : (<><IconCheck size={13} />Create</>)}
          </button>
        </div>
      </div>
    </>
  );
}
