function formatAvailability(worker) {
  if (!Array.isArray(worker.available_at_ms)) {
    return "Unavailable";
  }
  return worker.available_at_ms.length
    ? worker.available_at_ms.join(", ")
    : "No slots";
}

function statusLabel(status) {
  return status === "healthy"
    ? "online"
    : status === "degraded"
      ? "degraded"
      : "offline";
}

export default function WorkerStatus({
  workers,
  selectedWorkerId,
  onSelect,
  routeResult,
  changedWorkerIds = [],
  onUpdateStatus,
  onRemove,
  busyWorkerId,
}) {
  const selectedWorker = workers.find(
    (worker) => worker.worker_id === selectedWorkerId
  );
  const routeWorkerId = routeResult?.selected_worker;

  return (
    <section className="panel worker-panel topology-panel">
      <div className="section-heading">
        <div>
          <h2>Logical worker topology</h2>
          <p>
            Select a worker to inspect reported simulation state. This is not a
            physical network map.
          </p>
        </div>
        <span className="topology-count">
          {workers.length} {workers.length === 1 ? "worker" : "workers"}
        </span>
      </div>

      {workers.length === 0 ? (
        <p className="empty-state">
          No worker records are available from the backend.
        </p>
      ) : (
        <div className="topology-layout">
          <div className="worker-node-grid" aria-label="Worker topology">
            {workers.map((worker) => {
              const isSelected = worker.worker_id === selectedWorkerId;
              const isRouted = worker.worker_id === routeWorkerId;
              const utilization =
                Number.isFinite(worker.capacity) &&
                worker.capacity > 0 &&
                Number.isFinite(worker.active_slots)
                  ? Math.min(worker.active_slots / worker.capacity, 1)
                  : null;

              return (
                <div
                  className={[
                    "worker-node",
                    isSelected ? "worker-node-selected" : "",
                    isRouted ? "worker-node-routed" : "",
                    changedWorkerIds.includes(worker.worker_id)
                      ? "worker-node-changed"
                      : "",
                  ].filter(Boolean).join(" ")}
                  key={worker.worker_id}
                  type="button"
                  onClick={() => onSelect(worker.worker_id)}
                  aria-pressed={isSelected}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(worker.worker_id);
                    }
                  }}
                >
                  <span className="worker-node-header">
                    <span className={`node-status ${worker.status}`} />
                    <strong>{worker.name || worker.worker_id}</strong>
                    <span className={`status-pill ${worker.status}`}>
                      {statusLabel(worker.status)}
                    </span>
                  </span>
                  <span className="worker-node-id">{worker.worker_id}</span>
                  <span className="worker-node-stats">
                    <span><small>Capacity</small>{worker.capacity ?? "—"}</span>
                    <span><small>Active</small>{worker.active_slots ?? "—"}</span>
                    <span><small>Queue</small>{worker.queued_requests ?? "—"}</span>
                  </span>
                  <span className="worker-node-footer">
                    <span>
                      Available{" "}
                      {Array.isArray(worker.available_at_ms)
                        ? `${worker.available_at_ms[0] ?? "—"} ms`
                        : "unavailable"}
                    </span>
                    <span className="worker-node-actions">
                      <select
                        aria-label={`Change ${worker.name || worker.worker_id} status`}
                        value={worker.status}
                        disabled={busyWorkerId === worker.worker_id}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          onUpdateStatus(worker.worker_id, event.target.value)
                        }
                      >
                        <option value="healthy">healthy</option>
                        <option value="degraded">degraded</option>
                        <option value="offline">offline</option>
                      </select>
                      <button
                        type="button"
                        className="node-remove-button"
                        disabled={busyWorkerId === worker.worker_id}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemove(worker.worker_id);
                        }}
                      >
                        Remove
                      </button>
                    </span>
                    <span>
                      {utilization == null
                        ? "Utilization unavailable"
                        : `${Math.round(utilization * 100)}% derived`}
                    </span>
                  </span>
                  {isRouted && (
                    <span className="route-marker">Current routing target</span>
                  )}
                </div>
              );
            })}
          </div>

          <aside className="worker-inspector" aria-live="polite">
            {selectedWorker ? (
              <>
                <div className="inspector-heading">
                  <div>
                    <p className="eyebrow">WORKER INSPECTOR</p>
                    <h3>{selectedWorker.name}</h3>
                    <code>{selectedWorker.worker_id}</code>
                  </div>
                  <span className={`status-pill ${selectedWorker.status}`}>
                    {selectedWorker.status}
                  </span>
                </div>
                <div className="inspector-grid">
                  <InspectorValue label="Capacity" value={selectedWorker.capacity} />
                  <InspectorValue label="Active slots" value={selectedWorker.active_slots} />
                  <InspectorValue label="Queued requests" value={selectedWorker.queued_requests} />
                  <InspectorValue label="Service rate" value={selectedWorker.service_rate} />
                  <InspectorValue label="Synthetic cost / ms" value={selectedWorker.cost_per_service_ms} />
                  <InspectorValue label="Availability timestamps" value={formatAvailability(selectedWorker)} />
                </div>
                <p className="inspector-note">
                  Utilization is derived as active slots divided by capacity;
                  it is not a backend-measured utilization value.
                </p>
                <RoutingSummary
                  routeResult={routeResult}
                  selectedWorkerId={selectedWorker.worker_id}
                />
              </>
            ) : (
              <div className="inspector-placeholder">
                <strong>Select a worker node</strong>
                <p>
                  Worker details and the latest routing relationship will
                  appear here.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function InspectorValue({ label, value }) {
  return (
    <div className="inspector-value">
      <span>{label}</span>
      <strong>{value ?? "Unavailable"}</strong>
    </div>
  );
}

function RoutingSummary({ routeResult, selectedWorkerId }) {
  if (!routeResult) {
    return <p className="inspector-note">No routing decision is available yet.</p>;
  }

  const candidate = routeResult.candidates?.find(
    (item) => item.worker_id === selectedWorkerId
  );
  const isTarget = routeResult.selected_worker === selectedWorkerId;

  return (
    <div className="routing-summary">
      <h4>Latest routing relationship</h4>
      <p><strong>{routeResult.request_id}</strong> · {routeResult.status}</p>
      <p>{isTarget ? "Selected for the latest request." : "Not selected for the latest request."}</p>
      {candidate?.prediction ? (
        <div className="candidate-prediction">
          Score {candidate.prediction.score ?? "—"} · completion{" "}
          {candidate.prediction.completion_time_ms ?? "—"} ms
        </div>
      ) : (
        <p className="inspector-note">
          {candidate?.reason || "No candidate prediction was returned."}
        </p>
      )}
      <small>Candidate data reflects one decision, not a permanent connection.</small>
    </div>
  );
}