
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

export const api = {
  health: () => request("/api/health"),

  workers: () => request("/api/workers"),

  metrics: () => request("/api/metrics"),

  route: (payload) =>
    request("/api/route", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  benchmark: (payload) =>
    request("/api/benchmark", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export function normalizeWorkers(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.workers)) {
    return payload.workers;
  }

  return [];
}
