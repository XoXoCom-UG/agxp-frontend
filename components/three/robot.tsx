"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { pointer } from "@/lib/pointer";

/**
 * The agents, in three dimensions.
 *
 * Ported from LandingPageAGXP (components/three/robot.tsx) so the product and
 * the marketing site show the same characters, built the same way. The only
 * change is where the pointer comes from: that repo reads it off its scroll
 * library, and this one has lib/pointer.ts instead.
 *
 * Built from the same rules as the 2D mascot in the app: a geometric head with
 * a face panel and two lit eyes, an antenna that glows once the agent has
 * levelled up, a tie for the Consultant and a headset for the Coach. Nothing
 * here is a loaded model — it is all primitives, so the whole character weighs
 * nothing and re-colours instantly with the accent.
 */
export function Robot({
  role,
  accent,
  soft,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  level = 3,
  talking = false,
  /** 0–1: how lit the character is. The landing page drives this from
   *  scroll; here it is simply 1 once the scene has faded in. */
  presence = 1,
}: {
  role: "consultant" | "coach";
  accent: string;
  soft: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  level?: number;
  talking?: boolean;
  presence?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const antenna = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);

  const softColor = useMemo(() => new THREE.Color(soft), [soft]);
  const deepColor = useMemo(() => new THREE.Color(accent), [accent]);

  // The Consultant is the calmer of the two: it breathes and turns slower.
  const tempo = role === "consultant" ? 0.8 : 1.15;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;

    // Breathing, and a slow lean into the pointer — the character keeps
    // noticing you without ever leaving its mark.
    const targetY = Math.sin(t * 0.7 * tempo) * 0.06;
    g.position.y = position[1] + targetY;

    if (head.current) {
      const px = pointer.x;
      const py = pointer.y;
      const side = role === "consultant" ? -1 : 1;
      head.current.rotation.y = THREE.MathUtils.damp(
        head.current.rotation.y,
        rotation[1] + px * 0.25 + side * 0.06,
        3,
        delta,
      );
      head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, py * 0.16, 3, delta);
    }

    // Blink: a short, sharp squash on a lazy irregular cycle.
    if (eyes.current) {
      const cycle = (t * tempo + (role === "coach" ? 2.3 : 0)) % 6.4;
      const blink = cycle > 6.1 ? 0.08 : 1;
      eyes.current.scale.y = THREE.MathUtils.damp(eyes.current.scale.y, blink, 26, delta);
    }

    if (mouth.current) {
      const speak = talking ? 1 + Math.sin(t * 14) * 0.55 : 1;
      mouth.current.scale.y = THREE.MathUtils.damp(mouth.current.scale.y, speak, 18, delta);
    }

    if (antenna.current) {
      const mat = antenna.current.material as THREE.MeshStandardMaterial;
      const pulse = 1.6 + Math.sin(t * 2.2 * tempo) * 0.7;
      mat.emissiveIntensity = pulse * presence * (level >= 2 ? 1 : 0.25);
    }

    if (ring.current) {
      ring.current.rotation.z = t * 0.6 * tempo;
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.opacity = level >= 2 ? 0.35 * presence : 0;
    }
  });

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <group ref={head}>
        {/* head */}
        <RoundedBox args={[1.5, 1.25, 1.05]} radius={0.38} smoothness={6} castShadow>
          <meshStandardMaterial
            color={"#2a3140"}
            metalness={0.55}
            roughness={0.32}
            envMapIntensity={1.2}
          />
        </RoundedBox>

        {/* face panel — a darker inset the eyes sit inside */}
        <RoundedBox args={[1.14, 0.68, 0.08]} radius={0.3} smoothness={5} position={[0, 0.08, 0.53]}>
          <meshStandardMaterial color={"#0d1118"} metalness={0.2} roughness={0.5} />
        </RoundedBox>

        {/* eyes */}
        <group ref={eyes} position={[0, 0.1, 0.58]}>
          {[-0.26, 0.26].map(x => (
            <mesh key={x} position={[x, 0, 0]}>
              <sphereGeometry args={[0.115, 20, 20]} />
              <meshStandardMaterial
                color={softColor}
                emissive={softColor}
                emissiveIntensity={2.4 * presence}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>

        {/* mouth */}
        <mesh ref={mouth} position={[0, -0.26, 0.56]}>
          <boxGeometry args={[0.3, 0.06, 0.04]} />
          <meshStandardMaterial
            color={softColor}
            emissive={softColor}
            emissiveIntensity={1.1 * presence}
            toneMapped={false}
          />
        </mesh>

        {/* antenna */}
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.34, 10]} />
          <meshStandardMaterial color={"#39414f"} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh ref={antenna} position={[0, 1.02, 0]}>
          <sphereGeometry args={[0.13, 20, 20]} />
          <meshStandardMaterial
            color={softColor}
            emissive={softColor}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>

        {/* level ring around the antenna — the visual rank from the app */}
        <mesh ref={ring} position={[0, 1.02, 0]}>
          <torusGeometry args={[0.26, 0.012, 8, 48]} />
          <meshBasicMaterial color={softColor} transparent opacity={0.35} toneMapped={false} />
        </mesh>

        {role === "coach" ? (
          <CoachHeadset accent={deepColor} soft={softColor} lit={level >= 3} presence={presence} />
        ) : (
          <ConsultantLens soft={softColor} lit={level >= 3} presence={presence} />
        )}
      </group>

      {role === "consultant" && (
        <mesh position={[0, -0.95, 0.42]} rotation={[0.1, 0, 0]}>
          <coneGeometry args={[0.18, 0.62, 4]} />
          <meshStandardMaterial color={deepColor} metalness={0.4} roughness={0.35} />
        </mesh>
      )}
    </group>
  );
}

/** A band over the head with an ear pad each side; the pads light up at level 3. */
function CoachHeadset({
  accent,
  soft,
  lit,
  presence,
}: {
  accent: THREE.Color;
  soft: THREE.Color;
  lit: boolean;
  presence: number;
}) {
  return (
    <group>
      <mesh rotation={[0, 0, 0]} position={[0, 0.2, 0]}>
        <torusGeometry args={[0.86, 0.045, 10, 48, Math.PI]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.3} />
      </mesh>
      {[-0.86, 0.86].map(x => (
        <mesh key={x} position={[x, 0.08, 0]}>
          <capsuleGeometry args={[0.13, 0.22, 4, 12]} />
          <meshStandardMaterial
            color={accent}
            emissive={soft}
            emissiveIntensity={lit ? 1.4 * presence : 0}
            metalness={0.5}
            roughness={0.35}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* mic boom */}
      <mesh position={[0.62, -0.18, 0.4]} rotation={[0, -0.5, -0.9]}>
        <cylinderGeometry args={[0.018, 0.018, 0.6, 8]} />
        <meshStandardMaterial color={accent} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.32, -0.34, 0.6]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial color={soft} emissive={soft} emissiveIntensity={1.2 * presence} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The HUD lens the Consultant earns at level 3, scanning over one eye. */
function ConsultantLens({ soft, lit, presence }: { soft: THREE.Color; lit: boolean; presence: number }) {
  const scan = useRef<THREE.Mesh>(null);

  useFrame(state => {
    if (!scan.current) return;
    const t = state.clock.elapsedTime;
    scan.current.position.y = 0.1 + Math.sin(t * 1.6) * 0.075;
    (scan.current.material as THREE.MeshBasicMaterial).opacity = lit ? 0.45 * presence : 0;
  });

  if (!lit) return null;

  return (
    <group position={[0.26, 0.1, 0.62]}>
      <mesh>
        <torusGeometry args={[0.2, 0.018, 8, 32]} />
        <meshStandardMaterial color={soft} emissive={soft} emissiveIntensity={1.5 * presence} toneMapped={false} />
      </mesh>
      <mesh ref={scan} position={[0, 0.1, 0.01]}>
        <planeGeometry args={[0.34, 0.012]} />
        <meshBasicMaterial color={soft} transparent opacity={0.45} toneMapped={false} />
      </mesh>
    </group>
  );
}
