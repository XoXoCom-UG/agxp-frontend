// Compact progress bar for embedding inside small controls (e.g. the Method
// Group button). Styled via app/agxp-design.css (.ui-progress-*) to match
// this app's CSS-custom-property convention, not Tailwind utility classes —
// there's no Radix react-progress dependency here to build on.

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`ui-progress ${className ?? ""}`} role="progressbar"
      aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <ProgressTrack><ProgressIndicator value={value} /></ProgressTrack>
    </div>
  );
}

export function ProgressTrack({ children }: { children: React.ReactNode }) {
  return <div className="ui-progress-track">{children}</div>;
}

export function ProgressIndicator({ value }: { value: number }) {
  return <div className="ui-progress-indicator" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />;
}
