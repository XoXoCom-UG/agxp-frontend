"use client";

import { useEffect, useState } from "react";
import type { Agent, AgentType, Method } from "@/lib/agents";
import { listAllMethods, createAgent } from "@/lib/agents";
import { assignAgent, type Project } from "@/lib/projects";
import { levelFor, LEVEL_ORDER } from "@/lib/agent-progress";
import { methodLabel } from "@/lib/method-labels";
import { dateStr } from "@/lib/utils";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { AgentMascot } from "@/components/layout/agent-mascot";
import {
  IconBack, IconPlus, IconArrow, IconSearch, IconCheck, IconChevronDown,
} from "@/components/layout/agxp-icons";

type PanelState = "empty" | "list" | "detail" | "type" | "configure";

const ROLE_LABEL: Record<AgentType, string> = { consultant: "Consultant", coach: "Coach" };
const ROLE_HEAD: Record<AgentType, { title: string; sub: string; emptyTitle: string; emptyDesc: string }> = {
  coach: {
    title: "Personal AI Coach",
    sub: "Select or create a coaching agent for this project.",
    emptyTitle: "No coaching agent selected",
    emptyDesc: "Create a new agent tailored to this engagement, or choose one from your existing AI team.",
  },
  consultant: {
    title: "Personal AI Consultant",
    sub: "Select or create the consultant who leads this engagement.",
    emptyTitle: "No consulting agent selected",
    emptyDesc: "Create a new agent tailored to this engagement, or choose one from your existing AI team.",
  },
};

// Agent "type" catalog — a type carries fixed methods (Patryk, 2026-09-02:
// the user shouldn't pick methods à la carte, the type decides them), all
// grounded in methods that actually exist in the DB.
interface TypeTemplate { type: string; sub: string; description: string; primary: string[]; secondary: string[]; status: "confirmed" | "preview"; }
const TYPE_CATALOG: Record<AgentType, TypeTemplate[]> = {
  consultant: [
    { type: "AI Strategy Consultant", sub: "Strategy & AI Transformation", status: "confirmed",
      description: "Strategic analysis and structured guidance for AI and IT transformation projects.",
      primary: ["As-Is/To-Be", "Gap-Analyse", "Requirements Engineering"], secondary: ["Process Mapping", "Impact Mapping"] },
    { type: "Solution Architect", sub: "Systems & Integration", status: "preview",
      description: "Designs target-state systems and integration blueprints.",
      primary: ["Gap-Analyse", "Process Mapping"], secondary: ["Impact Mapping"] },
    { type: "Digital Transformation Manager", sub: "Roadmap & Adoption", status: "preview",
      description: "Coordinates roadmap execution and change adoption across teams.",
      primary: ["Impact Mapping", "Process Mapping"], secondary: ["Requirements Engineering"] },
  ],
  coach: [
    { type: "AI Business Analyst", sub: "Process & Requirements", status: "confirmed",
      description: "Supports structured project discovery, requirements clarification and project execution.",
      primary: ["Requirements Engineering", "Process Mapping"], secondary: ["As-Is/To-Be"] },
    { type: "Agile Coach / Scrum Master", sub: "Delivery & Team Flow", status: "preview",
      description: "Coaches delivery teams on flow, ceremonies and iterative planning.",
      primary: ["Process Mapping"], secondary: ["Impact Mapping"] },
    { type: "Change Manager", sub: "Change & Adoption", status: "preview",
      description: "Guides teams through the human side of AI/IT transformations.",
      primary: ["Impact Mapping", "As-Is/To-Be"], secondary: ["Gap-Analyse"] },
  ],
};

export function AgentPickerPanel({ role, project, agents, ensureProject, onAssigned, onAgentCreated, primary, projectCounts = {} }: {
  role: AgentType;
  /** Null until the project row exists — it's created lazily on the first real action. */
  project: Project | null;
  agents: Agent[];
  ensureProject: () => Promise<Project>;
  onAssigned: (project: Project) => void;
  onAgentCreated: (agent: Agent) => void;
  primary?: boolean;
  /** Projects each agent has worked on for this user — drives its level. */
  projectCounts?: Record<string, number>;
}) {
  const totalProjects = (a: Agent) => a.last_projects.length + (projectCounts[a.id] ?? 0);
  const head = ROLE_HEAD[role];
  const [state, setState] = useState<PanelState>("empty");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<TypeTemplate | null>(null);
  // Confirming a pick before it commits replaces the old "Change agent"
  // mid-conversation button — catches a mis-click right where it happens.
  const [pendingConfirm, setPendingConfirm] = useState<Agent | null>(null);

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
      const p = project ?? await ensureProject();
      onAssigned(await assignAgent(p.id, role, agentId, `${ROLE_LABEL[role]} selected`));
    } finally { setBusy(false); }
  }

  const showBack = state !== "empty";

  return (
    <section className={`panel ${role}`} style={primary ? { flex: 1.6 } : undefined}>
      {pendingConfirm && (
        <ConfirmDialog
          title={`${pendingConfirm.name} as your ${ROLE_LABEL[role]}?`}
          body="Confirm to bring this agent into the project — the conversation starts right away."
          confirmLabel={`Confirm ${ROLE_LABEL[role]}`}
          onConfirm={() => { const a = pendingConfirm; setPendingConfirm(null); select(a.id); }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      <div className="panel-head">
        <AgentMascot role={role} size={38} enter />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2>{head.title}</h2>
          <div className="sub">{head.sub}</div>
        </div>
        {showBack && (
          <button className="back-link" onClick={() => setState(state === "detail" ? "list" : state === "configure" ? "type" : "empty")}>
            <IconBack size={11} /> Back
          </button>
        )}
      </div>

      {state === "empty" ? (
        <>
          <div className="pick-empty">
            <button className="pick-plus" onClick={() => setState("type")} aria-label="Create new agent">
              <IconPlus size={22} />
            </button>
            <div className="t">{head.emptyTitle}</div>
            <div className="d">{head.emptyDesc}</div>
            <div className="pick-actions">
              <button className="btn-primary-wide" onClick={() => setState("type")}><IconPlus size={13} />Create new</button>
              <button className="choose-row" onClick={() => setState("list")}>
                Choose from existing AI team
                <IconChevronDown size={18} style={{ transform: "rotate(-90deg)" }} />
              </button>
            </div>
          </div>
          <div className="suggested">
            <div className="lbl">Suggested {ROLE_LABEL[role]} roles</div>
            <ul>
              {TYPE_CATALOG[role].map(t => (
                <li key={t.type}>
                  <span className="dot" />
                  <span className="nm">{t.type}</span>
                  <span className={`role-pill ${t.status}`}>{t.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </>

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
          totalProjects={totalProjects} onSelect={a => setPendingConfirm(a)} />

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
                <div className="detail-section" style={{ marginBottom: 0 }}>
                  <span className="lbl">Methods</span>
                  <div className="sb-methods">
                    <div className="grp"><div className="chips">{t.primary.map(m => <span key={m} className="m-chip">{m}</span>)}</div></div>
                    <div className="grp"><div className="chips">{t.secondary.map(m => <span key={m} className="m-chip secondary">{m}</span>)}</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>

      ) : (
        <ConfigureView role={role} template={draft} onCreated={agent => { onAgentCreated(agent); setPendingConfirm(agent); }} />
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
          <span className="lbl">Knowledge Level</span>
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
            <div className="chips">{agent.primaryMethods.map(m => <span key={m.id} className="m-chip">{methodLabel(m.name)}</span>)}</div>
          </div>
        )}
        {agent.secondaryMethods.length > 0 && (
          <div className="grp"><span className="lbl">Secondary Methods</span>
            <div className="chips">{agent.secondaryMethods.map(m => <span key={m.id} className="m-chip secondary">{methodLabel(m.name)}</span>)}</div>
          </div>
        )}
      </div>
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
      setError((e as Error).message || "Agent konnte nicht erstellt werden.");
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
        <div className="field"><label>Description</label><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="field">
          <label>Methods (fixed by type)</label>
          <div className="sb-methods">
            <div className="grp"><div className="chips">{t.primary.map(m => <span key={m} className="m-chip">{m}</span>)}</div></div>
            <div className="grp"><div className="chips">{t.secondary.map(m => <span key={m} className="m-chip secondary">{m}</span>)}</div></div>
          </div>
        </div>
        <div className="field"><label>Knowledge Level</label><div className="val" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>New (no project history yet)</div></div>
        {error && <div className="field-err">{error}</div>}
        <div className="configure-actions">
          <button className="btn btn-solid" disabled={!valid || saving} onClick={submit}>
            {saving ? <span className="spinner" /> : (<><IconCheck size={13} />Create Agent</>)}
          </button>
        </div>
      </div>
    </>
  );
}
