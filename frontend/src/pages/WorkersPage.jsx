
import { Cpu, Plus, RotateCcw, Trash2 } from "lucide-react";

export default function WorkersPage({
  workers,
  changedWorkerIds,
  selectedWorkerId,
  routeResult,
  onSelect,
  onUpdateStatus,
  onRemove,
  onAddWorker,
  onResetWorkers,
  busyWorkerId,
  newWorker,
  onNewWorkerChange,
  loading,
}) {
  const routeWorkerId = routeResult?.selected_worker;

  if (loading) {
    return <div className="loading-panel"><div className="spinner" /> Loading workers…</div>;
  }

  return (
    <div>
      {/* Worker grid */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Logical Worker Topology</div>
            <div className="panel-subtitle">Select a worker to inspect its state. Not a physical network map.</div>
          </div>
          <span className="topology-count">{workers.length} {workers.length === 1 ? "worker" : "workers"}</span>
        </div>

        {workers.length === 0 ? (
          <div className="empty-state">
            <Cpu size={40} />
            <p className="empty-state-title">No workers registered</p>
            <p className="empty-state-text">Use the form below to add a worker or reset to defaults.</p>
          </div>
        ) : (
          <div className="topology-layout">
            <div className="worker-grid" aria-label="Worker nodes">
              {workers.map((w, i) => {
                const isSelected = w.worker_id === selectedWorkerId;
                const isRouted = w.worker_id === routeWorkerId;
                const isChanged = changedWorkerIds.includes(w.worker_id);
                const util = w.capacity > 0 && w.active_slots != null
                  ? Math.min(w.active_slots / w.capacity, 1)
                  : null;
                const utilPct = util != null ? Math.round(util * 100) : null;

                return (
                  <div
                    key={w.worker_id}
                    className={[
                      "worker-card",
                      isSelected ? "selected" : "",
                      isRouted ? "routed" : "",
                      isChanged ? "changed" : "",
                    ].filter(Boolean).join(" ")}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(w.worker_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(w.worker_id);
                      }
                    }}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="worker-card-header">
                      <span className={`status-pill ${w.status}`}>{w.status}</span>
                      <span className="worker-card-name">{w.name || w.worker_id}</span>
                    </div>
                    <div className="worker-card-id">{w.worker_id}</div>

                    {utilPct != null && (
                      <div className="worker-util-bar-track">
                        <div
                          className={`worker-util-bar-fill${utilPct > 90 ? " critical" : utilPct > 70 ? " high" : ""}`}
                          style={{ width: `${utilPct}%` }}
                        />
                      </div>
                    )}

                    <div className="worker-stats">
                      <div className="worker-stat">
                        <span className="worker-stat-label">Capacity</span>
                        <span className="worker-stat-value">{w.capacity ?? "—"}</span>
                      </div>
                      <div className="worker-stat">
                        <span className="worker-stat-label">Active</span>
                        <span className="worker-stat-value">{w.active_slots ?? "—"}</span>
                      </div>
                      <div className="worker-stat">
                        <span className="worker-stat-label">Queue</span>
                        <span className="worker-stat-value">{w.queued_requests ?? "—"}</span>
                      </div>
                    </div>

                    <div className="worker-card-footer">
                      <span style={{ fontSize: "0.74rem", color: "var(--text-dim)" }}>
                        {Array.isArray(w.available_at_ms) ? `avail. ${w.available_at_ms[0] ?? "—"} ms` : "unavailable"}
                      </span>
                      <div className="worker-actions" onClick={e => e.stopPropagation()}>
                        <select
                          aria-label={`Change ${w.name || w.worker_id} status`}
                          value={w.status}
                          disabled={busyWorkerId === w.worker_id}
                          onChange={e => onUpdateStatus(w.worker_id, e.target.value)}
                        >
                          <option value="healthy">healthy</option>
                          <option value="degraded">degraded</option>
                          <option value="offline">offline</option>
                        </select>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm btn-icon"
                          disabled={busyWorkerId === w.worker_id}
                          onClick={e => { e.stopPropagation(); onRemove(w.worker_id); }}
                          aria-label={`Remove ${w.name || w.worker_id}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {isRouted && <div className="route-marker">▶ Current routing target</div>}
                  </div>
                );
              })}
            </div>

            {/* Inspector */}
            <aside className="inspector" aria-live="polite">
              {selectedWorkerId ? (() => {
                const w = workers.find(x => x.worker_id === selectedWorkerId);
                if (!w) return null;
                const candidate = routeResult?.candidates?.find(c => c.worker_id === w.worker_id);
                const isTarget = routeResult?.selected_worker === w.worker_id;
                return (
                  <>
                    <div className="inspector-header">
                      <div>
                        <div className="inspector-eyebrow">Worker Inspector</div>
                        <div className="inspector-name">{w.name}</div>
                        <div className="inspector-id">{w.worker_id}</div>
                      </div>
                      <span className={`status-pill ${w.status}`}>{w.status}</span>
                    </div>
                    <div className="inspector-grid">
                      {[
                        ["Capacity", w.capacity],
                        ["Active Slots", w.active_slots],
                        ["Queued", w.queued_requests],
                        ["Service Rate", w.service_rate],
                        ["Cost / ms", w.cost_per_service_ms],
                        ["Next Available", Array.isArray(w.available_at_ms) ? `${w.available_at_ms[0] ?? "—"} ms` : "—"],
                      ].map(([label, value]) => (
                        <div className="inspector-value" key={label}>
                          <div className="inspector-value-label">{label}</div>
                          <div className="inspector-value-data">{value ?? "—"}</div>
                        </div>
                      ))}
                    </div>
                    <p className="inspector-note">Utilization is derived: active slots ÷ capacity.</p>
                    {routeResult && (
                      <div className="routing-summary">
                        <h4>Latest Routing Relationship</h4>
                        <p><strong>{routeResult.request_id}</strong> · {routeResult.status}</p>
                        <p>{isTarget ? "✓ Selected for the latest request." : "Not selected for the latest request."}</p>
                        {candidate?.prediction ? (
                          <div className="candidate-prediction">
                            Score {candidate.prediction.score?.toFixed(4) ?? "—"} · completion {candidate.prediction.completion_time_ms ?? "—"} ms
                          </div>
                        ) : (
                          <p className="inspector-note">{candidate?.reason || "No candidate prediction returned."}</p>
                        )}
                        <small style={{ color: "var(--text-xdim)", display: "block", marginTop: 8, fontSize: "0.72rem" }}>
                          Candidate data reflects one decision, not a permanent connection.
                        </small>
                      </div>
                    )}
                  </>
                );
              })() : (
                <div className="inspector-placeholder">
                  <Cpu size={32} style={{ opacity: 0.2 }} />
                  <strong>Select a Worker Node</strong>
                  <p>Details and routing relationships will appear here.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>

      {/* Lifecycle controls */}
      <div className="two-col">
        {/* Add worker */}
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Worker Lifecycle</div>
              <div className="panel-subtitle">Register new workers or reset to defaults.</div>
            </div>
          </div>
          <form
            onSubmit={onAddWorker}
            className="form-grid"
          >
            {[
              ["Worker ID", "worker_id", "text", newWorker.worker_id],
              ["Name", "name", "text", newWorker.name],
              ["Capacity", "capacity", "number", newWorker.capacity],
              ["Service Rate", "service_rate", "number", newWorker.service_rate],
            ].map(([label, name, type, value]) => (
              <label className="form-label" key={name}>
                {label}
                <input
                  type={type}
                  name={name}
                  value={value}
                  min={type === "number" ? "0.001" : undefined}
                  step={name === "service_rate" || name === "cost_per_service_ms" ? "0.001" : undefined}
                  onChange={e => onNewWorkerChange(name, e.target.value)}
                  required
                />
              </label>
            ))}
            <label className="form-label">
              Synthetic Cost / ms
              <input
                type="number"
                name="cost_per_service_ms"
                value={newWorker.cost_per_service_ms}
                min="0"
                step="0.0001"
                onChange={e => onNewWorkerChange("cost_per_service_ms", e.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={Boolean(busyWorkerId)}
            >
              {busyWorkerId === "add" ? <><div className="spinner sm" /> Adding…</> : <><Plus size={15} /> Add Worker</>}
            </button>
          </form>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 14, width: "100%" }}
            onClick={onResetWorkers}
            disabled={Boolean(busyWorkerId)}
          >
            {busyWorkerId === "reset" ? <><div className="spinner sm" /> Resetting…</> : <><RotateCcw size={14} /> Reset Default Pool</>}
          </button>
        </section>

        {/* Worker table */}
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Registry Table</div>
              <div className="panel-subtitle">All workers with full details</div>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Status</th>
                  <th>Queue</th>
                  <th>Cap.</th>
                  <th>Svc Rate</th>
                  <th>Cost/ms</th>
                </tr>
              </thead>
              <tbody>
                {workers.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-dim)", padding: 24 }}>No workers</td></tr>
                ) : workers.map(w => (
                  <tr
                    key={w.worker_id}
                    style={{ cursor: "pointer" }}
                    onClick={() => onSelect(w.worker_id)}
                    className={w.worker_id === selectedWorkerId ? "worker-row-selected" : ""}
                  >
                    <td>
                      <strong>{w.name || w.worker_id}</strong>
                      <small style={{ fontFamily: "monospace", color: "var(--text-dim)" }}>{w.worker_id}</small>
                    </td>
                    <td><span className={`status-pill ${w.status}`}>{w.status}</span></td>
                    <td>{w.queued_requests ?? "—"}</td>
                    <td>{w.capacity ?? "—"}</td>
                    <td>{w.service_rate ?? "—"}</td>
                    <td>{w.cost_per_service_ms ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
