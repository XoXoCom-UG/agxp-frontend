"use client";

import { useEffect, useState } from "react";
import type { Agent, AgentType, Method } from "@/lib/agents";
import { listAllMethods, createAgent } from "@/lib/agents";
import { assignAgent, type Project } from "@/lib/projects";
import { levelFor, LEVEL_ORDER } from "@/lib/agent-progress";
import { methodLabel } from "@/lib/method-labels";
import { dateStr } from "@/lib/utils";
import { describeDbError } from "@/lib/db-error";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { AgentMascot } from "@/components/layout/agent-mascot";
import {
  IconBack, IconPlus, IconArrow, IconSearch, IconCheck, IconChevronDown,
} from "@/components/layout/agxp-icons";

type PanelState = "empty" | "list" | "detail" | "type" | "configure";

const ROLE_LABEL: Record<AgentType, string> = { consultant: "Consultant", coach: "Coach" };
// Plain words only. Patryk's review (2026-09-10): someone with no IT or
// consulting background must not meet jargon on the first screen, or they
// lose interest before the conversation starts.
const ROLE_HEAD: Record<AgentType, { title: string; sub: string; emptyTitle: string; emptyDesc: string }> = {
  coach: {
    title: "Your coach",
    sub: "Keeps an eye on the people side of your project.",
    emptyTitle: "No coach yet",
    emptyDesc: "Make a new one, or pick a coach you have worked with before.",
  },
  consultant: {
    title: "Your consultant",
    sub: "Works out what to change and how.",
    emptyTitle: "No consultant yet",
    emptyDesc: "Make a new one, or pick a consultant you have worked with before.",
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
    <section className={`panel ${role}${primary ? " primary" : ""}`}>
      {pendingConfirm && (
        <ConfirmDialog
          title={`${pendingConfirm.name} as your ${ROLE_LABEL[role]}?`}
          body="They join the project and the conversation starts right away."
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
        // Two ways in, nothing else. The "Suggested roles" list that used to
        // sit under this was cut on Patryk's review (2026-09-10): it repeated
        // what the next screen already shows.
        <div className="pick-empty">
          <button className="pick-plus" onClick={() => setState("type")} aria-label="Create new agent">
            <IconPlus size={22} />
          </button>
          <div className="t">{head.emptyTitle}</div>
          <div className="d">{head.emptyDesc}</div>
          <div className="pick-actions">
            <button className="btn-primary-wide" onClick={() => setState("type")}><IconPlus size={13} />Create new</button>
            <button className="choose-row" onClick={() => setState("list")}>
              Pick someone you know
              <IconChevronDown size={18} style={{ transform: "rotate(-90deg)" }} />
            </button>
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
          totalProjects={totalProjects} onSelect={a => setPendingConfirm(a)} />

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
          <span className="lbl">Experience</span>
          <div className="level">
            <b>{level}</b>
            <span className="level-bar">
              {LEVEL_ORDER.map((l, i) => <span key={l} className={`level-seg ${i <= LEVEL_ORDER.indexOf(level) ? "on" : ""}`} />)}
            </span>
          </div>
        </div>
        <div><span className="lbl">Projects together</span><b>{total}</b></div>
        {agent.tagline && <div><span className="lbl">Role</span><b>{agent.tagline}</b></div>}
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
          <label>Can help with</label>
          <ul className="plist">{[...t.primary, ...t.secondary].map(m => <li key={m}>{methodLabel(m)}</li>)}</ul>
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
