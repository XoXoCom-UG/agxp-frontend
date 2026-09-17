"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import { listMessages, addMessage, touchProjectActivity, renameFromFirstMessage, type Project, type ProjectMessage } from "@/lib/projects";
import { askAgent } from "@/lib/ask-agent";
import { parseMarkers, looksLikeDocument, streamingText, streamIsDocument, type TopicMarker, type MemoryNote } from "@/lib/message-markers";
import { loadAgentMemory, memoryLines, EMPTY_MEMORY, type AgentMemory } from "@/lib/agent-memory";
import { DELIVERABLES } from "@/lib/deliverables";
import { methodLabel, methodBlurb } from "@/lib/method-labels";
import { levelFor, nextLevel, LEVEL_ORDER } from "@/lib/agent-progress";
import { md, mdBlocks } from "@/lib/markdown";
import { useOpenClose } from "@/lib/use-open-close";
import { Progress } from "@/components/ui/progress";
import { AgentMascot, type MascotState, type MascotMood } from "@/components/layout/agent-mascot";
import { LoaderGrid } from "@/components/layout/loading-state";
import { CodeBlock } from "@/components/layout/code-block";
import type { DeliverableDoc } from "@/components/layout/deliverable-view";
import {
  IconCheck, IconSearch, IconMore, IconDownload, IconX,
  IconAttach, IconMic, IconArrowUp, IconArrow, IconDoc, IconSpark, IconRefresh,
} from "@/components/layout/agxp-icons";

// Must match .roadmap-panel.method-panel's CSS width — used to right-align
// the panel under its trigger button when it first opens.
const METHOD_PANEL_WIDTH = 520;

// The agent's opening line — a real introduction, not a generic "welcome
// back". Rendered as a normal message bubble (not persisted via addMessage,
// same as the greeting this replaces) so nothing changes about history/storage.
function agentGreeting(role: AgentType, agent: Agent): string {
  const specialty = agent.expertise || agent.tagline || "this area";
  return `Hey, I'm ${agent.name}, your AI Agent ${role === "coach" ? "Coach" : "Consultant"}. I am specialized in ${specialty}. How can I support you today?`;
}

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

export function ProjectChatPanel({ project, role, agent, grow = 1, projectCount = 0, onProjectNamed, onActivity, onOpenDoc, onChangeAgent }: {
  project: Project; role: AgentType; agent: Agent;
  /** How much of the row this panel takes (flex-grow). */
  grow?: number;
  /** How many of the user's projects this agent has worked on, this one included — drives the Agent Info level. */
  projectCount?: number;
  onProjectNamed?: (name: string) => void;
  /** Fires when a reply lands — the screen marks the tab on stacked layouts,
   *  where only one panel is on screen at a time. */
  onActivity?: () => void;
  /** Opens the finished deliverable in the full document view (owned by the screen). */
  onOpenDoc?: (doc: DeliverableDoc) => void;
  /** Drops this agent back to the picker — reached from the ⋯ menu, never a popup at selection time. */
  onChangeAgent?: () => void;
}) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [orb, setOrb] = useState<MascotState>("idle");
  /** The answer as it arrives, before it is saved and becomes a message —
   *  real token streaming (app/api/agent/chat/route.ts), not a fake reveal. */
  const [streamText, setStreamText] = useState("");
  /** The agent looks at the composer while you are writing to it. */
  const [attentive, setAttentive] = useState(false);
  /** A one-off reaction to what just happened, cleared after it has played. */
  const [mood, setMood] = useState<MascotMood>(null);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the agent brings from this user's earlier projects, plus what it
  // picked up during this session.
  const [memory, setMemory] = useState<AgentMemory>(EMPTY_MEMORY);
  const [learned, setLearned] = useState<MemoryNote[]>([]);
  const menu = useOpenClose();
  const roadmap = useOpenClose();
  const agentInfo = useOpenClose();
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

  const deliverable = DELIVERABLES[role];

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setMicSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => () => {
    if (speakTimer.current) clearTimeout(speakTimer.current);
    if (moodTimer.current) clearTimeout(moodTimer.current);
  }, []);

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

  /** Plays a reaction once. Reactions are what read as alive — they have to
   *  end, or they turn into noise in the corner of the eye. */
  function react(next: Exclude<MascotMood, null>, ms = 1000) {
    setMood(next);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood(null), ms);
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
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { alive = false; };
  }, [project.id, role]);

  // Memory is read from the user's other projects with this agent, so the
  // current one is excluded — an agent should not "remember" today's answers.
  useEffect(() => {
    let alive = true;
    loadAgentMemory(agent.id, role, project.id)
      .then(m => { if (alive) setMemory(m); })
      .catch(() => {});
    return () => { alive = false; };
  }, [agent.id, role, project.id]);

  // Following a streaming answer smoothly fights itself on every chunk, so the
  // scroll is instant while text is arriving and smooth otherwise.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streamText ? "auto" : "smooth" });
  }, [messages, sending, streamText]);

  function buildDoc(content: string, title: string, createdAt: string, version: number): DeliverableDoc {
    return { title, role, agentName: agent.name, projectName: project.name, content, createdAt, version };
  }

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
    react("nod", 450);   // "got it" — answered before the answer exists
    try {
      await addMessage(project.id, role, "user", t);
      if (isFirstEver) {
        renameFromFirstMessage(project, t).then(name => { if (name) onProjectNamed?.(name); }).catch(() => {});
      }
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const reply = await askAgent({
        agent,
        messages: history,
        memory: memoryLines(memory, learned),
        experience: { level, projects: totalProjects },
        onDelta: soFar => { setStreamText(soFar); setOrb("speaking"); },
      });
      setStreamText("");
      await addMessage(project.id, role, "assistant", reply);
      const createdAt = new Date().toISOString();
      setMessages(prev => [...prev, { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "assistant", content: reply, created_at: createdAt }]);
      playSpeaking();
      onActivity?.();
      // The document is the moment worth showing — open it right away instead
      // of leaving the user to find a card in the scrollback.
      const parsed = parseMarkers(reply);
      // Anything the agent decided to remember shows up in the Agent Info
      // popover right away, and travels with it into the next project.
      if (parsed.memories.length) setLearned(prev => [...prev, ...parsed.memories]);
      const isDocReply = parsed.doc || looksLikeDocument(parsed.text, deliverable.title);
      if (isDocReply) {
        onOpenDoc?.(buildDoc(parsed.text, parsed.doc || deliverable.title, createdAt, docs.length + 1));
      }
      // The reaction comes from what the reply IS, not from asking the model
      // for a mood: a finished document, real progress, or a question back.
      if (isDocReply) react("proud", 1200);
      else if (parsed.progress !== null && parsed.progress - pct >= 10) react("pleased", 900);
      else if (/[?？]\s*$/.test(parsed.text)) react("curious", 1800);
      touchProjectActivity(project.id, `${role === "coach" ? "Coach" : "Consultant"} replied`).catch(() => {});
    } catch (e) {
      setStreamText("");
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
  const noMessagesYet = loaded && messages.length === 0;

  // How far the interview has got: the newest assistant message that carries
  // each marker wins, so reloading history rebuilds the same rail.
  const { pct, station } = useMemo(() => {
    let pct: number | null = null;
    let station: TopicMarker | null = null;
    for (let i = messages.length - 1; i >= 0 && (pct === null || station === null); i--) {
      if (messages[i].role !== "assistant") continue;
      const p = parseMarkers(messages[i].content);
      if (pct === null && p.progress !== null) pct = p.progress;
      if (station === null && p.topic) station = p.topic;
    }
    return { pct: pct ?? 0, station };
  }, [messages]);

  // Every version of the deliverable the agent has produced, oldest first —
  // each regeneration is a full rebuild, so they are numbered versions.
  const docs = useMemo(() =>
    messages
      .filter(m => m.role === "assistant")
      .map(m => ({ m, p: parseMarkers(m.content) }))
      .filter(({ p }) => !!p.doc || looksLikeDocument(p.text, deliverable.title)),
    [messages, deliverable.title]);

  const versionOf = new Map(docs.map((d, i) => [d.m.id, i + 1]));
  const docMsg = docs.length ? docs[docs.length - 1] : null;
  const currentDoc = docMsg
    ? buildDoc(docMsg.p.text, docMsg.p.doc || deliverable.title, docMsg.m.created_at, docs.length)
    : null;

  // What to show in the Agent Info popover: this session's lessons first
  // (they are the new thing), then the older ones, deduplicated by fact.
  const shownLessons = (() => {
    const seen = new Set<string>();
    const out: { kind: string; fact: string; fresh: boolean; project?: string }[] = [];
    for (const l of [...learned].reverse()) {
      const key = l.fact.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: l.kind, fact: l.fact, fresh: true });
    }
    for (const l of memory.lessons) {
      const key = l.fact.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: l.kind, fact: l.fact, fresh: false, project: l.project });
    }
    return out;
  })();

  const stationIdx = station ? station.index - 1 : (messages.length > 0 ? 0 : -1);
  const stationLabel = station?.label || deliverable.stations[Math.max(0, stationIdx)]?.label || "";
  const ready = pct >= 100;

  // Shown on demand in the Agent Info panel. The agent levels up on the work
  // it has actually done for this user; this project is one of them, so
  // compare against the count without it to know whether joining here is
  // what pushed it up a level.
  const totalProjects = agent.last_projects.length + projectCount;
  const level = levelFor(totalProjects);
  const leveledUp = levelFor(Math.max(0, totalProjects - 1)) !== level;
  const { next, remaining } = nextLevel(totalProjects);

  // Roadmap "downloads" — opens a clean, standalone document with the
  // conversation content and triggers the browser's native print dialog, so
  // the user picks "Save as PDF" there. No new dependency, no reuse of the
  // .print-area/@media print rules in globals.css (those are scoped to the
  // dead _legacy concept page's own fixed-height layout) — a fresh document
  // avoids any interference with the main app's CSS entirely. There's still
  // no per-message method tagging in the data model, so a per-method export
  // is the same conversation labeled by method, not a precise filter — an
  // accepted, disclosed simplification (the panel's own copy says so).
  const roadmapMethods = [...agent.primaryMethods, ...agent.secondaryMethods];
  const userMessageCount = messages.filter(m => m.role === "user").length;
  const availableCount = Math.min(roadmapMethods.length, userMessageCount);

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
        onFocus={() => setAttentive(true)}
        onBlur={() => setAttentive(false)}
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
    <section className={`panel ${role}`} style={{ flexGrow: grow }}
      onClick={() => menu.close()}>
      {/* Head: who this agent is, condensed */}
      <div className="chat-head">
        <button className="mascot-trigger" data-tooltip="Agent info"
          onClick={() => { agentInfo.toggle(); roadmap.close(); }}>
          <AgentMascot role={role} state={orb} size={46} enter attentive={attentive} mood={mood} level={level} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="n">{agent.name}</div>
          <div className="r">{role === "coach" ? "Coach" : "Consultant"}</div>
        </div>
        {role === "consultant" && (
          <button ref={roadmapBtnRef} className="roadmap-btn roadmap-btn-lg" style={{ marginLeft: "auto" }}
            onClick={() => { roadmap.toggle(); agentInfo.close(); }}>
            <span>Transformation Concept</span>
            <Progress value={currentDoc ? 100 : pct} />
          </button>
        )}
        <div style={{ position: "relative", marginLeft: role === "consultant" ? 0 : "auto" }} onClick={e => e.stopPropagation()}>
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
                  {leveledUp && <span className="level-up">Level up!</span>}
                </div>
                {next && <div className="level-hint">{remaining} more project{remaining === 1 ? "" : "s"} to {next}</div>}
              </div>
              <div><span className="lbl">Previous Projects</span><b>{totalProjects}</b></div>
              {agent.tagline && <div><span className="lbl">Type</span><b>{agent.tagline}</b></div>}
            </div>
            {shownLessons.length > 0 && (
              <div className="sb-methods">
                <div className="grp">
                  <span className="lbl">
                    Remembers about you
                    {learned.length > 0 && <em className="mem-new"> +{learned.length} new</em>}
                  </span>
                  <ul className="plist mem">
                    {shownLessons.slice(0, 3).map(l => (
                      <li key={l.fact} className={l.fresh ? "fresh" : undefined}>{l.fact}</li>
                    ))}
                    {shownLessons.length > 3 && <li className="muted">and {shownLessons.length - 3} more</li>}
                  </ul>
                </div>
              </div>
            )}
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
            <h3>Transformation Concept</h3>
            <button className="rp-close" onMouseDown={e => e.stopPropagation()} onClick={() => roadmap.close()}><IconX size={13} /></button>
          </div>
          {/* Real progress on the actual deliverable — where the interview
              stands, or the generated document itself — not just a per-method
              download checklist. */}
          <div className={`deliv-rail${ready ? " ready" : ""}${currentDoc ? " done" : ""}`}>
            <div className="dr-top">
              <span className="dr-kind">{currentDoc ? "ready" : `${pct}%`}</span>
              <span className="dr-step">
                {currentDoc
                  ? docs.length > 1 ? `Version ${docs.length} generated` : "Document generated"
                  : stationIdx < 0
                    ? `${deliverable.stations.length} steps · not started`
                    : `Step ${stationIdx + 1} of ${deliverable.stations.length} · ${stationLabel}`}
              </span>
            </div>
            <div className="dr-bar"><span style={{ width: `${currentDoc ? 100 : pct}%` }} /></div>
            <div className="dr-actions">
              {currentDoc ? (
                <>
                  <button className="rp-download-all" onClick={() => { roadmap.close(); onOpenDoc?.(currentDoc); }}>
                    <IconDoc size={14} />Open document
                  </button>
                  <button className="dr-redo" disabled={sending} aria-label="Rebuild the document"
                    onClick={() => { roadmap.close(); send(deliverable.regeneratePrompt); }}>
                    <IconRefresh size={13} />
                  </button>
                </>
              ) : (
                <button className="rp-download-all" disabled={sending}
                  onClick={() => { roadmap.close(); send(deliverable.generatePrompt); }}>
                  <IconSpark size={14} />Generate document
                </button>
              )}
            </div>
          </div>
          <button className="rp-download-all" disabled={pdfBusy !== null} onClick={downloadAll}>
            {pdfBusy === "all" ? <LoaderGrid /> : <IconDownload size={14} />}Download conversation
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

        {loaded && (
          <>
            <div className="msg-agent"><div className="txt">{agentGreeting(role, agent)}</div></div>

            {noMessagesYet && role === "consultant" && (
              <div className="hero-actions">
                {actions.map(a => (
                  <button key={a.title} className="hero-action" onClick={() => send(a.prompt)}>
                    <span className="qa-ic">{a.icon}</span>
                    <span className="ha-label">{a.title}</span>
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === "user") return <div key={m.id} className="msg-user">{m.content}</div>;
              const parsed = parseMarkers(m.content);
              const showChoices = i === lastAssistantIdx && parsed.choices.length > 0 && !sending;
              const isDoc = !!parsed.doc || looksLikeDocument(parsed.text, deliverable.title);
              const choices = showChoices ? (
                <div className="choice-row" style={{ paddingLeft: 0 }}>
                  {parsed.choices.map(c => (
                    <button key={c} className="choice-chip" disabled={sending} onClick={() => send(c)}>
                      <IconArrow size={11} />{c}
                    </button>
                  ))}
                </div>
              ) : null;

              // A generated document is a document, not a wall-of-text chat bubble.
              if (isDoc) {
                const title = parsed.doc || deliverable.title;
                const version = versionOf.get(m.id) ?? 1;
                const sections = (parsed.text.match(/^##\s+\S/gm) ?? []).length;
                const words = parsed.text.split(/\s+/).filter(Boolean).length;
                return (
                  <div key={m.id} className="msg-agent">
                    <button className="doc-card" onClick={() => onOpenDoc?.(buildDoc(parsed.text, title, m.created_at, version))}>
                      <span className="dc-ic"><IconDoc size={17} /></span>
                      <span className="dc-txt">
                        <span className="dc-t">{title}</span>
                        <span className="dc-s">
                          {version > 1 && `Version ${version} · `}{sections} sections · {words.toLocaleString()} words · open to read
                        </span>
                      </span>
                      <IconArrow />
                    </button>
                    {choices}
                  </div>
                );
              }

              return (
                <div key={m.id} className="msg-agent">
                  <div className="txt">
                    {mdBlocks(parsed.text).map((block, bi) =>
                      block.type === "code"
                        ? <CodeBlock key={bi} code={block.code} language={block.lang} />
                        : <div key={bi} dangerouslySetInnerHTML={{ __html: block.html }} />
                    )}
                  </div>
                  {choices}
                </div>
              );
            })}

            {/* The answer as it is written. A document is not streamed into the
                chat as a wall of text — it says what it is building instead. */}
            {sending && streamText && (
              streamIsDocument(streamText) ? (
                <div className="msg-agent">
                  <div className="doc-card writing">
                    <span className="dc-ic"><IconDoc size={17} /></span>
                    <span className="dc-txt">
                      <span className="dc-t">Writing your {deliverable.title}…</span>
                      <span className="dc-s">{streamText.split(/\s+/).filter(Boolean).length.toLocaleString()} words so far</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="msg-agent streaming">
                  <div className="txt" dangerouslySetInnerHTML={{ __html: md(streamingText(streamText)) }} />
                </div>
              )
            )}
            {sending && !streamText && (
              <div className="msg-processing" role="status">
                <span className="tline" aria-hidden />
                <span className="shimmer-text">{processingLabel}</span>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {loaded && <div className="chat-input">{composer}</div>}
    </section>
  );
}
