
import { Activity, Clock, Cpu, GitBranch } from "lucide-react";

function StatCard({ label, value, icon: Icon, color = "blue" }) {
  return (
    <div className="kpi-card" style={{ animationDelay: "0ms" }}>
      <div className={`kpi-icon ${color}`}><Icon /></div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value ?? "—"}</div>
    </div>
  );
}

export default function LiveMonitorPage({
  workers,
  metrics,
  routeResult,
  loading,
  refreshing,
}) {
  const simTime = workers[0]?.available_at_ms?.[0] ?? metrics?.simulation_time_ms ?? null;
  const routingDecisions = metrics?.routing_decisions ?? null;
  const failedRequests = metrics?.failed_requests ?? null;
  const completedRequests = metrics?.completed_requests ?? null;

  if (loading) {
    return (
      <div className="loading-panel">
        <div className="spinner" /> Loading live data…
      </div>
    );
  }

  return (
    <div>
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        <StatCard label="Routing Decisions" value={routingDecisions} icon={Activity} color="blue" />
        <StatCard label="Completed Requests" value={completedRequests} icon={GitBranch} color="green" />
        <StatCard label="Failed Requests" value={failedRequests} icon={Activity} color="red" />
        <StatCard label="Registered Workers" value={workers.length || "—"} icon={Cpu} color="cyan" />
        {simTime != null && (
          <StatCard label="Sim Time (ms)" value={simTime} icon={Clock} color="purple" />
        )}
      </div>

      {/* Latest route result */}
      {routeResult && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Latest Routing Decision</div>
              <div className="panel-subtitle">Most recent request routing result</div>
            </div>
            <span className={`status-pill ${routeResult.status === "routed" ? "healthy" : "offline"}`}>
              {routeResult.status}
            </span>
          </div>
          <div className="result-grid">
            <div className="result-value"><span>Request ID</span><strong>{routeResult.request_id}</strong></div>
            <div className="result-value"><span>Policy</span><strong>{routeResult.policy}</strong></div>
            <div className="result-value"><span>Selected Worker</span><strong>{routeResult.selected_worker || "None"}</strong></div>
            {routeResult.prediction && (
              <>
                <div className="result-value"><span>Queue Delay</span><strong>{routeResult.prediction.queue_delay_ms} ms</strong></div>
                <div className="result-value"><span>Completion Time</span><strong>{routeResult.prediction.completion_time_ms} ms</strong></div>
                <div className="result-value"><span>Est. Cost</span><strong>{routeResult.prediction.estimated_cost?.toFixed?.(4) ?? "—"}</strong></div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Worker Registry */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Worker Registry</div>
            <div className="panel-subtitle">Live state of all registered workers</div>
          </div>
          {refreshing && <div className="spinner sm" />}
          <span className="topology-count">{workers.length} {workers.length === 1 ? "worker" : "workers"}</span>
        </div>
        {workers.length === 0 ? (
          <div className="empty-state">
            <Cpu size={36} />
            <p className="empty-state-title">No workers registered</p>
            <p className="empty-state-text">Navigate to Workers to register new workers.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Status</th>
                  <th>Queue</th>
                  <th>Active</th>
                  <th>Capacity</th>
                  <th>Service Rate</th>
                  <th>Cost/ms</th>
                  <th>Next Available</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => {
                  const util = w.capacity > 0 ? Math.min(w.active_slots / w.capacity, 1) : null;
                  const utilPct = util != null ? Math.round(util * 100) : null;
                  return (
                    <tr key={w.worker_id}>
                      <td>
                        <strong>{w.name || w.worker_id}</strong>
                        <small style={{ fontFamily: "monospace", color: "var(--text-dim)" }}>{w.worker_id}</small>
                      </td>
                      <td><span className={`status-pill ${w.status}`}>{w.status}</span></td>
                      <td>{w.queued_requests ?? "—"}</td>
                      <td>{w.active_slots ?? "—"}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {w.capacity ?? "—"}
                          {utilPct != null && (
                            <div className="worker-util-bar-track" style={{ width: 60 }}>
                              <div
                                className={`worker-util-bar-fill${utilPct > 90 ? " critical" : utilPct > 70 ? " high" : ""}`}
                                style={{ width: `${utilPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{w.service_rate ?? "—"}</td>
                      <td>{w.cost_per_service_ms ?? "—"}</td>
                      <td>{Array.isArray(w.available_at_ms) ? `${w.available_at_ms[0] ?? "—"} ms` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
