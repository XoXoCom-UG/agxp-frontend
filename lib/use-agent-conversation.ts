"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import { listMessages, addMessage, deleteMessage, touchProjectActivity, renameFromFirstMessage, type Project, type ProjectMessage } from "@/lib/projects";
import { askAgent, AgentError } from "@/lib/ask-agent";
import { parseMarkers, streamIsDocument, type ParsedMessage } from "@/lib/message-markers";
import { isDeliverableCommand, type Deliverable } from "@/lib/deliverables";
import { isReadAlongCommand, type PeerContext } from "@/lib/peer-context";
import { ERROR_PREFIX, isErrorLine, isDocReply, cutUnfinishedMarker, parseEntries, deriveConversation } from "@/lib/conversation-state";

/** The answer Try again replaces fades out for this long before it goes. */
const LEAVE_MS = 150;
/**
 * True, not decorative: before the first token the request is out and the
 * model is reading; past this it is simply a long answer. Inventing more
 * stages than exist would be the vague status message in costume.
 */
const LONG_WAIT_MS = 6000;

/**
 * The cause in plain words, with the way out. The raw detail goes to the
 * console, where someone who can act on it will look — an env var name or an
 * exception message on screen helps nobody who is only trying to talk.
 * warn, not error: the failure is already on screen with a way out, and the
 * dev overlay reports every console.error as if the app had crashed.
 */
function userFacingError(e: unknown, stage: "save" | "reply"): string {
  console.warn(`[chat] ${stage} failed:`, e);
  if (!(e instanceof AgentError)) {
    // Everything that is not the agent call is the database.
    return stage === "save"
      ? "Your message couldn't be saved. Check your connection and try again."
      : "The answer couldn't be saved. Check your connection and try again.";
  }
  switch (e.code) {
    case "unauthorized": return "Your session has expired. Sign in again, then try again.";
    case "rate_limited": return "Too many messages in a short time. Wait a minute, then try again.";
    case "not_configured": return "The assistant isn't configured on the server yet. Try again later.";
    case "bad_request": return "This conversation couldn't be sent. Reload the page and try again.";
    case "network": return "Couldn't reach the assistant. Check your connection and try again.";
    case "empty": return "The assistant didn't answer this time. Try again.";
    default: return "The assistant ran into a problem. Try again in a moment.";
  }
}

/** What a finished reply hands back to the panel, for the mascot and the screen. */
export interface ReplyInfo {
  reply: string;
  parsed: ParsedMessage;
  isDoc: boolean;
  /** The person pressed Stop; `reply` is what had arrived until then. */
  stopped: boolean;
  createdAt: string;
  /** 1-based version when `isDoc`, counted from the history it was built on. */
  version: number;
  /** Interview progress before this answer, to tell a real step forward. */
  progressBefore: number;
}

export interface ConversationOptions {
  project: Project;
  role: AgentType;
  agent: Agent;
  deliverable: Deliverable;
  /** Read at the moment a request goes out, so it is never a render behind. */
  context: () => { memory: string[]; experience: { level: string; projects: number }; peer?: PeerContext };
  onProjectNamed?: (name: string) => void;
  /** A request went out. */
  onStart?: (isGenerating: boolean) => void;
  /** A chunk of the answer arrived. */
  onDelta?: () => void;
  onReply?: (info: ReplyInfo) => void;
  /** Stopped before a single word arrived — there is nothing to keep. */
  onStoppedEmpty?: () => void;
  onError?: () => void;
}

function localMessage(project: Project, role: AgentType, who: "user" | "assistant", content: string, id?: string, createdAt?: string): ProjectMessage {
  return { id: id ?? crypto.randomUUID(), project_id: project.id, column_type: role, role: who, content, created_at: createdAt ?? new Date().toISOString() };
}

/**
 * One agent's conversation on one project: loading it, sending, streaming the
 * answer in, stopping it, trying again, and saving every turn. The panel only
 * draws what this returns.
 *
 * The callbacks are read through a ref at the moment they fire, so a reply
 * that lands thirty seconds after it was asked for still reports to the
 * current render — never to the one that happened to send it.
 */
export function useAgentConversation(opts: ConversationOptions) {
  const { project, role, deliverable } = opts;
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  /** How many messages came from history. Only what arrives after that
   *  animates in — reopening a chat must not slide thirty old messages in. */
  const [historyCount, setHistoryCount] = useState(0);
  /** Replies that were streamed into view: they are already on screen when
   *  they become a message, so they must not fade in a second time. */
  const [streamedIds, setStreamedIds] = useState<Set<string>>(() => new Set());
  /** The answer Try again is replacing, while it fades out. */
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  /** The answer as it arrives, before it is saved and becomes a message. */
  const [streamText, setStreamText] = useState("");
  /** Counts requests, so a slow-answer flag set for one never shows on the next. */
  const [turn, setTurn] = useState(0);
  const [longWaitTurn, setLongWaitTurn] = useState(-1);

  const optsRef = useRef(opts);
  useLayoutEffect(() => { optsRef.current = opts; });
  const abortRef = useRef<AbortController | null>(null);
  /** Set synchronously, so a double click or a key and a nudge in the same
   *  tick cannot both start a request before `sending` has re-rendered. */
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaving the panel stops the answer. What had arrived is still saved
  // (respond() below), it just is not drawn anywhere.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  // A failed load used to look exactly like a fresh chat — the next message
  // then went out without any of the history. It now says so, with a retry.
  useEffect(() => {
    let alive = true;
    listMessages(project.id, role)
      .then(m => {
        if (!alive) return;
        setMessages(m);
        setHistoryCount(m.length);
        setLoadError(false);
        setLoaded(true);
      })
      .catch(e => {
        if (!alive) return;
        console.warn("[chat] loading history failed:", e);
        setLoadError(true);
      });
    return () => { alive = false; };
  }, [project.id, role, loadAttempt]);

  function reload() {
    setLoadError(false);
    setLoadAttempt(n => n + 1);
  }

  useEffect(() => {
    if (!sending || streamText) return;
    const id = setTimeout(() => setLongWaitTurn(turn), LONG_WAIT_MS);
    return () => clearTimeout(id);
  }, [sending, streamText, turn]);
  const waitingLong = sending && !streamText && longWaitTurn === turn;

  function isGeneratePrompt(t: string): boolean {
    return t === deliverable.generatePrompt || t === deliverable.regeneratePrompt;
  }

  function pushError(content: string) {
    setMessages(prev => [...prev, localMessage(project, role, "assistant", `${ERROR_PREFIX}${content}`)]);
    optsRef.current.onError?.();
  }

  async function send(text: string): Promise<void> {
    const t = text.trim();
    // Before the history is in, a message would go out without it — and the
    // load landing afterwards would wipe it from the list.
    if (!t || inFlight.current || !loaded) return;
    inFlight.current = true;
    const isFirstEver = messages.length === 0;
    const userMsg = localMessage(project, role, "user", t);
    setMessages(prev => [...prev, userMsg]);
    try {
      await addMessage(project.id, role, "user", t);
      // Only something a person actually typed can name the project. The
      // document buttons and the Coach's own nudge are commands, and naming
      // a project "(Systemhinweis, nicht vom Nutzer geschrieben…" once was
      // enough to make that obvious.
      if (isFirstEver && !isDeliverableCommand(t) && !isReadAlongCommand(t)) {
        renameFromFirstMessage(project, t)
          .then(name => { if (name) optsRef.current.onProjectNamed?.(name); })
          .catch(e => console.warn("[chat] naming the project failed:", e));
      }
    } catch (e) {
      pushError(userFacingError(e, "save"));
      inFlight.current = false;
      return;
    }
    await respond([...messages, userMsg], isGeneratePrompt(t));
  }

  /**
   * Asks the agent to answer `history` and appends the reply. Shared by a
   * fresh message and by Try again, which replays the same history minus the
   * answer it is replacing — same context, same prompt, a new answer.
   */
  async function respond(history: ProjectMessage[], isGenerating: boolean) {
    inFlight.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    setTurn(n => n + 1);
    optsRef.current.onStart?.(isGenerating);
    try {
      const { agent, context } = optsRef.current;
      const { memory, experience, peer } = context();
      const { text, stopped } = await askAgent({
        agent,
        messages: history.map(m => ({ role: m.role, content: m.content })),
        memory,
        experience,
        peer,
        signal: controller.signal,
        onDelta: soFar => { setStreamText(soFar); optsRef.current.onDelta?.(); },
      });
      setStreamText("");
      // Stopped: what arrived is the reply, saved like any other — minus a
      // marker cut off halfway, which would otherwise stay on screen.
      const reply = stopped ? cutUnfinishedMarker(text) : text;
      if (!reply.trim()) { optsRef.current.onStoppedEmpty?.(); return; }

      const savedId = await addMessage(project.id, role, "assistant", reply);
      // Unmounted while saving: the reply is kept, there is just nobody to show it to.
      if (!mounted.current) return;
      const createdAt = new Date().toISOString();
      const replyId = savedId ?? crypto.randomUUID();
      if (!streamIsDocument(reply)) setStreamedIds(prev => new Set(prev).add(replyId));
      setMessages(prev => [...prev, localMessage(project, role, "assistant", reply, replyId, createdAt)]);

      const parsed = parseMarkers(reply);
      const isDoc = isDocReply(parsed, deliverable.title);
      // Counted from the history this answer was built on, not from the
      // rendered list — after Try again that still holds the replaced one.
      const before = deriveConversation(parseEntries(history, deliverable.title));
      const version = isDoc ? before.docs.length + 1 : 0;
      optsRef.current.onReply?.({ reply, parsed, isDoc, stopped, createdAt, version, progressBefore: before.pct });
      // The project list's "last activity" line; nothing on this screen reads it.
      touchProjectActivity(project.id, `${role === "coach" ? "Coach" : "Consultant"} replied`)
        .catch(e => console.warn("[chat] recording activity failed:", e));
    } catch (e) {
      setStreamText("");
      if (mounted.current) pushError(userFacingError(e, "reply"));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      inFlight.current = false;
      setSending(false);
    }
  }

  /** Stop: the answer ends where it is, and what arrived is kept. */
  function stop() {
    abortRef.current?.abort();
  }

  /** Try again: drop the newest answer and ask again from exactly the same
   *  history. The old answer is deleted from the project too, or it would
   *  come back on the next reload as a second reply to the same question. */
  function retry() {
    if (sending || leavingId || inFlight.current) return;
    let idx = -1;
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") { idx = i; break; }
    if (idx < 0) return;
    const target = messages[idx];
    const history = messages.slice(0, idx);
    const prompt = history[history.length - 1];
    if (!prompt || prompt.role !== "user") return;
    inFlight.current = true;
    // The answer being replaced fades out first instead of vanishing in one
    // frame — then it is removed and the new one is asked for.
    setLeavingId(target.id);
    leaveTimer.current = setTimeout(() => {
      setLeavingId(null);
      setMessages(history);
      setHistoryCount(c => Math.min(c, history.length));
      // An error line was never saved, so there is nothing to delete for it.
      if (!isErrorLine(target.content)) {
        deleteMessage(target.id).catch(e => console.warn("[chat] deleting the replaced answer failed:", e));
      }
      respond(history, isGeneratePrompt(prompt.content));
    }, LEAVE_MS);
  }

  // The number keys and the Coach's nudge fire from listeners and effects
  // that outlive a render; they call through this, so they always get the
  // send that sees the current messages, memory and peer.
  const sendRef = useRef(send);
  useLayoutEffect(() => { sendRef.current = send; });

  return {
    messages, loaded, loadError, reload, historyCount, streamedIds, leavingId,
    sending, streamText, waitingLong,
    send, sendRef, stop, retry,
  };
}
