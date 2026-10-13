# AstraPulse 2.0 Schema Evolution Proposal

**Status:** Proposed design only  
**Scope:** Backend data foundation; no implementation in this phase  
**Compatibility rule:** Existing endpoints, fields, schedulers, and frontend
payloads remain unchanged until a later implementation phase is approved.

## 1. Current implementation reused

The current backend already provides:

- `InferenceRequest` with request identity, model name, input/output token
  estimates, virtual arrival time, deadline duration, deadline mode, policy,
  and optional seed.
- `BenchmarkRequest` with workload profile, bounded request count, seed, and
  optional validated policy list.
- `Worker` with health status, capacity, per-slot virtual availability,
  service rate, and synthetic cost rate.
- `Prediction` with queue delay, service time, completion time, deadline
  timestamp, predicted deadline miss, deadline risk, estimated cost, and
  optional final score.
- `Candidate` and `RoutingDecision` for multi-worker candidate output and
  explainable selection.
- `BenchmarkMetrics` for aggregate policy results.
- `WorkerRegistry`, virtual-time slot prediction, deadline-risk calculation,
  cost projection, and isolated benchmark registry cloning.

These existing types should remain the compatibility boundary for the current
`/api/route` and `/api/benchmark` responses.

## 2. Gap analysis

| Required concept | Current state | Gap |
| --- | --- | --- |
| Request ID and workload estimates | Implemented | None for the current contract |
| Arrival time and deadline mode | Implemented | None for the current contract |
| Priority | Missing | Add as an optional bounded integer |
| Workflow/scenario ID | Missing | Add optional identifiers without changing current responses |
| Latency objective/max latency | Missing | Add workflow requirements |
| Required capability/service class | Missing | Add capability and service-class constraints |
| Capacity requirement | Implicitly represented by worker slots | Add explicit minimum slot/concurrency requirement |
| Reliability/consistency requirement | Missing | Define semantics before adding fields |
| Cost constraints | Missing | Add optional maximum estimated cost and budget scope |
| Worker capabilities | Missing | Add normalized capability identifiers |
| Failure/recovery state | Only `healthy`, `degraded`, and `offline` status exists | Add simulation metadata only when failure scenarios are implemented |
| Candidate exclusion reason | Implemented as one free-form reason | Preserve it and add structured reason codes |
| Normalized score components | Calculated internally but not exposed | Add a structured breakdown to a future response/run record |
| Selection explanation | Implemented as a policy-level sentence | Add stage and constraint evidence |
| Simulation run identity/configuration | Benchmark has a derived `run_id`, profile, seed, and results | Add explicit scenario configuration and run records |
| Predicted vs simulated outcome | Aggregate benchmark metrics exist | Add per-request predicted and simulated outcome records |
| Failure reasons | Failed counts exist | Add bounded machine-readable reason codes |

## 3. Proposed additive schema

The following are proposed Pydantic models or equivalent typed internal
records. They are not to be added to the live API in this phase.

### 3.1 Request additions

Extend the internal/request model additively:

| Field | Type | Validation |
| --- | --- | --- |
| `priority` | `int` | Optional; default `0`; bounded to `0..100` |
| `workflow_id` | `str \| None` | Optional; non-empty; max 128 characters |
| `scenario_id` | `str \| None` | Optional; non-empty; max 128 characters |
| `requirements` | `WorkflowRequirements \| None` | Optional; omitted means current behavior |

Existing fields and defaults remain unchanged. `extra="forbid"` should continue
to reject misspelled fields.

### 3.2 Workflow requirements

```text
WorkflowRequirements
  latency_objective_ms: int | None
  max_latency_ms: int | None
  deadline_mode: "soft" | "hard" | None
  required_capabilities: list[str]
  required_service_class: str | None
  min_capacity_slots: int
  reliability_level: "best_effort" | "standard" | "high" | None
  consistency_level: "none" | "session" | "strong" | None
  max_estimated_cost: float | None
  max_total_estimated_cost: float | None
```

Validation rules:

- All durations are non-negative integers; positive limits must be greater than
  zero.
- `latency_objective_ms` is a preference used in scoring; `max_latency_ms` is
  an eligibility constraint.
- `max_latency_ms` must be greater than or equal to
  `latency_objective_ms` when both are supplied.
- `min_capacity_slots` defaults to `1` and must be positive.
- Capabilities are non-empty, normalized strings with duplicates rejected.
- `max_estimated_cost` applies to one request. `max_total_estimated_cost`
  applies to a scenario/run and is not a worker eligibility check by itself.
- Reliability and consistency are independent dimensions. Reliability means
  the worker's declared simulated availability/failure policy; consistency
  means the workflow's state/session placement requirement. Neither is a
  probability unless a future simulation explicitly defines one.

### 3.3 Worker additions

Add these fields to a future worker-state model or an internal worker
capability record:

| Field | Type | Validation |
| --- | --- | --- |
| `capabilities` | `list[str]` | Default `[]`; normalized, unique values |
| `service_class` | `str` | Non-empty; max 64 characters |
| `reliability_level` | `"best_effort" \| "standard" \| "high"` | Default `"standard"` |
| `failure_mode` | `"none" \| "transient" \| "permanent"` | Default `"none"` |
| `recovery_at_ms` | `int \| None` | Non-negative; required for transient failure when active |
| `failure_reason` | `str \| None` | Bounded diagnostic text |

Existing `status`, `capacity`, `available_at_ms`, service-rate, and cost fields
remain authoritative. A worker is eligible only if it is not offline, supports
all required capabilities and service class, has enough capacity, satisfies
the hard deadline, and stays within the per-request cost limit.

### 3.4 Candidate evaluation

Keep the existing `Candidate` and `Prediction` response fields intact. A
future internal evaluation record should add:

```text
CandidateEvaluation
  worker_id: str
  eligible: bool
  exclusion_code: str | None
  exclusion_details: list[str]
  projected_queue_delay_ms: int | None
  projected_completion_time_ms: int | None
  deadline_risk: float | None
  estimated_cost: float | None
  normalized_components:
    completion: float | None
    queue_delay: float | None
    deadline_risk: float | None
    estimated_cost: float | None
    objective_gap: float | None
  final_score: float | None
  selected: bool
  explanation: list[str]
```

Validation rules:

- `eligible=False` requires an `exclusion_code`.
- `eligible=True` requires projected timing and cost values.
- Normalized components and risk are within `0..1`.
- A selected candidate must be eligible and must have a final score for
  AstraPulse policy.
- Exclusion codes are stable values such as `worker_offline`,
  `missing_capability`, `insufficient_capacity`, `hard_deadline_miss`,
  `cost_limit_exceeded`, and `failure_state`.

### 3.5 Simulation run

```text
SimulationRun
  run_id: str
  seed: int
  workload_profile: "light" | "mixed" | "burst" | str
  scenario_id: str | None
  scenario_config: ScenarioConfig
  selected_policy: "astrapulse" | "round_robin" | "least_loaded"
  candidate_evaluations: list[CandidateEvaluation]
  outcomes: list[SimulationOutcome]
  aggregate_metrics: BenchmarkMetrics
  failure_reasons: list[str]
```

`ScenarioConfig` should contain only deterministic, serializable settings:
worker-state overrides, request-generation settings, failure/recovery events,
and requirement defaults. It must not contain live worker objects.

`SimulationOutcome` should distinguish:

```text
SimulationOutcome
  request_id: str
  predicted_worker_id: str | None
  predicted_completion_time_ms: int | None
  predicted_deadline_miss: bool | None
  simulated_worker_id: str | None
  simulated_completion_time_ms: int | None
  simulated_deadline_miss: bool | None
  status: "completed" | "failed" | "no_feasible_candidate"
  failure_code: str | None
  estimated_cost: float | None
```

Predicted values are the scheduler's estimates before assignment. Simulated
values are the virtual-time outcome after assignment. They must not be
presented as real infrastructure measurements.

## 4. Logical workflow stages

These remain logical backend stages, not services:

1. **Analyze:** validate request and workflow requirements, derive effective
   deadline/cost/capability constraints.
2. **Evaluate:** calculate one `CandidateEvaluation` per worker and preserve
   both eligible and excluded candidates.
3. **Select and record:** apply the chosen existing policy only to eligible
   candidates, produce an explanation, assign virtual capacity, and record the
   predicted and simulated outcome.

If no candidate is feasible, return a structured internal
`no_feasible_candidate` result with failure codes. The current public route
status is `no_eligible_worker`; changing that response is a separate,
explicitly versioned compatibility decision.

## 5. Representative scenarios

| Scenario | Required setup | Expected assertion |
| --- | --- | --- |
| Normal traffic | Default workers; mixed workload | At least one eligible candidate; selection and prediction are recorded |
| Low-latency/high-consistency workflow | Tight latency objective; `consistency_level="strong"`; required capability | Candidates lacking capability/consistency are excluded before scoring |
| Preferred worker overloaded | Preferred worker slots have future availability | Alternatives are evaluated against the same requirements; overloaded worker is not selected if infeasible |
| Hard-deadline infeasible | All predicted completion times exceed a hard deadline | No candidate is selected; each exclusion has `hard_deadline_miss` or another precise code |
| Capacity exhausted | All worker slots unavailable beyond the request constraints | No feasible candidate; capacity exclusion is distinguishable from failure |
| Worker failure | A worker enters transient/offline state with optional recovery timestamp | Failed worker is excluded; recovery changes eligibility only at the documented virtual time |

Each scenario should use a fixed seed and assert structured reasons, not only
the selected worker ID.

## 6. Files for a later implementation milestone

No implementation files are modified in this phase. The likely minimal future
changes are:

- `backend/app/models/request.py`: additive request and requirement models.
- `backend/app/models/worker.py`: capabilities and failure/recovery metadata.
- `backend/app/models/decision.py`: internal/optional candidate evaluation
  structures, only after response compatibility is decided.
- `backend/app/models/metrics.py`: run/outcome models if persisted in memory.
- `backend/app/scheduler/base.py`: constraint filtering before existing policy
  scoring; do not rewrite the policy formulas.
- `backend/app/workers/registry.py`: deterministic scenario state and failure
  events.
- `backend/app/api/scheduling.py` and `backend/app/api/benchmarks.py`: wiring
  only after contract/version decisions.
- `backend/tests/`: scenario and validation coverage.

No new endpoint, database, dependency, or frontend change is justified yet.

## 7. Compatibility risks

- Adding required request fields would break existing frontend payloads; all
  first-phase additions must be optional with current defaults.
- Exposing new candidate fields in the existing response could change the
  frontend contract; prefer internal records or an explicitly versioned
  response.
- Renaming `no_eligible_worker` to `no_feasible_candidate` would break clients;
  retain the current public status initially and map the richer internal code.
- Worker capability defaults must not exclude existing workers unexpectedly.
- Existing benchmark reproducibility depends on deterministic seeds and cloned
  registries; scenario overrides must preserve both properties.
- Reliability and consistency must not be treated as interchangeable or as
  uncalibrated percentages.

## 8. Next milestone

Implement and test the additive Pydantic models in isolation first. Then add
constraint evaluation before the existing scheduler policies, followed by the
six scenario tests. Only after those tests pass should an API response
extension or a new versioned endpoint be considered.
