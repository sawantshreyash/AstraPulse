
import { useCallback, useEffect, useRef, useState } from "react";
import { api, normalizeWorkers } from "../services/api";
import BenchmarkChart from "../charts/BenchmarkChart";

export default function Dashboard() {
  const [health, setHealth] = useState("checking");
  const [workers, setWorkers] = useState([]);
  const previousWorkers = useRef([]);
  const [changedWorkerIds, setChangedWorkerIds] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [routeResult, setRouteResult] = useState(null);
  const [routing, setRouting] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");

  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [benchmarking, setBenchmarking] = useState(false);

  const [requestForm, setRequestForm] = useState({
    request_id: "req-001",
    model: "llama-3-8b",
    input_tokens: 500,
    output_tokens: 200,
    arrival_time_ms: 0,
    deadline_ms: 2000,
    deadline_mode: "soft",
    policy: "astrapulse",
  });

  const [benchmarkForm, setBenchmarkForm] = useState({
    request_count: 100,
    seed: 42,
    workload_profile: "mixed",
  });

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [healthData, workersData, metricsData] =
        await Promise.all([
          api.health(),
          api.workers(),
          api.metrics(),
        ]);

      setHealth("online");
      const nextWorkers = normalizeWorkers(workersData);
      const previousById = new Map(
        previousWorkers.current.map((worker) => [worker.worker_id, worker])
      );
      const changedIds = nextWorkers
        .filter((worker) => {
          const previous = previousById.get(worker.worker_id);
          return (
            previous &&
            ["status", "active_slots", "queued_requests", "available_at_ms"].some(
              (field) => previous[field] !== worker[field]
            )
          );
        })
        .map((worker) => worker.worker_id);

      setChangedWorkerIds(changedIds);
      previousWorkers.current = nextWorkers;
      setWorkers(nextWorkers);
      setMetrics(metricsData);
    } catch (err) {
      setHealth("offline");
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!changedWorkerIds.length) {
      return undefined;
    }

    const timeout = setTimeout(() => setChangedWorkerIds([]), 1200);
    return () => clearTimeout(timeout);
  }, [changedWorkerIds]);

  useEffect(() => {
    const workerId = routeResult?.selected_worker;
    if (!workerId) {
      return undefined;
    }

    setSelectedWorkerId(workerId);
    const timeout = setTimeout(() => setSelectedWorkerId(""), 1800);
    return () => clearTimeout(timeout);
  }, [routeResult]);

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  function updateRequestForm(event) {
    const { name, value } = event.target;

    const numericFields = [
      "input_tokens",
      "output_tokens",
      "arrival_time_ms",
      "deadline_ms",
    ];

    setRequestForm((current) => ({
      ...current,
      [name]: numericFields.includes(name)
        ? Number(value)
        : value,
    }));
  }

  function updateBenchmarkForm(event) {
    const { name, value } = event.target;

    const numericFields = ["request_count", "seed"];

    setBenchmarkForm((current) => ({
      ...current,
      [name]: numericFields.includes(name)
        ? Number(value)
        : value,
    }));
  }

  async function submitRoute(event) {
    event.preventDefault();
    setRouting(true);
    setError("");
    setRouteResult(null);

    try {
      const result = await api.route(requestForm);
      setRouteResult(result);
      await loadDashboard(true);
    } catch (err) {
      setError(err.message || "Routing request failed.");
    } finally {
      setRouting(false);
    }
  }

  async function runBenchmark(event) {
    event.preventDefault();
    setBenchmarking(true);
    setError("");
    setBenchmarkResult(null);

    try {
      const result = await api.benchmark({
        ...benchmarkForm,
        policies: [
          "astrapulse",
          "round_robin",
          "least_loaded",
        ],
      });

      setBenchmarkResult(result);
      await loadDashboard(true);
    } catch (err) {
      setError(err.message || "Benchmark failed.");
    } finally {
      setBenchmarking(false);
    }
  }

  const totalWorkers = workers.length;
  const healthyWorkers = workers.filter(
    (worker) => worker.status === "healthy"
  ).length;

  const queuedRequests = workers.reduce(
    (total, worker) =>
      total + Number(worker.queued_requests || 0),
    0
  );

  const routingDecisions =
    metrics?.routing_decisions ?? 0;

  const completedRequests =
    metrics?.completed_requests ?? 0;

  const failedRequests =
    metrics?.failed_requests ?? 0;

  const deadlineMisses =
    metrics?.deadline_misses ?? 0;

  const offlineWorkers = workers.filter(
    (worker) => worker.status === "offline"
  ).length;

  const benchmarkResults = benchmarkResult?.results ?? [];
  const latestBenchmark = metrics?.latest_benchmark;

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">PREDICTIVE AI WORKLOAD ORCHESTRATION</p>
          <h1>AstraPulse</h1>
          <p className="subtitle">
            Intelligent inference scheduling and workload visibility
          </p>
        </div>

        <div className="topbar-actions">
          <div className={`connection connection-${health}`}>
            <span
              className={`status-dot ${
                health === "online" ? "online" : "offline"
              }`}
            />
            <span>
              <small>API connection</small>
              <strong>{health}</strong>
            </span>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <strong>Something went wrong:</strong> {error}
          <button
            type="button"
            onClick={() => loadDashboard(true)}
          >
            Retry
          </button>
        </div>
      )}

      <section className="section-heading">
        <div>
          <h2>System overview</h2>
          <p>Current state of the simulated worker pool.</p>
        </div>

      </section>

      {loading ? (
        <div className="panel loading-panel">
          Loading AstraPulse data...
        </div>
      ) : (
        <>
          <section className="metrics-grid">
            <Metric
              emphasis="primary"
              label="Registered workers"
              value={totalWorkers}
              detail={`${healthyWorkers} healthy · ${offlineWorkers} offline`}
            />
            <Metric
              emphasis="primary"
              label="Routing decisions"
              value={routingDecisions}
              detail="Total recorded decisions"
            />
            <Metric
              emphasis="primary"
              label="Completed requests"
              value={completedRequests}
              detail="Reported by backend"
            />
            <Metric
              label="Queued requests"
              value={queuedRequests}
              detail={`${failedRequests} failed requests`}
            />
            <Metric
              label="Deadline misses"
              value={deadlineMisses}
              detail="Reported by backend"
            />
            <Metric
              label="Measured p95 latency"
              value={
                latestBenchmark?.results?.[0]?.p95_latency_ms != null
                  ? `${latestBenchmark.results[0].p95_latency_ms} ms`
                  : "—"
              }
              detail="Latest simulated benchmark"
            />
            <Metric
              label="Measured throughput"
              value={
                latestBenchmark?.results?.[0]?.throughput != null
                  ? `${latestBenchmark.results[0].throughput.toFixed(2)} /s`
                  : "—"
              }
              detail="Completed requests / simulated second"
            />
          </section>

          <section className="panel worker-panel">
            <div className="section-heading">
              <div>
                <h2>Worker status</h2>
                <p>Capacity, queue pressure and health.</p>
              </div>
            </div>

            {workers.length === 0 ? (
              <p>No worker records returned by the backend.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Status</th>
                      <th>Capacity</th>
                      <th>Active slots</th>
                      <th>Queue</th>
                      <th>Service rate</th>
                      <th>Cost / ms</th>
                      <th>Available at (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((worker) => (
                      <tr
                        key={worker.worker_id}
                        className={[
                          changedWorkerIds.includes(worker.worker_id)
                            ? "worker-row-changed"
                            : "",
                          selectedWorkerId === worker.worker_id
                            ? "worker-row-selected"
                            : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <td>
                          <strong>
                            {worker.name || worker.worker_id}
                          </strong>
                          <small>{worker.worker_id}</small>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${worker.status}`}
                          >
                            {worker.status}
                          </span>
                        </td>
                        <td>{worker.capacity ?? "—"}</td>
                        <td>{worker.active_slots ?? "—"}</td>
                        <td>{worker.queued_requests ?? 0}</td>
                        <td>{worker.service_rate ?? "—"}</td>
                        <td>{worker.cost_per_service_ms ?? "—"}</td>
                        <td>{worker.available_at_ms ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="two-column">
            <div className="panel">
              <h2>Route an inference request</h2>
              <p>
                Test how a scheduling policy selects a worker.
              </p>

              <div className={`decision-flow ${routing ? "is-active" : ""} ${routeResult ? "is-complete" : ""}`} aria-live="polite">
                <div className="flow-line" aria-hidden="true" />
                {[
                  ["01", "Request", "received"],
                  ["02", "Candidates", routing ? "evaluating" : routeResult ? "evaluated" : "ready"],
                  ["03", "Constraints", routing ? "checking" : routeResult ? "checked" : "pending"],
                  ["04", "Decision", routing ? "in progress" : routeResult ? "recorded" : "pending"],
                ].map(([number, label, state]) => (
                  <div className={`flow-step flow-${state.replace(" ", "-")}`} key={number}>
                    <span className="flow-marker">{number}</span>
                    <span className="flow-copy">
                      <strong>{label}</strong>
                      <small>{state}</small>
                    </span>
                  </div>
                ))}
              </div>

              <form onSubmit={submitRoute} className="form-grid">
                <label>
                  Request ID
                  <input
                    name="request_id"
                    value={requestForm.request_id}
                    onChange={updateRequestForm}
                    required
                  />
                </label>

                <label>
                  Model
                  <input
                    name="model"
                    value={requestForm.model}
                    onChange={updateRequestForm}
                    required
                  />
                </label>

                <label>
                  Input tokens
                  <input
                    type="number"
                    name="input_tokens"
                    min="1"
                    value={requestForm.input_tokens}
                    onChange={updateRequestForm}
                    required
                  />
                </label>

                <label>
                  Output tokens
                  <input
                    type="number"
                    name="output_tokens"
                    min="1"
                    value={requestForm.output_tokens}
                    onChange={updateRequestForm}
                    required
                  />
                </label>

                <label>
                  Arrival time (ms)
                  <input
                    type="number"
                    name="arrival_time_ms"
                    min="0"
                    value={requestForm.arrival_time_ms}
                    onChange={updateRequestForm}
                    required
                  />
                </label>

                <label>
                  Deadline (ms)
                  <input
                    type="number"
                    name="deadline_ms"
                    min="1"
                    value={requestForm.deadline_ms}
                    onChange={updateRequestForm}
                    required
                  />
                </label>

                <label>
                  Deadline mode
                  <select
                    name="deadline_mode"
                    value={requestForm.deadline_mode}
                    onChange={updateRequestForm}
                  >
                    <option value="soft">Soft</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>

                <label>
                  Scheduling policy
                  <select
                    name="policy"
                    value={requestForm.policy}
                    onChange={updateRequestForm}
                  >
                    <option value="astrapulse">AstraPulse</option>
                    <option value="round_robin">Round-Robin</option>
                    <option value="least_loaded">Least-Loaded</option>
                  </select>
                </label>

                <button
                  className="primary-button full-width"
                  type="submit"
                  disabled={routing}
                >
                  {routing ? "Routing..." : "Route request"}
                </button>
              </form>

              {routeResult && (
                <div className="result-box result-box-enter">
                  <h3>Routing result</h3>
                  <p>
                    <strong>Status:</strong>{" "}
                    {routeResult.status || "unknown"}
                  </p>
                  <p>
                    <strong>Policy:</strong>{" "}
                    {routeResult.policy || requestForm.policy}
                  </p>
                  <p>
                    <strong>Selected worker:</strong>{" "}
                    {routeResult.selected_worker || "None"}
                  </p>

                  {routeResult.prediction && (
                    <div className="result-grid">
                      <ResultValue
                        label="Queue delay"
                        value={routeResult.prediction.queue_delay_ms}
                        suffix="ms"
                      />
                      <ResultValue
                        label="Service time"
                        value={routeResult.prediction.service_time_ms}
                        suffix="ms"
                      />
                      <ResultValue
                        label="Completion time"
                        value={routeResult.prediction.completion_time_ms}
                        suffix="ms"
                      />
                      <ResultValue
                        label="Estimated cost"
                        value={routeResult.prediction.estimated_cost}
                      />
                      <ResultValue
                        label="Deadline risk"
                        value={
                          routeResult.prediction.deadline_risk != null
                            ? `${(routeResult.prediction.deadline_risk * 100).toFixed(1)}%`
                            : null
                        }
                      />
                      <ResultValue
                        label="Predicted miss"
                        value={routeResult.prediction.predicted_deadline_miss ? "Yes" : "No"}
                      />
                    </div>
                  )}

                  {Array.isArray(routeResult.explanation) &&
                    routeResult.explanation.length > 0 && (
                      <>
                        <h4>Why this decision?</h4>
                        <ul>
                          {routeResult.explanation.map(
                            (reason, index) => (
                              <li key={index}>{reason}</li>
                            )
                          )}
                        </ul>
                      </>
                    )}

                  {Array.isArray(routeResult.candidates) && (
                    <div className="candidate-list">
                      <h4>Candidate workers</h4>
                      {routeResult.candidates.map((candidate) => (
                        <div className="candidate-row" key={candidate.worker_id}>
                          <span>
                            <strong>{candidate.worker_id}</strong>{" "}
                            <span className={`candidate-state ${candidate.eligible ? "eligible" : "excluded"}`}>
                              {candidate.eligible ? "eligible" : "excluded"}
                            </span>
                          </span>
                          <small>
                            {candidate.eligible
                              ? `completion ${candidate.prediction?.completion_time_ms ?? "—"} ms · score ${candidate.prediction?.score?.toFixed?.(3) ?? "—"}`
                              : candidate.reason}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="panel">
              <h2>Benchmark policies</h2>
              <p>
                Compare AstraPulse with baseline schedulers.
              </p>

              <form
                onSubmit={runBenchmark}
                className="form-grid"
              >
                <label>
                  Request count
                  <input
                    type="number"
                    name="request_count"
                    min="1"
                    max="1000"
                    value={benchmarkForm.request_count}
                    onChange={updateBenchmarkForm}
                    required
                  />
                </label>

                <label>
                  Random seed
                  <input
                    type="number"
                    name="seed"
                    value={benchmarkForm.seed}
                    onChange={updateBenchmarkForm}
                    required
                  />
                </label>

                <label className="full-width">
                  Workload profile
                  <select
                    name="workload_profile"
                    value={benchmarkForm.workload_profile}
                    onChange={updateBenchmarkForm}
                  >
                    <option value="light">Light</option>
                    <option value="mixed">Mixed</option>
                    <option value="burst">Burst</option>
                  </select>
                </label>

                <button
                  className="primary-button full-width"
                  type="submit"
                  disabled={benchmarking}
                >
                  {benchmarking
                    ? "Running benchmark..."
                    : "Run benchmark"}
                </button>
              </form>

              {benchmarkResult && (
                <div className="result-box result-box-enter">
                  <h3>Benchmark result</h3>
                  <p>
                    <strong>Run ID:</strong>{" "}
                    {benchmarkResult.run_id || "—"}
                  </p>
                  <p>
                    <strong>Requests:</strong>{" "}
                    {benchmarkResult.request_count ?? "—"}
                  </p>

                  {Array.isArray(benchmarkResult.results) &&
                    benchmarkResult.results.length > 0 && (
                      <>
                        <BenchmarkChart results={benchmarkResult.results} />
                        <div className="benchmark-table table-wrapper">
                          <table>
                            <thead>
                              <tr>
                                <th>Policy</th>
                                <th>Completed</th>
                                <th>Failed</th>
                                <th>p50 / p95</th>
                                <th>Throughput</th>
                                <th>Miss rate</th>
                                <th>Est. cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {benchmarkResult.results.map((result) => (
                                <tr key={result.policy}>
                                  <td><strong>{formatPolicy(result.policy)}</strong></td>
                                  <td>{result.completed_requests}</td>
                                  <td>{result.failed_requests}</td>
                                  <td>{result.p50_latency_ms ?? "—"} / {result.p95_latency_ms ?? "—"} ms</td>
                                  <td>{result.throughput?.toFixed?.(2) ?? "—"} /s</td>
                                  <td>{((result.deadline_miss_rate ?? 0) * 100).toFixed(1)}%</td>
                                  <td>{result.total_estimated_cost?.toFixed?.(3) ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  {Array.isArray(benchmarkResult.results) &&
                    benchmarkResult.results.map((result) => (
                      <div
                        className="policy-result"
                        key={result.policy}
                      >
                        <h4>{formatPolicy(result.policy)} details</h4>
                        <p>Deadline misses: {result.deadline_misses ?? "—"}</p>
                        <p>Miss rate: {((result.deadline_miss_rate ?? 0) * 100).toFixed(1)}%</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function formatPolicy(policy) {
  return policy === "astrapulse"
    ? "AstraPulse"
    : policy === "round_robin"
      ? "Round-Robin"
      : "Least-Loaded";
}

function Metric({ label, value, detail, emphasis = "secondary" }) {
  return (
    <article className={`metric-card metric-${emphasis}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ResultValue({ label, value, suffix = "" }) {
  return (
    <div className="result-value">
      <span>{label}</span>
      <strong>
        {value ?? "—"}
        {value != null ? ` ${suffix}` : ""}
      </strong>
    </div>
  );
}
