"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Circle,
  ShieldAlert, Clock,
} from "lucide-react";

/*
 * The card component families behind the template catalogue.
 *
 * A template is not a component: ~12 components here back 46 templates in
 * src/agent/card_templates.json, and the catalogue can grow to hundreds without
 * touching this file — as long as new templates reuse a `component` listed in
 * COMPONENT_MAP (see card-template-renderer.tsx).
 *
 * Every component takes loosely-typed props on purpose: `data` comes from a model
 * and is validated server-side, so each one renders what it got and stays quiet
 * about what's missing rather than throwing.
 */

// ── shared shell ──────────────────────────────────────────────────────────────
export function CardShell({
  title, hint, children, className, accent,
}: {
  title?: string; hint?: string; children: React.ReactNode; className?: string; accent?: string;
}) {
  return (
    <div className={cn(
      "card-lift relative overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800",
      "bg-white dark:bg-zinc-900 p-4 h-full flex flex-col",
      className
    )}>
      {accent && <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />}
      {(title || hint) && (
        <div className="mb-3">
          {title && <p className="text-[12.5px] font-bold text-zinc-900 dark:text-zinc-100 leading-snug">{title}</p>}
          {hint && <p className="text-[11px] text-zinc-400 mt-0.5">{hint}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v as Record<string, unknown>[] : []);
const str = (v: unknown): string => (v == null ? "" : String(v));

/** Singular for exactly 1 — cards rendered "1 Stunden", which reads as sloppy. */
const SINGULAR: Record<string, string> = {
  Stunden: "Stunde", Tage: "Tage", Wochen: "Woche", Monate: "Monat", Jahre: "Jahr",
  Minuten: "Minute", Sekunden: "Sekunde", Server: "Server", Systeme: "System",
  Dienste: "Dienst", Personen: "Person", Entwickler: "Entwickler",
};
const unitFor = (v: unknown, unit: unknown): string => {
  const u = str(unit);
  return num(v) === 1 ? (SINGULAR[u] ?? u) : u;
};

/**
 * List items that actually have something to say, under `key`.
 *
 * The backend now guarantees this (see ITEM_SHAPES in src/agent/cards.py), but a
 * card whose items carry no text used to render as a column of bare icons or empty
 * circles that still reserved its full height — it read as a broken page. Filtering
 * here too means a stale or hand-edited concept degrades to a shorter card instead.
 */
const filled = (v: unknown, key: string): Record<string, unknown>[] =>
  arr(v).filter(it => str(it[key]).trim().length > 0);

// ── 1. KpiCard ────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, unit, period, trend }: Record<string, unknown>) {
  const t = str(trend).toLowerCase();
  const dir = t.includes("up") || t.includes("steig") ? "up" : t.includes("down") || t.includes("sink") ? "down" : null;
  return (
    <CardShell accent="rgb(22 163 74)">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">{str(label)}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums leading-none tracking-tight">
          {str(value)}
        </span>
        {unit ? <span className="text-sm font-semibold text-zinc-500">{str(unit)}</span> : null}
        {dir && (dir === "up"
          ? <TrendingUp className="w-4 h-4 text-green-600 ml-0.5" strokeWidth={2} />
          : <TrendingDown className="w-4 h-4 text-green-600 ml-0.5" strokeWidth={2} />)}
      </div>
      {period ? <p className="text-[11px] text-zinc-400 mt-1.5">{str(period)}</p> : null}
    </CardShell>
  );
}

// ── 2. BeforeAfterBar ─────────────────────────────────────────────────────────
export function BeforeAfterBar({ label, before_value, after_value, unit }: Record<string, unknown>) {
  const b = num(before_value) ?? 0, a = num(after_value) ?? 0;
  const max = Math.max(b, a, 1);
  const improved = a < b;
  const delta = b > 0 ? Math.round(((b - a) / b) * 100) : 0;
  const rows: [string, number, string][] = [["Vorher", b, "bg-zinc-300 dark:bg-zinc-700"], ["Nachher", a, "bg-green-600"]];
  return (
    <CardShell title={str(label)} hint={delta !== 0 ? `${improved ? "−" : "+"}${Math.abs(delta)}%` : undefined}>
      <div className="flex flex-col gap-2">
        {rows.map(([name, v, color]) => (
          <div key={name} className="flex items-center gap-2.5 group/bar rounded px-1 -mx-1 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors duration-150">
            <span className="w-[52px] shrink-0 text-[11px] text-zinc-500 group-hover/bar:text-zinc-800 dark:group-hover/bar:text-zinc-200 transition-colors duration-150">{name}</span>
            <div className="flex-1 h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className={cn("h-full rounded-full", color)} />
            </div>
            <span className="w-[68px] shrink-0 text-right text-[11.5px] font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
              {v}{unit ? ` ${unitFor(v, unit)}` : ""}
            </span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

// ── 3. RadialGauge ────────────────────────────────────────────────────────────
export function RadialGauge({ label, value, max, unit }: Record<string, unknown>) {
  const v = num(value) ?? 0, m = num(max) ?? 100;
  const pct = Math.max(0, Math.min(100, m > 0 ? (v / m) * 100 : 0));
  const R = 34, C = 2 * Math.PI * R;
  return (
    <CardShell title={str(label)}>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 84 84" className="w-[84px] h-[84px] shrink-0 -rotate-90">
          <circle cx="42" cy="42" r={R} fill="none" strokeWidth="8"
            className="stroke-zinc-100 dark:stroke-zinc-800" />
          <motion.circle cx="42" cy="42" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
            className="stroke-green-600" strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C - (pct / 100) * C }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }} />
        </svg>
        <div>
          <div className="text-[22px] font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50 leading-none">
            {v}{unit ? <span className="text-sm font-semibold text-zinc-500 ml-0.5">{str(unit)}</span> : null}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">von {m}{unit ? ` ${str(unit)}` : ""}</p>
        </div>
      </div>
    </CardShell>
  );
}

// ── 4. ProgressCard ───────────────────────────────────────────────────────────
/**
 * Milestones you tick off, with the bar following along.
 *
 * This used to be a static number: the model filled `current: 0, target: 7` and put
 * the milestone names into `note` as one arrow-separated string, so the card could
 * only ever read "0 / 7 — 0 %". Nothing in the app could move it, which made it a
 * picture of zero progress rather than a way to track any.
 *
 * `checked` and `onToggle` come from the card frame, which persists them in the
 * concept. Without them the card still renders — read-only — so a concept saved
 * before this change degrades instead of breaking.
 */
export function ProgressCard({
  label, items, current, target, unit, note, checked, onToggle,
}: Record<string, unknown>) {
  const list = filled(items, "label");
  const ticks = Array.isArray(checked) ? (checked as string[]) : [];
  const toggle = typeof onToggle === "function" ? (onToggle as (l: string) => void) : null;

  // With items, progress IS the tick count. Without them, fall back to the numbers
  // an older concept carries.
  const isDone = (it: Record<string, unknown>) =>
    ticks.includes(str(it.label)) || it.done === true || str(it.done).toLowerCase() === "true";
  const c = list.length ? list.filter(isDone).length : (num(current) ?? 0);
  const t = list.length ? list.length : (num(target) ?? 0);
  const pct = t > 0 ? Math.max(0, Math.min(100, (c / t) * 100)) : 0;

  return (
    <CardShell title={str(label)} hint={note ? str(note) : undefined}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-lg font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
          {c}<span className="text-zinc-400 font-semibold text-sm"> / {t}{unit ? ` ${unitFor(t, unit)}` : ""}</span>
        </span>
        <span className="text-[11px] font-bold text-green-700 dark:text-green-400 tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-600"
          style={{ width: `${pct}%` }}
        />
      </div>

      {list.length > 0 && (
        <ul className="flex flex-col gap-1 mt-3">
          {list.map((it, i) => {
            const lbl = str(it.label);
            const done = isDone(it);
            const Row = toggle ? "button" : "div";
            return (
              <li key={i}>
                <Row
                  {...(toggle
                    ? { type: "button" as const, onClick: () => toggle(lbl), "aria-pressed": done,
                        "aria-label": done ? `${lbl} als offen markieren` : `${lbl} als erledigt markieren` }
                    : {})}
                  className={cn(
                    "w-full text-left flex items-start gap-2 rounded-md px-1 py-1 -mx-1",
                    toggle && "hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors duration-150"
                  )}
                >
                  {done
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px text-green-600" strokeWidth={2.2} />
                    : <Circle className="w-3.5 h-3.5 shrink-0 mt-px text-zinc-300 dark:text-zinc-600" strokeWidth={2} />}
                  <span className={cn(
                    "text-[11.5px] leading-snug min-w-0 flex-1",
                    done ? "text-zinc-400 line-through" : "text-zinc-700 dark:text-zinc-300"
                  )}>
                    {lbl}
                  </span>
                </Row>
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}

// ── 5. RiskBadgeList ──────────────────────────────────────────────────────────
const RISK_TONE: Record<string, string> = {
  hoch: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40",
  high: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40",
  mittel: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
  medium: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
  niedrig: "text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800",
  low: "text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800",
};
export function RiskBadgeList({ items, title }: Record<string, unknown>) {
  const list = filled(items, "description");
  if (!list.length) return null;
  return (
    <CardShell title={str(title) || "Risiken"} accent="rgb(22 163 74)">
      <ul className="flex flex-col gap-2.5">
        {list.map((it, i) => {
          const level = str(it.risk_level).toLowerCase();
          return (
            <li key={i} className="flex items-start gap-2.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-400" strokeWidth={1.8} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {level && (
                    <span className={cn("text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                      RISK_TONE[level] ?? RISK_TONE.niedrig)}>{str(it.risk_level)}</span>
                  )}
                  {it.affected_area ? <span className="text-[11px] text-zinc-400">{str(it.affected_area)}</span> : null}
                </div>
                <p className="text-[12px] text-zinc-700 dark:text-zinc-300 leading-snug mt-1">{str(it.description)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

// ── 6. StatusList ─────────────────────────────────────────────────────────────
const STATUS_ICON: Record<string, { Icon: React.ElementType; cls: string }> = {
  ok: { Icon: CheckCircle2, cls: "text-green-600" },
  erfüllt: { Icon: CheckCircle2, cls: "text-green-600" },
  gut: { Icon: CheckCircle2, cls: "text-green-600" },
  offen: { Icon: Circle, cls: "text-zinc-400" },
  teilweise: { Icon: AlertTriangle, cls: "text-amber-500" },
  kritisch: { Icon: AlertTriangle, cls: "text-red-500" },
};
export function StatusList({ items, title }: Record<string, unknown>) {
  const list = filled(items, "label");
  if (!list.length) return null;
  return (
    <CardShell title={str(title) || "Status"}>
      <ul className="flex flex-col gap-2">
        {list.map((it, i) => {
          const key = str(it.status).toLowerCase();
          const { Icon, cls } = STATUS_ICON[key] ?? { Icon: Circle, cls: "text-zinc-400" };
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", cls)} strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200 leading-snug">{str(it.label)}</p>
                {it.note ? <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">{str(it.note)}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

// ── 7. TimelineSteps ──────────────────────────────────────────────────────────
export function TimelineSteps({ steps, title }: Record<string, unknown>) {
  const list = filled(steps, "label");
  if (!list.length) return null;
  return (
    <CardShell title={str(title) || "Ablauf"}>
      <ol className="relative flex flex-col gap-3 pl-1">
        {list.map((s, i) => (
          <li key={i} className="relative flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-green-600 ring-2 ring-green-100 dark:ring-green-950" />
              {i < list.length - 1 && <span className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700 mt-1" />}
            </div>
            <div className="min-w-0 flex-1 -mt-0.5 pb-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">{str(s.label)}</p>
                {s.when ? (
                  <span className="inline-flex items-center gap-1 text-[10.5px] text-zinc-400">
                    <Clock className="w-3 h-3" strokeWidth={1.8} />{str(s.when)}
                  </span>
                ) : null}
              </div>
              {s.note ? <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{str(s.note)}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}

// ── 8. DonutBreakdown ─────────────────────────────────────────────────────────
const SLICE_COLORS = ["var(--cat-tooling)", "var(--cat-business)", "var(--cat-agile)", "var(--cat-security)", "#8b8f8c"];
/**
 * Slices and legend highlight together on hover.
 *
 * Static, the slices ran into each other and there was no way to tell which arc
 * belonged to which label — you had to match colours by eye, and adjacent shades
 * look alike at 10px stroke width. Hovering either the arc OR its legend row now
 * lifts that slice, dims the rest, and puts its share in the middle of the ring.
 */
export function DonutBreakdown({ label, slices, unit }: Record<string, unknown>) {
  const [hot, setHot] = useState<number | null>(null);
  const list = filled(slices, "name")
    .map(s => ({ name: str(s.name), value: num(s.value) ?? 0 }))
    .filter(s => s.value > 0);
  if (!list.length) return null;
  const total = list.reduce((a, s) => a + s.value, 0) || 1;
  const R = 30, C = 2 * Math.PI * R;
  let acc = 0;
  const active = hot != null ? list[hot] : null;

  return (
    <CardShell title={str(label)}>
      <div className="flex items-center gap-4" onMouseLeave={() => setHot(null)}>
        <div className="relative w-[76px] h-[76px] shrink-0">
          <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
            {list.map((s, i) => {
              const frac = s.value / total;
              const dash = `${frac * C} ${C - frac * C}`;
              const offset = -acc * C;
              acc += frac;
              const dim = hot != null && hot !== i;
              return (
                <circle
                  key={i} cx="38" cy="38" r={R} fill="none"
                  strokeWidth={hot === i ? 12 : 10}
                  stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
                  strokeDasharray={dash} strokeDashoffset={offset}
                  opacity={dim ? 0.28 : 1}
                  onMouseEnter={() => setHot(i)}
                  className="transition-[opacity,stroke-width] duration-150 cursor-default"
                />
              );
            })}
          </svg>
          {/* The hovered share, in the hole where it reads without a tooltip. */}
          {active && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[12px] font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
                {Math.round((active.value / total) * 100)}%
              </span>
            </div>
          )}
        </div>

        <ul className="min-w-0 flex-1 flex flex-col gap-1">
          {list.map((s, i) => (
            <li
              key={i}
              onMouseEnter={() => setHot(i)}
              className={cn(
                "flex items-center gap-2 text-[11.5px] rounded px-1 -mx-1 py-px transition-colors duration-150",
                hot === i && "bg-zinc-100 dark:bg-zinc-800",
                hot != null && hot !== i && "opacity-45"
              )}
            >
              <i className="w-2 h-2 rounded-sm shrink-0" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
              <span className="flex-1 min-w-0 truncate text-zinc-600 dark:text-zinc-300">{s.name}</span>
              <span className="tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">
                {s.value}{unit ? str(unit) : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </CardShell>
  );
}

// ── 9. ScorecardGrid ──────────────────────────────────────────────────────────
export function ScorecardGrid({ items, title }: Record<string, unknown>) {
  // Rows of near-identical bars are hard to follow across; hovering one makes it
  // unambiguous which criterion the bar belongs to.
  const [hot, setHot] = useState<number | null>(null);
  const list = filled(items, "label");
  if (!list.length) return null;
  return (
    <CardShell title={str(title) || "Bewertung"}>
      <div className="flex flex-col gap-2.5" onMouseLeave={() => setHot(null)}>
        {list.map((it, i) => {
          const score = num(it.score) ?? 0, max = num(it.max) ?? 10;
          const pct = max > 0 ? Math.max(0, Math.min(100, (score / max) * 100)) : 0;
          const dim = hot != null && hot !== i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHot(i)}
              className={cn("rounded px-1 -mx-1 py-0.5 transition-opacity duration-150",
                            dim && "opacity-45", hot === i && "bg-zinc-50 dark:bg-zinc-800/60")}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11.5px] text-zinc-600 dark:text-zinc-300 truncate pr-2">{str(it.label)}</span>
                <span className="text-[11.5px] font-bold tabular-nums text-zinc-800 dark:text-zinc-200 shrink-0">
                  {score}<span className="text-zinc-400 font-medium">/{max}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                  className="h-full rounded-full bg-green-600" />
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

// ── 10. ComparisonTable ───────────────────────────────────────────────────────
export function ComparisonTable({ columns, rows, caption, title }: Record<string, unknown>) {
  const cols = (Array.isArray(columns) ? columns : []).map(str);
  const body = (Array.isArray(rows) ? rows : []) as unknown[][];
  return (
    <CardShell title={str(caption) || str(title) || "Vergleich"} className="sm:col-span-2">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c} className="text-left font-semibold uppercase tracking-wider text-[9.5px] text-zinc-400 px-1 pb-2">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, i) => (
              <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                {(Array.isArray(r) ? r : [r]).map((cell, j) => (
                  <td key={j} className={cn("px-1 py-2 align-top leading-snug",
                    j === 0 ? "font-semibold text-zinc-800 dark:text-zinc-200" : "text-zinc-600 dark:text-zinc-400")}>
                    {str(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

// ── 11. ChecklistProgress ─────────────────────────────────────────────────────
/**
 * A checklist you can actually tick.
 *
 * These templates were pulled from the catalogue because the card always read
 * "0 von N erledigt" — the model set done:false and nothing in the app could change
 * it, so it was a picture of an untouched list. `checked`/`onToggle` come from the
 * card frame, which persists them in the concept, same as ProgressCard. Without
 * them the card still renders, read-only.
 */
export function ChecklistProgress({ title, items, checked, onToggle }: Record<string, unknown>) {
  const list = filled(items, "label");
  if (!list.length) return null;
  const ticks = Array.isArray(checked) ? (checked as string[]) : [];
  const toggle = typeof onToggle === "function" ? (onToggle as (l: string) => void) : null;
  const isDone = (it: Record<string, unknown>) =>
    ticks.includes(str(it.label)) || it.done === true || str(it.done).toLowerCase() === "true";
  const done = list.filter(isDone).length;

  return (
    <CardShell title={title ? str(title) : "Checkliste"}
      hint={`${done} von ${list.length} erledigt`}>
      <ul className="flex flex-col gap-1">
        {list.map((it, i) => {
          const lbl = str(it.label);
          const ticked = isDone(it);
          const Row = toggle ? "button" : "div";
          return (
            <li key={i}>
              <Row
                {...(toggle
                  ? { type: "button" as const, onClick: () => toggle(lbl), "aria-pressed": ticked,
                      "aria-label": ticked ? `${lbl} als offen markieren` : `${lbl} als erledigt markieren` }
                  : {})}
                className={cn(
                  "w-full text-left flex items-start gap-2.5 rounded-md px-1 py-1 -mx-1",
                  toggle && "hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors duration-150"
                )}
              >
                {ticked
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px text-green-600" strokeWidth={2.2} />
                  : <Circle className="w-3.5 h-3.5 shrink-0 mt-px text-zinc-300 dark:text-zinc-600" strokeWidth={2} />}
                <span className={cn("text-[12px] leading-snug min-w-0 flex-1",
                  ticked ? "text-zinc-400 line-through" : "text-zinc-700 dark:text-zinc-300")}>
                  {lbl}
                </span>
              </Row>
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

// ── 12. StatGrid ──────────────────────────────────────────────────────────────
export function StatGrid({ stats, title }: Record<string, unknown>) {
  const list = filled(stats, "label");
  if (!list.length) return null;
  return (
    <CardShell title={str(title) || "Kennzahlen"} className="sm:col-span-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {list.map((s, i) => (
          <div key={i} className="min-w-0">
            <div className="text-[17px] font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50 leading-none">
              {str(s.value)}{s.unit ? <span className="text-[11px] font-semibold text-zinc-500 ml-0.5">{str(s.unit)}</span> : null}
            </div>
            <p className="text-[10.5px] text-zinc-400 mt-1 leading-snug">{str(s.label)}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

// ── fallback ──────────────────────────────────────────────────────────────────
export function GenericFallbackCard(data: Record<string, unknown>) {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== "");
  return (
    <CardShell title={str(data.label || data.title) || "Kennzahl"}>
      <dl className="flex flex-col gap-1">
        {entries.filter(([k]) => !["label", "title"].includes(k)).map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 text-[11.5px]">
            <dt className="text-zinc-400 truncate">{k}</dt>
            <dd className="font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums text-right">
              {typeof v === "object" ? JSON.stringify(v) : str(v)}
            </dd>
          </div>
        ))}
      </dl>
    </CardShell>
  );
}
