/**
 * A rotating dot sphere — what the agent looks like while it is thinking.
 *
 * Real 3D, not a picture of it: the dots are laid out on a unit sphere and
 * the whole group is spun under a perspective, so the browser scales the far
 * side down for us and the silhouette crowds at the edges on its own. A flat
 * SVG rotating in 2D reads as a spinning wheel; this reads as a globe.
 *
 * No state, no timers, no React work while it spins — one CSS animation on
 * one transform, which stays on the compositor.
 */

/**
 * Fibonacci lattice: the cheapest way to scatter points evenly on a sphere.
 * Deterministic, so this runs once at module load and never again — and the
 * server and the client produce byte-identical markup, which matters because
 * random positions here would be a hydration mismatch.
 */
function spherePoints(n: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out.push([Math.cos(theta) * ring, y, Math.sin(theta) * ring]);
  }
  return out;
}

/** Enough to read as a surface, few enough to stay one cheap layer. */
const POINTS = spherePoints(78);

export function ThinkingOrb({ size = 30, className }: { size?: number; className?: string }) {
  const r = size / 2;
  return (
    <span className={["torb", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }} aria-hidden="true">
      <span className="torb-spin">
        {POINTS.map(([x, y, z], i) => (
          <i key={i} style={{ transform: `translate3d(${(x * r).toFixed(2)}px, ${(y * r).toFixed(2)}px, ${(z * r).toFixed(2)}px)` }} />
        ))}
      </span>
    </span>
  );
}
