
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { COLORS, workerPosition, healthColor, queuePressure } from "./sceneConstants";

// ── Connection link from core to worker ──────────────────────────
function ConnectionLink({ position, color, active, pressure }) {
  const ref = useRef();
  const geo = useMemo(() => {
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...position)];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [position]);

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.elapsedTime;
      const pulse = active ? 0.9 : 0.25 + pressure * 0.4;
      ref.current.material.opacity = pulse + Math.sin(t * 2 + position[0]) * 0.15;
    }
  });

  return (
    <line ref={ref} geometry={geo}>
      <lineBasicMaterial
        color={active ? COLORS.linkActive : color}
        transparent
        opacity={0.4}
        linewidth={1}
      />
    </line>
  );
}

// ── Pressure ring around worker ──────────────────────────────────
function PressureRing({ pressure, color }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current && pressure > 0.05) {
      const t = clock.elapsedTime;
      const scale = 1 + Math.sin(t * (1.5 + pressure)) * 0.06 * pressure;
      ref.current.scale.setScalar(scale);
      ref.current.material.opacity = 0.3 + pressure * 0.5;
    }
  });
  if (pressure < 0.05) return null;
  return (
    <mesh ref={ref}>
      <torusGeometry args={[0.52, 0.02, 8, 40]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.8}
        transparent
        opacity={0.5}
      />
    </mesh>
  );
}

// ── Single worker node ───────────────────────────────────────────
function WorkerNode({ worker, index, total, selected, onSelect }) {
  const pos    = useMemo(() => workerPosition(index, total), [index, total]);
  const color  = healthColor(worker.status);
  const pressure = queuePressure(worker);
  const isOffline = worker.status === "offline";
  const ref    = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    // Pulse scale for non-offline nodes
    if (!isOffline) {
      const p = 1 + Math.sin(t * 1.2 + index) * 0.03;
      ref.current.scale.setScalar(selected ? 1.22 : p);
    }
  });

  return (
    <group position={pos}>
      {/* Core sphere */}
      <mesh
        ref={ref}
        onClick={(e) => { e.stopPropagation(); onSelect(worker.worker_id); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
      >
        <octahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 1.2 : (isOffline ? 0.1 : 0.65)}
          metalness={0.3}
          roughness={0.5}
          transparent
          opacity={isOffline ? 0.55 : 1}
        />
      </mesh>

      {/* Selection ring */}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.54, 0.025, 8, 48]} />
          <meshStandardMaterial
            color={COLORS.selected}
            emissive={COLORS.selected}
            emissiveIntensity={1.5}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* Queue pressure ring */}
      <PressureRing pressure={pressure} color={color} />

      {/* Point light */}
      <pointLight
        color={color}
        intensity={selected ? 2.5 : (0.6 + pressure * 1.2)}
        distance={1.5}
        decay={2}
      />

      {/* HTML label */}
      <Html
        center
        distanceFactor={9}
        style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
      >
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}>
          <span style={{
            fontSize: "10px",
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
            color: selected ? "#c8b4ff" : (
              worker.status === "healthy" ? "#4ecb91" :
              worker.status === "degraded" ? "#e8b84d" : "#f07070"
            ),
            background: "rgba(6,12,22,0.85)",
            padding: "1px 5px",
            borderRadius: 4,
            border: `1px solid ${selected ? "#6a50b040" : "#1c2e46"}`,
            letterSpacing: "0.03em",
          }}>
            {worker.name || worker.worker_id}
          </span>
          {pressure > 0.1 && (
            <span style={{
              fontSize: "9px",
              color: "#e8b84d",
              fontFamily: "Inter, sans-serif",
              background: "rgba(6,12,22,0.7)",
              padding: "1px 4px",
              borderRadius: 3,
            }}>
              Q {Math.round(pressure * 100)}%
            </span>
          )}
        </div>
      </Html>

      {/* Connection to core */}
      <ConnectionLink
        position={[-pos[0], -pos[1], -pos[2]]}
        color={color}
        active={selected}
        pressure={pressure}
      />
    </group>
  );
}

// ── All workers ──────────────────────────────────────────────────
export default function WorkerNetwork({ workers, selectedWorkerId, onSelectWorker }) {
  if (!workers || workers.length === 0) return null;
  return (
    <group>
      {workers.map((w, i) => (
        <WorkerNode
          key={w.worker_id}
          worker={w}
          index={i}
          total={workers.length}
          selected={w.worker_id === selectedWorkerId}
          onSelect={onSelectWorker}
        />
      ))}
    </group>
  );
}
