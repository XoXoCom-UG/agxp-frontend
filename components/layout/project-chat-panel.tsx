"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import { listMessages, addMessage, touchProjectActivity, renameFromFirstMessage, type Project, type ProjectMessage } from "@/lib/projects";
import { askAgent } from "@/lib/ask-agent";
import { parseMarkers } from "@/lib/message-markers";
import { methodLabel, methodBlurb } from "@/lib/method-labels";
import { levelFor, nextLevel, LEVEL_ORDER } from "@/lib/agent-progress";
import { md } from "@/lib/markdown";
import { useAuth } from "@/lib/auth-context";
import { AgentMascot, type MascotState } from "@/components/layout/agent-mascot";
import { IconSend, IconCheck, IconSearch, IconMore, IconDoc, IconDownload, IconX } from "@/components/layout/agxp-icons";

// Personalized "welcome back" hero greeting for the empty-conversation state
// (shown once, centered, before the first message) — not a literal "how can
// I help" clone. Falls back cleanly when no first name has resolved yet.
const GREETING: Record<AgentType, (firstName: string) => string> = {
  consultant: (firstName) =>
    firstName ? `Welcome back, ${firstName} — ready to dive in?` : "Welcome back — ready to dive in?",
  coach: (firstName) =>
    firstName ? `Good to have you back, ${firstName} — what's on your mind?` : "Good to have you back — what's on your mind?",
};

// Contextual "thinking" labels instead of a static "is thinking..." — a
// broader pool for the opening question, a narrower "still with you" pool
// once the conversation is already underway.
const PROCESSING_BROAD = ["Thinking it through", "Structuring the approach", "Weighing the options"];
const PROCESSING_CONTINUATION = ["Following up on that", "Refining the answer", "Connecting the dots"];

/** Each role's way in: the Consultant interviews, the Coach takes the temperature. */
const OPENER_ACTION: Record<AgentType, { title: string; blurb: string; prompt: string }> = {
  consultant: {
    title: "Full Assessment",
    blurb: "Standardized interview process.",
    prompt: "Let's do a full assessment with the standardized interview process.",
  },
  coach: {
    title: "Change Readiness Check",
    blurb: "Where the team stands today.",
    prompt: "Let's check how ready the team is for this change.",
  },
};

/** The agent offers what it knows: its way in, or one of its methods. */
function quickActions(agent: Agent) {
  const actions = [{ ...OPENER_ACTION[agent.type], icon: <IconCheck size={14} /> }];
  for (const m of agent.primaryMethods.slice(0, 3)) {
    actions.push({
      title: methodLabel(m.name),
      blurb: methodBlurb(m.name),
      prompt: `Let's work through the ${methodLabel(m.name)} method together.`,
      icon: <IconSearch size={14} />,
    });
  }
  return actions;
}

export function ProjectChatPanel({ project, role, agent, primary, projectCount = 0, onProjectNamed, onChangeAgent }: {
  project: Project; role: AgentType; agent: Agent;
  /** Consultant leads the layout (larger). */
  primary?: boolean;
  /** How many of the user's projects this agent has worked on, this one included. */
  projectCount?: number;
  onProjectNamed?: (name: string) => void;
  /** Drops this agent back to the picker — reached from the ⋯ menu, never a popup at selection time. */
  onChangeAgent?: () => void;
}) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [orb, setOrb] = useState<MascotState>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingPool = useRef(PROCESSING_BROAD);
  const { profileName } = useAuth();

  useEffect(() => () => { if (speakTimer.current) clearTimeout(speakTimer.current); }, []);

  useEffect(() => {
    if (!sending) { setProcessingLabel(""); return; }
    const pool = processingPool.current;
    let i = 0;
    setProcessingLabel(pool[0]);
    const id = setInterval(() => { i = (i + 1) % pool.length; setProcessingLabel(pool[i]); }, 1600);
    return () => clearInterval(id);
  }, [sending]);

  function playSpeaking() {
    setOrb("speaking");
    if (speakTimer.current) clearTimeout(speakTimer.current);
    speakTimer.current = setTimeout(() => setOrb("idle"), 900);
  }

  useEffect(() => {
    let alive = true;
    listMessages(project.id, role).then(m => { if (alive) { setMessages(m); setLoaded(true); } }).catch(() => setLoaded(true));
    return () => { alive = false; };
  }, [project.id, role]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    setInput("");
    const isFirstEver = messages.length === 0;
    const userMsg: ProjectMessage = { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "user", content: t, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    processingPool.current = isFirstEver ? PROCESSING_BROAD : PROCESSING_CONTINUATION;
    setSending(true);
    setOrb("thinking");
    try {
      await addMessage(project.id, role, "user", t);
      if (isFirstEver) {
        renameFromFirstMessage(project, t).then(name => { if (name) onProjectNamed?.(name); }).catch(() => {});
      }
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const reply = await askAgent(agent, history);
      await addMessage(project.id, role, "assistant", reply);
      setMessages(prev => [...prev, { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "assistant", content: reply, created_at: new Date().toISOString() }]);
      playSpeaking();
      touchProjectActivity(project.id, `${role === "coach" ? "Coach" : "Consultant"} replied`).catch(() => {});
    } catch (e) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "assistant", content: `Error: ${(e as Error).message}`, created_at: new Date().toISOString() }]);
      setOrb("idle");
    } finally {
      setSending(false);
    }
  }

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return i;
    return -1;
  })();
  const actions = quickActions(agent);
  const firstName = profileName.trim().split(/\s+/)[0] || "";
  const showHero = loaded && messages.length === 0;

  // Roadmap "downloads" — a genuine client-side Markdown export of the
  // conversation, not a backend PDF pipeline (none exists or is justified
  // yet). There's no per-message method tagging in the data model, so a
  // per-method download is the same conversation labeled by method, not a
  // precise filter — an accepted, disclosed simplification.
  function downloadMarkdown(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  function conversationMarkdown(title: string) {
    const lines = [`# ${title}`, `_${agent.name} · ${project.name}_`, ""];
    for (const m of messages) {
      lines.push(m.role === "user" ? `**You:** ${m.content}` : `**${agent.name}:** ${parseMarkers(m.content).text}`);
      lines.push("");
    }
    return lines.join("\n");
  }
  function downloadMethod(methodName: string) {
    downloadMarkdown(`${methodLabel(methodName)} — ${project.name}.md`, conversationMarkdown(methodLabel(methodName)));
  }
  function downloadAll() {
    downloadMarkdown(`AI Transformation Roadmap — ${project.name}.md`, conversationMarkdown("AI Transformation Roadmap"));
  }

  // The agent levels up on the work it has actually done for this user; this
  // project is one of them, so compare against the count without it to know
  // whether joining here is what pushed it up a level.
  const totalProjects = agent.last_projects.length + projectCount;
  const level = levelFor(totalProjects);
  const leveledUp = levelFor(Math.max(0, totalProjects - 1)) !== level;
  const { next, remaining } = nextLevel(totalProjects);

  // Extracted once so the exact same input/button — same state, same
  // handlers — can sit either centered in the empty-state hero or pinned at
  // the bottom, without duplicating the wiring.
  const composer = (
    <>
      <textarea className="autosize" rows={1} disabled={sending} value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
        placeholder={`Ask your ${role === "coach" ? "coach" : "consultant"}...`} />
      <button data-tooltip="Send message" disabled={!input.trim() || sending} onClick={() => send(input)}>
        <IconSend size={14} />
      </button>
    </>
  );

  return (
    <section className={`panel ${role}`} style={primary ? { flex: 2.3 } : undefined} onClick={() => menuOpen && setMenuOpen(false)}>
      {/* Head + Steckbrief: who this agent is, condensed */}
      <div className="chat-head">
        <AgentMascot role={role} state={orb} size={46} enter />
        <div style={{ minWidth: 0 }}>
          <div className="n">{agent.name}</div>
          <div className="r"><span className={`role-dot ${role}`} />{role === "coach" ? "Coach" : "Consultant"}</div>
        </div>
        {role === "consultant" && (
          <button className="roadmap-btn" style={{ marginLeft: "auto" }} onClick={() => setRoadmapOpen(o => !o)}>
            <IconDoc size={13} />Roadmap
          </button>
        )}
        <div style={{ position: "relative", marginLeft: role === "consultant" ? 0 : "auto" }} onClick={e => e.stopPropagation()}>
          <button className="chat-menu-btn" data-tooltip="More" onClick={() => setMenuOpen(o => !o)}>
            <IconMore size={14} />
          </button>
          {menuOpen && (
            <div className="popover" style={{ top: 36, right: 0, minWidth: 160 }}>
              <button className="mi" onClick={() => { setMenuOpen(false); onChangeAgent?.(); }}>Change agent</button>
            </div>
          )}
        </div>
      </div>

      {roadmapOpen && (
        <div className="roadmap-panel">
          <div className="rp-head">
            <h3>AI Transformation Roadmap</h3>
            <button className="rp-close" onClick={() => setRoadmapOpen(false)}><IconX size={13} /></button>
          </div>
          <button className="rp-download-all" onClick={downloadAll}><IconDownload size={14} />Download All</button>
          <p className="rp-note">Each item exports this conversation as Markdown, labeled by method — the app doesn't yet split messages per method.</p>
          <div className="rp-list">
            {[...agent.primaryMethods, ...agent.secondaryMethods].map(m => (
              <div key={m.id} className="roadmap-item">
                <span className="ri-name">{methodLabel(m.name)}</span>
                <button className="ri-dl" data-tooltip="Download" onClick={() => downloadMethod(m.name)}><IconDownload size={13} /></button>
              </div>
            ))}
            {agent.primaryMethods.length === 0 && agent.secondaryMethods.length === 0 && (
              <div className="roadmap-item"><span className="ri-name">Transformation Concept</span>
                <button className="ri-dl" data-tooltip="Download" onClick={downloadAll}><IconDownload size={13} /></button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="steckbrief">
        <div className="sb-stats">
          <div>
            <span className="lbl">Knowledge Level</span>
            <div className="level">
              <b>{level}</b>
              <span className="level-bar">
                {LEVEL_ORDER.map((l, i) => (
                  <span key={l} className={`level-seg ${i <= LEVEL_ORDER.indexOf(level) ? "on" : ""}`} />
                ))}
              </span>
              {leveledUp && <span className="level-up">Level up</span>}
            </div>
            {next && <div className="level-hint">{remaining} more project{remaining === 1 ? "" : "s"} to {next}</div>}
          </div>
          <div><span className="lbl">Previous Projects</span><b>{totalProjects}</b></div>
          {agent.tagline && <div><span className="lbl">Type</span><b>{agent.tagline}</b></div>}
        </div>
        <div className="sb-methods">
          {agent.primaryMethods.length > 0 && (
            <div className="grp">
              <span className="lbl">Primary Methods</span>
              <div className="chips">{agent.primaryMethods.map(m => <span key={m.id} className="m-chip">{methodLabel(m.name)}</span>)}</div>
            </div>
          )}
          {agent.secondaryMethods.length > 0 && (
            <div className="grp">
              <span className="lbl">Secondary Methods</span>
              <div className="chips">{agent.secondaryMethods.map(m => <span key={m.id} className="m-chip secondary">{methodLabel(m.name)}</span>)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="chat-body">
        {!loaded && <div className="spinner" style={{ margin: "0 auto", borderColor: "var(--border-strong)", borderTopColor: "var(--foreground)" }} />}

        {showHero && (
          <div className="chat-hero">
            <div className="chat-hero-inner">
              <div className="chat-hero-greet">{GREETING[role](firstName)}</div>
              <div className="chat-input chat-input--hero">{composer}</div>
              <div className="hero-actions">
                {actions.map(a => (
                  <button key={a.title} className="hero-action" title={a.blurb} onClick={() => send(a.prompt)}>
                    <span className="qa-ic">{a.icon}</span>
                    <span className="ha-label">{a.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {loaded && messages.length > 0 && (
          <>
            {messages.map((m, i) => {
              if (m.role === "user") return <div key={m.id} className="msg-user">{m.content}</div>;
              const parsed = parseMarkers(m.content);
              const showChoices = i === lastAssistantIdx && parsed.choices.length > 0 && !sending;
              return (
                <div key={m.id} className="msg-agent">
                  <div className="txt" dangerouslySetInnerHTML={{ __html: md(parsed.text) }} />
                  {showChoices && (
                    <div className="choice-row" style={{ paddingLeft: 0 }}>
                      {parsed.choices.map(c => (
                        <button key={c} className="choice-chip" disabled={sending} onClick={() => send(c)}>{c}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {sending && (
              <div className="msg-processing"><span className="tline" /><span className="plabel shimmer-text">{processingLabel}</span></div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {!showHero && (
        <div className="chat-input">{composer}</div>
      )}
    </section>
  );
}
