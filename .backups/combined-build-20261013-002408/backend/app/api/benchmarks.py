from fastapi import APIRouter

from app.api.scheduling import metrics_collector
from app.metrics.benchmark import generate_requests, run_policy
from app.models.request import BenchmarkRequest, Policy
from app.workers.registry import worker_registry

router = APIRouter(tags=["Benchmarks"])


@router.post("/benchmark")
def benchmark(request: BenchmarkRequest) -> dict:
    policies: list[Policy] = request.policies or ["astrapulse", "round_robin", "least_loaded"]
    workload = generate_requests(request.workload_profile, request.request_count, request.seed)
    results = [run_policy(workload, request.workload_profile, policy, worker_registry) for policy in policies]
    payload = {
        "run_id": f"{request.workload_profile}-{request.request_count}-{request.seed}",
        "simulation": True,
        "workload_profile": request.workload_profile,
        "request_count": request.request_count,
        "seed": request.seed,
        "results": [result.model_dump() for result in results],
    }
    metrics_collector.latest_benchmark = payload
    return payload