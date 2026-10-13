
import { useMemo } from "react";

const POLICIES = [
  { id: "astrapulse", label: "AstraPulse" },
  { id: "round_robin", label: "Round-Robin" },
  { id: "least_loaded", label: "Least-Loaded" },
];

const METRICS = [
  {
    key: "p95_latency_ms",
    label: "P95 latency",
    unit: " ms",
    lowerIsBetter: true,
  },
  {
    key: "throughput",
    label: "Throughput",
    unit: " req/s",
    lowerIsBetter: false,
  },
  {
    key: "deadline_miss_rate",
    label: "Deadline miss rate",
    percent: true,
    lowerIsBetter: true,
  },
  {
    key: "total_estimated_cost",
    label: "Estimated cost",
    unit: "",
    lowerIsBetter: true,
  },
];

function formatValue(value, metric) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  if (metric.percent) {
    return `${(value * 100).toFixed(2)}%`;
  }

  return `${value.toFixed(2)}${metric.unit}`;
}

export default function RobustnessBenchmark({
  runs = [],
  running = false,
}) {
  const summary = useMemo(() => {
    return POLICIES.map((policy) => {
      const policyResults = runs.flatMap((run) =>
        (run.results || []).filter(
          (result) => result.policy === policy.id
        )
      );

      const values = {};

      METRICS.forEach((metric) => {
        const samples = policyResults
          .map((result) => result[metric.key])
          .filter(
            (value) =>
              typeof value === "number" &&
              Number.isFinite(value)
          );

        values[metric.key] = {
          average:
            samples.length > 0
              ? samples.reduce((sum, value) => sum + value, 0) /
                samples.length
              : null,
          worst:
            samples.length > 0
              ? metric.lowerIsBetter
                ? Math.max(...samples)
                : Math.min(...samples)
              : null,
          sampleCount: samples.length,
        };
      });

      return {
        ...policy,
        values,
      };
    });
  }, [runs]);

  return (
    <section className="panel robustness-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Multi-Seed Robustness Results</div>
          <div className="panel-subtitle">
            Compare average and worst observed performance across
            repeated simulated workloads.
          </div>
        </div>
      </div>

      {running && (
        <div className="result-box running" role="status">
          <div className="robustness-progress">
            <span className="spinner sm" />
            Running robustness tests: {runs.length}/5 seeds completed…
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">
            No robustness results yet
          </p>
          <p className="empty-state-text">
            Run the five-seed test above to compare scheduler
            consistency.
          </p>
        </div>
      ) : (
        <>
          <div className="robustness-summary">
            <div className="robustness-summary-item">
              <span>Completed runs</span>
              <strong>{runs.length}/5</strong>
            </div>

            <div className="robustness-summary-item">
              <span>Policies compared</span>
              <strong>{POLICIES.length}</strong>
            </div>

            <div className="robustness-summary-item">
              <span>Seeds</span>
              <strong>
                {runs.map((run) => run.seed).join(", ")}
              </strong>
            </div>
          </div>

          <div className="table-wrapper benchmark-table robustness-table">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2}>Policy</th>
                  {METRICS.map((metric) => (
                    <th key={metric.key} colSpan={2}>
                      {metric.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {METRICS.flatMap((metric) => [
                    <th key={`${metric.key}-average`}>Average</th>,
                    <th key={`${metric.key}-worst`}>Worst</th>,
                  ])}
                </tr>
              </thead>

              <tbody>
                {summary.map((policy) => (
                  <tr key={policy.id}>
                    <td>
                      <strong
                        className={
                          policy.id === "astrapulse"
                            ? "robustness-primary-policy"
                            : ""
                        }
                      >
                        {policy.label}
                      </strong>
                    </td>

                    {METRICS.flatMap((metric) => {
                      const values = policy.values[metric.key];

                      return [
                        <td key={`${metric.key}-average`}>
                          {formatValue(values.average, metric)}
                        </td>,
                        <td key={`${metric.key}-worst`}>
                          {formatValue(values.worst, metric)}
                        </td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="robustness-legend">
            <p>
              <strong>Worst-case definition:</strong> maximum latency,
              deadline-miss rate and estimated cost; minimum throughput.
            </p>
            <p>
              Averages use the available numeric results for each policy.
              All values are based on simulated benchmarks, not live
              production measurements.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
