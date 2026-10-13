
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/$/, "");

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot connect to the AstraPulse backend. " +
        "Make sure FastAPI is running at http://127.0.0.1:8000."
    );
  }

  const raw = await response.text();
  let data = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { detail: raw };
    }
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.detail ||
      data?.message ||
      `API request failed (${response.status})`;

    throw new Error(
      typeof message === "string"
        ? message
        : JSON.stringify(message)
    );
  }

  return data;
}

function requireObject(data, endpoint) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`The ${endpoint} response was not valid JSON data.`);
  }
  return data;
}

function validateHealth(data) {
  const payload = requireObject(data, "health");
  if (typeof payload.status !== "string") {
    throw new Error("The health response did not include a valid status.");
  }
  return payload;
}

function validateWorkers(data) {
  const payload = requireObject(data, "workers");
  if (!Array.isArray(payload.workers)) {
    throw new Error("The workers response did not include a worker list.");
  }
  return payload;
}

function validateMetrics(data) {
  const payload = requireObject(data, "metrics");
  const requiredFields = [
    "routing_decisions",
    "completed_requests",
    "failed_requests",
    "deadline_misses",
  ];
  if (requiredFields.some((field) => typeof payload[field] !== "number")) {
    throw new Error("The metrics response was missing required counters.");
  }
  return payload;
}

function validateRoute(data) {
  const payload = requireObject(data, "routing");
  if (
    typeof payload.request_id !== "string" ||
    typeof payload.status !== "string" ||
    !Array.isArray(payload.candidates)
  ) {
    throw new Error("The routing response was missing required fields.");
  }
  return payload;
}

function validateBenchmark(data) {
  const payload = requireObject(data, "benchmark");
  if (
    typeof payload.run_id !== "string" ||
    !Array.isArray(payload.results)
  ) {
    throw new Error("The benchmark response was missing required fields.");
  }
  return payload;
}

function validateScenarioCatalog(data) {
  if (!Array.isArray(data)) {
    throw new Error("The scenario response was not a valid scenario list.");
  }
  return data;
}

function validateScenarioRun(data) {
  const payload = requireObject(data, "scenario run");
  if (typeof payload.status !== "string") {
    throw new Error("The scenario response did not include a valid status.");
  }
  return payload;
}

function validateAutomatedLab(data) {
  const payload = requireObject(data, "automated lab");
  if (
    typeof payload.status !== "string" ||
    !Array.isArray(payload.results) ||
    !payload.counts
  ) {
    throw new Error("The automated lab response was missing required fields.");
  }
  const validStatuses = new Set(["PASS", "FAIL", "ERROR", "UNSUPPORTED"]);
  if (payload.results.some((item) =>
    !item ||
    typeof item.scenario_id !== "string" ||
    !validStatuses.has(item.status)
  )) {
    throw new Error("The automated lab response contained invalid scenario results.");
  }
  return payload;
}

export const api = {
  health: () => request("/api/health").then(validateHealth),

  workers: () => request("/api/workers").then(validateWorkers),

  metrics: () => request("/api/metrics").then(validateMetrics),

  route: (payload) =>
    request("/api/route", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(validateRoute),

  benchmark: (payload) =>
    request("/api/benchmark", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(validateBenchmark),

  addWorker: (payload) =>
    request("/api/workers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateWorkerStatus: (workerId, status) =>
    request(`/api/workers/${encodeURIComponent(workerId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  removeWorker: (workerId) =>
    request(`/api/workers/${encodeURIComponent(workerId)}`, {
      method: "DELETE",
    }),

  resetWorkers: () =>
    request("/api/workers/reset", { method: "POST" }),

  scenarios: () => request("/api/scenarios").then(validateScenarioCatalog),

  runScenario: (scenarioId, payload) =>
    request(`/api/scenarios/${encodeURIComponent(scenarioId)}/run`, {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(validateScenarioRun),

  runAutomatedLab: (payload) =>
    request("/api/scenarios/automated/run", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(validateAutomatedLab),
};

export function normalizeWorkers(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.workers)) {
    return payload.workers;
  }

  throw new Error("The workers response did not include a worker list.");
}
