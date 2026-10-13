
import { useCallback, useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";

/* ─── Pressure calculation ───────────────────────────────────────
 * pressure = queuedRequests / max(capacity, 1)
 * Clamped to [0, 1]. Returns 0 if worker has no valid data.
 * ─────────────────────────────────────────────────────────────── */
function calcPressure(worker) {
  const capacity = Number(worker.capacity);
  const queued = Number(worker.queued_requests ?? 0);
  if (!Number.isFinite(capacity) || capacity <= 0) return 0;
  return Math.min(queued / capacity, 1);
}

function pressureColor(p) {
  if (p > 0.8) return "#f07070";
  if (p > 0.5) return "#e8b84d";
  if (p > 0.2) return "#4da6ff";
  return "#4ecb91";
}

function pressureLabel(p) {
  if (p > 0.8) return "critical";
  if (p > 0.5) return "high";
  if (p > 0.2) return "moderate";
  return "normal";
}

/* ─── History entry ──────────────────────────────────────────── */
const MAX_HISTORY = 60;

/* ─── Radar ring for each worker ────────────────────────────── */
function WorkerRadar({ worker, pressure, pulses }) {
  const color = pressureColor(pressure);
  const pct = Math.round(pressure * 100);
  const radius = 36 + pressure * 24; // 36–60px visual ring
  const strokeDash = Math.PI * 2 * radius;
  const strokeOffset = strokeDash * (1 - pressure);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
      position: "relative",
      animation: "card-enter 360ms ease-out both",
    }}>
      {/* Radar circle */}
      <div style={{ position: "relative", width: 120, height: 120 }}>
        {/* Pulse rings */}
        {pulses.map((p, i) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `2px solid ${color}`,
              opacity: 0,
              animation: `shockwave-pulse 1.2s ease-out both`,
              animationDelay: `${i * 120}ms`,
              pointerEvents: "none",
            }}
          />
        ))}
        {/* SVG ring */}
        <svg viewBox="0 0 120 120" width="120" height="120" style={{ position: "absolute", inset: 0 }}>
          {/* Background track */}
          <circle cx="60" cy="60" r={radius - 4} fill="none" stroke="#1c2e46" strokeWidth="8" />
          {/* Pressure arc */}
          <circle
            cx="60"
            cy="60"
            r={radius - 4}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${strokeDash} ${strokeDash}`}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
          />
        </svg>
        {/* Center label */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}>
          <strong style={{ fontSize: "1.1rem", fontWeight: 800, color, lineHeight: 1, transition: "color 0.4s ease" }}>
            {pct}%
          </strong>
          <small style={{ fontSize: "0.62rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {pressureLabel(pressure)}
          </small>
        </div>
      </div>

      {/* Worker info */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
          {worker.name || worker.worker_id}
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "monospace", marginBottom: 4 }}>
          {worker.worker_id}
        </div>
        <span className={`status-pill ${worker.status}`}>{worker.status}</span>
      </div>

      {/* Queue/capacity bar */}
      <div style={{ width: "100%", maxWidth: 120 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-dim)", marginBottom: 3 }}>
          <span>Queue: {worker.queued_requests ?? 0}</span>
          <span>Cap: {worker.capacity ?? "?"}</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "var(--line)", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            borderRadius: 2,
            background: color,
            width: `${pct}%`,
            transition: "width 0.6s ease, background 0.4s ease",
          }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Sparkline ─────────────────────────────────────────────── */
function Sparkline({ history, workerId, color }) {
  const filtered = history.map(snap => {
    const w = snap.find(x => x.worker_id === workerId);
    return w ? calcPressure(w) : 0;
  });
  if (!filtered.length) return null;
  const width = 200;
  const height = 50;
  const max = Math.max(...filtered, 0.01);
  const pts = filtered
    .map((v, i) => `${(i / (filtered.length - 1 || 1)) * width},${height - (v / max) * height}`)
    .join(" ");

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

/* ─── Main component ────────────────────────────────────────── */
export default function ShockwavePage({ workers }) {
  const [history, setHistory] = useState([]); // array of worker snapshots
  const [pulseMap, setPulseMap] = useState({}); // workerId -> [{id}]
  const previousPressures = useRef({});
  const pulseIdRef = useRef(0);

  // Update history and detect pressure changes on workers update
  const PULSE_THRESHOLD = 0.15;

  const updateSnapshot = useCallback((currentWorkers) => {
    if (!currentWorkers.length) return;

    setHistory(prev => {
      const next = [...prev, currentWorkers].slice(-MAX_HISTORY);
      return next;
    });

    // Detect meaningful pressure increases
    const triggered = {};
    currentWorkers.forEach(w => {
      const p = calcPressure(w);
      const prev = previousPressures.current[w.worker_id] ?? 0;
      const delta = p - prev;
      if (delta >= PULSE_THRESHOLD && p > 0.1) {
        const id = ++pulseIdRef.current;
        triggered[w.worker_id] = [{ id }];
        setTimeout(() => {
          setPulseMap(m => {
            const next = { ...m };
            if (Array.isArray(next[w.worker_id])) {
              next[w.worker_id] = next[w.worker_id].filter(x => x.id !== id);
            }
            return next;
          });
        }, 1400);
      }
      previousPressures.current[w.worker_id] = p;
    });

    if (Object.keys(triggered).length) {
      setPulseMap(m => ({ ...m, ...triggered }));
    }
  }, []);

  useEffect(() => {
    updateSnapshot(workers);
  }, [workers, updateSnapshot]);

  const totalPressure = workers.length
    ? workers.reduce((acc, w) => acc + calcPressure(w), 0) / workers.length
    : 0;

  return (
    <div>
      {/* Overall pressure indicator */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", marginBottom: 20 }}>
        <div className="kpi-card primary">
          <div className={`kpi-icon ${totalPressure > 0.7 ? "red" : totalPressure > 0.4 ? "amber" : "green"}`}>
            <Radio />
          </div>
          <div className="kpi-label">Avg Queue Pressure</div>
          <div className="kpi-value" style={{ color: pressureColor(totalPressure) }}>
            {Math.round(totalPressure * 100)}%
          </div>
          <div className="kpi-detail">{pressureLabel(totalPressure)} · {workers.length} workers</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue"><Radio /></div>
          <div className="kpi-label">Total Queued</div>
          <div className="kpi-value">{workers.reduce((acc, w) => acc + Number(w.queued_requests || 0), 0)}</div>
          <div className="kpi-detail">Across all workers</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon cyan"><Radio /></div>
          <div className="kpi-label">History Snapshots</div>
          <div className="kpi-value">{history.length}</div>
          <div className="kpi-detail">Last {MAX_HISTORY} polling cycles</div>
        </div>
      </div>

      {/* Radar grid */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Worker Queue Pressure Radar</div>
            <div className="panel-subtitle">
              Pressure = queue depth ÷ capacity. Shockwave pulses fire on significant pressure increases (≥{Math.round(PULSE_THRESHOLD * 100)}% delta).
            </div>
          </div>
        </div>

        {workers.length === 0 ? (
          <div className="empty-state">
            <Radio size={40} />
            <p className="empty-state-title">No workers to visualize</p>
            <p className="empty-state-text">Register workers on the Workers page, then run a simulation to generate queue pressure data.</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 28,
            padding: "20px 0",
          }}>
            {workers.map(w => (
              <WorkerRadar
                key={w.worker_id}
                worker={w}
                pressure={calcPressure(w)}
                pulses={pulseMap[w.worker_id] || []}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pressure history sparklines */}
      {history.length > 1 && workers.length > 0 && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Pressure History</div>
              <div className="panel-subtitle">Rolling pressure trend per worker (last {MAX_HISTORY} snapshots)</div>
            </div>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}>
            {workers.map(w => {
              const p = calcPressure(w);
              const color = pressureColor(p);
              return (
                <div key={w.worker_id} style={{
                  padding: "14px 16px",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-muted)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text)" }}>{w.name || w.worker_id}</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>{w.worker_id}</div>
                    </div>
                    <span style={{ fontSize: "1rem", fontWeight: 800, color }}>{Math.round(p * 100)}%</span>
                  </div>
                  <Sparkline history={history} workerId={w.worker_id} color={color} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <style>{`
        @keyframes shockwave-pulse {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
