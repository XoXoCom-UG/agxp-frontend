import { useEffect, useRef, useState } from "react";
import type { DeliverableDoc } from "@/components/layout/deliverable-view";
import { IconDoc, IconRefresh, IconArrow, IconSpark, IconHistory, IconRestore } from "@/components/layout/agxp-icons";

/**
 * The artifact card behind the header's doc pill: what the deliverable looks
 * like before it exists (interview progress, unchanged since before this
 * card's redesign — a segmented bar and the current step) and once it is a
 * finished, versioned document (redesigned).
 */
export function DeliverableRail({
  title, totalStations, pct, stationIdx, stationLabel, currentDoc, version, restored = false, versions,
  sending, onOpen, onGenerate, onRegenerate, onOpenVersion, onRestoreVersion,
}: {
  title: string;
  totalStations: number;
  pct: number;
  stationIdx: number;
  stationLabel: string;
  currentDoc: DeliverableDoc | null;
  /** The version Open shows: the newest, or the one brought back by Restore. */
  version: number;
  /** True while `version` is an older one brought back by Restore. */
  restored?: boolean;
  versions: { version: number; createdAt: string }[];
  sending: boolean;
  onOpen: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onOpenVersion: (version: number) => void;
  onRestoreVersion: (version: number) => void;
}) {
  if (currentDoc) {
    return (
      <div className="artf-card is-ready">
        <ArtifactHeader title={title} state="ready" restored={restored}
          subtitle={metaLine(version, currentDoc.createdAt, restored)} />
        <ArtifactActions
          sending={sending} versions={versions} current={version} onOpen={onOpen} onRegenerate={onRegenerate}
          onOpenVersion={onOpenVersion} onRestoreVersion={onRestoreVersion}
        />
      </div>
    );
  }

  return (
    <div className="artf-card is-pending" style={{ ["--dr-steps" as string]: totalStations }}>
      <ArtifactHeader title={title} state="pending" pct={pct} />
      <div className="artf-bar"><span style={{ ["--p" as string]: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
      <div className="artf-bottom">
        <span className="artf-step">
          {stationIdx < 0
            ? `${totalStations} steps · not started`
            : `Step ${stationIdx + 1} of ${totalStations} · ${stationLabel}`}
        </span>
        <button className="artf-cta" disabled={sending} onClick={onGenerate}>
          <IconSpark size={12} />Generate
        </button>
      </div>
    </div>
  );
}

function ArtifactHeader({ title, state, pct, subtitle, restored = false }: {
  title: string; state: "pending" | "ready"; pct?: number; subtitle?: string; restored?: boolean;
}) {
  return (
    <div className="artf-head">
      <span className="artf-icon"><IconDoc size={15} /></span>
      <span className="artf-head-txt">
        <span className="artf-eyebrow">{title}</span>
        {/* Keyed on the text, so the highlight replays each time it changes. */}
        {subtitle && <span key={subtitle} className={`artf-sub${restored ? " is-restored" : ""}`}>{subtitle}</span>}
      </span>
      {state === "pending" && <span className="artf-pct">{pct}%</span>}
    </div>
  );
}

function ArtifactActions({ sending, versions, current, onOpen, onRegenerate, onOpenVersion, onRestoreVersion }: {
  sending: boolean;
  versions: { version: number; createdAt: string }[];
  current: number;
  onOpen: () => void;
  onRegenerate: () => void;
  onOpenVersion: (version: number) => void;
  onRestoreVersion: (version: number) => void;
}) {
  return (
    <div className="artf-actions">
      <VersionHistory versions={versions} current={current} onOpenVersion={onOpenVersion} onRestoreVersion={onRestoreVersion} />
      <div className="artf-actions-right">
        <button className="artf-ghost artf-regen" disabled={sending} onClick={onRegenerate}>
          <IconRefresh size={13} />Regenerate
        </button>
        <button className="artf-cta" onClick={onOpen}>
          Open<IconArrow />
        </button>
      </div>
    </div>
  );
}

/**
 * Every past version, newest first — open any of them, or restore one, which
 * makes it the version Open shows until a new one is generated. The version
 * in use is marked instead of offering to restore itself.
 */
function VersionHistory({ versions, current, onOpenVersion, onRestoreVersion }: {
  versions: { version: number; createdAt: string }[];
  current: number;
  onOpenVersion: (version: number) => void;
  onRestoreVersion: (version: number) => void;
}) {
  const [open, setOpen] = useState(false);
  /** Read out once a restore has happened; the menu itself closes. */
  const [announce, setAnnounce] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function restore(v: number) {
    setOpen(false);
    onRestoreVersion(v);
    setAnnounce(`Version ${v} restored. Open now shows it.`);
    // The button that was clicked is gone with the menu; focus goes back to
    // the toggle instead of falling to the page.
    toggleRef.current?.focus();
  }

  return (
    <div className="ver-wrap" ref={ref}>
      <button ref={toggleRef} className="artf-ghost" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <IconHistory size={13} />History
      </button>
      {open && (
        <div className="ver-menu">
          {versions.slice().reverse().map(v => (
            <div className={`ver-item${v.version === current ? " is-current" : ""}`} key={v.version}>
              <button className="ver-open" aria-current={v.version === current ? "true" : undefined}
                onClick={() => { setOpen(false); onOpenVersion(v.version); }}>
                <span className="ver-num">v{v.version}</span>
                <span className="ver-time">{timeAgo(v.createdAt)}</span>
              </button>
              {v.version === current ? (
                <span className="ver-current">In use</span>
              ) : (
                <button className="ver-restore" aria-label={`Restore version ${v.version}`} data-tooltip="Restore"
                  onClick={() => restore(v.version)}>
                  <IconRestore size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <span className="visually-hidden" role="status" aria-live="polite">{announce}</span>
    </div>
  );
}

function metaLine(version: number, createdAt: string, restored: boolean): string {
  const parts = [`v${version}`];
  if (restored) parts.push("Restored");
  else if (version > 1) parts.push(`Updated from v${version - 1}`);
  parts.push(timeAgo(createdAt));
  return parts.join(" · ");
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
