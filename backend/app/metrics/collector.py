from dataclasses import dataclass, field

from app.workers.simulation import percentile


@dataclass
class MetricsCollector:
    routing_decisions: int = 0
    completed_requests: int = 0
    failed_requests: int = 0
    deadline_misses: int = 0
    latest_benchmark: dict | None = None
    latencies: list[int] = field(default_factory=list)
    total_estimated_cost: float = 0.0

    def record(self, completed: bool, deadline_miss: bool, latency: int | None = None, cost: float = 0.0) -> None:
        self.routing_decisions += 1
        if completed:
            self.completed_requests += 1
            if latency is not None:
                self.latencies.append(latency)
        else:
            self.failed_requests += 1
        if deadline_miss:
            self.deadline_misses += 1
        self.total_estimated_cost += cost

    def snapshot(self) -> dict:
        return {
            "routing_decisions": self.routing_decisions,
            "completed_requests": self.completed_requests,
            "failed_requests": self.failed_requests,
            "deadline_misses": self.deadline_misses,
            "latest_benchmark": self.latest_benchmark,
            "p50_latency_ms": percentile(self.latencies, 0.50),
            "p95_latency_ms": percentile(self.latencies, 0.95),
            "total_estimated_cost": self.total_estimated_cost,
        }