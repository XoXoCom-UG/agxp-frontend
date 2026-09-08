"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import { listMessages, addMessage, touchProjectActivity, renameFromFirstMessage, type Project, type ProjectMessage } from "@/lib/projects";
import { askAgent } from "@/lib/ask-agent";
import { parseMarkers } from "@/lib/message-markers";
import { methodLabel, methodBlurb } from "@/lib/method-labels";
import { levelFor, nextLevel, LEVEL_ORDER } from "@/lib/agent-progress";
import { md } from "@/lib/markdown";
import { AgentMascot, type MascotState } from "@/components/layout/agent-mascot";
import { IconArrow, IconSend, IconCheck, IconSearch } from "@/components/layout/agxp-icons";

const OPENING: Record<AgentType, string> = {
  consultant: "Hey, what can I do for you today?",
  coach: "Hey, what would you like to talk through today?",
};

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

export function ProjectChatPanel({ project, role, agent, primary, projectCount = 0, onProjectNamed }: {
  project: Project; role: AgentType; agent: Agent;
  /** Consultant leads the layout (larger). */
  primary?: boolean;
  /** How many of the user's projects this agent has worked on, this one included. */
  projectCount?: number;
  onProjectNamed?: (name: string) => void;
}) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [orb, setOrb] = useState<MascotState>("idle");
  const bottomRef = useRef<HTMLDivElement>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (speakTimer.current) clearTimeout(speakTimer.current); }, []);

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

  // The agent levels up on the work it has actually done for this user; this
  // project is one of them, so compare against the count without it to know
  // whether joining here is what pushed it up a level.
  const totalProjects = agent.last_projects.length + projectCount;
  const level = levelFor(totalProjects);
  const leveledUp = levelFor(Math.max(0, totalProjects - 1)) !== level;
  const { next, remaining } = nextLevel(totalProjects);

  return (
    <section className={`panel ${role}`} style={primary ? { flex: 1.6 } : undefined}>
      {/* Head + Steckbrief: who this agent is, condensed */}
      <div className="chat-head">
        <AgentMascot role={role} state={orb} size={46} enter />
        <div style={{ minWidth: 0 }}>
          <div className="n">{agent.name}</div>
          <div className="r"><span className={`role-dot ${role}`} />{role === "coach" ? "Coach" : "Consultant"}</div>
        </div>
      </div>

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

        {loaded && (
          <div className="msg-agent">
            <div className="txt">{OPENING[role]}</div>
          </div>
        )}
        {loaded && messages.length === 0 && (
          <div className="qa-list">
            {actions.map(a => (
              <button key={a.title} className="qa-item" onClick={() => send(a.prompt)}>
                <span className="qa-ic">{a.icon}</span>
                <div className="qtxt"><div className="qt">{a.title}</div><div className="qs">{a.blurb}</div></div>
                <IconArrow />
              </button>
            ))}
          </div>
        )}

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
          <div className="msg-typing"><span className="tline" />{agent.name} is thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <textarea className="autosize" rows={1} disabled={sending} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder={`Ask your ${role === "coach" ? "coach" : "consultant"}...`} />
        <button data-tooltip="Send message" disabled={!input.trim() || sending} onClick={() => send(input)}>
          <IconSend size={14} />
        </button>
      </div>
    </section>
  );
}
