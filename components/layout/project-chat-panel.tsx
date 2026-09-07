"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import { listMessages, addMessage, touchProjectActivity, renameFromFirstMessage, type Project, type ProjectMessage } from "@/lib/projects";
import { askAgent } from "@/lib/ask-agent";
import { parseMarkers } from "@/lib/message-markers";
import { methodLabel, methodBlurb } from "@/lib/method-labels";
import { md } from "@/lib/markdown";
import { IconCoach, IconConsultant, IconArrow, IconSend, IconCheck, IconSearch } from "@/components/layout/agxp-icons";

const OPENING: Record<AgentType, string> = {
  consultant: "Hey, what can I do for you today?",
  coach: "Hey, what would you like to talk through today?",
};

/** The agent offers what it knows: a full guided interview, or one of its methods. */
function quickActions(agent: Agent) {
  const actions = [{
    title: "Full Assessment",
    blurb: "Standardized interview process.",
    prompt: "Let's do a full assessment with the standardized interview process.",
    icon: <IconCheck size={14} />,
  }];
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

export function ProjectChatPanel({ project, role, agent, primary, onProjectNamed }: {
  project: Project; role: AgentType; agent: Agent;
  /** Consultant leads the layout (larger). */
  primary?: boolean;
  onProjectNamed?: (name: string) => void;
}) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    try {
      await addMessage(project.id, role, "user", t);
      if (isFirstEver) {
        renameFromFirstMessage(project, t).then(name => { if (name) onProjectNamed?.(name); }).catch(() => {});
      }
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const reply = await askAgent(agent, history);
      await addMessage(project.id, role, "assistant", reply);
      setMessages(prev => [...prev, { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "assistant", content: reply, created_at: new Date().toISOString() }]);
      touchProjectActivity(project.id, `${role === "coach" ? "Coach" : "Consultant"} replied`).catch(() => {});
    } catch (e) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "assistant", content: `Error: ${(e as Error).message}`, created_at: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  }

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return i;
    return -1;
  })();
  const actions = quickActions(agent);

  return (
    <section className={`panel ${role}`} style={primary ? { flex: 1.6 } : undefined}>
      {/* Head + Steckbrief: who this agent is, condensed */}
      <div className="chat-head">
        <div className="chat-avatar">{role === "coach" ? <IconCoach size={17} /> : <IconConsultant size={17} />}</div>
        <div style={{ minWidth: 0 }}>
          <div className="n">{agent.name}</div>
          <div className="r"><span className={`role-dot ${role}`} />{role === "coach" ? "Coach" : "Consultant"}</div>
        </div>
      </div>

      <div className="steckbrief">
        <div className="sb-stats">
          <div><span className="lbl">Knowledge Level</span><b>{agent.knowledge_level}</b></div>
          <div><span className="lbl">Previous Projects</span><b>{agent.last_projects.length}</b></div>
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
