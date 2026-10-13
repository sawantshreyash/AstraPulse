
import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COLORS, workerPosition } from "./sceneConstants";

// ── A single routing pulse travelling from core to worker ─────────
// progress: 0 (core) → 1 (worker)
function RoutePulse({ workerIndex, workerCount, progress, color = COLORS.pulse }) {
  const ref = useRef();
  const target = useMemo(
    () => new THREE.Vector3(...workerPosition(workerIndex, workerCount)),
    [workerIndex, workerCount]
  );
  const origin = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame(() => {
    if (!ref.current) return;
    const pos = origin.clone().lerp(target, progress);
    ref.current.position.copy(pos);
    // Scale up slightly then down
    const s = 1.0 + Math.sin(progress * Math.PI) * 0.5;
    ref.current.scale.setScalar(s);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.12, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.5}
        transparent
        opacity={0.9}
      />
      <pointLight color={color} intensity={2.5} distance={1.5} decay={2} />
    </mesh>
  );
}

// ── Shockwave ring expanding from a worker ───────────────────────
function ShockwaveRing({ position, age, color }) {
  const ref = useRef();
  const scale = 1 + age * 3.5;
  const opacity = Math.max(0, 1 - age);

  useFrame(() => {
    if (ref.current) {
      ref.current.scale.setScalar(1 + age * 3.5);
      ref.current.material.opacity = Math.max(0, 0.9 - age * 1.1);
    }
  });

  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.5, 0.025, 8, 48]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

// ── Global shockwave field (multiple expanding rings from core) ───
const SHOCKWAVE_RINGS = 3;
function GlobalShockwave({ active, pressure }) {
  const rings = useRef([]);
  const t     = useRef(0);

  useFrame((_, dt) => {
    if (!active && pressure < 0.05) return;
    t.current += dt;
  });

  if (pressure < 0.05 && !active) return null;

  return (
    <group>
      {Array.from({ length: SHOCKWAVE_RINGS }, (_, i) => {
        const offset = (i / SHOCKWAVE_RINGS);
        return (
          <ExpandingRing
            key={i}
            offset={offset}
            pressure={pressure}
          />
        );
      })}
    </group>
  );
}

function ExpandingRing({ offset, pressure }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.elapsedTime * 0.5 + offset) % 1);
    const s = 2 + t * (3 + pressure * 5);
    ref.current.scale.setScalar(s);
    ref.current.material.opacity = (1 - t) * 0.4 * (0.3 + pressure * 0.7);
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1, 0.018, 8, 64]} />
      <meshStandardMaterial
        color={COLORS.pulse}
        emissive={COLORS.pulse}
        emissiveIntensity={1}
        transparent
        opacity={0.3}
      />
    </mesh>
  );
}

// ── Main routing animation manager ──────────────────────────────
// routeAnim: { workerIndex, workerCount, progress, targetWorkerId } | null
export default function RoutingAnimation({
  routeAnim,
  workers,
  globalPressure,
  shockwaveActive,
}) {
  const progress = routeAnim?.progress ?? 0;
  const workerIdx = routeAnim?.workerIndex ?? 0;
  const workerCount = workers?.length ?? 1;

  return (
    <group>
      {/* Global shockwave field driven by actual queue pressure */}
      <GlobalShockwave active={shockwaveActive} pressure={globalPressure} />

      {/* Route pulse (shown only while a routing animation is active) */}
      {routeAnim && progress > 0 && progress < 1 && (
        <RoutePulse
          workerIndex={workerIdx}
          workerCount={workerCount}
          progress={progress}
          color={COLORS.pulse}
        />
      )}

      {/* Arrival burst at target worker */}
      {routeAnim && progress >= 0.95 && (
        <group position={workerPosition(workerIdx, workerCount)}>
          <pointLight color={COLORS.pulse} intensity={5} distance={3} decay={2} />
        </group>
      )}
    </group>
  );
}
