\# AstraPulse API Contract



\*\*Project:\*\* AstraPulse — Predictive AI Workload Orchestration  

\*\*Status:\*\* Initial agreed contract  

\*\*Backend:\*\* Python + FastAPI  

\*\*Frontend:\*\* React + Vite  

\*\*Simulation:\*\* Virtual time  

\*\*Persistence:\*\* In-memory first; SQLite optional later  

\*\*Time unit:\*\* Milliseconds (`ms`) for all simulated timestamps and durations



\---



\## 1. Purpose



This document defines how the AstraPulse frontend communicates with the backend.



All three scheduling policies must use the same simulated workers, workload assumptions, deadline rules, and cost model.



The three policies are:



\- `astrapulse`

\- `round\_robin`

\- `least\_loaded`



The project is a simulated demonstration. It does not run real AI models or schedule real cloud GPUs.



\## 2. API Base URL



During local development:



`http://127.0.0.1:8000`



All API endpoints use the `/api` prefix.



\## 3. API Endpoints



| Method | Endpoint | Purpose |

|---|---|---|

| GET | `/api/health` | Check backend health |

| GET | `/api/workers` | Get worker status and capacity |
| POST | `/api/workers` | Add a simulated worker |
| PATCH | `/api/workers/{worker_id}` | Change worker health state |
| DELETE | `/api/workers/{worker_id}` | Remove an idle simulated worker |
| POST | `/api/workers/reset` | Restore the deterministic default worker pool |

| POST | `/api/route` | Route one request and explain the decision |

| POST | `/api/benchmark` | Compare the three scheduling policies |
| GET | `/api/metrics` | Retrieve routing and benchmark metrics |
| GET | `/api/scenarios` | List deterministic scenario profiles |
| POST | `/api/scenarios/{scenario_id}/run` | Run one scenario profile |
| POST | `/api/scenarios/automated/run` | Run the isolated deterministic scenario suite |
| GET | `/api/scenario-runs` | List in-memory scenario audit records |

The scenario endpoints are an additive backend extension. Existing endpoint
paths and response fields are unchanged. Scenario profiles that require
workflow capabilities not present in the current request or worker schemas
return `status: "unsupported"` with an explicit `gap` instead of inventing
constraint semantics.

`POST /api/scenarios/automated/run` accepts optional `seed` (non-negative
integer, default `42`) and `request_count` (1-20, default `6`). It returns
`counts`, `results`, and an isolated `policy_comparison`. Every result has
`scenario_id`, `expected_behavior`, `actual_outcome`, `explanation`, and one
of `PASS`, `FAIL`, `ERROR`, or `UNSUPPORTED`. Scenario execution continues
when one case errors. Results are deterministic simulation evidence, not
real infrastructure telemetry or cloud billing.



\## 4. Health Endpoint



\### `GET /api/health`



Example response:



```json

{

&#x20; "status": "ok",

&#x20; "service": "astrapulse-api",

&#x20; "simulation\_mode": "virtual\_time"

}

```



\## 5. Workers Endpoint



\### `GET /api/workers`



Returns the current simulated worker registry.



Example response:



```json

{

&#x20; "simulation\_time\_ms": 0,

&#x20; "workers": \[

&#x20;   {

&#x20;     "worker\_id": "worker-1",

&#x20;     "name": "Worker 1",

&#x20;     "status": "healthy",

&#x20;     "capacity": 2,

&#x20;     "active\_slots": 0,

&#x20;     "queued\_requests": 0,

&#x20;     "available\_at\_ms": \[0, 0],

&#x20;     "service\_rate": 1.0,

&#x20;     "cost\_per\_service\_ms": 0.002

&#x20;   }

&#x20; ]

}

```



Rules:



\- Worker status is `healthy`, `degraded`, or `offline`.

\- Capacity must be a positive integer.

\- Active slots and queued requests must be non-negative integers.

\- Each worker has a documented service rate and simulated cost rate.

\- `available\_at\_ms` contains one virtual availability timestamp per execution slot.



\## 6. Routing Endpoint



\### `POST /api/route`



Routes a single simulated inference request.



Example request:



```json

{

&#x20; "request\_id": "req-001",

&#x20; "model": "text-small",

&#x20; "input\_tokens": 500,

&#x20; "output\_tokens": 200,

&#x20; "arrival\_time\_ms": 0,

&#x20; "deadline\_ms": 1500,

&#x20; "deadline\_mode": "soft",

&#x20; "policy": "astrapulse",

&#x20; "seed": 42

}

```



Field definitions:



\- `request\_id`: unique identifier for the request.

\- `model`: simulated workload label; no real model is invoked.

\- `input\_tokens`: non-negative integer.

\- `output\_tokens`: non-negative integer.

\- `arrival\_time\_ms`: virtual arrival timestamp in milliseconds.

\- `deadline\_ms`: positive deadline budget measured from arrival.

\- `deadline\_mode`: `soft` or `hard`; defaults to `soft`.

\- `policy`: `astrapulse`, `round\_robin`, or `least\_loaded`; defaults to `astrapulse`.

\- `seed`: optional non-negative integer for reproducible simulation.



Example successful response:



```json

{

&#x20; "request\_id": "req-001",

&#x20; "status": "routed",

&#x20; "policy": "astrapulse",

&#x20; "selected\_worker": "worker-2",

&#x20; "prediction": {

&#x20;   "queue\_delay\_ms": 100,

&#x20;   "service\_time\_ms": 400,

&#x20;   "completion\_time\_ms": 500,

&#x20;   "deadline\_at\_ms": 1500,

&#x20;   "predicted\_deadline\_miss": false,

&#x20;   "deadline\_risk": 0.0,

&#x20;   "estimated\_cost": 0.8,

&#x20;   "score": 0.24

&#x20; },

&#x20; "candidates": \[],

&#x20; "explanation": \[

&#x20;   "Worker 2 had the lowest score among eligible workers."

&#x20; ],

&#x20; "simulation\_time\_ms": 0

}

```



The numeric values are illustrative. Actual values must be calculated by the simulation engine.



The `candidates` field must contain the evaluated workers, their predictions, eligibility status, scores where applicable, and reasons for selection or exclusion.



If no worker is eligible, return:



```json

{

&#x20; "request\_id": "req-002",

&#x20; "status": "no\_eligible\_worker",

&#x20; "policy": "astrapulse",

&#x20; "selected\_worker": null,

&#x20; "prediction": null,

&#x20; "candidates": \[],

&#x20; "explanation": \[

&#x20;   "No worker satisfied the hard eligibility constraints."

&#x20; ],

&#x20; "simulation\_time\_ms": 0

}

```



\## 7. Virtual-Time Simulation Rules



All simulation time is virtual. It must not depend on how long Python takes to execute.



For each worker execution slot:



```text

start\_time\_ms =

&#x20;   max(arrival\_time\_ms, slot\_available\_at\_ms)



queue\_delay\_ms =

&#x20;   start\_time\_ms - arrival\_time\_ms



finish\_time\_ms =

&#x20;   start\_time\_ms + service\_time\_ms



completion\_time\_ms =

&#x20;   finish\_time\_ms - arrival\_time\_ms



deadline\_at\_ms =

&#x20;   arrival\_time\_ms + deadline\_ms

```



The scheduler evaluates the earliest predicted finish among a worker's available execution slots.

\## Worker lifecycle and routing diagnostics

`POST /api/workers` accepts a validated worker configuration:

```json
{
  "worker_id": "worker-demo",
  "name": "Demo Worker",
  "status": "healthy",
  "capacity": 2,
  "service_rate": 1.0,
  "cost_per_service_ms": 0.002
}
```

It returns the created worker with status `201`. Duplicate IDs return `409`;
invalid configurations return FastAPI validation errors (`422`).

`PATCH /api/workers/{worker_id}` accepts `{"status":"offline"}` or another
supported status. Offline workers remain visible but are excluded from new
requests. `DELETE /api/workers/{worker_id}` removes only idle workers. If
assigned or queued simulated work exists, deletion returns `409` and leaves
the worker untouched. Unknown workers return `404`.

`POST /api/workers/reset` restores the deterministic four-worker pool and
resets virtual simulation time to zero. It does not erase live routing
metrics or the latest benchmark snapshot.

Routing responses include additive `stages` records for request validation,
candidate evaluation, constraint evaluation, worker selection, and simulated
execution. Each stage has a status, explanation, and evidence. A
`no_eligible_worker` response marks constraint evaluation as `failed` and
selection/execution as `not_applicable`; hard-deadline exclusion is stated
explicitly. Simulated execution means a virtual slot was assigned and a
prediction was recorded, not that a real model completed.



The simulation engine must update slot availability consistently when requests are assigned.



Service time must be computed using a documented deterministic workload model based on token counts and worker service rate, with optional seeded variation.



The same request, worker state, and seed must produce the same prediction.



\## 8. Deadline Policy



AstraPulse uses hybrid deadline handling.



\### Hard eligibility



A worker is ineligible if:



\- It is offline.

\- It cannot accept work under the defined capacity and queue rules.

\- The request uses hard deadline mode and its predicted completion violates the hard deadline.



\### Soft deadline risk



For soft deadlines, deadline risk contributes a penalty to AstraPulse's score instead of automatically excluding a worker.



The exact risk formula must be documented in the simulation specification before implementation.



All three policies must use the same deadline definitions and final outcome rules.



\## 9. AstraPulse Scoring



AstraPulse evaluates eligible workers using a weighted score. Lower scores are better.



```text

score =

&#x20;   w\_latency \* normalized\_completion

&#x20; + w\_queue \* normalized\_queue\_delay

&#x20; + w\_deadline \* deadline\_risk

&#x20; + w\_cost \* normalized\_estimated\_cost

```



Rules:



\- Normalized components must use documented scales, preferably between `0` and `1`.

\- Scoring weights and defaults must be centrally configured and documented.

\- Deadline risk must be between `0` and `1`.

\- Ties must be resolved deterministically.

\- The response must explain why a worker was selected.

\- The frontend must display the score as a heuristic, not as a trained machine-learning prediction.



The final normalization formula, weights, and deadline-risk formula must be frozen before implementing the scheduler.



\## 10. Simulated Cost Model



Use the following initial cost model:



```text

estimated\_cost =

&#x20;   service\_time\_ms \* cost\_per\_service\_ms

```



The cost rate is a configurable synthetic value associated with each worker.



This cost is only for comparing scheduling decisions. It is not a real cloud-provider price.



All policies must use the same cost formula.



\## 11. Benchmark Endpoint



\### `POST /api/benchmark`



Runs the same generated workload against the selected policies.



Example request:



```json

{

&#x20; "request\_count": 100,

&#x20; "seed": 42,

&#x20; "workload\_profile": "mixed",

&#x20; "policies": \[

&#x20;   "astrapulse",

&#x20;   "round\_robin",

&#x20;   "least\_loaded"

&#x20; ]

}

```



Rules:



\- `request\_count` must be an integer from 1 through 1000.

\- `seed` controls reproducible workload generation.

\- Initial workload profiles are `light`, `mixed`, and `burst`.

\- If `policies` is omitted, run all three policies.

\- Unknown policy identifiers must be rejected.

\- Each policy must receive an equivalent copy of the initial worker state.
\- The benchmark baseline is created from the default worker configuration for
  each run; previous live routing requests do not affect it.
\- Every policy must receive the same generated request sequence.
\- Queue mutations from one policy must never affect another policy's benchmark.
\- Benchmark execution does not mutate live worker slots, live simulation time,
  or live routing counters. It updates only the latest benchmark summary.

\- All benchmark outputs must be identified as simulated results.



Example response:



```json

{

&#x20; "run\_id": "bench-001",

&#x20; "simulation": true,

&#x20; "seed": 42,

&#x20; "request\_count": 100,

&#x20; "results": \[

&#x20;   {

&#x20;     "policy": "astrapulse",

&#x20;     "completed\_requests": 100,

&#x20;     "failed\_requests": 0,

&#x20;     "deadline\_misses": 4,

&#x20;     "deadline\_miss\_rate": 0.04,

&#x20;     "throughput": 12.5,

&#x20;     "p50\_latency\_ms": 250,

&#x20;     "p95\_latency\_ms": 900,

&#x20;     "total\_estimated\_cost": 82.5

&#x20;   }

&#x20; ]

}

```



The example metrics are illustrative, not expected results.



\## 12. Metrics Endpoint



\### `GET /api/metrics`



Returns current routing statistics and the latest benchmark summary.



Example response:



```json

{

&#x20; "routing\_decisions": 0,
&#x20; "completed\_requests": 0,
&#x20; "failed\_requests": 0,
&#x20; "deadline\_misses": 0,
&#x20; "latest\_benchmark": null,
&#x20; "p50\_latency\_ms": null,
&#x20; "p95\_latency\_ms": null,
&#x20; "total\_estimated\_cost": 0.0

}

```



Routing statistics and benchmark statistics must remain distinguishable.



Because the initial implementation uses in-memory state, restarting the backend resets stored statistics and results.



\## 13. Metric Definitions



\- \*\*Latency:\*\* simulated completion time minus arrival time, in milliseconds.

\- \*\*p50 latency:\*\* 50th-percentile simulated latency.

\- \*\*p95 latency:\*\* 95th-percentile simulated latency.

\- \*\*Deadline miss:\*\* a request that finishes after its deadline, using one consistent rule across all policies.

\- \*\*Deadline miss rate:\*\* deadline misses divided by total submitted requests.

\- \*\*Throughput:\*\* completed requests divided by elapsed simulated seconds.

\- \*\*Estimated cost:\*\* sum of synthetic request costs.

\- \*\*Success/failure:\*\* terminal outcomes defined consistently for every policy.



Percentile calculation, failed-request treatment, and deadline outcomes must be documented in the benchmark methodology.



\## 14. Error Handling



Invalid request data must produce HTTP `422 Unprocessable Entity`.



Unknown policies must be rejected with a clear validation message.



Handled domain errors should use a consistent response structure:



```json

{

&#x20; "error": {

&#x20;   "code": "INVALID\_POLICY",

&#x20;   "message": "Unsupported scheduling policy.",

&#x20;   "details": {

&#x20;     "allowed\_policies": \[

&#x20;       "astrapulse",

&#x20;       "round\_robin",

&#x20;       "least\_loaded"

&#x20;     ]

&#x20;   }

&#x20; }

}

```



Unexpected server errors must not expose stack traces to the frontend.



\## 15. Implementation Priorities



1\. Finalize this API contract and the simulation formulas.

2\. Implement worker models and in-memory worker state.

3\. Implement virtual-time service and queue calculations.

4\. Implement Round-Robin and Least-Loaded baselines.

5\. Implement AstraPulse scoring and explanations.

6\. Implement the FastAPI endpoints.

7\. Implement metrics and fair benchmark comparisons.

8\. Connect the React dashboard.

9\. Add tests and prepare the demonstration.



\## 16. Agreed Project Constraints



\- Frontend: React + Vite + plain CSS.

\- Backend: Python + FastAPI.

\- Workers: simulated, not real GPUs.

\- Scheduling: AstraPulse, Round-Robin, and Least-Loaded.

\- Time: virtual milliseconds.

\- Persistence: in-memory first; SQLite optional later.

\- Cost: simple simulated cost model.

\- UI: dark dashboard.

\- Priority: working core features before optional enhancements.



All API changes must be reflected in this document and communicated to all developers before integration.
