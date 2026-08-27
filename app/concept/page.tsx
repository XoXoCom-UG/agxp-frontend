"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useChatStore } from "@/lib/chat-store";
import { api, ConceptData } from "@/lib/api";
import { AppShell } from "@/components/layout/app-shell";
import { DEMO_CONCEPT } from "@/lib/demo";
import { dateStr } from "@/lib/utils";
import {
  Clock, AlertTriangle, TrendingDown, Zap,
  ChevronRight, CheckCircle2, FileText, MessageSquare, ArrowLeft, Pencil, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence, useSpring } from "motion/react";
import { MeasurePriorityBoard, MeasureSequence } from "@/components/charts/measure-views";
import { ConceptCardsSection } from "@/components/cards/card-template-renderer";

// ── Magnetic button ───────────────────────────────────────────────────────────
function MagBtn({
  children, onClick, className, disabled, type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useSpring(0, { stiffness: 180, damping: 16 });
  const y = useSpring(0, { stiffness: 180, damping: 16 });

  function onMove(e: React.MouseEvent) {
    if (disabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.26);
    y.set((e.clientY - r.top - r.height / 2) * 0.26);
  }
  function onLeave() { x.set(0); y.set(0); }

  return (
    <motion.button
      ref={ref}
      type={type}
      style={{ x, y }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </motion.button>
  );
}

// ── Typewriter ────────────────────────────────────────────────────────────────
function Typewriter({ text, speed = 46 }: { text: string; speed?: number }) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setOut(""); setDone(false);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setOut(text.slice(0, i));
      if (i >= text.length) { clearInterval(t); setDone(true); }
    }, speed);
    return () => clearInterval(t);
  }, [text]);

  return (
    <span>
      {out}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
          className="inline-block w-[2px] h-[1em] bg-zinc-800 ml-[2px] align-[-2px]"
        />
      )}
    </span>
  );
}

// ── Generating overlay ────────────────────────────────────────────────────────
// Paced against the measured backend time (~85s end to end). The stages used to
// finish at 22s, which left the user watching a frozen last line for a full
// minute — it read as a hang. The last stage is deliberately open-ended so a
// slower-than-usual run still looks like progress rather than a freeze.
const G_MESSAGES = [
  { text: "Lese und verstehe deine gesamte Konversation...", ms: 0 },
  { text: "Identifiziere aktuelle IT-Probleme und Pain Points...", ms: 7000 },
  { text: "Analysiere Transformationspotenziale...", ms: 16000 },
  { text: "Berechne Business Value und erwarteten ROI...", ms: 26000 },
  { text: "Entwickle konkrete Maßnahmen für deinen Stack...", ms: 36000 },
  { text: "Formuliere User Stories für dein Entwicklungsteam...", ms: 47000 },
  { text: "Wähle die passenden Mehrwert-Maßnahmen aus...", ms: 58000 },
  { text: "Stelle die passenden Kennzahlen-Karten zusammen...", ms: 68000 },
  { text: "Erstelle die finale Zusammenfassung...", ms: 78000 },
];

function GeneratingOverlay() {
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState<number[]>([]);

  useEffect(() => {
    const timers = G_MESSAGES.map((m, i) =>
      setTimeout(() => {
        setCurrent(i);
        if (i > 0) setDone(prev => [...prev, i - 1]);
      }, m.ms)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-white"
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.04, 0.08, 0.04] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, #16a34a, transparent)" }}
      />

      <div className="relative w-full max-w-sm px-8">
        <div className="flex justify-center mb-14">
          <motion.div
            className="w-14 h-14 rounded-2xl bg-green-600 flex items-center justify-center text-white shadow-lg shadow-green-600/25"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          >
            <Zap className="w-6 h-6" strokeWidth={1.5} />
          </motion.div>
        </div>

        <div className="flex flex-col gap-4">
          {G_MESSAGES.map((m, i) => {
            if (i > current) return null;
            const isDone = done.includes(i);
            const isCurrent = i === current;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {isDone ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.3, bounce: 0.4 }}>
                      <CheckCircle2 className="w-4 h-4 text-green-500" strokeWidth={2} />
                    </motion.div>
                  ) : isCurrent ? (
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                      className="w-2 h-2 rounded-full bg-green-600" />
                  ) : null}
                </div>
                <span className={`text-sm leading-relaxed ${isDone ? "text-zinc-400" : isCurrent ? "text-zinc-900 font-medium" : "text-zinc-400"}`}>
                  {isCurrent ? <Typewriter text={m.text} speed={46} /> : m.text}
                </span>
              </motion.div>
            );
          })}
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          className="mt-12 text-center text-xs text-zinc-400">
          Das dauert typischerweise 1–2 Minuten
        </motion.p>
      </div>
    </motion.div>
  );
}

// ── KPI meta ──────────────────────────────────────────────────────────────────
const KPI_META = [
  { key: "manual_effort", label: "Zeitersparnis",   sub: "Manuelle Aufwände", Icon: Clock },
  { key: "error_rate",    label: "Fehlerrate",       sub: "Reduzierung",       Icon: AlertTriangle },
  { key: "cost_savings",  label: "Kostenersparnis",  sub: "Pro Jahr",          Icon: TrendingDown },
] as const;

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.8, 0.4] }}
      transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      className={`bg-zinc-100 rounded-lg ${className ?? ""}`}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function ConceptContent() {
  const { token, loading } = useAuth();
  const store = useChatStore();
  const router = useRouter();
  const params = useSearchParams();
  const urlSession = params.get("session");
  const sessionId = urlSession || store.sessionId;
  // Concept lives in the store so the assistant can edit it and this page
  // re-renders (assisted editing).
  const concept = store.activeConcept;
  const setConcept = store.setActiveConcept;
  const [conceptLoading, setConceptLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [openStep, setOpenStep] = useState<number | null>(null);
  // Regenerating overwrites the concept saved for this session, so the button
  // asks once instead of discarding it on a mis-click.
  const [confirmRegen, setConfirmRegen] = useState(false);

  // Pending debounced concept save (see patchConcept).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<{ token: string; sessionId: string; concept: ConceptData } | null>(null);

  useEffect(() => { if (!loading && !token) router.replace("/login"); }, [token, loading]);

  // Load history if not loaded yet
  useEffect(() => {
    if (token && !store.history.length) {
      api.getHistory(token).then(d => store.setHistory(d.sessions)).catch(() => {});
    }
  }, [token]);

  // Load concept when we have a session with messages
  useEffect(() => {
    if (store.demoActive) return;
    if (!token || !sessionId || !store.messages.length) return;
    setConceptLoading(true);
    api.getConcept(token, sessionId)
      .then(d => { if (d?.concept) setConcept(d.concept); })
      .catch(() => {})
      .finally(() => setConceptLoading(false));
  }, [token, sessionId, store.messages.length, store.demoActive]);

  // Arriving with ?session= — load the concept AND the conversation behind it.
  //
  // The messages matter beyond display: regenerating needs them, and the
  // "Neu generieren" button was gated on having them, so opening a concept by URL
  // hid the button entirely. That is why it "didn't always show up".
  useEffect(() => {
    if (store.demoActive) return;
    if (!token || !urlSession) return;
    setConceptLoading(true);
    api.getConcept(token, urlSession)
      .then(d => { if (d?.concept) setConcept(d.concept); })
      .catch(() => {})
      .finally(() => setConceptLoading(false));

    if (!store.messages.length) {
      api.getSession(token, urlSession)
        .then(s => {
          store.setSessionId(urlSession);
          if (s.title) store.setSessionTitle(s.title);
          if (s.messages?.length) store.setMessages(s.messages);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, urlSession, store.demoActive]);

  // During the tour, show the bundled example instead of loading/generating.
  useEffect(() => {
    if (store.demoActive) setConcept(DEMO_CONCEPT);
  }, [store.demoActive]);

  // Arriving from the chat CTA (?gen=1) auto-generates the concept once.
  const autoGen = useRef(false);
  useEffect(() => {
    if (params.get("gen") !== "1" || autoGen.current || !token) return;
    if (!store.messages.length || concept || generating) return;
    autoGen.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, token, store.messages.length, concept]);

  async function selectSession(sid: string) {
    if (!token) return;
    try {
      const s = await api.getSession(token, sid);
      store.setSessionId(sid);
      store.setSessionTitle(s.title || "Konversation");
      store.setMessages(s.messages ?? []);
      // Try to load existing concept immediately
      setConceptLoading(true);
      const d = await api.getConcept(token, sid).catch(() => null);
      if (d?.concept) setConcept(d.concept);
      setConceptLoading(false);
    } catch {}
  }

  async function generate() {
    if (!token) return;
    setGenerating(true); setError("");
    try {
      let msgs = store.messages;
      if (!msgs.length && sessionId) {
        // Opened by URL: the conversation isn't in the store yet, and the concept is
        // generated FROM the conversation, so fetch it rather than refusing.
        const s = await api.getSession(token, sessionId).catch(() => null);
        msgs = s?.messages ?? [];
        if (msgs.length) store.setMessages(msgs);
      }
      if (!msgs.length) {
        setError("Wähle zuerst eine Konversation aus.");
        setGenerating(false); return;
      }
      const res = await api.generateConcept(token, { messages: msgs, session_id: sessionId });
      setConcept(res.concept);
      await api.saveConcept(token, res.session_id, res.concept);
      // Interview is effectively done once a concept exists.
      store.setGuidedProject(false);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setGenerating(false); }
  }

  /**
   * Apply a small change to the concept and persist it.
   *
   * Used by the card controls (hide / pin). The choice lives inside the concept
   * blob, which `db_save_concept` already stores as JSONB — so it survives a reload
   * without a schema change. Optimistic: the UI updates immediately and a failed
   * save just means the preference doesn't outlive the session, which is a better
   * trade than blocking the click on a round-trip.
   */
  function patchConcept(patch: Partial<ConceptData>) {
    if (!concept) return;
    const next = { ...concept, ...patch };
    setConcept(next);
    if (!token || !sessionId || store.demoActive) return;

    // Coalesce writes. Every tick used to POST the entire concept blob, so ticking
    // off a dozen measures fired a dozen full-size requests that could also land out
    // of order. The UI already updated above, so the delay costs nothing visible.
    saveRef.current = { token, sessionId, concept: next };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushConceptSave, 700);
  }

  /** Persist whatever the latest pending concept is. Last write wins. */
  function flushConceptSave() {
    saveTimer.current = null;
    const pending = saveRef.current;
    saveRef.current = null;
    if (!pending) return;
    api.saveConcept(pending.token, pending.sessionId, pending.concept).catch(() => {});
  }

  // A debounced save must not be lost by leaving the page — flush it on unmount.
  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      flushConceptSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feed the right-side assistant with the concept currently on screen.
  useEffect(() => {
    if (!concept) return;
    const parts: string[] = [];
    if (concept.title) parts.push(`Titel: ${concept.title}`);
    if (concept.now?.summary) parts.push(`Ist-Zustand: ${concept.now.summary}`);
    if (concept.goal?.summary) parts.push(`Ziel-Zustand: ${concept.goal.summary}`);
    (concept.goal?.table ?? []).forEach(r => parts.push(`Ziel: ${r.ziel} — Tooling: ${r.tooling}`));
    store.setLeftContext(`Transformation Concept, das der Nutzer gerade ansieht:\n${parts.join("\n")}`.slice(0, 2000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept]);

  const steps    = concept?.transformation_steps ?? [];
  const stories  = concept?.user_stories ?? [];
  const bv       = concept?.business_value_summary ?? {};
  const now       = concept?.now ?? {};
  const goal      = concept?.goal ?? {};
  const pains     = now.pain_points ?? [];
  const outcomes  = goal.outcomes ?? [];
  const goalTable = goal.table ?? [];
  const measures  = concept?.recommended_measures ?? [];
  const cards     = concept?.cards ?? [];

  const kpiItems = KPI_META
    .map(m => ({ ...m, val: (bv as Record<string, string | undefined>)[m.key] }))
    .filter(k => k.val);

  // Chart data derived from the concept's own text (empty blocks are hidden).

  const hasMessages = store.messages.length > 0;
  // All conversations (project chats included) can carry a concept.
  const loose = store.history;

  if (loading || !token) return (
    <div className="flex bg-white" style={{ height: "100vh" }}>
      <div className="w-60 border-r border-zinc-200 shrink-0" />
      <div className="flex-1 flex items-center justify-center">
        <div className="thinking-spinner" style={{ width: 28, height: 28 }} />
      </div>
    </div>
  );

  return (
    <AppShell active="concept">
      <div className="flex-1 flex flex-col relative min-h-0" style={{ overflow: "hidden" }}>
        {/* Generating overlay */}
        <AnimatePresence>{generating && <GeneratingOverlay />}</AnimatePresence>

        {/* Page toolbar (page-specific actions live here) */}
        <div className="no-print flex items-center gap-2.5 px-4 md:px-6 h-12 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900">
          {/* Back to chat */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/chat")}
            title="Zurück zum Chat"
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Zurück</span>
          </motion.button>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate flex items-center gap-2">
              {concept?.title || (hasMessages ? store.sessionTitle : "Transformation Concept")}
              {store.demoActive && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900 rounded px-1.5 py-0.5">Beispiel</span>
              )}
            </p>
            {concept && (
              <p className="text-xs text-zinc-400">{steps.length} Maßnahmen · {stories.length} User Stories</p>
            )}
          </div>

          {/* Regenerate — the only way to replace a concept that was saved before
              a backend change, so it must stay reachable whenever one exists. */}
          {concept && !store.demoActive && !!sessionId && (
            confirmRegen ? (
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:inline text-xs text-zinc-500">Bestehendes Concept überschreiben?</span>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setConfirmRegen(false); generate(); }}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 transition-colors duration-150 rounded-lg px-3 py-1.5 shadow-sm shadow-green-600/20"
                >
                  <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Ja, neu generieren
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setConfirmRegen(false)}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150"
                >
                  Abbrechen
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setConfirmRegen(true)}
                disabled={generating}
                title="Concept mit dem aktuellen Stand neu erstellen"
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150 disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Neu generieren</span>
              </motion.button>
            )
          )}

          {concept && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150"
            >
              <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
              PDF
            </motion.button>
          )}

          {hasMessages && !concept && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 transition-colors duration-150 rounded-lg px-3.5 py-1.5 shadow-sm shadow-green-600/20"
            >
              <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
              Generieren
            </motion.button>
          )}
        </div>

        {/* Content */}
        <div className="print-area flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-10 pb-20">

            {/* Page header */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0 }}
              className="mb-8 pb-7 border-b border-zinc-100"
            >
              <p className="text-xs tracking-widest text-zinc-400 uppercase mb-3">Transformation Concept</p>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                {concept?.title || "Noch kein Concept generiert"}
              </h1>
            </motion.div>

            {/* ── Loading skeleton ─────────────────────────────────────────── */}
            {conceptLoading && !concept && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-4">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="bg-white border border-zinc-100 rounded-xl p-6">
                      <Skeleton className="h-3 w-20 mb-4" />
                      <Skeleton className="h-7 w-28 mb-2" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-zinc-100 rounded-xl p-6">
                  <Skeleton className="h-4 w-32 mb-4" />
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-4/5 mb-2" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            )}

            {/* ── No session: show history to pick ───────────────────────── */}
            {!concept && !conceptLoading && !hasMessages && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0.05, delay: 0.05 }}
              >
                {loose.length > 0 ? (
                  <>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">
                      Konversation auswählen
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {loose.map((s, i) => (
                        <motion.button
                          key={s.session_id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", duration: 0.4, bounce: 0.05, delay: i * 0.04 }}
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => selectSession(s.session_id)}
                          className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-zinc-200 bg-white hover:border-green-200 hover:bg-green-50/30 hover:shadow-sm transition-all duration-150 text-left group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center flex-shrink-0 group-hover:border-green-200 group-hover:bg-green-50 transition-colors duration-150">
                            <MessageSquare className="w-4 h-4 text-zinc-400 group-hover:text-green-600 transition-colors duration-150" strokeWidth={1.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 truncate mb-0.5">
                              {s.title || "Untitled Konversation"}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {s.message_count} Nachrichten · {dateStr(s.saved_at)}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-green-500 transition-colors duration-150 flex-shrink-0" strokeWidth={1.5} />
                        </motion.button>
                      ))}
                    </div>
                    <div className="mt-6 pt-5 border-t border-zinc-100 text-center">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        whileHover={{ y: -1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        onClick={() => router.push("/chat")}
                        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
                      >
                        <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                        Oder neuen Chat starten
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm px-10 py-16 text-center relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none"
                      style={{ background: "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(22,163,74,0.04), transparent)" }} />
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                      className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto mb-6">
                      <MessageSquare className="w-6 h-6 text-zinc-400" strokeWidth={1.5} />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-zinc-900 mb-2">Erst mit dem Agenten chatten</h3>
                    <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-8 leading-relaxed">
                      Starte ein Gespräch mit dem Agenten. Die KI erstellt dann hier ein strukturiertes Transformation Concept.
                    </p>
                    <motion.button whileTap={{ scale: 0.95 }} whileHover={{ y: -1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      onClick={() => router.push("/chat")}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 transition-colors duration-150 rounded-xl px-6 py-3 shadow-md">
                      <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                      Chat öffnen
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Has session, no concept yet ──────────────────────────────── */}
            {!concept && !conceptLoading && hasMessages && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0.05, delay: 0.05 }}
                className="rounded-2xl border border-zinc-200 bg-white shadow-sm px-10 py-16 text-center relative overflow-hidden"
              >
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(22,163,74,0.04), transparent)" }} />
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto mb-6">
                  <Zap className="w-6 h-6 text-zinc-400" strokeWidth={1.5} />
                </motion.div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">Concept generieren</h3>
                <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-8 leading-relaxed">
                  Die KI analysiert deine Konversation und erstellt ein strukturiertes Transformation Concept mit Business Value, Maßnahmen und User Stories.
                </p>
                {error && (
                  <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 mb-5 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 inline-block">
                    {error}
                  </motion.p>
                )}
                <motion.button
                  whileTap={{ scale: 0.95 }} whileHover={{ y: -1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  onClick={generate}
                  disabled={generating}
                  className="inline-flex items-center gap-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 transition-colors duration-150 rounded-xl px-7 py-3.5 shadow-md shadow-green-600/20"
                >
                  <Zap className="w-4 h-4" strokeWidth={1.5} />
                  Concept generieren
                </motion.button>
                <div className="mt-10 grid grid-cols-3 gap-4 max-w-xs mx-auto">
                  {[
                    { icon: Clock,        label: "Business Value", sub: "ROI & Zeit" },
                    { icon: Zap,          label: "Maßnahmen",      sub: "Aktionsplan" },
                    { icon: CheckCircle2, label: "User Stories",   sub: "Für dein Team" },
                  ].map(({ icon: Icon, label, sub }) => (
                    <div key={label} className="flex flex-col items-center text-center gap-1.5">
                      <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                      </div>
                      <p className="text-xs font-semibold text-zinc-700">{label}</p>
                      <p className="text-xs text-zinc-400">{sub}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Concept content ──────────────────────────────────────────── */}
            {/* gap-8: at gap-5 the sections ran together and the page read as one
                dense block. Sections need to be visibly separate to be scannable. */}
            {concept && (
              <div className="flex flex-col gap-8">

                {/* The prose-parsed VORHER/NACHHER block used to sit here. It read
                    "von X auf Y" out of sentences and normalised time units, so it
                    compared different periods as if they were the same thing and
                    rendered "Nachher" green whatever the direction — one concept
                    claimed effort improving from 160h to 1200h. The cards section
                    already carries BeforeAfterBar with explicit, validated
                    before_value/after_value/unit fields. Two sources for the same
                    number meant one of them could lie; the guessed one is gone. */}

                {/* Ziel-Zustand FIRST — as a table: Ziel | Bestes Tooling | Alternativen */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0 }}
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-[0_2px_8px_-3px_rgba(16,40,22,0.08),0_16px_36px_-20px_rgba(16,40,22,0.16)] overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-green-50 dark:bg-green-950/60 flex items-center justify-center ring-1 ring-green-100 dark:ring-green-900 shrink-0">
                      <Zap className="w-4 h-4 text-green-600" strokeWidth={1.6} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none">Ziel-Zustand</h2>
                      {goal.summary && <p className="text-xs text-zinc-400 truncate mt-1">{goal.summary}</p>}
                    </div>
                    {goalTable.length > 0 && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-2.5 py-1 rounded-full tabular-nums">
                        {goalTable.length} Ziele
                      </span>
                    )}
                  </div>
                  {goalTable.length > 0 ? (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {goalTable.map((row, i) => (
                        <div key={i} className="group/row relative flex gap-4 px-6 py-4 hover:bg-green-50/40 dark:hover:bg-green-950/20 transition-colors duration-150">
                          <div className="shrink-0 w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold flex items-center justify-center tabular-nums mt-0.5 transition-colors duration-150 group-hover/row:bg-green-600 group-hover/row:text-white">
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <div className="flex-1 min-w-0 grid md:grid-cols-[1.05fr_1fr_1fr] gap-x-6 gap-y-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Ziel</p>
                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">{row.ziel}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Empfohlenes Tooling</p>
                              <span className="inline-flex items-start gap-1.5 text-sm text-zinc-700 dark:text-zinc-200 font-medium leading-snug">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" strokeWidth={2} />
                                {row.tooling}
                              </span>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Alternativen</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(row.alternativen ?? []).map((a, j) => (
                                  <span key={j} className="text-[11.5px] text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-md px-2 py-0.5 leading-relaxed">{a}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <button onClick={() => store.startEdit("concept", `Ziel: ${row.ziel}`)}
                            title="Mit dem Assistenten bearbeiten"
                            className="opacity-0 group-hover/row:opacity-100 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40 transition-all self-start mt-0.5">
                            <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="px-6 py-4 space-y-2.5">
                      {outcomes.map((o, i) => (
                        <li key={i} className="flex gap-2.5 items-start text-sm text-zinc-700 dark:text-zinc-300 leading-snug">
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" strokeWidth={2} />
                          {o}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>

                {/* Ist-Zustand as a compact table */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0, delay: 0.06 }}
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-[0_2px_8px_-3px_rgba(16,40,22,0.08),0_16px_36px_-20px_rgba(16,40,22,0.16)] overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center ring-1 ring-amber-100 dark:ring-amber-900/60 shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500" strokeWidth={1.6} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none">Ist-Zustand</h2>
                      <p className="text-xs text-zinc-400 truncate mt-1">{now.summary || "Aktuelle Schwachpunkte"}</p>
                    </div>
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {pains.map((p, i) => (
                      <div key={i} className="group/row flex gap-3.5 px-6 py-3.5 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors duration-150">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" strokeWidth={1.7} />
                        <span className="flex-1 min-w-0 text-sm text-zinc-700 dark:text-zinc-300 leading-snug">{p}</span>
                        <button onClick={() => store.startEdit("concept", `Ist-Zustand: ${p.slice(0, 40)}`)}
                          title="Mit dem Assistenten bearbeiten"
                          className="opacity-0 group-hover/row:opacity-100 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40 transition-all self-start">
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Empfohlene Maßnahmen — two separate sections rather than one
                    card with four tabbed views of the same data. Each renders only
                    when the backend supplies measures, so an older concept simply
                    shows nothing here. */}
                <MeasurePriorityBoard
                  measures={measures}
                  lensSummary={concept?.measures_lens_summary}
                  state={concept?.measure_state}
                  onStateChange={next => patchConcept({ measure_state: next })}
                />
                <MeasureSequence
                  measures={measures}
                  state={concept?.measure_state}
                  onStateChange={next => patchConcept({ measure_state: next })}
                />

                {/* Result cards, chosen per concept. Older concepts have no
                    `cards`, so they keep rendering the three static KPI tiles. */}
                {cards.length > 0 ? (
                  <ConceptCardsSection
                    cards={cards}
                    hidden={concept?.cards_hidden ?? []}
                    pinned={concept?.cards_pinned ?? null}
                    checked={concept?.card_state?.checked ?? {}}
                    onHiddenChange={next => patchConcept({ cards_hidden: next })}
                    onPinnedChange={next => patchConcept({ cards_pinned: next })}
                    onCheckedChange={next => patchConcept({ card_state: { ...concept?.card_state, checked: next } })}
                  />
                ) : kpiItems.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {kpiItems.map(({ label, val, sub, Icon }, i) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.08, delay: i * 0.08 }}
                        whileHover={{ y: -2 }}
                        className="bg-white border border-zinc-200 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200 cursor-default"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs tracking-widest text-zinc-500 uppercase">{label}</p>
                          <Icon className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                        </div>
                        <p className="text-2xl font-bold text-zinc-900 tracking-tight leading-none mb-1.5 break-words">{val}</p>
                        <p className="text-xs text-zinc-400">{sub}</p>
                      </motion.div>
                    ))}
                  </div>
                )}


                {steps.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", duration: 0.5, bounce: 0, delay: 0.2 }}
                    className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                      <h2 className="text-base font-semibold text-zinc-900">Transformationsschritte</h2>
                      <span className="text-xs text-zinc-400">{steps.length} Maßnahmen</span>
                    </div>
                    {steps.map((s, i) => (
                      <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: 0.22 + i * 0.06 }}
                        className={i < steps.length - 1 ? "border-b border-zinc-100" : ""}>
                        <motion.button
                          whileTap={{ scale: 0.99 }}
                          className="w-full text-left px-6 py-5 flex gap-4 items-start hover:bg-zinc-50/70 transition-colors duration-150"
                          onClick={() => setOpenStep(openStep === i ? null : i)}
                        >
                          <motion.div whileHover={{ scale: 1.05 }}
                            className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">
                            {i + 1}
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-zinc-900">{s.title}</span>
                              {s.effort && <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 font-mono">{s.effort}</span>}
                            </div>
                            {s.business_value && <p className="text-xs text-green-600 font-medium">{s.business_value}</p>}
                          </div>
                          <motion.span
                            animate={{ rotate: openStep === i ? 90 : 0 }}
                            transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
                            className="text-zinc-300 mt-0.5 flex-shrink-0"
                          >
                            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                          </motion.span>
                        </motion.button>
                        <AnimatePresence initial={false}>
                          {openStep === i && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ type: "spring", duration: 0.4, bounce: 0.05 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-5 pt-1 ml-11">
                                {s.description && <p className="text-sm leading-relaxed text-zinc-600 mb-3">{s.description}</p>}
                                {s.implementation_ideas?.length ? (
                                  <div className="flex flex-wrap gap-2">
                                    {s.implementation_ideas.map((idea, j) => (
                                      <motion.span key={j}
                                        initial={{ opacity: 0, scale: 0.92 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: j * 0.04, type: "spring", duration: 0.3 }}
                                        className="text-xs px-2.5 py-1 rounded-md bg-zinc-50 border border-zinc-200 text-zinc-500">
                                        {idea}
                                      </motion.span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {stories.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", duration: 0.5, bounce: 0, delay: 0.28 }}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-[0_2px_8px_-3px_rgba(16,40,22,0.08),0_16px_36px_-20px_rgba(16,40,22,0.16)] overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-green-50 dark:bg-green-950/60 flex items-center justify-center ring-1 ring-green-100 dark:ring-green-900 shrink-0">
                        <FileText className="w-4 h-4 text-green-600" strokeWidth={1.6} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none">User Stories</h2>
                        <p className="text-xs text-zinc-400 mt-1">Reihenfolge — in dieser Folge umsetzen</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-2.5 py-1 rounded-full tabular-nums">
                        {stories.length} Stories
                      </span>
                    </div>
                    <div className="p-5 grid sm:grid-cols-2 gap-4">
                      {stories.map((s, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + i * 0.05, type: "spring", duration: 0.4, bounce: 0 }}
                          className="group/card relative flex flex-col rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 hover:border-green-300 dark:hover:border-green-800 hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex items-center gap-2.5 mb-2">
                            <span className="shrink-0 w-6 h-6 rounded-md bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-700 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-center tabular-nums">
                              {i + 1}
                            </span>
                            <p className="flex-1 min-w-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">{s.title}</p>
                            {s.size && (
                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-700 px-2 py-0.5 rounded-full" title="Aufwand">
                                {s.size}
                              </span>
                            )}
                          </div>
                          {s.story && <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400 mb-3">{s.story}</p>}
                          {s.acceptance_criteria && (
                            <p className="mt-auto text-xs text-green-700 dark:text-green-400 font-medium flex items-start gap-1.5 border-t border-zinc-200/70 dark:border-zinc-800 pt-2.5">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2} />
                              {s.acceptance_criteria}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function ConceptPage() {
  return (
    <Suspense fallback={
      <div className="flex bg-white" style={{ height: "100vh" }}>
        <div className="w-60 border-r border-zinc-200 shrink-0" />
        <div className="flex-1 flex items-center justify-center">
          <div className="thinking-spinner" style={{ width: 28, height: 28 }} />
        </div>
      </div>
    }>
      <ConceptContent />
    </Suspense>
  );
}
