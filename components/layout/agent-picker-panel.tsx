"use client";

import { useEffect, useState } from "react";
import type { Agent, AgentType, Method } from "@/lib/agents";
import { listAllMethods, createAgent } from "@/lib/agents";
import { assignAgent, clearAgent, type Project } from "@/lib/projects";
import { dateStr } from "@/lib/utils";
import {
  IconBack, IconPlus, IconArrow, IconSearch, IconCoach, IconConsultant, IconCheck,
} from "@/components/layout/agxp-icons";

type PanelState = "empty" | "list" | "detail" | "type" | "configure";

const ROLE_LABEL: Record<AgentType, string> = { consultant: "Consultant", coach: "Coach" };
const ROLE_BLURB: Record<AgentType, string> = {
  consultant: "Provides strategic analysis and structured guidance for AI and IT transformation.",
  coach: "Supports structured project discovery, requirements clarification and project execution.",
};

// Agent "type" catalog for the 2-step create flow — grounded in the methods
// that actually exist in the DB (unlike Ana's mockup, which invents a larger
// fictional method catalog), so every method name here resolves to a real row.
interface TypeTemplate { type: string; sub: string; description: string; primary: string[]; secondary: string[]; }
const TYPE_CATALOG: Record<AgentType, TypeTemplate[]> = {
  consultant: [
    { type: "AI Strategy Consultant", sub: "Strategy & AI Transformation",
      description: "Strategic analysis and structured guidance for AI and IT transformation projects.",
      primary: ["As-Is/To-Be", "Gap-Analyse"], secondary: ["Requirements Engineering"] },
    { type: "Solution Architect", sub: "Systems & Integration",
      description: "Designs target-state systems and integration blueprints.",
      primary: ["Gap-Analyse", "Process Mapping"], secondary: ["Impact Mapping"] },
    { type: "Digital Transformation Manager", sub: "Roadmap & Adoption",
      description: "Coordinates roadmap execution and change adoption across teams.",
      primary: ["Impact Mapping", "Process Mapping"], secondary: ["Requirements Engineering"] },
  ],
  coach: [
    { type: "Business Analyst Coach", sub: "Process & Requirements",
      description: "Supports structured project discovery, requirements clarification and project execution.",
      primary: ["Requirements Engineering", "Process Mapping"], secondary: ["As-Is/To-Be"] },
    { type: "Change Management Coach", sub: "Change & Adoption",
      description: "Begleitet Teams durch Veränderungsprozesse im Rahmen von AI-/IT-Transformationen.",
      primary: ["Impact Mapping", "As-Is/To-Be"], secondary: ["Gap-Analyse"] },
  ],
};

export function AgentPickerPanel({ role, project, agents, onAssigned, onAgentCreated }: {
  role: AgentType;
  project: Project;
  agents: Agent[];
  onAssigned: (project: Project) => void;
  onAgentCreated: (agent: Agent) => void;
}) {
  const assignedId = role === "coach" ? project.coach_agent_id : project.consultant_agent_id;
  const assigned = agents.find(a => a.id === assignedId) ?? null;

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

  async function select(agentId: string) {
    setBusy(true);
    try { onAssigned(await assignAgent(project.id, role, agentId, `${ROLE_LABEL[role]} selected`)); }
    finally { setBusy(false); }
  }
  async function change() {
    setBusy(true);
    try { onAssigned(await clearAgent(project.id, role)); setState("empty"); }
    finally { setBusy(false); }
  }

  const showBack = !assigned && state !== "empty";
  const reco = TYPE_CATALOG[role][0];

  return (
    <section className={`panel ${role}`}>
      <div className="pane-head">
        <div className="pane-head-top">
          <div>
            <div className="role-line"><span className={`role-dot ${role}`} /><span className="role-eyebrow">{ROLE_LABEL[role]}</span></div>
            <div className="pane-title">Personal AI {ROLE_LABEL[role]}</div>
          </div>
          {showBack && (
            <button className="back-link" onClick={() => setState(state === "detail" || state === "configure" ? (state === "detail" ? "list" : "type") : "empty")}>
              <IconBack size={11} /> Back
            </button>
          )}
        </div>
      </div>

      {assigned ? (
        <div className="selected-summary">
          <div className="sel-badge">{role === "coach" ? <IconCoach size={20} /> : <IconConsultant size={20} />}</div>
          <div className="sel-name">{assigned.name}</div>
          <div className="sel-type">Knowledge: {assigned.knowledge_level} · {assigned.last_projects.length} Projects</div>
          {assigned.primaryMethods.length > 0 && <div className="sel-methods">{assigned.primaryMethods.map(m => m.name).join(" · ")}</div>}
          <div className="ready-badge"><span className="rd" />Ready for project</div>
          <button className="change-link" onClick={change} disabled={busy}>Change agent</button>
        </div>

      ) : state === "empty" ? (
        <div className="empty-fill">
          <div className="empty-state-block">
            <div className="empty-icon">{role === "coach" ? <IconCoach size={22} /> : <IconConsultant size={22} />}</div>
            <h3 className="empty-title">No {ROLE_LABEL[role]} assigned</h3>
            <p className="empty-desc">{ROLE_BLURB[role]}</p>
            <div className="empty-actions">
              <button className="btn btn-hero" onClick={() => setState("type")}><IconPlus />Create new agent</button>
              <button className="btn btn-ghost" onClick={() => setState("list")}>Choose from existing team</button>
            </div>
          </div>
          <div className="reco-box">
            <div className="reco-label">Recommended for this project</div>
            <div className="reco-name">{reco.type}</div>
            <div className="reco-methods">{reco.primary.join(" · ")}</div>
            <div className="reco-hint">Best match based on current project context.</div>
          </div>
        </div>

      ) : state === "list" ? (
        <>
          <div className="list-toolbar">
            <div className="search-box"><IconSearch size={13} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by agent, type or method..." />
            </div>
          </div>
          <div className="list-section-label">Existing AI Team</div>
          {filtered.length === 0 ? (
            <div className="empty-search">
              <div className="t">No agents found</div>
              <div className="d">Try another role, method or expertise.</div>
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
                    <span className="proj-count">{a.last_projects.length} Projects</span>
                    <span className="dr-select" aria-hidden="true">Select <IconArrow /></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>

      ) : state === "detail" ? (
        <DetailView agent={roleAgents.find(a => a.id === detailId) ?? null} role={role} busy={busy} onSelect={select} />

      ) : state === "type" ? (
        <>
          <div className="step-eyebrow">Step 1 / 2 — Choose agent type</div>
          <div className="type-wrap">
            {TYPE_CATALOG[role].map(t => (
              <div key={t.type} className="type-card">
                <div className="type-card-top">
                  <div><h3>{t.type}</h3><div className="desc">{t.description}</div></div>
                  <button className="btn btn-ghost" onClick={() => { setDraft(t); setState("configure"); }}>Select <IconArrow /></button>
                </div>
                <div className="detail-section" style={{ marginBottom: 0 }}><span className="lbl">Primary Methods</span><div className="val">{t.primary.join(" · ")}</div></div>
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

function DetailView({ agent, role, busy, onSelect }: { agent: Agent | null; role: AgentType; busy: boolean; onSelect: (id: string) => void }) {
  if (!agent) return null;
  return (
    <div className="detail">
      <div className="role-line"><span className={`role-dot ${role}`} /><span className="role-eyebrow">{ROLE_LABEL[role]}</span></div>
      <h2>{agent.name}</h2>
      {agent.description && <div className="detail-desc">{agent.description}</div>}
      {agent.expertise && (
        <div className="detail-section"><span className="lbl">Expertise</span><div className="val">{agent.expertise}</div></div>
      )}
      {agent.primaryMethods.length > 0 && (
        <div className="detail-section"><span className="lbl">Primary Methods</span>
          <ol className="num-list">{agent.primaryMethods.map((m, i) => <li key={m.id}><span className="no">0{i + 1}</span>{m.name}</li>)}</ol>
        </div>
      )}
      {agent.secondaryMethods.length > 0 && (
        <div className="detail-section"><span className="lbl">Secondary</span><div className="val">{agent.secondaryMethods.map(m => m.name).join(" · ")}</div></div>
      )}
      <div className="detail-row-inline">
        <div><span className="lbl">Knowledge Level</span><b>{agent.knowledge_level}</b></div>
        <div><span className="lbl">Previous Projects</span><b>{agent.last_projects.length}</b></div>
      </div>
      {agent.last_projects.length > 0 && (
        <div className="detail-section"><span className="lbl">Recent Projects</span>
          <div className="timeline">{agent.last_projects.map(p => (
            <div key={p.id} className="t-item"><div className="pn">{p.name}</div><div className="pd">{dateStr(p.created_at)}</div></div>
          ))}</div>
        </div>
      )}
      <button className="detail-select-btn" disabled={busy} onClick={() => onSelect(agent.id)}>
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
  const [selectedPrimary, setSelectedPrimary] = useState<Set<string>>(new Set());
  const [selectedSecondary, setSelectedSecondary] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAllMethods().then(methods => {
      setAllMethods(methods);
      const byName = (names: string[]) => new Set(methods.filter(m => names.includes(m.name)).map(m => m.id));
      setSelectedPrimary(byName(t.primary));
      setSelectedSecondary(byName(t.secondary));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).catch(() => {});
  }, []);

  const primaryMethods = allMethods.filter(m => m.is_primary);
  const secondaryMethods = allMethods.filter(m => !m.is_primary);
  const valid = name.trim().length > 0 && selectedPrimary.size > 0;

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setSet(n);
  }

  async function submit() {
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    try {
      const methodIds = [...selectedPrimary, ...selectedSecondary];
      const agent = await createAgent({ type: role, name: name.trim(), description: description.trim(), tagline: t.sub, methodIds });
      onCreated(agent);
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="step-eyebrow">Step 2 / 2 — Configure Agent</div>
      <div className="configure">
        <div className="field">
          <label>Agent Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} />
          {touched && !name.trim() && <div className="field-err">Agent name is required.</div>}
        </div>
        <div className="field"><label>Description</label><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="field">
          <label>Primary Methods</label>
          <div className="method-select">
            {primaryMethods.map(m => (
              <button key={m.id} type="button" className={`method-chip ${selectedPrimary.has(m.id) ? "on" : ""}`}
                onClick={() => toggle(selectedPrimary, setSelectedPrimary, m.id)}>{m.name}</button>
            ))}
          </div>
          {touched && selectedPrimary.size === 0 && <div className="field-err">Select at least one primary method.</div>}
        </div>
        <div className="field">
          <label>Secondary Methods</label>
          <div className="method-select">
            {secondaryMethods.map(m => (
              <button key={m.id} type="button" className={`method-chip ${selectedSecondary.has(m.id) ? "on" : ""}`}
                onClick={() => toggle(selectedSecondary, setSelectedSecondary, m.id)}>{m.name}</button>
            ))}
          </div>
        </div>
        <div className="field"><label>Knowledge Level</label><div className="val" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>New (no project history yet)</div></div>
        <div className="configure-actions">
          <button className="btn btn-solid" disabled={!valid || saving} onClick={submit}>
            {saving ? <span className="spinner" /> : (<><IconCheck size={13} />Create Agent</>)}
          </button>
        </div>
      </div>
    </>
  );
}
