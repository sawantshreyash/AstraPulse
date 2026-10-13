import random

from app.models.metrics import BenchmarkMetrics
from app.models.request import InferenceRequest, Policy
from app.scheduler.base import choose, evaluate_workers
from app.workers.registry import WorkerRegistry
from app.workers.simulation import percentile


def generate_requests(profile: str, count: int, seed: int) -> list[InferenceRequest]:
    rng = random.Random(seed)
    requests: list[InferenceRequest] = []
    arrival = 0
    for index in range(count):
        if profile == "light":
            gap, deadline = rng.randint(80, 160), rng.randint(900, 1600)
        elif profile == "burst":
            gap, deadline = (0 if index % 5 else rng.randint(0, 20)), rng.randint(300, 900)
        else:
            gap, deadline = rng.randint(0, 100), rng.randint(500, 1300)
        arrival += gap
        requests.append(InferenceRequest(
            request_id=f"bench-{seed}-{index}",
            model="simulated-model",
            input_tokens=rng.randint(100, 1200),
            output_tokens=rng.randint(50, 500),
            arrival_time_ms=arrival,
            deadline_ms=deadline,
            deadline_mode="soft",
            policy="astrapulse",
            seed=seed,
        ))
    return requests


def run_policy(requests: list[InferenceRequest], profile: str, policy: Policy, initial: WorkerRegistry) -> BenchmarkMetrics:
    registry = initial.clone()
    completed = failed = misses = 0
    latencies: list[int] = []
    total_cost = 0.0
    cursor = 0
    first_arrival_ms = min(
        (request.arrival_time_ms for request in requests), default=0
    )
    last_completion_ms = first_arrival_ms
    for request in requests:
        evaluations = evaluate_workers(request, registry.list_workers())
        selected = choose(evaluations, policy, cursor)
        if selected is None:
            failed += 1
            continue
        if policy == "round_robin":
            cursor += 1
        completed += 1
        misses += int(bool(selected.predicted_deadline_miss))
        latencies.append(int(selected.completion_time_ms))
        total_cost += float(selected.estimated_cost)
        last_completion_ms = max(last_completion_ms, selected.slot.finish_time_ms)
        registry.assign(selected.worker, selected.slot.slot_index, selected.slot.finish_time_ms)
    elapsed_ms = max(0, last_completion_ms - first_arrival_ms)
    throughput = completed / (elapsed_ms / 1000) if elapsed_ms else 0.0
    return BenchmarkMetrics(
        policy=policy,
        workload_profile=profile,
        request_count=len(requests),
        submitted_requests=len(requests),
        completed_requests=completed,
        failed_requests=failed,
        deadline_misses=misses,
        deadline_miss_rate=misses / len(requests) if requests else 0.0,
        throughput=throughput,
        p50_latency_ms=percentile(latencies, 0.50),
        p95_latency_ms=percentile(latencies, 0.95),
        total_estimated_cost=total_cost,
    )