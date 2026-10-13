# Scenario Laboratory

The scenario laboratory is a backend-only, deterministic extension for
demonstrating the existing virtual-time scheduler. It uses cloned
`WorkerRegistry` state and the existing request generation, candidate
evaluation, policy selection, and benchmark metrics.

## Endpoints

- `GET /api/scenarios` lists scenario identifiers, descriptions, support
  status, and schema gaps.
- `POST /api/scenarios/{scenario_id}/run` executes one scenario.
- `GET /api/scenario-runs` returns in-memory scenario audit records for the
  current backend process.

Run request:

```json
{
  "seed": 42,
  "request_count": 6,
  "policy": "astrapulse"
}
```

`seed` must be non-negative, `request_count` is limited to 100, and `policy`
uses the existing `astrapulse`, `round_robin`, or `least_loaded` values.

## Profiles

The currently executable profiles are:

- `normal`: seeded mixed requests against the initial worker pool.
- `preferred_overloaded`: delays Worker 2 and evaluates alternatives.
- `hard_deadline_infeasible`: makes available slots miss a hard deadline.
- `capacity_exhausted`: makes all slots unavailable before a hard deadline.
- `worker_failure_recovery`: excludes Worker 1 while offline, then restores it.
- `burst`: seeded burst requests and aggregate virtual-time metrics.

`low_latency_consistency` and `conflicting_constraints` are listed but return
`unsupported` with an explicit gap. The current request and worker schemas do
not define consistency, reliability, service class, capabilities, priority,
latency objectives, or cost constraints. The lab does not invent those
semantics.

## Isolation and interpretation

Each run starts from a cloned registry. The mutable scenario registry is reset
in a `finally` block, including when execution raises an exception. Results
include `worker_state_restored: true` when restoration succeeds.

Each run has a deterministic run ID based on scenario, seed, request count, and
policy. The run record includes candidate decisions, predicted values, a
separate simulated outcome, and aggregate metrics. Run records are in memory
only and are lost when the backend restarts.

Candidate values and completion values are virtual-time simulation estimates,
not measurements of real workers or cloud infrastructure. The public routing
status remains `no_eligible_worker` for compatibility with the existing API.
The scenario laboratory does not rename that status.

Normalized score-component breakdowns, capability constraints, consistency
semantics, and explicit cost limits remain unavailable because those fields are
not present in the current request and worker schemas.
