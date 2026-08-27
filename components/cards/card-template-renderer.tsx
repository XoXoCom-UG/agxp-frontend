"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LayoutGrid, Info, Check, EyeOff, Pin, PinOff, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat-store";
import type { ConceptCard } from "@/lib/api";
import {
  KpiCard, BeforeAfterBar, RadialGauge, ProgressCard, RiskBadgeList, StatusList,
  TimelineSteps, DonutBreakdown, ScorecardGrid, ComparisonTable, ChecklistProgress,
  StatGrid, GenericFallbackCard,
} from "./card-components";

/*
 * Renders whatever cards the backend picked for this concept.
 *
 * The backend sends {template_id, component, title, topic, data}. Only `component`
 * resolves the renderer, which is what lets the catalogue grow without changes
 * here: a new template only needs to reuse a component already in COMPONENT_MAP.
 * An unknown component renders GenericFallbackCard instead of crashing, so a stale
 * frontend paired with a newer catalogue degrades rather than breaks.
 *
 * The frame around each card lives here, not in the components: hiding, pinning and
 * handing the card to the assistant are the same for all twelve.
 */

const COMPONENT_MAP: Record<string, React.ComponentType<Record<string, unknown>>> = {
  KpiCard, BeforeAfterBar, RadialGauge, ProgressCard, RiskBadgeList, StatusList,
  TimelineSteps, DonutBreakdown, ScorecardGrid, ComparisonTable, ChecklistProgress,
  StatGrid,
};

/** Components that need the full width to be readable. */
const WIDE = new Set(["ComparisonTable", "StatGrid"]);
/** Components showing a single figure — they must never be stretched to match a
 *  neighbour full of list items, so they are laid out among themselves. */
const SMALL = new Set(["KpiCard", "RadialGauge"]);

/** Keys that carry the card's numbers/labels rather than its plumbing. */
const SKIP_KEYS = new Set(["basis", "title"]);

/**
 * Turn a card into something the assistant can reason about.
 *
 * The ⓘ button used to open a one-sentence overlay that also covered the numbers
 * it was explaining. Handing the whole card to the assistant instead means the
 * reader can keep asking — where a figure comes from, how solid it is, what to
 * challenge — which is the actual question behind "where does this number come
 * from".
 */
function cardToQuote(card: ConceptCard): string {
  const data = card.data ?? {};
  const lines: string[] = [`Karte: „${card.title || "Kennzahl"}"`];

  for (const [k, v] of Object.entries(data)) {
    if (SKIP_KEYS.has(k) || v == null || v === "") continue;
    if (Array.isArray(v)) {
      const items = v.map(it => {
        if (it && typeof it === "object") {
          const o = it as Record<string, unknown>;
          // Whatever the item shape, these are the fields that carry meaning.
          return ["label", "name", "description", "risk_level", "status",
                  "value", "unit", "score", "max", "when", "note", "done"]
            .filter(f => o[f] !== undefined && o[f] !== "")
            .map(f => `${f}=${String(o[f])}`)
            .join(", ");
        }
        return String(it);
      }).filter(Boolean);
      if (items.length) lines.push(`${k}:\n  - ${items.join("\n  - ")}`);
    } else if (typeof v === "object") {
      continue;
    } else {
      lines.push(`${k}: ${String(v)}`);
    }
  }

  const basis = typeof data.basis === "string" ? data.basis.trim() : "";
  if (basis) lines.push(`Rechenweg laut Konzept: ${basis}`);
  return lines.join("\n");
}

const CARD_QUESTION =
  "Erkläre mir diese Kennzahl aus dem Transformationskonzept im Detail: " +
  "woher kommen die Zahlen, wie belastbar sind sie, welche Annahmen stecken drin " +
  "und was sollte ich hinterfragen, bevor ich sie einem Kunden zeige?";

export function CardTemplateRenderer({
  card, checked, onToggle,
}: {
  card: ConceptCard;
  /** Milestone labels ticked off in this card (ProgressCard). */
  checked?: string[];
  onToggle?: (itemLabel: string) => void;
}) {
  const Component = COMPONENT_MAP[card.component] ?? GenericFallbackCard;
  // `title` is passed alongside the data so each template names its own card; the
  // tick state only matters to the components that have milestones.
  return (
    <Component
      {...(card.data ?? {})}
      title={card.title ?? card.data?.label}
      checked={checked}
      onToggle={onToggle}
    />
  );
}

function IconButton({
  label, onClick, children, active,
}: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "w-6 h-6 rounded-md flex items-center justify-center transition-colors duration-150",
        "border backdrop-blur-sm",
        active
          ? "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-400"
          : "border-zinc-200 dark:border-zinc-700 bg-white/85 dark:bg-zinc-900/85 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      )}
    >
      {children}
    </button>
  );
}

/**
 * One card plus its controls.
 *
 * ⓘ hands the card to the assistant on the right instead of opening a panel over
 * it. The old overlay showed one sentence and covered the very numbers it was
 * explaining; the assistant gets the card's full data plus the backend's Rechenweg
 * and can be asked follow-ups, which is the real question behind "where does this
 * number come from".
 */
function CardFrame({
  card, pinned, onHide, onTogglePin, checked, onToggleItem,
}: {
  card: ConceptCard; pinned: boolean;
  onHide: () => void; onTogglePin: () => void;
  checked?: string[]; onToggleItem?: (itemLabel: string) => void;
}) {
  const pushAssistant = useChatStore(s => s.pushAssistant);
  const setAssistantOpenMobile = useChatStore(s => s.setAssistantOpenMobile);
  const [asked, setAsked] = useState(false);

  function explain() {
    pushAssistant({ quote: cardToQuote(card), question: CARD_QUESTION });
    setAssistantOpenMobile(true);          // on desktop the panel is always visible
    setAsked(true);
    setTimeout(() => setAsked(false), 1600);
  }

  // Column span is set by the grid child in ConceptCardsSection — this frame sits
  // one level deeper, so a col-span here would do nothing.
  return (
    <div className="relative group h-full">
      <CardTemplateRenderer card={card} checked={checked} onToggle={onToggleItem} />

      {/* Controls stay out of the way until the card is hovered or focused. */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 no-print">
        <IconButton
          label="Im Assistenten erklären lassen"
          onClick={explain}
          active={asked}
        >
          {asked
            ? <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
            : <Info className="w-3.5 h-3.5" strokeWidth={1.8} />}
        </IconButton>
        <IconButton label={pinned ? "Nicht mehr anpinnen" : "Nach oben anpinnen"} onClick={onTogglePin} active={pinned}>
          {pinned ? <PinOff className="w-3.5 h-3.5" strokeWidth={1.8} /> : <Pin className="w-3.5 h-3.5" strokeWidth={1.8} />}
        </IconButton>
        <IconButton label="Karte ausblenden" onClick={onHide}>
          <EyeOff className="w-3.5 h-3.5" strokeWidth={1.8} />
        </IconButton>
      </div>

    </div>
  );
}

export function ConceptCardsSection({
  cards, hidden = [], pinned = null, checked = {}, onHiddenChange, onPinnedChange, onCheckedChange,
}: {
  cards: ConceptCard[];
  hidden?: string[];
  pinned?: string | null;
  /** template_id -> ticked milestone labels. */
  checked?: Record<string, string[]>;
  onHiddenChange?: (next: string[]) => void;
  onPinnedChange?: (next: string | null) => void;
  onCheckedChange?: (next: Record<string, string[]>) => void;
}) {
  if (!cards?.length) return null;

  const visible = cards.filter(c => !hidden.includes(c.template_id));
  // Pinned wins; otherwise the backend's order already puts Ist→Ziel first.
  const byPriority = pinned
    ? [...visible].sort((a, b) => (a.template_id === pinned ? -1 : b.template_id === pinned ? 1 : 0))
    : visible;

  /*
   * Grouped by how much a card actually has to say, then laid out per group.
   *
   * Cards fill their cell so a row ends flush, which is tidy while neighbours are
   * comparable — and awful when they aren't. A single-number card ("500 ms") beside
   * a six-item checklist got stretched to the checklist's height, which is the big
   * empty box in the report. Pairing like with like removes the mismatch instead of
   * giving up on even rows: one-number cards sit three-up among themselves, lists
   * and bars two-up, tables full width.
   */
  const [lead, ...rest] = byPriority;
  const bands: { key: string; cols: string; cards: ConceptCard[] }[] = [];
  if (lead) bands.push({ key: "lead", cols: "grid-cols-1", cards: [lead] });

  const small = rest.filter(c => SMALL.has(c.component));
  const wide = rest.filter(c => WIDE.has(c.component));
  const medium = rest.filter(c => !SMALL.has(c.component) && !WIDE.has(c.component));

  if (small.length) bands.push({ key: "small", cols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", cards: small });
  if (medium.length) bands.push({ key: "medium", cols: "grid-cols-1 sm:grid-cols-2", cards: medium });
  for (const [i, c] of wide.entries()) bands.push({ key: `wide-${i}`, cols: "grid-cols-1", cards: [c] });

  const hide = (id: string) => onHiddenChange?.([...hidden, id]);
  const restore = () => onHiddenChange?.([]);
  const togglePin = (id: string) => onPinnedChange?.(pinned === id ? null : id);
  const toggleItem = (tid: string, itemLabel: string) => {
    const cur = checked[tid] ?? [];
    const next = cur.includes(itemLabel) ? cur.filter(l => l !== itemLabel) : [...cur, itemLabel];
    onCheckedChange?.({ ...checked, [tid]: next });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.5, bounce: 0 }}
      className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-[0_2px_8px_-3px_rgba(16,40,22,0.08),0_16px_36px_-20px_rgba(16,40,22,0.16)] overflow-hidden"
    >
      <div className="px-6 pt-5 pb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-green-50 dark:bg-green-950/60 flex items-center justify-center ring-1 ring-green-100 dark:ring-green-900 shrink-0">
          <LayoutGrid className="w-4 h-4 text-green-600" strokeWidth={1.6} />
        </div>
        <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none min-w-0 flex-1">
          Auf einen Blick
        </h2>
        {hidden.length > 0 && (
          <button
            type="button"
            onClick={restore}
            className="no-print inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150 shrink-0"
          >
            <Undo2 className="w-3.5 h-3.5" strokeWidth={1.6} />
            {hidden.length} wieder einblenden
          </button>
        )}
      </div>

      <div className="px-5 pb-6 flex flex-col gap-4">
        {bands.map((band, bi) => (
          <div key={band.key} className={cn("grid gap-4", band.cols)}>
            {band.cards.map((card, i) => (
              <motion.div
                key={`${card.template_id}-${i}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min((bi + i) * 0.03, 0.24), duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                className="min-w-0"
              >
                <CardFrame
                  card={card}
                  pinned={pinned === card.template_id}
                  onHide={() => hide(card.template_id)}
                  onTogglePin={() => togglePin(card.template_id)}
                  checked={checked[card.template_id] ?? []}
                  onToggleItem={label => toggleItem(card.template_id, label)}
                />
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </motion.section>
  );
}
