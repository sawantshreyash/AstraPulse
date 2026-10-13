
import { lazy, Suspense, useState, useMemo } from "react";
import { Zap } from "lucide-react";
import { queuePressure } from "../3d/sceneConstants";

const InfrastructureScene = lazy(() => import("../3d/InfrastructureScene"));

function PressureLegend() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
      {[
        { label: "Low",      bg: "var(--green)",  range: "0–30%" },
        { label: "Moderate", bg: "var(--amber)",  range: "30–70%" },
        { label: "High",     bg: "var(--red)",    range: "70–100%" },
      ].map(({ label, bg, range }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem" }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: bg }} />
          <span style={{ color: "var(--text-muted)" }}>{label}</span>
          <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>{range}</span>
        </div>
      ))}
    </div>
  );
}

function WorkerPressureRow({ worker }) {
  const p = queuePressure(worker);
  const color = p > 0.7 ? "var(--red)" : p > 0.3 ? "var(--amber)" : "var(--green)";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "140px 1fr 60px 60px",
      alignItems: "center",
      gap: 12,
      padding: "8px 14px",
      borderBottom: "1px solid var(--line)",
      fontSize: "0.82rem",
    }}>
      <div>
        <div style={{ fontWeight: 600, color: "var(--text)" }}>{worker.name || worker.worker_id}</div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{worker.worker_id}</div>
      </div>
      <div style={{ position: "relative", height: 8, borderRadius: 4, background: "var(--surface-muted)", border: "1px solid var(--line)" }}>
        <div style={{
          position: "absolute", inset: 0, width: `${Math.round(p * 100)}%`,
          borderRadius: 4, background: color,
          transition: "width 600ms var(--ease-out), background 400ms",
        }} />
      </div>
      <div style={{ color, fontWeight: 700, textAlign: "right" }}>{Math.round(p * 100)}%</div>
      <div style={{ textAlign: "right", color: "var(--text-dim)", fontSize: "0.76rem" }}>
        {worker.queued_requests ?? 0}/{worker.capacity}
      </div>
    </div>
  );
}

export default function ShockwavePage({ workers }) {
  const [selectedWorkerId, setSelectedWorkerId] = useState("");

  const globalPressure = useMemo(() =>
    workers.length
      ? workers.reduce((s, w) => s + queuePressure(w), 0) / workers.length
      : 0,
    [workers]
  );

  const shockwaveActive = globalPressure > 0.15;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header panel */}
      <div className="panel" style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Zap size={16} style={{ color: "var(--amber)" }} />
          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Queue Shockwave Visualization</span>
          <div style={{
            marginLeft: "auto",
            padding: "3px 10px",
            borderRadius: 12,
            background: globalPressure > 0.5 ? "var(--red-glow)" : globalPressure > 0.2 ? "var(--amber-glow)" : "var(--green-glow)",
            border: `1px solid ${globalPressure > 0.5 ? "var(--red-dim)" : globalPressure > 0.2 ? "var(--amber-dim)" : "var(--green-dim)"}`,
            color: globalPressure > 0.5 ? "var(--red)" : globalPressure > 0.2 ? "var(--amber)" : "var(--green)",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}>
            Global pressure: {Math.round(globalPressure * 100)}%
          </div>
        </div>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
          The 3D visualization responds to actual queue depth from the backend worker registry.
          Expanding ring pulses indicate queue pressure. Run a scenario in the Testing page to generate load.
        </p>
      </div>

      {/* 3D scene — full-width */}
      <div className="panel" style={{ padding: 0, overflow: "hidden", height: 500 }}>
        <div style={{
          position: "absolute",
          top: 10, left: 14, zIndex: 10,
          fontSize: "0.7rem", color: "var(--text-dim)",
          fontFamily: "Inter, sans-serif",
          pointerEvents: "none",
        }}>
          Click a worker node for details
        </div>
        <Suspense fallback={
          <div className="loading-panel" style={{ height: 500 }}>
            <div className="spinner" />Loading 3D shockwave…
          </div>
        }>
          <InfrastructureScene
            workers={workers}
            selectedWorkerId={selectedWorkerId}
            onSelectWorker={setSelectedWorkerId}
            routeAnim={null}
            paused={false}
            globalPressure={globalPressure}
            shockwaveActive={shockwaveActive}
            style={{ height: 500 }}
          />
        </Suspense>
      </div>

      {/* Per-worker pressure table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: 6 }}>Worker Queue Pressure</div>
          <PressureLegend />
        </div>
        {workers.length === 0 ? (
          <div style={{ padding: 24, color: "var(--text-dim)", fontSize: "0.85rem", textAlign: "center" }}>
            No workers in registry
          </div>
        ) : (
          <div>
            <div style={{
              display: "grid", gridTemplateColumns: "140px 1fr 60px 60px",
              gap: 12, padding: "6px 14px",
              fontSize: "0.68rem", color: "var(--text-xdim)",
              textTransform: "uppercase", letterSpacing: "0.08em",
              borderBottom: "1px solid var(--line)",
            }}>
              <span>Worker</span><span>Pressure bar</span><span style={{ textAlign: "right" }}>%</span><span style={{ textAlign: "right" }}>Q/Cap</span>
            </div>
            {workers.map(w => <WorkerPressureRow key={w.worker_id} worker={w} />)}
          </div>
        )}
      </div>
    </div>
  );
}
