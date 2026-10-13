
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COLORS } from "./sceneConstants";

// ── Orbit ring ────────────────────────────────────────────────────
function Ring({ radius, tube, rotX = 0, rotY = 0, rotZ = 0, color, speed = 0.12, opacity = 0.55 }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.x += dt * speed * 0.3;
      ref.current.rotation.y += dt * speed;
      ref.current.rotation.z += dt * speed * 0.2;
    }
  });
  return (
    <mesh ref={ref} rotation={[rotX, rotY, rotZ]}>
      <torusGeometry args={[radius, tube, 16, 96]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

// ── Icosahedron core ─────────────────────────────────────────────
function CoreSphere() {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.18;
      ref.current.rotation.x += dt * 0.06;
    }
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.9, 2]} />
      <meshStandardMaterial
        color={COLORS.core}
        emissive={COLORS.core}
        emissiveIntensity={0.9}
        metalness={0.4}
        roughness={0.3}
      />
    </mesh>
  );
}

// ── Wireframe outer shell ─────────────────────────────────────────
function OuterShell() {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y -= dt * 0.1;
      ref.current.rotation.z += dt * 0.05;
    }
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.5, 1]} />
      <meshStandardMaterial
        color={COLORS.ring}
        emissive={COLORS.ring}
        emissiveIntensity={0.4}
        wireframe
        transparent
        opacity={0.35}
      />
    </mesh>
  );
}

// ── Energy particles orbiting the core ───────────────────────────
const PARTICLE_COUNT = 60;
function EnergyParticles() {
  const ref = useRef();
  // Build positions once with useMemo
  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      const r     = 1.7 + Math.random() * 0.6;
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.08;
      ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.04) * 0.2;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={PARTICLE_COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={COLORS.particle}
        size={0.05}
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

// ── Main Central Core ─────────────────────────────────────────────
export default function OrchestratorCore() {
  const groupRef = useRef();
  // Gentle floating bob
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.12;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Point lights */}
      <pointLight color={COLORS.core}   intensity={4}   distance={6} decay={2} />
      <pointLight color={COLORS.ring}   intensity={2}   distance={4} decay={2} position={[0, 2, 0]} />
      <pointLight color={COLORS.purple} intensity={1.5} distance={4} decay={2} position={[0, -2, 0]} />

      {/* Core geometry */}
      <CoreSphere />
      <OuterShell />
      <EnergyParticles />

      {/* Layered orbit rings */}
      <Ring radius={1.9} tube={0.012} rotX={1.1} rotY={0.3} color={COLORS.ring}   speed={0.14} opacity={0.65} />
      <Ring radius={2.2} tube={0.010} rotX={0.4} rotY={1.2} color={COLORS.core}   speed={0.09} opacity={0.50} />
      <Ring radius={2.6} tube={0.008} rotX={1.8} rotY={0.6} color={COLORS.purple} speed={0.06} opacity={0.35} />
      <Ring radius={3.0} tube={0.007} rotX={0.9} rotY={2.1} color={COLORS.ring}   speed={0.05} opacity={0.25} />
    </group>
  );
}
