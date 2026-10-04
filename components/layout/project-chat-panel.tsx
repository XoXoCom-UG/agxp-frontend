"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import type { Project } from "@/lib/projects";
import { type MemoryNote } from "@/lib/message-markers";
import { loadAgentMemory, memoryLines, EMPTY_MEMORY, type AgentMemory } from "@/lib/agent-memory";
import { DELIVERABLES } from "@/lib/deliverables";
import { levelFor } from "@/lib/agent-progress";
import { recordReply, syncReplies, useMascotLevel, MAX_MASCOT_LEVEL } from "@/lib/mascot-level";
import { handleCodeCopyClick } from "@/lib/markdown";
import { peerTranscript, previewLine, type PeerContext, type PanelSnapshot } from "@/lib/peer-context";
import { parseEntries, deriveConversation } from "@/lib/conversation-state";
import { useAgentConversation, type ReplyInfo } from "@/lib/use-agent-conversation";
import { useMascotChoreography } from "@/lib/use-mascot-choreography";
import { useReadAlongNudge } from "@/lib/use-read-along-nudge";
import { useChoiceKeys } from "@/lib/use-choice-keys";
import type { DeliverableDoc } from "@/components/layout/deliverable-view";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { IconRefresh } from "@/components/layout/agxp-icons";
import { ChatHead } from "@/components/layout/chat/chat-head";
import { ChatComposer } from "@/components/layout/chat/chat-composer";
import { ChatMessage, ChatStreaming } from "@/components/layout/chat/chat-message";

const OPENING: Record<AgentType, string> = {
  consultant: "Hey, what can I do for you today?",
  coach: "Hey, what would you like to talk through today?",
};

/** Scrolled further than this, the head shows its hairline. */
const STUCK_AFTER_PX = 4;
/** Progress jumps at least this far before the mascot is pleased about it. */
const PLEASED_STEP = 10;
const PROUD_MS = 1200;
const PLEASED_MS = 400;
const GLANCE_UP_MS = 1200;

/** Only a precise pointer gets the composer focused back for it; on a phone
 *  that would pull the keyboard up after every answer. */
function hasFinePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;
}

export function ProjectChatPanel({ project, role, agent, projectCount = 0, peer, idle = false, unread = false, keyboardActive = true, headExtra, onProjectNamed, onActivity, onOpenDoc, onChangeAgent, onSnapshot, onFocusPanel, onMinimise }: {
  project: Project; role: AgentType; agent: Agent;
  /** How many of the user's projects this agent has worked on, this one included. */
  projectCount?: number;
  onProjectNamed?: (name: string) => void;
  /** Fires when a reply lands — the screen marks the tab on stacked layouts,
   *  where only one panel is on screen at a time. */
  onActivity?: () => void;
  /** Opens the finished deliverable in the full document view (owned by the screen). */
  onOpenDoc?: (doc: DeliverableDoc) => void;
  /** Drops this agent so the panel falls back to the picker — the same escape
   *  hatch AgentPickerPanel offers before Start, now also reachable mid-chat. */
  onChangeAgent?: () => void;
  /** The other agent's conversation on this project, handed down by the screen. */
  peer?: PeerContext;
  /** True when this is the narrow panel — it waits rather than leads. */
  idle?: boolean;
  /** An answer landed here while the user was looking at the other panel. */
  unread?: boolean;
  /** The panel the keyboard belongs to. Both panels are mounted at once, so
   *  only this one answers the number keys and gets its composer focused
   *  back after a reply. */
  keyboardActive?: boolean;
  /** Publishes this panel's state upward; the screen routes it to the other one. */
  onSnapshot?: (s: PanelSnapshot) => void;
  /** Hands this panel the room. */
  onFocusPanel?: () => void;
  /** Folds this panel away into the pill. Only the Coach is given one. */
  onMinimise?: () => void;
  /** Rendered in the head beside the document button — the folded Coach
   *  lives here, so it takes no room of its own. */
  headExtra?: React.ReactNode;
}) {
  const deliverable = DELIVERABLES[role];
  /** The mascot's earned look, 1-5: one level per answer (lib/mascot-level.ts). */
  const mascotLevel = useMascotLevel(agent.id);
  const mascot = useMascotChoreography(mascotLevel);

  // What the agent brings from this user's earlier projects, plus what it
  // picked up during this session.
  const [memory, setMemory] = useState<AgentMemory>(EMPTY_MEMORY);
  const [learned, setLearned] = useState<MemoryNote[]>([]);
  /** What the screen reader hears when an answer lands. */
  const [announce, setAnnounce] = useState("");
  /** "Change agent" asks first — it is a one-click way to lose your place. */
  const [confirmChange, setConfirmChange] = useState(false);
  /** The agent looks at the composer while you are writing to it. */
  const [attentive, setAttentive] = useState(false);
  /** The head's hairline appears only once content has scrolled beneath it. */
  const [stuck, setStuck] = useState(false);
  /** Set by Restore in the version history: Open shows this version instead
   *  of the newest. Remembers how many versions there were, so a real new
   *  version supersedes it without an effect having to reset it. */
  const [restore, setRestore] = useState<{ version: number; atCount: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** Was the composer focused when the request went out? */
  const composerHadFocus = useRef(false);

  const totalProjects = agent.last_projects.length + projectCount;
  const level = levelFor(totalProjects);

  function buildDoc(content: string, title: string, createdAt: string, version: number): DeliverableDoc {
    return { title, role, agentId: agent.id, agentName: agent.name, agentProjects: totalProjects, projectName: project.name, content, createdAt, version };
  }

  function onReply({ parsed, isDoc, stopped, createdAt, version, progressBefore }: ReplyInfo) {
    // No real upgrade system yet: every answer is one level (up to 5).
    recordReply(agent.id);
    onActivity?.();
    const preview = previewLine(parsed.text);
    setAnnounce(stopped ? `${agent.name} stopped. ${preview}`
      : isDoc ? `${agent.name} finished the ${parsed.doc || deliverable.title}.`
      : `${agent.name} replied: ${preview}`);
    // Anything the agent decided to remember shows up in the profile right
    // away, and travels with it into the next project.
    if (parsed.memories.length) setLearned(prev => [...prev, ...parsed.memories]);
    // Stopped on purpose: kept, but nothing to celebrate or open.
    if (stopped) { mascot.setOrb("idle"); return; }
    mascot.playSuccess();
    // The document is the moment worth showing — open it right away instead
    // of leaving the user to find a card in the scrollback.
    if (isDoc) {
      onOpenDoc?.(buildDoc(parsed.text, parsed.doc || deliverable.title, createdAt, version));
      mascot.glanceAt("result");
    }
    // One reaction per answer, never several fighting over the same
    // animation: a level-up (played by useMascotChoreography when the level
    // rises) outranks a finished document, which outranks real progress. A
    // question back or suggested answers only move the eyes — that happens
    // on most replies, so it gets no head motion at all.
    if (mascotLevel < MAX_MASCOT_LEVEL) return;
    if (isDoc) mascot.react("proud", PROUD_MS);
    else if (parsed.progress !== null && parsed.progress - progressBefore >= PLEASED_STEP) mascot.react("pleased", PLEASED_MS);
    else if (/[?？]\s*$/.test(parsed.text)) mascot.glanceAt("up", GLANCE_UP_MS);
    else if (parsed.choices.length > 0) mascot.glanceAt("card");
  }

  const chat = useAgentConversation({
    project, role, agent, deliverable,
    context: () => ({ memory: memoryLines(memory, learned), experience: { level, projects: totalProjects }, peer }),
    onProjectNamed,
    onStart: isGenerating => {
      composerHadFocus.current = !!inputRef.current && document.activeElement === inputRef.current;
      mascot.setOrb(isGenerating ? "working" : "thinking");
    },
    onDelta: () => mascot.setOrb("speaking"),
    onReply,
    onStoppedEmpty: () => { mascot.setOrb("idle"); setAnnounce(`${agent.name} stopped.`); },
    onError: mascot.playError,
  });
  const { messages, loaded, loadError, sending, streamText, leavingId } = chat;

  // Every message parsed once per change of the list, not once per use per render.
  const entries = useMemo(() => parseEntries(messages, deliverable.title), [messages, deliverable.title]);
  const convo = useMemo(() => deriveConversation(entries), [entries]);
  const { pct, station, docs, versionOf, lastAssistantIdx } = convo;
  const answered = useMemo(() => entries.filter(e => e.m.role === "assistant" && !e.isError).length, [entries]);

  // Memory is read from the user's other projects with this agent, so the
  // current one is excluded — an agent should not "remember" today's answers.
  // A failure only means it starts without them; the chat itself still works.
  useEffect(() => {
    let alive = true;
    loadAgentMemory(agent.id, role, project.id)
      .then(m => { if (alive) setMemory(m); })
      .catch(e => console.warn("[chat] loading agent memory failed:", e));
    return () => { alive = false; };
  }, [agent.id, role, project.id]);

  // Following a streaming answer smoothly fights itself on every chunk, so the
  // scroll is instant while text is arriving and smooth otherwise.
  //
  // This scrolls the list itself rather than calling scrollIntoView on a
  // sentinel at the bottom. scrollIntoView walks up and scrolls EVERY
  // scrollable ancestor, and `overflow:hidden` still makes an element
  // programmatically scrollable — so it was quietly scrolling the panel and
  // the whole app shell down as well, taking the agent's head and the header
  // off the top of the window with no way to scroll them back.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: streamText ? "auto" : "smooth" });
  }, [messages, sending, streamText]);

  // Once the answer is in, the composer gets focus back — if this is the
  // panel the keyboard belongs to, and focus is not somewhere the person
  // put it in the meantime (the other panel, the document that just opened).
  const wasSending = useRef(false);
  useEffect(() => {
    const was = wasSending.current;
    wasSending.current = sending;
    if (!was || sending || !keyboardActive) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (composerHadFocus.current || hasFinePointer()) inputRef.current?.focus({ preventScroll: true });
  }, [sending, keyboardActive]);

  useChoiceKeys({ choices: convo.choices, active: keyboardActive, sending, panelRef, onPick: chat.sendRef });
  useReadAlongNudge({
    enabled: role === "coach", loaded, hasHistory: messages.length > 0,
    peerTurns: peer?.turns ?? 0, peerDocs: peer?.docs ?? 0, sending, sendRef: chat.sendRef,
  });

  // A conversation opened from history already holds that many answers; the
  // mascot is at least that far along, even in a browser that never saw
  // them. syncReplies only ever raises the count, so running it again as
  // answers land is a no-op — recordReply has already counted them.
  useEffect(() => {
    if (loaded) syncReplies(agent.id, answered);
  }, [loaded, agent.id, answered]);

  // What this panel tells the screen about itself: the transcript the other
  // agent gets to read, and the last line its pill/idle preview shows. Held
  // in a ref so the effect below fires on real changes only — passing the
  // callback itself as a dependency would republish on every render, and the
  // screen writing that back down would spin the two panels against each other.
  const snapCb = useRef(onSnapshot);
  useEffect(() => { snapCb.current = onSnapshot; });
  useEffect(() => {
    // Error lines are not something the agent said, and commands are not
    // something the person wrote.
    const said = entries.filter(e => !e.isError && !e.isCommand);
    const turns = said.map(e => ({ role: e.m.role, content: e.m.content }));
    const answers = said.filter(e => e.m.role === "assistant");
    const last = answers[answers.length - 1];
    const lastLine = (last && previewLine(last.p.text)) || OPENING[role];
    snapCb.current?.({ name: agent.name, transcript: peerTranscript(turns, agent.name), lastLine,
      agentTurns: answers.length, docCount: docs.length, busy: sending });
  }, [entries, sending, agent.name, role, docs.length]);

  const latest = docs.length;
  const restoredVersion = restore && restore.atCount === latest && restore.version < latest ? restore.version : null;
  const currentVersion = restoredVersion ?? latest;

  function docFor(version: number): DeliverableDoc | null {
    const d = docs[version - 1];
    return d ? buildDoc(d.p.text, d.p.doc || deliverable.title, d.m.created_at, version) : null;
  }
  function openVersion(version: number) {
    const doc = docFor(version);
    if (doc) onOpenDoc?.(doc);
  }

  const stationIdx = station ? station.index - 1 : (messages.length > 0 ? 0 : -1);
  const stationLabel = station?.label || deliverable.stations[Math.max(0, stationIdx)]?.label || "";
  // How many stations this conversation actually has, from the agent rather
  // than from the full agenda. A capped plan is told it has three of eight,
  // so a rail built from deliverable.stations.length would draw five ticks
  // the interview never reaches and read "Step 3 of 8" at 100%. The marker is
  // the one place that knows which agenda the agent was given.
  const totalStations = station?.total ?? deliverable.stations.length;

  const busy = sending || !!leavingId;

  return (
    <section ref={panelRef} className={`panel ${role}${idle ? " is-idle" : ""}${unread ? " has-unread" : ""}`}>
      <ChatHead
        role={role} agent={agent} deliverable={deliverable}
        mascot={{ orb: mascot.orb, mood: mascot.mood, lookAt: mascot.lookAt }}
        attentive={attentive} stuck={stuck} headExtra={headExtra}
        unread={unread} sending={sending} totalProjects={totalProjects}
        memory={memory} learned={learned}
        doc={{
          pct, stationIdx, stationLabel, totalStations,
          currentDoc: docFor(currentVersion), currentVersion, restored: restoredVersion !== null,
          versions: docs.map((d, i) => ({ version: i + 1, createdAt: d.m.created_at })),
        }}
        onFocusPanel={onFocusPanel}
        onMinimise={onMinimise}
        onChangeAgent={onChangeAgent ? () => setConfirmChange(true) : undefined}
        onOpenVersion={openVersion}
        onGenerate={() => chat.send(deliverable.generatePrompt)}
        onRegenerate={() => chat.send(deliverable.regeneratePrompt)}
        onRestoreVersion={v => setRestore({ version: v, atCount: latest })}
      />

      <div className="chat-body" ref={bodyRef} onScroll={e => setStuck(e.currentTarget.scrollTop > STUCK_AFTER_PX)}
        onClick={handleCodeCopyClick}>
        {!loaded && !loadError && (
          <div className="chat-loading" role="status">
            <span className="spinner chat-spinner" aria-hidden="true" />
            <span className="visually-hidden">Loading the conversation…</span>
          </div>
        )}

        {/* Looking like an empty chat here would be wrong: there is history,
            it just didn't arrive, and a message sent now would go out without it. */}
        {loadError && (
          <div className="msg-agent msg-error" role="alert">
            <div className="me-title">This conversation didn&apos;t load</div>
            <div className="me-detail">
              The earlier messages couldn&apos;t be fetched, so {agent.name} can&apos;t see them yet. Check your connection and try again.
            </div>
            <button className="me-retry" onClick={chat.reload}>
              <IconRefresh size={13} />Try again
            </button>
          </div>
        )}

        {loaded && (
          <div className="msg-agent">
            <div className="txt">{OPENING[role]}</div>
          </div>
        )}

        {entries.map((entry, i) => (
          <ChatMessage key={entry.m.id} entry={entry}
            agentName={agent.name} docTitle={deliverable.title}
            isNew={i >= chat.historyCount && !chat.streamedIds.has(entry.m.id)}
            isLeaving={entry.m.id === leavingId}
            isLast={i === lastAssistantIdx}
            version={versionOf.get(entry.m.id) ?? 1}
            sending={sending} busy={busy}
            onRetry={chat.retry}
            onPick={chat.send}
            onOpenDoc={title => onOpenDoc?.(buildDoc(entry.p.text, title, entry.m.created_at, versionOf.get(entry.m.id) ?? 1))}
          />
        ))}

        {sending && (
          <ChatStreaming streamText={streamText} agentName={agent.name}
            docTitle={deliverable.title} waitingLong={chat.waitingLong} />
        )}
      </div>

      <ChatComposer role={role} sending={sending} canSend={loaded} projectId={project.id}
        inputRef={inputRef}
        onSend={chat.send} onStop={chat.stop} onAttentiveChange={setAttentive} />
      <div className="visually-hidden" role="status" aria-live="polite">{announce}</div>
      {confirmChange && onChangeAgent && (
        <ConfirmDialog
          title={`Change your ${role === "coach" ? "coach" : "consultant"}?`}
          body={`The conversation with ${agent.name} stays saved in this project. You'll pick another ${role === "coach" ? "coach" : "consultant"} next.`}
          confirmLabel="Change agent"
          onCancel={() => setConfirmChange(false)}
          onConfirm={() => { setConfirmChange(false); onChangeAgent(); }} />
      )}
    </section>
  );
}
