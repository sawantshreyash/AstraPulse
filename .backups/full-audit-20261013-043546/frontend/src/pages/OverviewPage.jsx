
import {
  Activity,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  Gauge,
  TrendingDown,
  Users,
  Zap,
} from "lucide-react";
import BenchmarkChart from "../charts/BenchmarkChart";

function KpiCard({ label, value, detail, icon: Icon, iconColor = "blue", primary = false, delay = 0 }) {
  const isEmpty = value === null || value === undefined || value === "—";
  return (
    <article
      className={`kpi-card${primary ? " primary" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {Icon && (
        <div className={`kpi-icon ${iconColor}`}>
          <Icon />
        </div>
      )}
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${isEmpty ? "" : ""}`}>
        {isEmpty ? <span className="kpi-empty">—</span> : value}
      </div>
      {detail && <div className="kpi-detail">{detail}</div>}
    </article>
  );
}

function SectionPanel({ title, subtitle, children }) {
  return (
    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-header">
        <div>
          <div className="panel-title">{title}</div>
          {subtitle && <div className="panel-subtitle">{subtitle}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}

function WorkerHealthBar({ workers }) {
  if (!workers.length) return null;
  const healthy = workers.filter(w => w.status === "healthy").length;
  const degraded = workers.filter(w => w.status === "degraded").length;
  const offline = workers.filter(w => w.status === "offline").length;
  const total = workers.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 4, height: 8, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ flex: healthy / total, background: "var(--green)", transition: "flex 0.4s ease" }} />
        <div style={{ flex: degraded / total, background: "var(--amber)", transition: "flex 0.4s ease" }} />
        <div style={{ flex: offline / total, background: "var(--red)", transition: "flex 0.4s ease" }} />
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: "0.78rem", color: "var(--text-dim)" }}>
        <span style={{ color: "var(--green)" }}>● {healthy} healthy</span>
        {degraded > 0 && <span style={{ color: "var(--amber)" }}>● {degraded} degraded</span>}
        {offline > 0 && <span style={{ color: "var(--red)" }}>● {offline} offline</span>}
      </div>
    </div>
  );
}

function PolicyRow({ result }) {
  const isAp = result.policy === "astrapulse";
  return (
    <tr>
      <td>
        <strong style={{ color: isAp ? "var(--blue)" : "inherit" }}>
          {result.policy === "astrapulse"
            ? "AstraPulse"
            : result.policy === "round_robin"
            ? "Round-Robin"
            : "Least-Loaded"}
        </strong>
        {isAp && (
          <span className="kpi-icon blue" style={{ display: "inline-flex", marginLeft: 6, padding: "1px 5px", borderRadius: 4, fontSize: "0.64rem", verticalAlign: "middle" }}>
            ✓ Best
          </span>
        )}
      </td>
      <td>{result.completed_requests ?? "—"}</td>
      <td>{result.failed_requests ?? "—"}</td>
      <td>
        {result.p50_latency_ms ?? "—"} / {result.p95_latency_ms ?? "—"} ms
      </td>
      <td>{result.throughput?.toFixed(2) ?? "—"} /s</td>
      <td>{((result.deadline_miss_rate ?? 0) * 100).toFixed(1)}%</td>
      <td>{result.total_estimated_cost?.toFixed(3) ?? "—"}</td>
    </tr>
  );
}

export default function OverviewPage({
  workers,
  metrics,
  benchmarkResult,
  loading,
}) {
  const totalWorkers = workers.length;
  const healthyWorkers = workers.filter(w => w.status === "healthy").length;
  const offlineWorkers = workers.filter(w => w.status === "offline").length;
  const degradedWorkers = workers.filter(w => w.status === "degraded").length;
  const queuedRequests = workers.reduce((t, w) => t + Number(w.queued_requests || 0), 0);
  const routingDecisions = metrics?.routing_decisions ?? null;
  const completedRequests = metrics?.completed_requests ?? null;
  const failedRequests = metrics?.failed_requests ?? null;
  const deadlineMisses = metrics?.deadline_misses ?? null;
  const latestBenchmark = metrics?.latest_benchmark;
  const benchmarkResults = benchmarkResult?.results ?? latestBenchmark?.results ?? [];

  const p95 = latestBenchmark?.results?.[0]?.p95_latency_ms;
  const p50 = latestBenchmark?.results?.[0]?.p50_latency_ms;
  const estimatedCost = latestBenchmark?.results?.[0]?.total_estimated_cost;
  const throughput = latestBenchmark?.results?.[0]?.throughput;

  if (loading) {
    return (
      <div className="loading-panel">
        <div className="spinner" />
        Loading AstraPulse data…
      </div>
    );
  }

  return (
    <div>
      {/* KPI Grid */}
      <div className="kpi-grid">
        <KpiCard label="Registered Workers" value={totalWorkers || "—"} detail={`${healthyWorkers} healthy · ${offlineWorkers} offline`} icon={Users} iconColor="blue" primary delay={0} />
        <KpiCard label="Routing Decisions" value={routingDecisions ?? "—"} detail="Total recorded decisions" icon={Activity} iconColor="cyan" primary delay={40} />
        <KpiCard label="Completed Requests" value={completedRequests ?? "—"} detail="Reported by backend" icon={CheckCircle} iconColor="green" primary delay={80} />
        <KpiCard label="Failed Requests" value={failedRequests ?? "—"} detail="Requests without a route" icon={Zap} iconColor="red" delay={120} />
        <KpiCard label="Deadline Misses" value={deadlineMisses ?? "—"} detail="Soft deadline violations" icon={TrendingDown} iconColor="amber" delay={160} />
        <KpiCard label="Queued Requests" value={queuedRequests > 0 ? queuedRequests : (totalWorkers ? "0" : "—")} detail="Sum across all workers" icon={Layers} iconColor="purple" delay={200} />
        <KpiCard label="P50 Latency" value={p50 != null ? `${p50} ms` : "—"} detail="Latest benchmark" icon={Clock} iconColor="cyan" delay={240} />
        <KpiCard label="P95 Latency" value={p95 != null ? `${p95} ms` : "—"} detail="Latest benchmark" icon={Clock} iconColor="amber" delay={280} />
        <KpiCard label="Throughput" value={throughput != null ? `${throughput.toFixed(2)}/s` : "—"} detail="Requests per second" icon={Gauge} iconColor="green" delay={320} />
        <KpiCard label="Est. Cost" value={estimatedCost != null ? estimatedCost.toFixed(3) : "—"} detail="Synthetic estimate" icon={DollarSign} iconColor="purple" delay={360} />
      </div>

      <div className="two-col" style={{ alignItems: "start", marginBottom: 20 }}>
        {/* Worker health */}
        <SectionPanel title="Worker Health" subtitle="Current status of the simulated worker pool">
          {workers.length === 0 ? (
            <div className="empty-state">
              <Users size={36} />
              <p className="empty-state-title">No workers registered</p>
              <p className="empty-state-text">Go to the Workers page to add or reset the worker pool.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <WorkerHealthBar workers={workers} />
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Status</th>
                      <th>Queue</th>
                      <th>Capacity</th>
                      <th>Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map(w => {
                      const util = w.capacity > 0 ? Math.round((w.active_slots / w.capacity) * 100) : null;
                      return (
                        <tr key={w.worker_id}>
                          <td>
                            <strong>{w.name || w.worker_id}</strong>
                            <small style={{ fontFamily: "monospace", color: "var(--text-dim)" }}>{w.worker_id}</small>
                          </td>
                          <td><span className={`status-pill ${w.status}`}>{w.status}</span></td>
                          <td>{w.queued_requests ?? "—"}</td>
                          <td>{w.capacity ?? "—"}</td>
                          <td>{util != null ? `${util}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionPanel>

        {/* Key insights */}
        <SectionPanel title="Key Insights" subtitle="Derived from available benchmark results">
          {benchmarkResults.length === 0 ? (
            <div className="empty-state">
              <BarChart3 size={36} />
              <p className="empty-state-title">No benchmark results yet</p>
              <p className="empty-state-text">Run a benchmark from the Scheduling Decisions page to see policy performance insights here.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {benchmarkResults.map((r, i) => (
                <div key={r.policy} style={{
                  padding: "12px 14px",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                  background: r.policy === "astrapulse" ? "var(--blue-glow-soft)" : "var(--surface-muted)",
                  borderColor: r.policy === "astrapulse" ? "var(--line-accent)" : "var(--line)",
                  animationDelay: `${i * 60}ms`
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong style={{ fontSize: "0.88rem", color: r.policy === "astrapulse" ? "var(--blue)" : "var(--text)" }}>
                      {r.policy === "astrapulse" ? "AstraPulse" : r.policy === "round_robin" ? "Round-Robin" : "Least-Loaded"}
                    </strong>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{((r.deadline_miss_rate ?? 0) * 100).toFixed(1)}% miss rate</span>
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    <span>P50: {r.p50_latency_ms ?? "—"} ms</span>
                    <span>P95: {r.p95_latency_ms ?? "—"} ms</span>
                    <span>Throughput: {r.throughput?.toFixed(2) ?? "—"}/s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>

      {/* Latency chart */}
      {benchmarkResults.length > 0 && (
        <SectionPanel title="Latency Comparison" subtitle="P50 / P95 latency per policy from the latest benchmark run">
          <BenchmarkChart results={benchmarkResults} />
          <div className="two-col" style={{ marginTop: 16 }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Completed</th>
                    <th>Failed</th>
                    <th>P50 / P95</th>
                    <th>Throughput</th>
                    <th>Miss rate</th>
                    <th>Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkResults.map(r => <PolicyRow key={r.policy} result={r} />)}
                </tbody>
              </table>
            </div>
          </div>
        </SectionPanel>
      )}
    </div>
  );
}
