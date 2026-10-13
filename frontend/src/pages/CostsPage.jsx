
import { DollarSign } from "lucide-react";

export default function CostsPage({ benchmarkResult, metrics }) {
  const results = benchmarkResult?.results ?? metrics?.latest_benchmark?.results ?? [];

  return (
    <div>
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Cost Analysis</div>
            <div className="panel-subtitle">
              Synthetic estimated compute costs per scheduling policy. These are simulated estimates, not real cloud billing.
            </div>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="empty-state">
            <DollarSign size={40} />
            <p className="empty-state-title">No cost data available</p>
            <p className="empty-state-text">Run a benchmark from the Scheduling Decisions page to generate cost estimates.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {results.map(r => {
              const cost = r.total_estimated_cost ?? 0;
              const maxCost = Math.max(...results.map(x => x.total_estimated_cost ?? 0), 0.001);
              const pct = (cost / maxCost) * 100;
              return (
                <div key={r.policy} style={{
                  padding: "16px 18px",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  background: r.policy === "astrapulse" ? "var(--blue-glow-soft)" : "var(--surface-muted)",
                  borderColor: r.policy === "astrapulse" ? "var(--line-accent)" : "var(--line)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: "0.96rem", fontWeight: 700, color: r.policy === "astrapulse" ? "var(--blue)" : "var(--text)", marginBottom: 3 }}>
                        {r.policy === "astrapulse" ? "AstraPulse" : r.policy === "round_robin" ? "Round-Robin" : "Least-Loaded"}
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-dim)" }}>
                        {r.completed_requests ?? 0} requests completed · {r.failed_requests ?? 0} failed
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em" }}>
                        {cost.toFixed(4)}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>synthetic units</div>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      borderRadius: 3,
                      background: r.policy === "astrapulse" ? "var(--blue)" : r.policy === "round_robin" ? "var(--cyan)" : "var(--purple)",
                      width: `${pct}%`,
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    <span>Cost/req: {r.completed_requests ? (cost / r.completed_requests).toFixed(5) : "—"}</span>
                    <span>Miss rate: {((r.deadline_miss_rate ?? 0) * 100).toFixed(1)}%</span>
                    <span>Throughput: {r.throughput?.toFixed(2) ?? "—"} /s</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Cost Disclaimer</div>
          </div>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", margin: 0 }}>
          All cost figures are <strong>synthetic estimates</strong> produced by the AstraPulse simulation engine.
          They represent the sum of <code>cost_per_service_ms × service_time_ms</code> across all routed requests
          under each scheduling policy. These values are not connected to any real cloud provider billing,
          GPU pricing, or network cost. Use them for relative policy comparison only.
        </p>
      </section>
    </div>
  );
}
