"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat-store";
import type { RecommendedMeasure, MeasureCategory } from "@/lib/api";
import {
  Crosshair, GitBranch, ArrowRight, Check, Circle, CornerUpRight, Info,
  Wrench, Users, TrendingUp, ShieldCheck,
} from "lucide-react";

/*
 * Empfohlene Maßnahmen — a board you work with, not a picture you look at.
 *
 * History, because each change fixed something concrete:
 *  - It started as four tabbed views (bento / scatter / graph / radar). The scatter
 *    plotted numbered dots with the names in a side list, so reading it meant
 *    mapping ten numbers by eye, and dots overlapped because impact × effort has
 *    only 12 positions. Measures now sit in their quadrant AS THEIR NAME.
 *  - The views were merged into one card; three of them restated each other. Now
 *    two sections answer two different questions: what first, and in what order.
 *  - Quadrants held 6/1/2/1 measures, and a quadrant with one entry is useless. The
 *    generator now produces 12 measures with at least 3 per quadrant.
 *  - Nothing could be DONE with any of it. Every measure now ticks off, feeding a
 *    real progress bar, and can be moved to another quadrant when the reader
 *    disagrees with the AI's call. Both persist in the concept.
 *
 * Colour always means category.
 */

const CATS: Record<MeasureCategory, { label: string; color: string; Icon: React.ElementType }> = {
  tooling:  { label: "Tooling",  color: "var(--cat-tooling)",  Icon: Wrench },
  agile:    { label: "Agile",    color: "var(--cat-agile)",    Icon: Users },
  business: { label: "Business", color: "var(--cat-business)", Icon: TrendingUp },
  security: { label: "Security", color: "var(--cat-security)", Icon: ShieldCheck },
};
const CAT_KEYS = Object.keys(CATS) as MeasureCategory[];

const IMPACT_ORDER = { Low: 0, Medium: 1, High: 2 } as const;
const EFFORT_ORDER = { S: 0, M: 1, L: 2, XL: 3 } as const;

const cat = (m: RecommendedMeasure) => CATS[m.category] ?? CATS.tooling;
const impactIdx = (m: RecommendedMeasure) => IMPACT_ORDER[m.impact ?? "Medium"] ?? 1;
const effortIdx = (m: RecommendedMeasure) => EFFORT_ORDER[m.effort ?? "M"] ?? 1;

export type QuadId = "quick" | "bets" | "side" | "later";

// Impact has three levels but a 2×2 has two rows, so the bottom row holds
// everything below High. It must NOT read "wenig Wirkung": the generator is required
// to produce a spread, so Medium is the middle of the range — calling a Medium
// measure low-impact would be plainly wrong.
const QUADS: { id: QuadId; label: string; hint: string; lead?: boolean }[] = [
  { id: "quick", label: "Quick Wins",        hint: "hohe Wirkung · wenig Aufwand", lead: true },
  { id: "bets",  label: "Große Wetten",      hint: "hohe Wirkung · hoher Aufwand" },
  { id: "side",  label: "Einfach mitnehmen", hint: "moderate Wirkung · wenig Aufwand" },
  { id: "later", label: "Später prüfen",     hint: "moderate Wirkung · hoher Aufwand" },
];

const autoQuad = (m: RecommendedMeasure): QuadId => {
  const high = impactIdx(m) >= 2;
  const cheap = effortIdx(m) <= 1;
  return high ? (cheap ? "quick" : "bets") : cheap ? "side" : "later";
};

/** Collapse near-duplicate consultant lenses — one run emitted "Compliance &
 *  Datenschutz", "Datenschutz & Compliance" AND "DSGVO Compliance", so the line ran
 *  to eight entries and truncated mid-word. Concepts saved before the backend fix
 *  still carry the long list, so the UI cleans it too. */
function tidyLenses(lenses: string[]): string[] {
  const best = new Map<string, string>();
  for (const raw of lenses) {
    const lens = raw.trim();
    if (!lens) continue;
    const key = (lens.toLowerCase().match(/\w+/g) ?? [])
      .filter(w => w !== "und" && w !== "and").sort().join(" ");
    if (!key) continue;
    const prev = best.get(key);
    if (!prev || lens.length > prev.length) best.set(key, lens);
  }
  return [...best.values()].sort().slice(0, 5);
}

// ── shell ─────────────────────────────────────────────────────────────────────

function Section({
  title, hint, Icon, right, children,
}: {
  title: string; hint: string; Icon: React.ElementType;
  right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.5, bounce: 0 }}
      className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-[0_2px_8px_-3px_rgba(16,40,22,0.08),0_16px_36px_-20px_rgba(16,40,22,0.16)] overflow-hidden"
    >
      <div className="px-6 pt-5 pb-4 flex items-start gap-3 flex-wrap">
        <div className="w-8 h-8 rounded-xl bg-green-50 dark:bg-green-950/60 flex items-center justify-center ring-1 ring-green-100 dark:ring-green-900 shrink-0">
          <Icon className="w-4 h-4 text-green-600" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none">{title}</h2>
          <p className="text-xs text-zinc-400 mt-1.5">{hint}</p>
        </div>
        {right}
      </div>
      <div className="px-6 pb-6">{children}</div>
    </motion.section>
  );
}

/** Real progress, driven by what the reader actually ticked off. The concept used
 *  to carry a "Implementierungsfortschritt" card stuck at 0 % because nothing in the
 *  app ever moved it. */
function ProgressHeader({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="min-w-[168px]">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          {done} von {total} erledigt
        </span>
        <span className="text-[13px] font-bold tabular-nums text-green-700 dark:text-green-400">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-600"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CategoryStrip({ measures }: { measures: RecommendedMeasure[] }) {
  const counts = CAT_KEYS.map(k => ({ k, n: measures.filter(m => m.category === k).length }))
    .filter(c => c.n > 0);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {counts.map(({ k, n }) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-[10.5px] text-zinc-500 dark:text-zinc-400">
          <i className="w-1.5 h-1.5 rounded-full" style={{ background: CATS[k].color }} />
          {CATS[k].label}
          <b className="font-bold text-zinc-700 dark:text-zinc-200 tabular-nums">{n}</b>
        </span>
      ))}
    </div>
  );
}

function EffortTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9.5px] font-bold tabular-nums text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700 rounded px-1 py-px shrink-0">
      {children}
    </span>
  );
}

/**
 * One measure: tick it off on the left, open it by its title.
 *
 * Two separate hit areas on purpose — ticking something off and reading about it are
 * different intents, and a single click target would make one of them accidental.
 */
function MeasureRow({
  m, selected, done, tag, onSelect, onToggleDone,
}: {
  m: RecommendedMeasure; selected: boolean; done: boolean;
  /** Shown only in the merged band, where the row's group is no longer in the header. */
  tag?: string;
  onSelect: () => void; onToggleDone: () => void;
}) {
  const c = cat(m);
  return (
    <div
      className={cn(
        "flex items-start gap-1 rounded-lg border bg-white dark:bg-zinc-900 transition-colors duration-150",
        selected
          ? "border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/60"
          : "border-zinc-200/70 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
      )}
    >
      <button
        type="button"
        onClick={onToggleDone}
        aria-pressed={done}
        aria-label={done ? `${m.title} als offen markieren` : `${m.title} als erledigt markieren`}
        className="shrink-0 pl-2.5 pr-1 py-2.5"
      >
        {done
          ? <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={2.6} />
          : <Circle className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 hover:text-zinc-400" strokeWidth={2} />}
      </button>
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        className="min-w-0 flex-1 text-left flex items-start gap-2 pr-2 py-2"
      >
        <i className="w-1.5 h-1.5 rounded-full shrink-0 mt-[5px]" style={{ background: c.color }} />
        <span className={cn(
          "min-w-0 flex-1 text-[11.5px] font-medium leading-snug",
          done ? "text-zinc-400 line-through" : "text-zinc-800 dark:text-zinc-200"
        )}>
          {m.title}
        </span>
        {tag ? (
          <span className="text-[9.5px] font-medium text-zinc-400 dark:text-zinc-500 whitespace-nowrap shrink-0">
            {tag}
          </span>
        ) : null}
        {m.effort ? <EffortTag>{m.effort}</EffortTag> : null}
      </button>
    </div>
  );
}

/** Detail plus the controls to move a measure the reader thinks is misfiled. */
function MeasureDetail({
  m, all, quad, onMove,
}: {
  m: RecommendedMeasure; all: RecommendedMeasure[];
  quad: QuadId; onMove: (q: QuadId) => void;
}) {
  const pushAssistant = useChatStore(s => s.pushAssistant);
  const setAssistantOpenMobile = useChatStore(s => s.setAssistantOpenMobile);
  const c = cat(m);
  const deps = (m.depends_on ?? [])
    .map(id => all.find(x => x.id === id)?.title)
    .filter(Boolean) as string[];
  return (
    <motion.div
      key={m.id}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="overflow-hidden"
    >
      <div className="mt-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 p-4">
        <div className="flex items-start gap-2.5">
          <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: c.color }} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-50 leading-snug">{m.title}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10.5px] text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <i className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />{c.label}
              </span>
              <span>Wirkung <b className="font-bold text-zinc-700 dark:text-zinc-200">{m.impact ?? "—"}</b></span>
              <span>Aufwand <b className="font-bold text-zinc-700 dark:text-zinc-200">{m.effort ?? "—"}</b></span>
              {m.lens ? <span className="text-zinc-400">{m.lens}</span> : null}
            </div>
            {m.description ? (
              <p className="text-[12px] text-zinc-600 dark:text-zinc-300 leading-relaxed mt-2.5">{m.description}</p>
            ) : null}
            {deps.length ? (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
                Setzt voraus: <span className="text-zinc-700 dark:text-zinc-200">{deps.join(" · ")}</span>
              </p>
            ) : null}

            {/* Same hand-off as the cards: the assistant gets the measure and can be
                asked why it matters, what it costs, what it depends on. */}
            <button
              type="button"
              onClick={() => {
                pushAssistant({
                  quote: [
                    `Maßnahme: „${m.title}"`,
                    `Kategorie: ${c.label} · Wirkung: ${m.impact ?? "—"} · Aufwand: ${m.effort ?? "—"}`,
                    m.lens ? `Perspektive: ${m.lens}` : "",
                    m.description ? `Beschreibung: ${m.description}` : "",
                    deps.length ? `Setzt voraus: ${deps.join(", ")}` : "",
                  ].filter(Boolean).join("\n"),
                  question:
                    "Erkläre mir diese Maßnahme im Detail: warum lohnt sie sich für diesen " +
                    "Kunden, was steckt an Aufwand dahinter, welche Risiken gibt es und " +
                    "welche Alternativen wären denkbar?",
                });
                setAssistantOpenMobile(true);
              }}
              className="no-print inline-flex items-center gap-1.5 mt-3.5 text-[10.5px] font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-300 transition-colors duration-150"
            >
              <Info className="w-3 h-3" strokeWidth={1.8} />
              Im Assistenten erklären lassen
            </button>

            <div className="flex flex-wrap items-center gap-1.5 mt-3 no-print">
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 mr-0.5">
                <CornerUpRight className="w-3 h-3" strokeWidth={1.8} />
                Verschieben nach
              </span>
              {QUADS.filter(q => q.id !== quad).map(q => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onMove(q.id)}
                  className="text-[10.5px] font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-300 transition-colors duration-150"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── 1. Priorisierung ──────────────────────────────────────────────────────────

export function MeasurePriorityBoard({
  measures, lensSummary, state, onStateChange,
}: {
  measures: RecommendedMeasure[];
  lensSummary?: string[];
  state?: { done?: string[]; quadrant?: Record<string, string> };
  onStateChange?: (next: { done: string[]; quadrant: Record<string, string> }) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);

  const done = state?.done ?? [];
  const overrides = state?.quadrant ?? {};
  const quadOf = (m: RecommendedMeasure): QuadId =>
    (overrides[m.id] as QuadId) ?? autoQuad(m);

  const byQuad = useMemo(() => {
    const g: Record<QuadId, RecommendedMeasure[]> = { quick: [], bets: [], side: [], later: [] };
    [...measures]
      .sort((a, b) => impactIdx(b) - impactIdx(a) || effortIdx(a) - effortIdx(b))
      .forEach(m => g[quadOf(m)].push(m));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measures, overrides]);

  /*
   * A group earns its own band only if it has enough measures to look like a group.
   * Below this, it is folded into "Weitere Maßnahmen" — the alternative was an
   * almost-empty box, which is what the fixed 2×2 kept producing.
   */
  const MIN_GROUP = 3;
  const bands = useMemo(() => {
    type Item = { m: RecommendedMeasure; tag?: string };
    const out: { id: string; label: string; hint: string; lead?: boolean; items: Item[] }[] = [];
    const leftovers: Item[] = [];

    for (const q of QUADS) {
      const list = byQuad[q.id];
      if (!list.length) continue;                       // nothing to show, no box
      if (list.length < MIN_GROUP) {
        // Keep the quadrant visible as a chip so the judgement isn't lost.
        leftovers.push(...list.map(m => ({ m, tag: q.label })));
        continue;
      }
      out.push({ id: q.id, label: q.label, hint: q.hint, lead: q.lead, items: list.map(m => ({ m })) });
    }
    if (leftovers.length) {
      out.push({
        id: "rest",
        label: "Weitere Maßnahmen",
        hint: "einzelne Posten, nach Einordnung markiert",
        items: leftovers,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byQuad]);

  const lenses = useMemo(() => tidyLenses(lensSummary ?? []), [lensSummary]);

  if (!measures.length) return null;
  const selected = measures.find(m => m.id === sel) ?? null;

  const commit = (patch: { done?: string[]; quadrant?: Record<string, string> }) =>
    onStateChange?.({ done, quadrant: overrides, ...patch });

  const toggleDone = (id: string) =>
    commit({ done: done.includes(id) ? done.filter(d => d !== id) : [...done, id] });

  const move = (id: string, q: QuadId) => commit({ quadrant: { ...overrides, [id]: q } });

  return (
    <Section
      title="Empfohlene Maßnahmen"
      hint="Nach Wirkung und Aufwand einsortiert — abhaken, was erledigt ist, oder verschieben, wo du es anders siehst"
      Icon={Crosshair}
      right={<ProgressHeader done={done.length} total={measures.length} />}
    >
      <div className="mb-3.5">
        <CategoryStrip measures={measures} />
      </div>

      {/*
        Bands, not a fixed 2×2.
        A real project doesn't spread evenly across four quadrants — a two-week game
        MVP genuinely has no "high impact, high effort" work — so the grid rendered an
        empty box beside a box holding one item. Groups with fewer than MIN_GROUP
        measures are folded into one "Weitere Maßnahmen" band (nothing is dropped,
        each keeps its quadrant as a chip), empty groups aren't rendered, and a band
        is only as tall as its contents, so there is no hole to look at.
      */}
      <div className="flex flex-col gap-3">
        {bands.map(band => {
          const bDone = band.items.filter(x => done.includes(x.m.id)).length;
          return (
            <div
              key={band.id}
              className={cn(
                "rounded-xl border p-3.5",
                band.lead
                  ? "border-green-200/80 dark:border-green-900/60 bg-green-50/40 dark:bg-green-950/20"
                  : "border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/20"
              )}
            >
              <div className="flex items-baseline justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <p className={cn(
                    "text-[11px] font-bold uppercase tracking-wider",
                    band.lead ? "text-green-700 dark:text-green-400" : "text-zinc-500 dark:text-zinc-400"
                  )}>
                    {band.label}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{band.hint}</p>
                </div>
                <span className="text-[11px] font-bold tabular-nums text-zinc-400 shrink-0">
                  {bDone > 0 ? `${bDone}/${band.items.length}` : band.items.length}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                {band.items.map(({ m, tag }) => (
                  <MeasureRow
                    key={m.id}
                    m={m}
                    tag={tag}
                    done={done.includes(m.id)}
                    selected={sel === m.id}
                    onSelect={() => setSel(sel === m.id ? null : m.id)}
                    onToggleDone={() => toggleDone(m.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {selected && (
          <MeasureDetail
            m={selected}
            all={measures}
            quad={quadOf(selected)}
            onMove={q => move(selected.id, q)}
          />
        )}
      </AnimatePresence>

      {lenses.length ? (
        <p className="text-[11px] text-zinc-400 mt-4 leading-relaxed">
          Perspektiven: <span className="text-zinc-500 dark:text-zinc-400">{lenses.join(" · ")}</span>
        </p>
      ) : null}
    </Section>
  );
}

// ── 2. Reihenfolge ────────────────────────────────────────────────────────────

/**
 * Order as horizontal stages.
 *
 * Columns were wrong twice over: an SVG graph before that truncated every title to
 * ~28 characters, then four narrow columns that wrapped "100–200 Items mit
 * Metadata-Schema strukturieren" over four lines and left a stage holding one
 * measure looking broken next to a stage holding four. Rows give every title the
 * full width and a short stage simply reads as a short row.
 *
 * Stages are NOT movable by hand, unlike the quadrants: a quadrant is a judgement
 * call the reader may disagree with, but a stage follows from `depends_on` — moving
 * a measure ahead of its prerequisite would state something untrue.
 */
export function MeasureSequence({
  measures, state, onStateChange,
}: {
  measures: RecommendedMeasure[];
  state?: { done?: string[]; quadrant?: Record<string, string> };
  onStateChange?: (next: { done: string[]; quadrant: Record<string, string> }) => void;
}) {
  const done = state?.done ?? [];
  const stages = useMemo(() => {
    const byId = new Map(measures.map(m => [m.id, m]));
    const depth = new Map<string, number>();
    const resolve = (id: string, seen: Set<string>): number => {
      if (depth.has(id)) return depth.get(id)!;
      if (seen.has(id)) return 0;                       // cycle guard
      seen.add(id);
      const deps = (byId.get(id)?.depends_on ?? []).filter(d => byId.has(d) && d !== id);
      const v = deps.length ? Math.max(...deps.map(d => resolve(d, seen))) + 1 : 0;
      depth.set(id, v);
      return v;
    };
    measures.forEach(m => resolve(m.id, new Set()));
    const max = Math.max(0, ...depth.values());
    const out: RecommendedMeasure[][] = Array.from({ length: max + 1 }, () => []);
    measures.forEach(m => out[depth.get(m.id) ?? 0].push(m));
    return out.filter(s => s.length);
  }, [measures]);

  if (!measures.length) return null;

  const toggleDone = (id: string) =>
    onStateChange?.({
      done: done.includes(id) ? done.filter(d => d !== id) : [...done, id],
      quadrant: state?.quadrant ?? {},
    });

  if (stages.length < 2) {
    return (
      <Section title="Reihenfolge" hint="Was baut auf was auf" Icon={GitBranch}>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
          Diese Maßnahmen sind unabhängig voneinander — die Reihenfolge kannst du frei nach
          Priorisierung wählen.
        </p>
      </Section>
    );
  }

  const NAMES = ["Zuerst möglich", "Danach", "Anschließend", "Zuletzt", "Am Ende"];
  const byId = new Map(measures.map(m => [m.id, m]));

  return (
    <Section
      title="Reihenfolge"
      hint={`${stages.length} Stufen · was zuerst möglich ist und was darauf aufbaut`}
      Icon={GitBranch}
    >
      <div className="flex flex-col gap-2.5">
        {stages.map((stage, si) => (
          <div
            key={si}
            className="rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/20 p-3.5"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-5 h-5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-[10px] font-bold tabular-nums text-zinc-500 shrink-0">
                {si + 1}
              </span>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 min-w-0 flex-1">
                {NAMES[si] ?? `Stufe ${si + 1}`}
              </p>
              {si < stages.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0" strokeWidth={1.8} />
              )}
              <span className="text-[11px] font-bold tabular-nums text-zinc-400 shrink-0">{stage.length}</span>
            </div>

            {/* Two-up on wide screens, one per row on narrow — titles keep their
                full width either way. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
              {stage.map(m => {
                const c = cat(m);
                const isDone = done.includes(m.id);
                const deps = (m.depends_on ?? [])
                  .map(id => byId.get(id)?.title).filter(Boolean) as string[];
                return (
                  <div
                    key={m.id}
                    className="rounded-lg border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => toggleDone(m.id)}
                      aria-pressed={isDone}
                      aria-label={isDone ? `${m.title} als offen markieren` : `${m.title} als erledigt markieren`}
                      className="shrink-0 pl-2.5 pr-1 py-2.5"
                    >
                      {isDone
                        ? <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={2.6} />
                        : <Circle className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600" strokeWidth={2} />}
                    </button>
                    <div className="min-w-0 flex-1 py-2 pr-2">
                      <div className="flex items-start gap-2">
                        <i className="w-1.5 h-1.5 rounded-full shrink-0 mt-[5px]" style={{ background: c.color }} />
                        <p className={cn(
                          "min-w-0 flex-1 text-[11.5px] font-medium leading-snug",
                          isDone ? "text-zinc-400 line-through" : "text-zinc-800 dark:text-zinc-200"
                        )}>
                          {m.title}
                        </p>
                        {m.effort ? <EffortTag>{m.effort}</EffortTag> : null}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 pl-3.5">
                        {c.label} · Wirkung {m.impact ?? "—"}
                        {deps.length ? <> · setzt voraus: {deps.join(", ")}</> : null}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
