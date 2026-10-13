from fastapi import APIRouter

from app.api.scheduling import metrics_collector
from app.metrics.benchmark import generate_requests, run_policy
from app.models.request import BenchmarkRequest, Policy
from app.models.metrics import BenchmarkResponse
from app.workers.registry import WorkerRegistry

router = APIRouter(tags=["Benchmarks"])


@router.post("/benchmark", response_model=BenchmarkResponse)
def benchmark(request: BenchmarkRequest) -> BenchmarkResponse:
    policies: list[Policy] = request.policies or ["astrapulse", "round_robin", "least_loaded"]
    workload = generate_requests(request.workload_profile, request.request_count, request.seed)
    benchmark_registry = WorkerRegistry()
    results = [
        run_policy(workload, request.workload_profile, policy, benchmark_registry)
        for policy in policies
    ]
    payload = {
        "run_id": f"{request.workload_profile}-{request.request_count}-{request.seed}",
        "simulation": True,
        "workload_profile": request.workload_profile,
        "request_count": request.request_count,
        "seed": request.seed,
        "results": [result.model_dump() for result in results],
    }
    metrics_collector.latest_benchmark = payload
    return BenchmarkResponse.model_validate(payload)