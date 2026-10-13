import SchedulingDecisionPanel from "../components/SchedulingDecisionPanel";
import WorkerLoadChart from "../charts/WorkerLoadChart";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, CheckCircle, Clock, Cpu, DollarSign, Gauge,
  Info, Play, RotateCcw, Send, TrendingDown, Users, Zap,
} from "lucide-react";
import { workerPosition } from "../3d/sceneConstants";

// Lazy-load the heavy 3D scene
const InfrastructureScene = lazy(() => import("../3d/InfrastructureScene"));

/* ── Worker inspector sidebar ────────────────────────────────── */
function WorkerInspector({ worker, routeResult }) {
  if (!worker) {
    return (
      <div className="inspector-placeholder" style={{ minHeight: 220 }}>
        <Cpu size={28} style={{ opacity: 0.15 }} />
        <strong>Click a node</strong>
        <p>Select a worker in the 3D scene to inspect its state.</p>
      </div>
    );
  }

  const util   = worker.capacity > 0 ? Math.min(worker.active_slots / worker.capacity, 1) : null;
  const pressure = worker.capacity > 0 ? Math.min(Number(worker.queued_requests || 0) / worker.capacity, 1) : 0;
  const isTarget = routeResult?.selected_worker === worker.worker_id;
  const candidate = routeResult?.candidates?.find(c => c.worker_id === worker.worker_id);

  return (
    <div className="inspector" style={{ padding: "16px 14px" }}>
      <div className="inspector-header" style={{ marginBottom: 12 }}>
        <div>
          <div className="inspector-eyebrow">Worker Inspector</div>
          <div className="inspector-name" style={{ fontSize: "0.94rem" }}>{worker.name}</div>
          <div className="inspector-id">{worker.worker_id}</div>
        </div>
        <span className={`status-pill ${worker.status}`}>{worker.status}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          ["Capacity", worker.capacity],
          ["Active",   worker.active_slots],
          ["Queue",    worker.queued_requests],
          ["Svc Rate", worker.service_rate],
          ["Cost/ms",  worker.cost_per_service_ms],
          ["Next avail", Array.isArray(worker.available_at_ms) ? `${worker.available_at_ms[0] ?? "—"}ms` : "—"],
        ].map(([label, val]) => (
          <div className="inspector-value" key={label} style={{ padding: "8px 10px" }}>
            <div className="inspector-value-label">{label}</div>
            <div className="inspector-value-data" style={{ fontSize: "0.86rem" }}>{val ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Utilization bar */}
      {util != null && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-dim)", marginBottom: 3 }}>
            <span>Utilization</span>
            <span>{Math.round(util * 100)}%</span>
          </div>
          <div className="worker-util-bar-track">
            <div className={`worker-util-bar-fill${util > 0.9 ? " critical" : util > 0.7 ? " high" : ""}`}
              style={{ width: `${Math.round(util * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Queue pressure */}
      {pressure > 0.05 && (
        <div style={{ padding: "8px 10px", borderRadius: 5, background: "var(--amber-glow)", border: "1px solid var(--amber-dim)", fontSize: "0.78rem", color: "var(--amber)" }}>
          Queue pressure: {Math.round(pressure * 100)}%
        </div>
      )}

      {/* Last routing relationship */}
      {routeResult && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Latest Routing
          </div>
          {isTarget ? (
            <div style={{ fontSize: "0.82rem", color: "var(--cyan)", fontWeight: 600 }}>
              ✓ Selected for {routeResult.request_id}
            </div>
          ) : (
            <div style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
              Not selected for latest request
            </div>
          )}
          {candidate?.prediction && (
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              Score: {candidate.prediction.score?.toFixed(3) ?? "—"} ·
              {" "}Completion: {candidate.prediction.completion_time_ms ?? "—"}ms
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Quick route form ────────────────────────────────────────── */
function QuickRoutePanel({ onRoute, routing, routeResult, workers }) {
  const [form, setForm] = useState({
    request_id: `req-${Date.now().toString().slice(-4)}`,
    model: "llama-3-8b",
    input_tokens: 500,
    output_tokens: 200,
    arrival_time_ms: 0,
    deadline_ms: 2000,
    deadline_mode: "soft",
    policy: "astrapulse",
  });

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      input_tokens:    Number(form.input_tokens),
      output_tokens:   Number(form.output_tokens),
      arrival_time_ms: Number(form.arrival_time_ms),
      deadline_ms:     Number(form.deadline_ms),
    };
    onRoute(payload);
    // New request ID for next submission
    setForm(f => ({ ...f, request_id: `req-${Date.now().toString().slice(-4)}` }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label className="form-label" style={{ fontSize: "0.72rem" }}>
            Model
            <input value={form.model} onChange={e => update("model", e.target.value)} required style={{ padding: "6px 9px", fontSize: "0.8rem" }} />
          </label>
          <label className="form-label" style={{ fontSize: "0.72rem" }}>
            Policy
            <select value={form.policy} onChange={e => update("policy", e.target.value)} style={{ padding: "6px 9px", fontSize: "0.8rem" }}>
              <option value="astrapulse">AstraPulse</option>
              <option value="round_robin">Round-Robin</option>
              <option value="least_loaded">Least-Loaded</option>
            </select>
          </label>
          <label className="form-label" style={{ fontSize: "0.72rem" }}>
            Input tokens
            <input type="number" value={form.input_tokens} onChange={e => update("input_tokens", e.target.value)} min={1} required style={{ padding: "6px 9px", fontSize: "0.8rem" }} />
          </label>
          <label className="form-label" style={{ fontSize: "0.72rem" }}>
            Deadline (ms)
            <input type="number" value={form.deadline_ms} onChange={e => update("deadline_ms", e.target.value)} min={1} required style={{ padding: "6px 9px", fontSize: "0.8rem" }} />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={routing} style={{ justifyContent: "center" }}>
          {routing ? <><div className="spinner sm" /> Routing…</> : <><Send size={13} /> Route Request</>}
        </button>
      </form>

      {/* Compact result */}
      {routeResult && (
        <div style={{
          padding: "10px 12px",
          borderRadius: 6,
          border: `1px solid ${routeResult.status === "routed" ? "var(--cyan-dim)" : "var(--red-dim)"}`,
          background: routeResult.status === "routed" ? "var(--cyan-glow)" : "var(--red-glow)",
          fontSize: "0.8rem",
          animation: "result-enter 200ms ease both",
        }}>
          <div style={{ fontWeight: 700, color: routeResult.status === "routed" ? "var(--cyan)" : "var(--red)", marginBottom: 4 }}>
            {routeResult.status === "routed" ? `✓ Routed → ${routeResult.selected_worker}` : `✗ ${routeResult.status}`}
          </div>
          {routeResult.explanation?.[0] && (
            <div style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>{routeResult.explanation[0]}</div>
          )}
          {routeResult.prediction && (
            <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: "0.74rem", color: "var(--text-dim)" }}>
              <span>Completion: {routeResult.prediction.completion_time_ms}ms</span>
              <span>Cost: {routeResult.prediction.estimated_cost?.toFixed(4)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── KPI strip ───────────────────────────────────────────────── */
function KpiStrip({ workers, metrics }) {
  const healthy   = workers.filter(w => w.status === "healthy").length;
  const degraded  = workers.filter(w => w.status === "degraded").length;
  const offline   = workers.filter(w => w.status === "offline").length;
  const queued    = workers.reduce((s, w) => s + Number(w.queued_requests || 0), 0);
  const avgPress  = workers.length
    ? workers.reduce((s, w) => s + Math.min(Number(w.queued_requests || 0) / Math.max(Number(w.capacity) || 1, 1), 1), 0) / workers.length
    : 0;

  const kpis = [
    { label: "Healthy",    value: healthy,                   color: "green",  icon: Users },
    { label: "Degraded",   value: degraded,                  color: "amber",  icon: TrendingDown },
    { label: "Offline",    value: offline,                   color: "red",    icon: Zap },
    { label: "Routed",     value: metrics?.routing_decisions ?? "—", color: "blue",   icon: Activity },
    { label: "Completed",  value: metrics?.completed_requests ?? "—", color: "cyan",   icon: CheckCircle },
    { label: "Avg Pressure", value: `${Math.round(avgPress * 100)}%`, color: avgPress > 0.7 ? "red" : avgPress > 0.4 ? "amber" : "green", icon: Gauge },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(6, 1fr)",
      gap: 8,
      marginBottom: 16,
    }}>
      {kpis.map(({ label, value, color, icon: Icon }) => (
        <div key={label} className="kpi-card" style={{ padding: "12px 14px", margin: 0 }}>
          <div className={`kpi-icon ${color}`} style={{ marginBottom: 8 }}><Icon /></div>
          <div className="kpi-label" style={{ fontSize: "0.64rem" }}>{label}</div>
          <div className="kpi-value" style={{ fontSize: "1.2rem" }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Scenario quick-launcher ─────────────────────────────────── */
function ScenarioLauncher({ catalog, onRun, running }) {
  const [sel, setSel] = useState("burst");
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <label className="form-label" style={{ fontSize: "0.72rem", margin: 0 }}>
        Scenario
        <select value={sel} onChange={e => setSel(e.target.value)} disabled={running} style={{ padding: "6px 9px", fontSize: "0.8rem" }}>
          {catalog.map(s => (
            <option key={s.scenario_id} value={s.scenario_id} disabled={!s.supported}>
              {s.scenario_id}{!s.supported ? " (unsupported)" : ""}
            </option>
          ))}
        </select>
      </label>
      <button className="btn btn-secondary btn-sm" onClick={() => onRun(sel)} disabled={running}>
        {running ? <><div className="spinner sm" /> Running…</> : <><Play size={12} /> Run Scenario</>}
      </button>
    </div>
  );
}

/* ── Main OverviewPage ────────────────────────────────────────── */
export default function OverviewPage({
  workers,
  metrics,
  routeResult,
  routing,
  onRoute,
  selectedWorkerId,
  onSelectWorker,
  routeAnim,
  onPauseToggle,
  scenarioPaused,
  scenarioCatalog,
  onRunScenario,
  scenarioRunning,
  scenarioResult,
}) {
  // Compute global pressure from real worker data
  const globalPressure = workers.length
    ? workers.reduce((s, w) =>
        s + Math.min(Number(w.queued_requests || 0) / Math.max(Number(w.capacity) || 1, 1), 1), 0
      ) / workers.length
    : 0;

  const selectedWorker = workers.find(w => w.worker_id === selectedWorkerId);
  const shockwaveActive = scenarioRunning || globalPressure > 0.3;

  // Reduced-motion respect
  const prefersReduced = typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI strip */}
      <KpiStrip workers={workers} metrics={metrics} />

      {/* Main grid: 3D scene + right panel */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 300px",
        gap: 14,
        alignItems: "start",
      }}>

        {/* ─── 3D Scene panel ─── */}
        <div className="panel" style={{ padding: 0, overflow: "hidden", minHeight: 480, position: "relative" }}>
          {/* Scene header */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            padding: "10px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "linear-gradient(to bottom, rgba(6,12,22,0.92), transparent)",
            zIndex: 5,
            pointerEvents: "none",
          }}>
            <div>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                AstraPulse — Live Infrastructure
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 1 }}>
                {workers.length} workers · drag to orbit · scroll to zoom
              </div>
            </div>
            {globalPressure > 0.3 && (
              <div style={{
                fontSize: "0.7rem", fontWeight: 700, padding: "3px 9px",
                borderRadius: 12, border: "1px solid var(--amber-dim)",
                background: "var(--amber-glow)", color: "var(--amber)",
              }}>
                ⚡ Queue Pressure {Math.round(globalPressure * 100)}%
              </div>
            )}
          </div>

          {prefersReduced ? (
            /* Reduced motion fallback: 2D worker grid */
            <div style={{ padding: 20 }}>
              <div className="worker-grid">
                {workers.map(w => (
                  <button
                    key={w.worker_id}
                    className={`worker-card${selectedWorkerId === w.worker_id ? " selected" : ""}`}
                    onClick={() => onSelectWorker(w.worker_id)}
                  >
                    <div className="worker-card-header">
                      <span className={`status-pill ${w.status}`}>{w.status}</span>
                      <span className="worker-card-name">{w.name || w.worker_id}</span>
                    </div>
                    <div className="worker-stats">
                      <div className="worker-stat"><span className="worker-stat-label">Cap</span><span className="worker-stat-value">{w.capacity}</span></div>
                      <div className="worker-stat"><span className="worker-stat-label">Queue</span><span className="worker-stat-value">{w.queued_requests ?? 0}</span></div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Suspense fallback={
              <div className="loading-panel" style={{ height: 480 }}>
                <div className="spinner" />
                <span>Initialising 3D scene…</span>
              </div>
            }>
              <InfrastructureScene
                workers={workers}
                selectedWorkerId={selectedWorkerId}
                onSelectWorker={onSelectWorker}
                routeAnim={routeAnim}
                paused={scenarioPaused}
                globalPressure={globalPressure}
                shockwaveActive={shockwaveActive}
                style={{ height: 480 }}
              />
            </Suspense>
          )}

          {/* Pause/resume — overlaid at bottom of 3D panel */}
          {!prefersReduced && (
            <div style={{
              position: "absolute", bottom: 14, left: 14, zIndex: 10,
            }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.72rem", padding: "4px 10px", background: "rgba(6,12,22,0.75)", backdropFilter: "blur(4px)" }}
                onClick={onPauseToggle}
              >
                {scenarioPaused ? "▶ Resume" : "⏸ Pause"}
              </button>
            </div>
          )}
        </div>

        {/* ─── Right column ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Worker inspector */}
          <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)" }}>Node Inspector</span>
              {selectedWorker && (
                <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.7rem", padding: "3px 8px" }} onClick={() => onSelectWorker("")}>Clear</button>
              )}
            </div>
            <WorkerInspector worker={selectedWorker} routeResult={routeResult} />
          </section>

          {/* Route a request */}
          <section className="panel" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
              Route Request
            </div>
            <QuickRoutePanel
              onRoute={onRoute}
              routing={routing}
              routeResult={routeResult}
              workers={workers}
            />
          </section>

          {/* Scenario launcher */}
          {scenarioCatalog.length > 0 && (
            <section className="panel" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                Simulate Load
              </div>
              <ScenarioLauncher
                catalog={scenarioCatalog}
                onRun={onRunScenario}
                running={scenarioRunning}
              />
              {scenarioResult && (
                <div style={{ marginTop: 10, fontSize: "0.76rem", color: "var(--text-muted)", padding: "8px 10px", borderRadius: 5, background: "var(--surface-muted)", border: "1px solid var(--line)" }}>
                  <strong style={{ color: "var(--text)" }}>Scenario complete</strong>
                  {" · "}{scenarioResult.decisions?.length ?? "?"} decisions
                  {scenarioResult.decisions && (
                    <span style={{ color: "var(--cyan)", marginLeft: 4 }}>
                      · {scenarioResult.decisions.filter(d => d.status === "routed").length} routed
                    </span>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      
      {/* Worker capacity and queue intelligence */}
      <WorkerLoadChart workers={workers} />

      {/* Scheduling decision and candidate intelligence */}
      <SchedulingDecisionPanel
        routeResult={routeResult}
        selectedWorkerId={selectedWorkerId}
      />

      {/* Candidate workers from last routing decision */}
      {routeResult?.candidates && routeResult.candidates.length > 0 && (
        <section className="panel" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
            Last Routing Decision — Candidate Evaluation
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {routeResult.candidates.map(c => (
              <div key={c.worker_id} style={{
                padding: "8px 11px",
                borderRadius: 6,
                border: `1px solid ${c.worker_id === routeResult.selected_worker ? "var(--cyan-dim)" : "var(--line)"}`,
                background: c.worker_id === routeResult.selected_worker ? "var(--cyan-glow)" : "var(--surface-muted)",
                fontSize: "0.78rem",
                minWidth: 140,
              }}>
                <div style={{ fontWeight: 700, color: c.worker_id === routeResult.selected_worker ? "var(--cyan)" : "var(--text)", marginBottom: 3 }}>
                  {c.worker_id === routeResult.selected_worker ? "✓ " : ""}
                  {c.worker_id}
                </div>
                <div style={{ color: c.eligible ? "var(--green)" : "var(--red)", fontSize: "0.72rem", marginBottom: 3 }}>
                  {c.eligible ? "eligible" : `excluded — ${c.reason}`}
                </div>
                {c.prediction && (
                  <div style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>
                    {c.prediction.completion_time_ms}ms · score {c.prediction.score?.toFixed(3)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
