
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api, normalizeWorkers } from "../services/api";

import Sidebar from "../components/Sidebar";
import WorkspaceHeader from "../components/WorkspaceHeader";

const OverviewPage = lazy(() => import("./OverviewPage"));
const LiveMonitorPage = lazy(() => import("./LiveMonitorPage"));
const WorkersPage = lazy(() => import("./WorkersPage"));
const RequestsPage = lazy(() => import("./RequestsPage"));
const SchedulingPage = lazy(() => import("./SchedulingPage"));
const TestingPage = lazy(() => import("./TestingPage"));
const ShockwavePage = lazy(() => import("./ShockwavePage"));
const AnalyticsPage = lazy(() => import("./AnalyticsPage"));
const CostsPage = lazy(() => import("./CostsPage"));
const AlertsPage = lazy(() => import("./AlertsPage"));

const PAGE_SUBTITLES = {
  overview: "Live 3D AI infrastructure console",
  live: "Real-time simulation monitor",
  workers: "Worker node management",
  requests: "Route inference requests",
  scheduling: "Benchmark scheduling policies",
  testing: "Scenario and automated lab",
  shockwave: "Queue pressure visualization",
  analytics: "Performance analytics",
  costs: "Cost analysis",
  alerts: "System alerts",
};

export default function Dashboard() {
  /* Navigation */
  const [activePage, setActivePage] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* Core state */
  const [health, setHealth] = useState("checking");
  const [workers, setWorkers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const refreshInFlight = useRef(false);
  const previousWorkers = useRef([]);
  const [changedWorkerIds, setChangedWorkerIds] = useState([]);

  /* Routing state */
  const [routeResult, setRouteResult] = useState(null);
  const [routing, setRouting] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");

  /* 3D animation state */
  const [routeAnim, setRouteAnim] = useState(null);
  const [scenarioPaused, setScenarioPaused] = useState(false);
  const routeAnimTimer = useRef(null);

  /* Benchmark state */
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [benchmarking, setBenchmarking] = useState(false);

  const [robustnessRuns, setRobustnessRuns] = useState([]);
  const [robustnessRunning, setRobustnessRunning] = useState(false);

  /* Scenario and lab state */
  const [scenarioCatalog, setScenarioCatalog] = useState([]);
  const [scenarioId, setScenarioId] = useState("burst");
  const [scenarioResult, setScenarioResult] = useState(null);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [automatedLabResult, setAutomatedLabResult] = useState(null);
  const [automatedLabRunning, setAutomatedLabRunning] = useState(false);

  /* Worker lifecycle state */
  const [workerAction, setWorkerAction] = useState("");

  const [newWorker, setNewWorker] = useState({
    worker_id: "worker-demo",
    name: "Demo Worker",
    capacity: 2,
    service_rate: 1,
    cost_per_service_ms: 0.002,
  });

  /* Request form state */
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

  /* Benchmark form state */
  const [benchmarkForm, setBenchmarkForm] = useState({
    request_count: 100,
    seed: 42,
    workload_profile: "mixed",
  });

  /* Load dashboard data */
  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (refreshInFlight.current) return;

    refreshInFlight.current = true;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [healthData, workersData, metricsData] = await Promise.all([
        api.health(),
        api.workers(),
        api.metrics(),
      ]);

      setHealth(healthData.status === "ok" ? "online" : "offline");

      const nextWorkers = normalizeWorkers(workersData);

      const previousById = new Map(
        previousWorkers.current.map((worker) => [
          worker.worker_id,
          worker,
        ])
      );

      const changedIds = nextWorkers
        .filter((worker) => {
          const previous = previousById.get(worker.worker_id);

          return (
            previous &&
            [
              "status",
              "active_slots",
              "queued_requests",
              "available_at_ms",
            ].some((field) => previous[field] !== worker[field])
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
      refreshInFlight.current = false;
    }
  }, []);

  /* Auto-poll dashboard */
  useEffect(() => {
    loadDashboard();

    api.scenarios()
      .then(setScenarioCatalog)
      .catch(() => {});

    const interval = setInterval(() => {
      loadDashboard(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  /* Clear changed-worker highlights */
  useEffect(() => {
    if (!changedWorkerIds.length) return;

    const timer = setTimeout(() => {
      setChangedWorkerIds([]);
    }, 1200);

    return () => clearTimeout(timer);
  }, [changedWorkerIds]);

  /* Validate selected worker */
  useEffect(() => {
    if (
      selectedWorkerId &&
      !workers.some((worker) => worker.worker_id === selectedWorkerId)
    ) {
      setSelectedWorkerId("");
    }
  }, [selectedWorkerId, workers]);

  /* Animate route result */
  useEffect(() => {
    if (!routeResult?.selected_worker || !workers.length) return;

    setSelectedWorkerId(routeResult.selected_worker);

    const workerIndex = workers.findIndex(
      (worker) => worker.worker_id === routeResult.selected_worker
    );

    if (workerIndex === -1) return;

    const duration = 1200;
    const start = performance.now();

    clearTimeout(routeAnimTimer.current);

    function tick() {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);

      setRouteAnim({
        workerIndex,
        workerCount: workers.length,
        progress,
        targetWorkerId: routeResult.selected_worker,
      });

      if (progress < 1) {
        routeAnimTimer.current = requestAnimationFrame(tick);
      } else {
        routeAnimTimer.current = setTimeout(() => {
          setRouteAnim(null);
        }, 600);
      }
    }

    routeAnimTimer.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(routeAnimTimer.current);
      clearTimeout(routeAnimTimer.current);
    };
  }, [routeResult]); // Intentionally follows route-result changes.

  /* Worker actions */
  async function addWorker(event) {
    event.preventDefault();

    setWorkerAction("add");
    setError("");

    try {
      await api.addWorker({
        ...newWorker,
        capacity: Number(newWorker.capacity),
        service_rate: Number(newWorker.service_rate),
        cost_per_service_ms: Number(newWorker.cost_per_service_ms),
      });

      await loadDashboard(true);
    } catch (err) {
      setError(err.message || "Unable to add worker.");
    } finally {
      setWorkerAction("");
    }
  }

  async function updateWorkerStatus(workerId, status) {
    setWorkerAction(workerId);
    setError("");

    try {
      await api.updateWorkerStatus(workerId, status);
      await loadDashboard(true);
    } catch (err) {
      setError(err.message || "Unable to update worker status.");
    } finally {
      setWorkerAction("");
    }
  }

  async function removeWorker(workerId) {
    setWorkerAction(workerId);
    setError("");

    try {
      await api.removeWorker(workerId);
      await loadDashboard(true);

      if (selectedWorkerId === workerId) {
        setSelectedWorkerId("");
      }
    } catch (err) {
      setError(err.message || "Unable to remove worker.");
    } finally {
      setWorkerAction("");
    }
  }

  async function resetWorkers() {
    setWorkerAction("reset");
    setError("");

    try {
      await api.resetWorkers();

      setRouteResult(null);
      setSelectedWorkerId("");
      setRouteAnim(null);

      await loadDashboard(true);
    } catch (err) {
      setError(err.message || "Unable to reset workers.");
    } finally {
      setWorkerAction("");
    }
  }

  /* Request form */
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
      [name]: numericFields.includes(name) ? Number(value) : value,
    }));
  }

  /* Submit route */
  async function submitRoute(event) {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    setRouting(true);
    setError("");
    setRouteResult(null);

    try {
      const payload = event?.preventDefault
        ? requestForm
        : event;

      const result = await api.route(payload);

      setRouteResult(result);
      await loadDashboard(true);
    } catch (err) {
      setError(err.message || "Routing request failed.");
    } finally {
      setRouting(false);
    }
  }

  /* Route from overview quick form */
  async function directRoute(payload) {
    setRouting(true);
    setError("");
    setRouteResult(null);

    try {
      const result = await api.route(payload);

      setRouteResult(result);
      await loadDashboard(true);
    } catch (err) {
      setError(err.message || "Routing request failed.");
    } finally {
      setRouting(false);
    }
  }

  /* Update benchmark form */
  function updateBenchmarkForm(event) {
    const { name, value } = event.target;

    const numericFields = ["request_count", "seed"];

    setBenchmarkForm((current) => ({
      ...current,
      [name]: numericFields.includes(name) ? Number(value) : value,
    }));
  }

  /* Validate benchmark form */
  function validateBenchmarkForm() {
    if (
      !Number.isInteger(benchmarkForm.request_count) ||
      benchmarkForm.request_count < 1 ||
      benchmarkForm.request_count > 1000
    ) {
      return "Request count must be a whole number between 1 and 1000.";
    }

    if (
      !Number.isInteger(benchmarkForm.seed) ||
      benchmarkForm.seed < 0
    ) {
      return "Random seed must be a non-negative whole number.";
    }

    if (
      !["light", "mixed", "burst"].includes(
        benchmarkForm.workload_profile
      )
    ) {
      return "Please select a valid workload profile.";
    }

    return "";
  }

  /* Run one benchmark */
  async function runBenchmark(event) {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    const validationError = validateBenchmarkForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (benchmarking || robustnessRunning) {
      return;
    }

    setBenchmarking(true);
    setError("");
    setBenchmarkResult(null);

    try {
      const result = await api.benchmark({
        request_count: Number(benchmarkForm.request_count),
        seed: Number(benchmarkForm.seed),
        workload_profile: benchmarkForm.workload_profile,
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

  /* Run robustness benchmark across five seeds */
  async function runRobustnessBenchmark() {
    const validationError = validateBenchmarkForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (benchmarking || robustnessRunning) {
      return;
    }

    const requestCount = Number(benchmarkForm.request_count);
    const startingSeed = Number(benchmarkForm.seed);
    const workloadProfile = benchmarkForm.workload_profile;

    const completedRuns = [];

    setRobustnessRunning(true);
    setRobustnessRuns([]);
    setError("");

    try {
      for (let index = 0; index < 5; index += 1) {
        const seed = startingSeed + index;

        const result = await api.benchmark({
          request_count: requestCount,
          seed,
          workload_profile: workloadProfile,
          policies: [
            "astrapulse",
            "round_robin",
            "least_loaded",
          ],
        });

        if (!Array.isArray(result?.results)) {
          throw new Error(
            `Invalid benchmark response for seed ${seed}.`
          );
        }

        completedRuns.push({
          seed,
          run_id: result.run_id,
          request_count: result.request_count ?? requestCount,
          results: result.results,
        });

        // Update the UI after each successful run.
        setRobustnessRuns([...completedRuns]);
      }

      await loadDashboard(true);
    } catch (err) {
      setError(
        err.message ||
        `Robustness benchmark stopped after ${completedRuns.length} of 5 runs.`
      );
    } finally {
      setRobustnessRunning(false);
    }
  }

  /* Run scenario */
  async function runScenario(event) {
    const id = typeof event === "string" ? event : scenarioId;

    if (event?.preventDefault) {
      event.preventDefault();
    }

    setScenarioRunning(true);
    setScenarioResult(null);
    setError("");

    try {
      const result = await api.runScenario(id, {
        seed: 42,
        request_count: 6,
        policy: "astrapulse",
      });

      setScenarioResult(result);
      await loadDashboard(true);
    } catch (err) {
      setError(err.message || "Scenario execution failed.");
    } finally {
      setScenarioRunning(false);
    }
  }

  /* Run automated lab */
  async function runAutomatedLab() {
    setAutomatedLabRunning(true);
    setAutomatedLabResult(null);
    setError("");

    try {
      const result = await api.runAutomatedLab({
        seed: 42,
        request_count: 6,
      });

      setAutomatedLabResult(result);
    } catch (err) {
      setError(err.message || "Automated lab execution failed.");
    } finally {
      setAutomatedLabRunning(false);
    }
  }

  /* Render active page */
  function renderPage() {
    switch (activePage) {
      case "overview":
        return (
          <OverviewPage
            workers={workers}
            metrics={metrics}
            routeResult={routeResult}
            routing={routing}
            onRoute={directRoute}
            selectedWorkerId={selectedWorkerId}
            onSelectWorker={setSelectedWorkerId}
            routeAnim={routeAnim}
            onPauseToggle={() =>
              setScenarioPaused((paused) => !paused)
            }
            scenarioPaused={scenarioPaused}
            scenarioCatalog={scenarioCatalog}
            onRunScenario={runScenario}
            scenarioRunning={scenarioRunning}
            scenarioResult={scenarioResult}
          />
        );

      case "live":
        return (
          <LiveMonitorPage
            workers={workers}
            metrics={metrics}
            routeResult={routeResult}
            loading={loading}
            refreshing={refreshing}
          />
        );

      case "workers":
        return (
          <WorkersPage
            workers={workers}
            changedWorkerIds={changedWorkerIds}
            selectedWorkerId={selectedWorkerId}
            routeResult={routeResult}
            onSelect={setSelectedWorkerId}
            onUpdateStatus={updateWorkerStatus}
            onRemove={removeWorker}
            onAddWorker={addWorker}
            onResetWorkers={resetWorkers}
            busyWorkerId={workerAction}
            newWorker={newWorker}
            onNewWorkerChange={(field, value) =>
              setNewWorker((current) => ({
                ...current,
                [field]: value,
              }))
            }
            loading={loading}
          />
        );

      case "requests":
        return (
          <RequestsPage
            requestForm={requestForm}
            onUpdateRequestForm={updateRequestForm}
            onSubmitRoute={submitRoute}
            routing={routing}
            routeResult={routeResult}
          />
        );

      case "scheduling":
        return (
          <SchedulingPage
            benchmarkForm={benchmarkForm}
            onUpdateBenchmarkForm={updateBenchmarkForm}
            onRunBenchmark={runBenchmark}
            benchmarking={benchmarking}
            benchmarkResult={benchmarkResult}
            robustnessRuns={robustnessRuns}
            robustnessRunning={robustnessRunning}
            onRunRobustnessBenchmark={runRobustnessBenchmark}
          />
        );

      case "testing":
        return (
          <TestingPage
            scenarioCatalog={scenarioCatalog}
            scenarioId={scenarioId}
            onSetScenarioId={setScenarioId}
            onRunScenario={runScenario}
            scenarioRunning={scenarioRunning}
            scenarioResult={scenarioResult}
            onRunAutomatedLab={runAutomatedLab}
            automatedLabRunning={automatedLabRunning}
            automatedLabResult={automatedLabResult}
          />
        );

      case "shockwave":
        return <ShockwavePage workers={workers} />;

      case "analytics":
        return (
          <AnalyticsPage
            benchmarkResult={benchmarkResult}
            metrics={metrics}
          />
        );

      case "costs":
        return (
          <CostsPage
            benchmarkResult={benchmarkResult}
            metrics={metrics}
          />
        );

      case "alerts":
        return (
          <AlertsPage
            health={health}
            error={error}
            workers={workers}
          />
        );

      default:
        return (
          <div
            className="empty-state"
            style={{ marginTop: 40 }}
          >
            <p className="empty-state-title">Page not found</p>
          </div>
        );
    }
  }

  /* Main dashboard layout */
  return (
    <>
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page);
          setError("");
        }}
        health={health}
        sidebarOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((open) => !open)}
      />

      <div className="main-content">
        <WorkspaceHeader
          activePage={activePage}
          health={health}
          refreshing={refreshing}
          onRefresh={() => loadDashboard(true)}
        />

        <main
          className={`page${
            activePage === "overview" ? " page-3d" : ""
          }`}
          id="main-content"
        >
          {error && (
            <div className="error-banner" role="alert">
              <strong>Error:</strong> {error}

              <button
                type="button"
                className="retry-btn"
                onClick={() => loadDashboard(true)}
              >
                Retry
              </button>
            </div>
          )}

          <div className="page-header">
            <p className="page-subtitle">
              {PAGE_SUBTITLES[activePage] || ""}
            </p>
          </div>

          <Suspense
            fallback={
              <div className="loading-panel" role="status">
                <div className="spinner" />
                Loading page…
              </div>
            }
          >
            {renderPage()}
          </Suspense>
        </main>
      </div>
    </>
  );
}
