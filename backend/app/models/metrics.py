from pydantic import BaseModel


class BenchmarkMetrics(BaseModel):
    policy: str
    workload_profile: str
    request_count: int
    submitted_requests: int
    completed_requests: int
    failed_requests: int
    deadline_misses: int
    deadline_miss_rate: float
    throughput: float
    p50_latency_ms: float | None
    p95_latency_ms: float | None
    total_estimated_cost: float


class MetricsResponse(BaseModel):
    routing_decisions: int
    completed_requests: int
    failed_requests: int
    deadline_misses: int
    latest_benchmark: dict | None
    p50_latency_ms: float | None
    p95_latency_ms: float | None
    total_estimated_cost: float


class BenchmarkResponse(BaseModel):
    run_id: str
    simulation: bool
    workload_profile: str
    request_count: int
    seed: int
    results: list[BenchmarkMetrics]