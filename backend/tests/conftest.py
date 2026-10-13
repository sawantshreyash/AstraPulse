import pytest

from app.api.scheduling import metrics_collector
from app.workers.registry import worker_registry


@pytest.fixture(autouse=True)
def reset_simulation_state() -> None:
    worker_registry.reset()
    metrics_collector.routing_decisions = 0
    metrics_collector.completed_requests = 0
    metrics_collector.failed_requests = 0
    metrics_collector.deadline_misses = 0
    metrics_collector.latest_benchmark = None
    metrics_collector.latencies.clear()
    metrics_collector.total_estimated_cost = 0.0
