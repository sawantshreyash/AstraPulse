
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock3,
  Gauge,
  Target,
} from "lucide-react";

import BenchmarkChart from "../charts/BenchmarkChart";

const POLICY_NAMES = {
  astrapulse: "AstraPulse",
  round_robin: "Round-Robin",
  least_loaded: "Least-Loaded",
};

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";

  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  color = "blue",
}) {
  return (
    <article className="kpi-card">
      <div className={`kpi-icon ${color}`}>
        <Icon size={17} />
      </div>

      <div className="kpi-label">{label}</div>

      <div className="kpi-value">{value}</div>

      {detail && <div className="kpi-detail">{detail}</div>}
    </article>
  );
}

function MetricBars({
  title,
  subtitle,
  results,
  field,
  format,
  lowerIsBetter = false,
}) {
  const valid = results.filter(
    (result) =>
      Number.isFinite(result[field]) &&
      result[field] >= 0
  );

  const maxValue = Math.max(
    ...valid.map((result) => result[field]),
    0
  );

  return (
    <section className="panel metric-bars-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="panel-subtitle">{subtitle}</p>
        </div>
      </div>

      {valid.length === 0 ? (
        <div className="chart-empty">
          No valid measurements are available for this metric.
        </div>
      ) : (
        <div className="metric-bars">
          {valid.map((result) => {
            const value = result[field];

            const percentage =
              maxValue > 0
                ? (value / maxValue) * 100
                : 0;

            const color =
              result.policy === "astrapulse"
                ? "#49aaff"
                : result.policy === "round_robin"
                  ? "#48e0e6"
                  : "#8d9cff";

            return (
              <div
                className="metric-bar-row"
                key={result.policy}
              >
                <div className="metric-bar-heading">
                  <span className="metric-bar-name">
                    {POLICY_NAMES[result.policy] ??
                      result.policy ??
                      "Unknown"}
                  </span>

                  <strong
                    className="metric-bar-value"
                    style={{ color }}
                  >
                    {format(value)}
                  </strong>
                </div>

                <div
                  className="metric-bar-track"
                  role="img"
                  aria-label={`${POLICY_NAMES[result.policy] ?? result.policy}: ${format(value)}`}
                >
                  <div
                    className="metric-bar-fill"
                    style={{
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${color}95, ${color})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="chart-note">
        {lowerIsBetter
          ? "Lower values are preferable, assuming equivalent workload conditions."
          : "Compare values under identical workload and simulation settings."}
      </p>
    </section>
  );
}

export default function AnalyticsPage({
  benchmarkResult,
  metrics,
}) {
  const results =
    benchmarkResult?.results ??
    metrics?.latest_benchmark?.results ??
    [];

  const safeResults = Array.isArray(results)
    ? results
    : [];

  const astra = safeResults.find(
    (result) => result.policy === "astrapulse"
  );

  const validLatencies = safeResults.filter(
    (result) =>
      Number.isFinite(result.p50_latency_ms) &&
      result.p50_latency_ms >= 0
  );

  const bestLatency =
    validLatencies.length > 0
      ? validLatencies.reduce((best, result) =>
          result.p50_latency_ms < best.p50_latency_ms
            ? result
            : best
        )
      : null;

  const throughputValues = safeResults.filter(
    (result) =>
      Number.isFinite(result.throughput) &&
      result.throughput >= 0
  );

  const bestThroughput =
    throughputValues.length > 0
      ? Math.max(
          ...throughputValues.map(
            (result) => result.throughput
          )
        )
      : null;

  const liveStats = [
    {
      label: "Routing Decisions",
      value: metrics?.routing_decisions,
    },
    {
      label: "Completed Requests",
      value: metrics?.completed_requests,
    },
    {
      label: "Failed Requests",
      value: metrics?.failed_requests,
    },
    {
      label: "Deadline Misses",
      value: metrics?.deadline_misses,
    },
  ];

  return (
    <div className="analytics-workspace">
      <header className="page-header">
        <div className="page-eyebrow">
          PERFORMANCE INTELLIGENCE
        </div>

        <h1 className="page-title">
          Analytics Overview
        </h1>

        <p className="page-subtitle">
          Evaluate scheduling efficiency, latency distribution,
          throughput and deadline behavior.
        </p>
      </header>

      <section className="analytics-summary">
        <div className="analytics-section-heading">
          <div>
            <h2>Benchmark summary</h2>
            <p>
              Based on the latest available benchmark results
            </p>
          </div>

          <span className="analytics-data-badge">
            <Activity size={13} />
            Simulation metrics
          </span>
        </div>

        <div className="kpi-grid analytics-kpis">
          <StatCard
            label="AstraPulse P50"
            value={
              Number.isFinite(astra?.p50_latency_ms)
                ? `${formatNumber(astra.p50_latency_ms)} ms`
                : "—"
            }
            detail="Median latency"
            icon={Clock3}
            color="blue"
          />

          <StatCard
            label="AstraPulse P95"
            value={
              Number.isFinite(astra?.p95_latency_ms)
                ? `${formatNumber(astra.p95_latency_ms)} ms`
                : "—"
            }
            detail="95th-percentile latency"
            icon={Gauge}
            color="cyan"
          />

          <StatCard
            label="Highest throughput"
            value={
              bestThroughput !== null
                ? `${formatNumber(bestThroughput)} /s`
                : "—"
            }
            detail="Across measured policies"
            icon={BarChart3}
            color="blue"
          />

          <StatCard
            label="Lowest P50"
            value={
              bestLatency
                ? `${formatNumber(bestLatency.p50_latency_ms)} ms`
                : "—"
            }
            detail={
              bestLatency
                ? `Policy: ${POLICY_NAMES[bestLatency.policy] ?? bestLatency.policy}`
                : "No latency measurement"
            }
            icon={Target}
            color="cyan"
          />
        </div>
      </section>

      <section className="analytics-chart-section">
        <div className="analytics-section-heading">
          <div>
            <h2>Performance comparisons</h2>
            <p>
              Use the same request count, seed and workload profile
              when evaluating policies.
            </p>
          </div>
        </div>

        {safeResults.length > 0 ? (
          <BenchmarkChart results={safeResults} />
        ) : (
          <section className="panel analytics-empty">
            <div className="empty-state">
              <BarChart3 size={36} />

              <p className="empty-state-title">
                Waiting for benchmark results
              </p>

              <p className="empty-state-text">
                Open Scheduling Decisions, run a benchmark,
                and return here to compare actual measured
                simulation metrics.
              </p>
            </div>
          </section>
        )}
      </section>

      {safeResults.length > 0 && (
        <section className="analytics-detail-grid">
          <MetricBars
            title="Throughput by policy"
            subtitle="Completed requests per simulated second"
            results={safeResults}
            field="throughput"
            format={(value) => `${formatNumber(value)} /s`}
          />

          <MetricBars
            title="Deadline miss rate"
            subtitle="Fraction of requests missing their deadline"
            results={safeResults}
            field="deadline_miss_rate"
            format={(value) =>
              `${formatNumber(value * 100, 1)}%`
            }
            lowerIsBetter
          />
        </section>
      )}

      {metrics && (
        <section className="panel live-metrics-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Live pipeline counters
              </h2>

              <p className="panel-subtitle">
                Current backend counters, distinct from the
                benchmark results above.
              </p>
            </div>

            <span className="analytics-data-badge">
              <Activity size={13} />
              Live snapshot
            </span>
          </div>

          <div className="result-grid analytics-live-grid">
            {liveStats.map((stat) => (
              <div
                key={stat.label}
                className="result-value"
              >
                <span>{stat.label}</span>

                <strong>
                  {stat.value ?? "—"}
                </strong>
              </div>
            ))}
          </div>

          {Number.isFinite(metrics.deadline_misses) &&
            Number.isFinite(metrics.completed_requests) &&
            metrics.completed_requests > 0 && (
              <p className="chart-note">
                Live deadline-miss count relative to completed
                requests:{" "}
                {formatNumber(
                  (metrics.deadline_misses /
                    metrics.completed_requests) *
                    100,
                  1
                )}
                %. This is a simple counter ratio, not necessarily
                the benchmark's deadline-miss rate.
              </p>
            )}
        </section>
      )}
    </div>
  );
}
