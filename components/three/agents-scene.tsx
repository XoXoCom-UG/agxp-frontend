"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Robot } from "@/components/three/robot";
import { trackPointer } from "@/lib/pointer";

/**
 * The two agents on the home screen, in three dimensions.
 *
 * Deliberately NOT a port of the marketing site's stage: that one is 468
 * lines wired to its own scroll library and drives a whole page of sections.
 * All this needs is two characters, three lights and a transparent canvas.
 *
 * It is loaded lazily and fades in over the flat robots already on screen
 * (see HomeScreen), so nothing here is on the path between signing in and
 * seeing the page. If WebGL is unavailable or the chunk never arrives, the
 * flat ones simply stay — which is why they are a sibling in the DOM rather
 * than something this replaces.
 */

/** Read off the theme so the characters follow the accent chosen in Settings. */
function useAccent() {
  const [c, setC] = useState({ accent: "#154E80", soft: "#2E7BC4" });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const accent = s.getPropertyValue("--primary").trim() || "#154E80";
      const soft = s.getPropertyValue("--primary-soft").trim() || "#2E7BC4";
      setC(prev => (prev.accent === accent && prev.soft === soft ? prev : { accent, soft }));
    };
    read();
    // The accent and the theme are both class/attribute changes on <html>.
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-accent"] });
    return () => mo.disconnect();
  }, []);
  return c;
}

export default function AgentsScene() {
  const { accent, soft } = useAccent();
  const [still, setStill] = useState(false);
  /** Set once the renderer actually exists. The flat robots underneath are
   *  only hidden after this — a canvas element that never drew anything
   *  would otherwise leave the hero empty. */
  const [live, setLive] = useState(false);

  useEffect(() => {
    const stop = trackPointer();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => { stop(); mq.removeEventListener("change", sync); };
  }, []);

  return (
    <Canvas
      className={`ag3d-canvas${live ? " ag3d-live" : ""}`}
      onCreated={() => setLive(true)}
      // Transparent, so the characters sit on the page's own ground and the
      // core art keeps showing through behind them.
      gl={{ antialias: true, alpha: true }}
      // Capped: on a high-density screen the untouched value renders four
      // times the pixels for a decoration nobody is inspecting.
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 4.4], fov: 40 }}
      // Asked not to animate: render once and stop, so the characters are
      // still there and nothing moves or spends battery.
      frameloop={still ? "demand" : "always"}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 5]} intensity={2.4} />
      <directionalLight position={[-4, 1, 2]} intensity={0.8} color={soft} />
      <pointLight position={[-3, -1, 3]} intensity={26} color={soft} distance={16} />

      <Robot role="consultant" accent={accent} soft={soft}
        position={[-1.5, 0, 0]} rotation={[0, 0.3, 0]} scale={1.25} level={3} />
      <Robot role="coach" accent={accent} soft={soft}
        position={[1.5, 0, 0]} rotation={[0, -0.3, 0]} scale={1.25} level={3} />
    </Canvas>
  );
}
