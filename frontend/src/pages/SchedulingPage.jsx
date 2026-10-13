
import { useState } from "react";
import { BarChart3, Play } from "lucide-react";
import BenchmarkChart from "../charts/BenchmarkChart";
import RobustnessBenchmark from "../components/RobustnessBenchmark";

function formatPolicy(policy) {
  if (policy === "astrapulse") return "AstraPulse";
  if (policy === "round_robin") return "Round-Robin";
  if (policy === "least_loaded") return "Least-Loaded";
  return policy || "Unknown";
}

function formatNumber(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "—";
}

export default function SchedulingPage({
  benchmarkForm,
  onUpdateBenchmarkForm,
  onRunBenchmark,
  benchmarking = false,
  benchmarkResult,
  robustnessRuns = [],
  robustnessRunning = false,
  onRunRobustnessBenchmark,
}) {
  const [localError, setLocalError] = useState("");

  const hasBenchmarkResults =
    Array.isArray(benchmarkResult?.results) &&
    benchmarkResult.results.length > 0;

  async function handleRobustnessClick() {
    setLocalError("");

    if (typeof onRunRobustnessBenchmark !== "function") {
      setLocalError(
        "Robustness handler is missing. Connect onRunRobustnessBenchmark in Dashboard.jsx."
      );
      return;
    }

    try {
      await onRunRobustnessBenchmark();
    } catch (error) {
      setLocalError(
        error?.message || "The robustness test could not start."
      );
    }
  }

  return (
    <div className="scheduling-page">
      <div className="two-col">
        {/* Benchmark configuration */}
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Benchmark Policies</div>
              <div className="panel-subtitle">
                Compare AstraPulse against baseline schedulers using
                a deterministic simulated workload.
              </div>
            </div>
          </div>

          <form onSubmit={onRunBenchmark} className="form-grid">
            <label className="form-label">
              Request Count
              <input
                type="number"
                name="request_count"
                min="1"
                max="1000"
                value={benchmarkForm.request_count}
                onChange={onUpdateBenchmarkForm}
                required
              />
            </label>

            <label className="form-label">
              Random Seed
              <input
                type="number"
                name="seed"
                min="0"
                value={benchmarkForm.seed}
                onChange={onUpdateBenchmarkForm}
                required
              />
            </label>

            <label className="form-label full-width">
              Workload Profile
              <select
                name="workload_profile"
                value={benchmarkForm.workload_profile}
                onChange={onUpdateBenchmarkForm}
              >
                <option value="light">Light</option>
                <option value="mixed">Mixed</option>
                <option value="burst">Burst</option>
              </select>
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={benchmarking || robustnessRunning}
            >
              {benchmarking ? (
                <>
                  <span className="spinner sm" />
                  Running benchmark…
                </>
              ) : (
                <>
                  <Play size={14} />
                  Run Benchmark
                </>
              )}
            </button>
          </form>

          {benchmarking && (
            <div className="result-box running" role="status">
              <span className="spinner sm" />
              Running simulated workload…
            </div>
          )}
        </section>

        {/* Single benchmark results */}
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Benchmark Results</div>
              <div className="panel-subtitle">
                Performance comparison by scheduling policy
              </div>
            </div>
          </div>

          {!benchmarkResult ? (
            <div className="empty-state">
              <BarChart3 size={36} />
              <p className="empty-state-title">No benchmark run yet</p>
              <p className="empty-state-text">
                Configure the workload and select Run Benchmark.
              </p>
            </div>
          ) : !hasBenchmarkResults ? (
            <div className="result-box">
              <p className="result-box-notice">
                The backend returned no policy results for this run.
              </p>
            </div>
          ) : (
            <div className="result-box">
              <div className="benchmark-run-meta">
                <span>
                  <strong>Run ID:</strong>{" "}
                  {benchmarkResult.run_id || "—"}
                </span>
                <span>
                  <strong>Requests:</strong>{" "}
                  {benchmarkResult.request_count ?? "—"}
                </span>
              </div>

              <BenchmarkChart results={benchmarkResult.results} />

              <div className="table-wrapper benchmark-table">
                <table>
                  <thead>
                    <tr>
                      <th>Policy</th>
                      <th>Completed</th>
                      <th>Failed</th>
                      <th>P50 / P95</th>
                      <th>Throughput</th>
                      <th>Miss Rate</th>
                      <th>Estimated Cost</th>
                    </tr>
                  </thead>

                  <tbody>
                    {benchmarkResult.results.map((result) => (
                      <tr key={result.policy}>
                        <td>
                          <strong
                            className={
                              result.policy === "astrapulse"
                                ? "robustness-primary-policy"
                                : ""
                            }
                          >
                            {formatPolicy(result.policy)}
                          </strong>
                        </td>
                        <td>{result.completed_requests ?? "—"}</td>
                        <td>{result.failed_requests ?? "—"}</td>
                        <td>
                          {formatNumber(result.p50_latency_ms)} /{" "}
                          {formatNumber(result.p95_latency_ms)} ms
                        </td>
                        <td>
                          {formatNumber(result.throughput)} /s
                        </td>
                        <td>
                          {typeof result.deadline_miss_rate === "number"
                            ? `${(
                                result.deadline_miss_rate * 100
                              ).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td>
                          {formatNumber(result.total_estimated_cost, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="policy-details-grid">
                {benchmarkResult.results.map((result) => (
                  <article
                    className="policy-result"
                    key={result.policy}
                  >
                    <h4>{formatPolicy(result.policy)}</h4>
                    <p>
                      Deadline misses: {result.deadline_misses ?? "—"}
                    </p>
                    <p>
                      Miss rate:{" "}
                      {typeof result.deadline_miss_rate === "number"
                        ? `${(
                            result.deadline_miss_rate * 100
                          ).toFixed(1)}%`
                        : "—"}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Multi-seed robustness runner */}
      <section className="panel robustness-launcher">
        <div className="panel-header">
          <div>
            <div className="panel-title">Robustness Test</div>
            <div className="panel-subtitle">
              Run five benchmarks with consecutive seeds and compare
              average and worst-case simulated results.
            </div>
          </div>
        </div>

        <div className="robustness-config">
          <div>
            <span className="robustness-config-label">
              Requests per run
            </span>
            <strong>{benchmarkForm.request_count}</strong>
          </div>

          <div>
            <span className="robustness-config-label">
              Starting seed
            </span>
            <strong>{benchmarkForm.seed}</strong>
          </div>

          <div>
            <span className="robustness-config-label">
              Workload profile
            </span>
            <strong>{benchmarkForm.workload_profile}</strong>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleRobustnessClick}
          disabled={benchmarking || robustnessRunning}
        >
          {robustnessRunning ? (
            <>
              <span className="spinner sm" />
              Testing {robustnessRuns.length}/5 seeds…
            </>
          ) : (
            <>
              <Play size={14} />
              Run 5-Seed Robustness Test
            </>
          )}
        </button>

        {localError && (
          <div className="result-box" role="alert">
            <p className="result-box-notice">{localError}</p>
          </div>
        )}

        {robustnessRunning && (
          <div className="result-box running" role="status">
            <span className="spinner sm" />
            {robustnessRuns.length} of 5 runs completed.
          </div>
        )}
      </section>

      <RobustnessBenchmark
        runs={robustnessRuns}
        running={robustnessRunning}
      />
    </div>
  );
}
