/**
 * Placeholder rows shaped like the real ones.
 *
 * The lists used to show the word "Loading…", so the page was empty, then
 * jumped. A skeleton the same height as the row it replaces means the layout
 * is already correct before the data lands — nothing moves when it does.
 *
 * Not a spinner: a spinner says "wait", a skeleton says "here is what is
 * coming". At one or two hundred milliseconds that difference is most of the
 * perceived speed.
 */
export function SkeletonRows({ count = 4, avatar = "square" }: {
  count?: number;
  /** Matches the real row: History has a stack of small heads, the Dashboard one big one. */
  avatar?: "square" | "round";
}) {
  return (
    <div className="project-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        // The stagger makes it read as a list filling in rather than one
        // block flashing.
        <div key={i} className="skel-row" style={{ "--i": i } as React.CSSProperties}>
          <div className={`skel-avatar ${avatar}`} />
          <div className="skel-lines">
            {/* Uneven widths — equal bars look like a table, not like text. */}
            <div className="skel-line" style={{ width: `${52 + ((i * 13) % 26)}%` }} />
            <div className="skel-line sm" style={{ width: `${34 + ((i * 17) % 30)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
