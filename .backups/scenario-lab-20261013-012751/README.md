# AstraPulse

AstraPulse is a local hackathon demonstration of predictive AI workload
orchestration. It routes simulated inference requests across simulated workers
using predicted completion time, queue pressure, worker capacity and health,
deadlines, and estimated cost.

This is a simulation, not a production inference platform:

- Workers are simulated in memory; no real GPUs or deployed models are used.
- Routing values such as queue delay, completion time, deadline risk, and cost
  are predictions calculated by the simulation.
- Benchmark latency and throughput are measured within virtual time.
- Costs are synthetic estimated costs, not cloud-provider billing.
- Restarting the backend resets worker state, routing metrics, and benchmark
  history.

## Project layout

- `backend/` - FastAPI application, simulation, schedulers, and Python tests.
- `frontend/` - React + Vite dashboard.
- `docs/api-contract.md` - API request and response contract.
- `docs/benchmark-methodology.md` - Simulation and benchmark methodology.
- `ASTRAPULSE_MASTER_PLAN.md` (one directory above this project) - Permanent
  project control instructions and architecture decisions.

## Prerequisites

- Python 3.10 or newer
- Node.js and npm

The backend dependencies are listed in
[backend/requirements.txt](backend/requirements.txt). The frontend
dependencies are listed in [frontend/package.json](frontend/package.json).

## Start the backend

From `astrapulse/backend`:

```powershell
..\..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If the virtual environment is not at `..\..\.venv` in your checkout, create or
activate a Python virtual environment and use its Python executable instead.
The API is then available at <http://127.0.0.1:8000>, with interactive
documentation at <http://127.0.0.1:8000/docs>.

No environment variables are required by the backend.

## Start the frontend

In a second terminal, from `astrapulse/frontend`:

```powershell
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` requests to the backend at
`http://127.0.0.1:8000`.

To use a different API origin, set the optional `VITE_API_BASE_URL` environment
variable before starting or building the frontend. For example:

```powershell
$env:VITE_API_BASE_URL = "http://127.0.0.1:8000"
npm run dev
```

## Hackathon demonstration flow

1. Start the backend and frontend using the commands above.
2. In the dashboard, inspect **Worker status**. The initial registry contains
   healthy, degraded, and offline simulated workers, along with capacity,
   active slots, queue, virtual availability, service rate, and estimated cost
   fields.
3. In **Route an inference request**, submit the default request. The result
   shows the selected worker, candidate workers, predicted queue/service/
   completion times, deadline risk, predicted deadline miss, estimated cost,
   and the scheduling explanation. These are predicted simulation values.
4. In **Benchmark policies**, choose a workload profile and seed, then run the
   benchmark. The dashboard compares AstraPulse, Round-Robin, and Least-Loaded
   on the same generated workload and reports simulated p50/p95 latency,
   throughput, deadline misses, completed/failed requests, and total estimated
   cost.
5. Point out that benchmark results are reproducible for the same workload
   profile, request count, and seed, but they are not measurements of real
   infrastructure.

The same flow can be exercised through the API:

```powershell
curl http://127.0.0.1:8000/api/workers

curl -X POST http://127.0.0.1:8000/api/workers `
  -H "Content-Type: application/json" `
  -d '{"worker_id":"worker-demo","name":"Demo Worker","capacity":2,"service_rate":1.0,"cost_per_service_ms":0.002}'

curl -X PATCH http://127.0.0.1:8000/api/workers/worker-demo `
  -H "Content-Type: application/json" `
  -d '{"status":"offline"}'

curl -X DELETE http://127.0.0.1:8000/api/workers/worker-demo

curl -X POST http://127.0.0.1:8000/api/workers/reset

curl -X POST http://127.0.0.1:8000/api/route `
  -H "Content-Type: application/json" `
  -d '{"request_id":"demo-001","model":"llama-3-8b","input_tokens":500,"output_tokens":200,"arrival_time_ms":0,"deadline_ms":2000,"deadline_mode":"soft","policy":"astrapulse"}'

curl -X POST http://127.0.0.1:8000/api/benchmark `
  -H "Content-Type: application/json" `
  -d '{"workload_profile":"mixed","request_count":100,"seed":42,"policies":["astrapulse","round_robin","least_loaded"]}'
```

## API endpoints

All application endpoints are documented in
[docs/api-contract.md](docs/api-contract.md):

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend health and simulation mode |
| GET | `/api/workers` | Current simulated worker registry |
| POST | `/api/workers` | Add a validated simulated worker |
| PATCH | `/api/workers/{worker_id}` | Change a worker health state |
| DELETE | `/api/workers/{worker_id}` | Remove an idle simulated worker |
| POST | `/api/workers/reset` | Restore the deterministic default worker pool |
| POST | `/api/route` | Route one inference request |
| POST | `/api/benchmark` | Compare the three scheduling policies |
| GET | `/api/metrics` | Current routing metrics and latest benchmark |
| GET | `/api/scenarios` | List deterministic scenario profiles |
| POST | `/api/scenarios/{scenario_id}/run` | Run one scenario profile |
| GET | `/api/scenario-runs` | List in-memory scenario audit records |

Worker lifecycle rules:

- `POST /api/workers` rejects duplicate IDs with `409` and invalid payloads
  with FastAPI validation errors (`422`).
- Offline workers remain visible but are excluded from new routing decisions.
- A worker with assigned or queued simulated work cannot be removed; the
  delete request returns `409` rather than silently discarding that work.
- Reset restores the four-worker deterministic pool and virtual simulation
  clock. It does not erase live routing metrics or benchmark history.

Successful `/api/route` responses now include additive `stages` diagnostics
for request validation, candidate evaluation, constraint evaluation, worker
selection, and simulated execution. A `no_eligible_worker` response marks
selection and execution as `not_applicable`. Hard-deadline infeasibility is
reported explicitly in the constraint stage. The execution stage records a
virtual slot assignment; it does not claim that a real model completed.

## Tests and build

Run backend tests from `astrapulse/backend`:

```powershell
..\..\.venv\Scripts\python.exe -m pytest
```

Build the frontend from `astrapulse/frontend`:

```powershell
npm run build
```
