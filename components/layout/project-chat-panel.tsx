"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import { listMessages, addMessage, touchProjectActivity, renameFromFirstMessage, type Project, type ProjectMessage } from "@/lib/projects";
import { askAgent } from "@/lib/ask-agent";
import { parseMarkers } from "@/lib/message-markers";
import { methodLabel, methodBlurb } from "@/lib/method-labels";
import { levelFor, nextLevel, LEVEL_ORDER } from "@/lib/agent-progress";
import { md } from "@/lib/markdown";
import { useAuth } from "@/lib/auth-context";
import { useOpenClose } from "@/lib/use-open-close";
import { usePanelSizeStore } from "@/lib/panel-size-store";
import { Progress } from "@/components/ui/progress";
import { AgentMascot, type MascotState } from "@/components/layout/agent-mascot";
import { LoadingState, LoaderGrid } from "@/components/layout/loading-state";
import { ThinkingState } from "@/components/layout/thinking-state";
import { StreamingText } from "@/components/layout/streaming-text";
import {
  IconCheck, IconSearch, IconMore, IconDownload, IconX,
  IconAttach, IconMic, IconArrowUp, IconArrow,
} from "@/components/layout/agxp-icons";

// Must match .roadmap-panel.method-panel's CSS width — used to right-align
// the panel under its trigger button when it first opens.
const METHOD_PANEL_WIDTH = 520;

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

export function ProjectChatPanel({ project, role, agent, flexGrow, projectCount = 0, onProjectNamed, onChangeAgent }: {
  project: Project; role: AgentType; agent: Agent;
  /** Consultant leads the layout (larger) — grows further while the Coach is still being picked. */
  flexGrow: number;
  /** How many of the user's projects this agent has worked on, this one included — drives the Agent Info level. */
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
  const menu = useOpenClose();
  const roadmap = useOpenClose();
  const agentInfo = useOpenClose();
  const { swapped, toggle: toggleSwap } = usePanelSizeStore();
  // Method Group floats near its trigger button rather than at a fixed CSS
  // offset, and can be dragged anywhere afterward — position lives in state
  // (not transform, which the t-dropdown pop animation already owns) so the
  // two never fight over the same CSS property.
  const roadmapBtnRef = useRef<HTMLButtonElement>(null);
  const [roadmapPos, setRoadmapPos] = useState<{ top: number; left: number } | null>(null);
  const roadmapDrag = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null);
  const [processingLabel, setProcessingLabel] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  // Real extended-thinking text, keyed by message id — client-side only, not
  // persisted (no schema migration available), so it's lost on reload.
  const [reasoningByMessage, setReasoningByMessage] = useState<Record<string, string[]>>({});
  // Message ids that should render plain (already animated, or loaded from
  // history) rather than through the word-by-word StreamingText reveal.
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(() => new Set());
  // Which Roadmap download is mid-"generating" (a method name, or "all").
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingPool = useRef(PROCESSING_BROAD);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  // Starts false (matching the server render) and only flips after mount —
  // checking window.SpeechRecognition during render would differ between
  // server and client and break hydration.
  const [micSupported, setMicSupported] = useState(false);
  const { profileName } = useAuth();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setMicSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

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

  // Attachments are cosmetic — appended as plain text on send, same
  // disclosed limitation as before: no real Supabase Storage upload exists.
  function pickFiles() { fileInputRef.current?.click(); }
  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setAttachments(prev => [...prev, ...files.map(f => f.name)]);
    e.target.value = ""; // allow re-picking the same file
  }
  function removeAttachment(name: string) {
    setAttachments(prev => prev.filter(n => n !== name));
  }

  // Voice input via the browser's native Web Speech API — feature-detected,
  // the mic button doesn't render at all where it's unsupported (no fake
  // control that does nothing).
  function toggleMic() {
    if (!micSupported) return;
    if (recording) { recognitionRef.current?.stop(); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor();
    rec.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }

  useEffect(() => {
    let alive = true;
    listMessages(project.id, role).then(m => {
      if (!alive) return;
      setMessages(m);
      setAnimatedIds(new Set(m.map(msg => msg.id))); // history never replays the reveal
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { alive = false; };
  }, [project.id, role]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  // Anchor Method Group under its trigger button the instant it opens (before
  // paint, so there's no flash at a stale position), and forget the position
  // again once it closes so the next open re-anchors fresh.
  useLayoutEffect(() => {
    if (roadmap.mounted && !roadmapPos && roadmapBtnRef.current) {
      const r = roadmapBtnRef.current.getBoundingClientRect();
      setRoadmapPos({ top: r.bottom + 8, left: r.right - METHOD_PANEL_WIDTH });
    } else if (!roadmap.mounted && roadmapPos) {
      setRoadmapPos(null);
    }
  }, [roadmap.mounted, roadmapPos]);

  function startRoadmapDrag(e: React.MouseEvent) {
    if (!roadmapPos) return;
    roadmapDrag.current = { startX: e.clientX, startY: e.clientY, startTop: roadmapPos.top, startLeft: roadmapPos.left };
    function onMove(ev: MouseEvent) {
      const d = roadmapDrag.current;
      if (!d) return;
      setRoadmapPos({ top: d.startTop + (ev.clientY - d.startY), left: d.startLeft + (ev.clientX - d.startX) });
    }
    function onUp() {
      roadmapDrag.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const attachNote = attachments.length ? `\n\nAttached: ${attachments.join(", ")}` : "";
    const t = trimmed + attachNote;
    setInput("");
    setAttachments([]);
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
      await addMessage(project.id, role, "assistant", reply.content);
      const replyId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: replyId, project_id: project.id, column_type: role, role: "assistant", content: reply.content, created_at: new Date().toISOString() }]);
      if (reply.thinking) {
        const paragraphs = reply.thinking.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        setReasoningByMessage(prev => ({ ...prev, [replyId]: paragraphs }));
      }
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

  // Shown on demand in the Agent Info panel now, not a permanent Steckbrief.
  const totalProjects = agent.last_projects.length + projectCount;
  const level = levelFor(totalProjects);
  const { next, remaining } = nextLevel(totalProjects);

  // A method's PDF becomes "available" once the conversation has produced
  // enough back-and-forth to be worth generating from — one method unlocks
  // per user message, in order, capped at the total. No real per-method
  // readiness signal exists yet; this is a placeholder heuristic driving the
  // Method Group progress bar and which downloads are enabled.
  const roadmapMethods = [...agent.primaryMethods, ...agent.secondaryMethods];
  const userMessageCount = messages.filter(m => m.role === "user").length;
  const availableCount = Math.min(roadmapMethods.length, userMessageCount);
  const availabilityPct = roadmapMethods.length > 0 ? (availableCount / roadmapMethods.length) * 100 : 0;

  // Roadmap "downloads" — opens a clean, standalone document with the
  // conversation content and triggers the browser's native print dialog, so
  // the user picks "Save as PDF" there. No new dependency, no reuse of the
  // .print-area/@media print rules in globals.css (those are scoped to the
  // dead _legacy concept page's own fixed-height layout) — a fresh document
  // avoids any interference with the main app's CSS entirely. There's still
  // no per-message method tagging in the data model, so a per-method export
  // is the same conversation labeled by method, not a precise filter — an
  // accepted, disclosed simplification (the panel's own copy says so).
  function conversationMarkdown(title: string) {
    const lines = [`# ${title}`, `_${agent.name} · ${project.name}_`, ""];
    for (const m of messages) {
      lines.push(m.role === "user" ? `**You:** ${m.content}` : `**${agent.name}:** ${parseMarkers(m.content).text}`);
      lines.push("");
    }
    return lines.join("\n");
  }
  function openPrintable(title: string, markdown: string) {
    const win = window.open("", "_blank", "width=800,height=1000");
    if (!win) return; // popup blocked — rare given this runs from a direct click
    win.document.write(`<!doctype html><html><head><title>${title}</title>
      <style>
        body{ font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#18181B; padding:40px; line-height:1.6; max-width:720px; margin:0 auto; }
        h1{ font-size:22px; margin:0 0 4px; } h2,h3{ margin-top:24px; } strong{ font-weight:600; }
      </style></head><body>${md(markdown)}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }
  // The print pipeline itself is near-instant — a deliberate minimum delay
  // gives the "generating" state (the LoaderGrid swapped in for the button's
  // icon) something real to show instead of flashing for one frame.
  function downloadMethod(methodName: string) {
    setPdfBusy(methodName);
    setTimeout(() => {
      openPrintable(methodLabel(methodName), conversationMarkdown(methodLabel(methodName)));
      setPdfBusy(null);
    }, 600);
  }
  function downloadAll() {
    setPdfBusy("all");
    setTimeout(() => {
      openPrintable("AI Transformation Roadmap", conversationMarkdown("AI Transformation Roadmap"));
      setPdfBusy(null);
    }, 600);
  }

  // Extracted once so the exact same input/toolbar — same state, same
  // handlers — can sit either centered in the empty-state hero or pinned at
  // the bottom, without duplicating the wiring.
  const composer = (
    <>
      <textarea className="autosize" rows={1} disabled={sending} value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
        placeholder={`Ask your ${role === "coach" ? "coach" : "consultant"}...`} />
      {attachments.length > 0 && (
        <div className="attach-chips">
          {attachments.map(name => (
            <span key={name} className="attach-chip">{name}
              <button onClick={() => removeAttachment(name)}><IconX size={10} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="composer-toolbar">
        <div className="composer-left">
          <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesPicked} />
          <button className="composer-icon-btn" data-tooltip="Attach" onClick={pickFiles}><IconAttach size={15} /></button>
        </div>
        <div className="composer-right">
          {micSupported && (
            <button className={`composer-icon-btn${recording ? " active" : ""}`} data-tooltip="Voice input" onClick={toggleMic}>
              <IconMic size={15} />
            </button>
          )}
          <button className="composer-send" data-tooltip="Send message" disabled={!input.trim() || sending} onClick={() => send(input)}>
            <IconArrowUp size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <section className={`panel ${role}`} style={{ flex: flexGrow }}
      onClick={() => menu.close()}>
      {/* Head: who this agent is, condensed */}
      <div className="chat-head">
        <button className="mascot-trigger" data-tooltip="Agent info"
          onClick={() => { agentInfo.toggle(); roadmap.close(); }}>
          <AgentMascot role={role} state={orb} size={46} enter />
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="n">{agent.name}</div>
          <div className="r">{role === "coach" ? "Coach" : "Consultant"}</div>
        </div>
        {role === "consultant" && (
          <button ref={roadmapBtnRef} className="roadmap-btn roadmap-btn-lg" style={{ marginLeft: "auto" }}
            onClick={() => { roadmap.toggle(); agentInfo.close(); }}>
            <span>Method Group</span>
            <Progress value={availabilityPct} />
          </button>
        )}
        {role === "coach" && (
          <button className="icon-btn" style={{ marginLeft: "auto" }}
            data-tooltip={swapped ? "Reset panel sizes" : "Give Coach more room"}
            onClick={e => { e.stopPropagation(); toggleSwap(); }}>
            <IconArrow style={{ transform: swapped ? "none" : "rotate(180deg)" }} />
          </button>
        )}
        <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
          <button className="chat-menu-btn" data-tooltip="More" onClick={() => menu.toggle()}>
            <IconMore size={14} />
          </button>
          {menu.mounted && (
            <div className={`popover t-dropdown ${menu.className}`} data-origin="top-right" style={{ top: 36, right: 0, minWidth: 160 }}>
              <button className="mi" onClick={() => { menu.close(); agentInfo.open(); roadmap.close(); }}>Agent info</button>
              <button className="mi" onClick={() => { menu.close(); onChangeAgent?.(); }}>Change agent</button>
            </div>
          )}
        </div>
      </div>

      {agentInfo.mounted && (
        <div className={`roadmap-panel agent-info-panel t-dropdown ${agentInfo.className}`}>
          <div className="rp-head">
            <h3>{agent.name}</h3>
            <button className="rp-close" onClick={() => agentInfo.close()}><IconX size={13} /></button>
          </div>
          <div className="rp-list">
            {agent.description && <p className="agent-info-desc">{agent.description}</p>}
            <div className="sb-stats">
              <div>
                <span className="lbl">Knowledge Level</span>
                <div className="level">
                  <b>{level}</b>
                  <span className="level-bar">
                    {LEVEL_ORDER.map((l, i) => <span key={l} className={`level-seg ${i <= LEVEL_ORDER.indexOf(level) ? "on" : ""}`} />)}
                  </span>
                </div>
                {next && <div className="level-hint">{remaining} more project{remaining === 1 ? "" : "s"} to {next}</div>}
              </div>
              <div><span className="lbl">Previous Projects</span><b>{totalProjects}</b></div>
              {agent.tagline && <div><span className="lbl">Type</span><b>{agent.tagline}</b></div>}
            </div>
            <div className="sb-methods">
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
          </div>
        </div>
      )}

      {roadmap.mounted && (
        <div className={`roadmap-panel method-panel t-dropdown ${roadmap.className}`}
          style={roadmapPos ? { top: roadmapPos.top, left: roadmapPos.left } : undefined}>
          <div className="rp-head" onMouseDown={startRoadmapDrag} style={{ cursor: "grab" }}>
            <h3>Method Group</h3>
            <button className="rp-close" onMouseDown={e => e.stopPropagation()} onClick={() => roadmap.close()}><IconX size={13} /></button>
          </div>
          <button className="rp-download-all" disabled={pdfBusy !== null} onClick={downloadAll}>
            {pdfBusy === "all" ? <LoaderGrid /> : <IconDownload size={14} />}Download All
          </button>
          <div className="rp-list">
            {roadmapMethods.map((m, i) => (
              <div key={m.id} className="roadmap-item">
                <span className="ri-name">{methodLabel(m.name)}</span>
                <button className="ri-dl" data-tooltip={i < availableCount ? "Download" : "Not yet available"}
                  disabled={pdfBusy !== null || i >= availableCount} onClick={() => downloadMethod(m.name)}>
                  {pdfBusy === m.name ? <LoaderGrid /> : <IconDownload size={13} />}
                </button>
              </div>
            ))}
            {agent.primaryMethods.length === 0 && agent.secondaryMethods.length === 0 && (
              <div className="roadmap-item"><span className="ri-name">Transformation Concept</span>
                <button className="ri-dl" data-tooltip="Download" disabled={pdfBusy !== null} onClick={downloadAll}>
                  {pdfBusy === "all" ? <LoaderGrid /> : <IconDownload size={13} />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="chat-body">
        {!loaded && <div className="spinner" style={{ margin: "0 auto", borderColor: "var(--border-strong)", borderTopColor: "var(--foreground)" }} />}

        {showHero && (
          <div className="chat-hero">
            <div className="chat-hero-inner">
              <div className="chat-hero-greet">{GREETING[role](firstName)}</div>
              <div className="chat-input chat-input--hero">{composer}</div>
              {role === "consultant" && (
                <div className="hero-actions">
                  {actions.map(a => (
                    <button key={a.title} className="hero-action" onClick={() => send(a.prompt)}>
                      <span className="qa-ic">{a.icon}</span>
                      <span className="ha-label">{a.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {loaded && messages.length > 0 && (
          <>
            {messages.map((m, i) => {
              if (m.role === "user") return <div key={m.id} className="msg-user">{m.content}</div>;
              const parsed = parseMarkers(m.content);
              const showChoices = i === lastAssistantIdx && parsed.choices.length > 0 && !sending;
              const reasoning = reasoningByMessage[m.id];
              const isNew = !animatedIds.has(m.id);
              return (
                <div key={m.id} className="msg-agent">
                  {reasoning && <ThinkingState paragraphs={reasoning} />}
                  {isNew ? (
                    <div className="txt">
                      <StreamingText text={parsed.text} onDone={() => setAnimatedIds(prev => new Set(prev).add(m.id))} />
                    </div>
                  ) : (
                    <div className="txt" dangerouslySetInnerHTML={{ __html: md(parsed.text) }} />
                  )}
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

            {sending && <LoadingState label={processingLabel} />}
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
