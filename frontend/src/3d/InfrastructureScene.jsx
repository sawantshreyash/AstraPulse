
import { Suspense, useRef, useCallback, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import OrchestratorCore from "./OrchestratorCore";
import WorkerNetwork from "./WorkerNetwork";
import RoutingAnimation from "./RoutingAnimation";
import { COLORS } from "./sceneConstants";

// ── Stars / ambient particles ────────────────────────────────────

const STAR_COUNT = 300;
function Starfield() {
  const positions = useMemo(() => {
    const arr = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return arr;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={typeof positions === "function" ? positions() : positions}
          count={STAR_COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color={0x4a6a8a} size={0.04} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

// ── Grid floor ───────────────────────────────────────────────────
function GridFloor() {
  return (
    <gridHelper
      args={[28, 28, 0x1c2e46, 0x1a2840]}
      position={[0, -4, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

// ── Ambient / directional lights ─────────────────────────────────
function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.08} />
      <directionalLight position={[5, 10, 5]} intensity={0.4} color={0xb8d4f0} castShadow={false} />
      <hemisphereLight skyColor={0x0d2040} groundColor={0x020408} intensity={0.3} />
    </>
  );
}

// ── Camera auto-rotation + reset ─────────────────────────────────
function CameraController({ paused, orbitRef }) {
  useFrame((_, dt) => {
    if (!paused && orbitRef.current) {
      orbitRef.current.autoRotate = true;
      orbitRef.current.autoRotateSpeed = 0.3;
      orbitRef.current.update();
    } else if (orbitRef.current) {
      orbitRef.current.autoRotate = false;
    }
  });
  return null;
}

// ── WebGL unavailable fallback ───────────────────────────────────
function WebGLFallback({ workers }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      gap: 16,
      color: "var(--text-dim)",
      fontSize: "0.88rem",
      padding: 24,
      textAlign: "center",
    }}>
      <div style={{ fontSize: "2rem" }}>⬡</div>
      <strong style={{ color: "var(--text-muted)" }}>3D scene unavailable</strong>
      <p style={{ margin: 0, maxWidth: 280 }}>
        WebGL is not supported or is disabled. Worker data is still available in the Workers and Live Monitor pages.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8, width: "100%", maxWidth: 320 }}>
        {workers.map(w => (
          <div key={w.worker_id} style={{
            padding: "8px 10px",
            border: "1px solid var(--line)",
            borderRadius: 6,
            background: "var(--surface-muted)",
            fontSize: "0.78rem",
          }}>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>{w.name || w.worker_id}</div>
            <div style={{ color: w.status === "healthy" ? "var(--green)" : w.status === "degraded" ? "var(--amber)" : "var(--red)" }}>
              {w.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main exported 3D Canvas ──────────────────────────────────────
export default function InfrastructureScene({
  workers,
  selectedWorkerId,
  onSelectWorker,
  routeAnim,
  paused,
  globalPressure,
  shockwaveActive,
  style,
}) {
  const orbitRef = useRef();
  const [webglOk, setWebglOk] = useState(true);

  // Detect WebGL support
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!ctx) setWebglOk(false);
    } catch {
      setWebglOk(false);
    }
  }, []);

  const resetCamera = useCallback(() => {
    if (orbitRef.current) {
      orbitRef.current.reset();
    }
  }, []);

  if (!webglOk) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", ...style }}>
        <WebGLFallback workers={workers} />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", ...style }}>
      <Canvas
        camera={{ position: [0, 3.5, 14], fov: 52, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "default",
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color(0x060c16), 1);
        }}
        style={{ background: "#060c16" }}
      >
        <SceneLights />
        <Starfield />
        <GridFloor />

        <Suspense fallback={null}>
          <OrchestratorCore />
          <WorkerNetwork
            workers={workers}
            selectedWorkerId={selectedWorkerId}
            onSelectWorker={onSelectWorker}
          />
          <RoutingAnimation
            routeAnim={routeAnim}
            workers={workers}
            globalPressure={globalPressure}
            shockwaveActive={shockwaveActive}
          />
        </Suspense>

        <OrbitControls
          ref={orbitRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={5}
          maxDistance={22}
          minPolarAngle={0.3}
          maxPolarAngle={Math.PI - 0.3}
          makeDefault
        />
        <CameraController paused={paused} orbitRef={orbitRef} />
      </Canvas>

      {/* Scene overlay controls */}
      <div style={{
        position: "absolute",
        bottom: 14,
        right: 14,
        display: "flex",
        gap: 6,
        zIndex: 10,
      }}>
        <button
          type="button"
          title={paused ? "Resume animation" : "Pause animation"}
          onClick={() => {}} // handled by parent
          style={{
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid var(--line-strong)",
            background: "rgba(6,12,22,0.75)",
            color: "var(--text-muted)",
            fontSize: "0.72rem",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button
          type="button"
          title="Reset camera"
          onClick={resetCamera}
          style={{
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid var(--line-strong)",
            background: "rgba(6,12,22,0.75)",
            color: "var(--text-muted)",
            fontSize: "0.72rem",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          ⌖ Reset view
        </button>
      </div>
    </div>
  );
}
