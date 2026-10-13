\# AstraPulse Architecture



\## 1. Project Overview



AstraPulse is a demonstration of predictive AI workload orchestration. It simulates incoming AI inference requests and routes them to simulated workers using predicted completion time, queue pressure, worker capacity, health, estimated cost, and request deadlines.



The project compares three scheduling policies:



\- AstraPulse — predictive, weighted scheduling.

\- Round-Robin — distributes requests cyclically among eligible workers.

\- Least-Loaded — selects a worker with the lowest projected outstanding workload.



The application is a local simulation, not a production cloud platform. It does not require real GPUs, deployed AI models, or paid cloud services.



\## 2. Technology Stack



\- Backend: Python and FastAPI.

\- Frontend: React and Vite.

\- Styling: plain CSS.

\- Initial state storage: in-memory Python objects.

\- Testing: pytest and FastAPI test utilities.

\- Optional later enhancement: SQLite.



Docker and external AI APIs are not required for the initial demonstration.



\## 3. High-Level Architecture



```text

User

&#x20;|

&#x20;v

React + Vite Dashboard

&#x20;|

&#x20;| HTTP / JSON

&#x20;v

FastAPI Application

&#x20;|

&#x20;+-- API Layer

&#x20;|    +-- Health

&#x20;|    +-- Workers

&#x20;|    +-- Scheduling

&#x20;|    +-- Benchmarks

&#x20;|    +-- Metrics

&#x20;|

&#x20;+-- Scheduler Layer

&#x20;|    +-- AstraPulse

&#x20;|    +-- Round-Robin

&#x20;|    +-- Least-Loaded

&#x20;|

&#x20;+-- Simulation Layer

&#x20;|    +-- Request workload

&#x20;|    +-- Worker service-time estimation

&#x20;|    +-- Virtual-time queue simulation

&#x20;|    +-- Capacity and health handling

&#x20;|

&#x20;+-- Metrics and Benchmark Layer

&#x20;     +-- Latency percentiles

&#x20;     +-- Throughput

&#x20;     +-- Deadline misses

&#x20;     +-- Estimated cost

&#x20;     +-- Policy comparison

&#x20;|

&#x20;v

In-Memory Simulated Worker Registry

```



\## 4. Backend Responsibilities



\### API layer



Validate request payloads, call the relevant service, and return JSON responses according to `docs/api-contract.md`.



\### Worker registry



Maintain the simulated worker inventory and worker state, including worker identifiers, health, capacity, service rate, queue state, and cost configuration.



\### Simulation engine



Estimate request service times and simulate scheduling using virtual time. The initial implementation must not depend on real waiting or network calls to simulated workers.



\### Scheduler layer



Implement a shared scheduler interface and three scheduling policies:



1\. AstraPulse evaluates eligible workers using normalized completion time, queue delay, deadline risk, and estimated cost.

2\. Round-Robin selects eligible workers cyclically.

3\. Least-Loaded selects the worker with the smallest projected outstanding workload.



All policies must respect the agreed worker eligibility and deadline rules.



\### Metrics collector



Collect request outcomes and calculate latency percentiles, throughput, deadline miss rate, success and failure counts, and estimated cost.



\### Benchmark runner



Generate one deterministic workload and evaluate each policy against equivalent initial worker states. Results must be reproducible for identical settings and seeds.



\## 5. Frontend Responsibilities



The React dashboard consumes the FastAPI endpoints through a shared API service.



Pages and components:



\- Overview — high-level system status and metrics.

\- Routing — submit requests and inspect scheduling decisions.

\- Queue Shockwave Radar — visualize worker queue pressure.

\- Benchmarks — compare all three scheduling policies.

\- Worker Monitor — display worker health, capacity, and queue state.



The interface should use a dark theme, responsive layouts, loading states, and error handling. It must distinguish predicted values from measured simulated outcomes.



\## 6. API Contract



The initial API consists of:



\- `GET /api/health`

\- `GET /api/workers`

\- `POST /api/route`

\- `POST /api/benchmark`

\- `GET /api/metrics`



Request fields, response schemas, validation rules, and error behavior are defined in `docs/api-contract.md`. That contract is authoritative; implementation must not silently introduce incompatible field names or response structures.



\## 7. Deadline Handling



Two modes are supported:



\- Hard deadline mode: exclude workers whose predicted completion would violate the request deadline.

\- Soft deadline mode: allow candidates but include deadline risk in the AstraPulse score.



If no worker is eligible, return the contract-defined `no\_eligible\_worker` result.



\## 8. Virtual-Time Simulation



The simulation advances logical timestamps rather than waiting for real service durations.



For each request:



```text

start\_time\_ms = max(arrival\_time\_ms, slot\_available\_at\_ms)

queue\_delay\_ms = start\_time\_ms - arrival\_time\_ms

finish\_time\_ms = start\_time\_ms + service\_time\_ms

completion\_time\_ms = finish\_time\_ms - arrival\_time\_ms

```



Capacity slots track their availability. Service-time and deadline calculations must follow `docs/benchmark-methodology.md`.



\## 9. Benchmark Fairness



Each policy receives the same generated request sequence and an equivalent fresh worker state. Workload generation must be reproducible for the same seed.



The benchmark reports latency, throughput, deadline misses, outcomes, and estimated cost. It must report actual simulation results without claiming AstraPulse always outperforms the baselines.



\## 10. Development Sequence



1\. Verify project files and documentation.

2\. Implement backend data models.

3\. Implement worker registry and simulation.

4\. Implement all three scheduling policies.

5\. Implement metrics and benchmark execution.

6\. Connect and test API endpoints.

7\. Implement the React dashboard and visualizations.

8\. Run backend tests and frontend build.

9\. Perform an end-to-end demonstration and document limitations.



\## 11. Non-Goals



The initial version does not implement:



\- Real GPU provisioning.

\- Production distributed scheduling.

\- Real inference model execution.

\- Paid external AI APIs.

\- Mandatory database persistence.

\- Claims of production readiness.



The goal is a working, testable, explainable demonstration.





