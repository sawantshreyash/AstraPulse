
from copy import deepcopy

from app.models.worker import Worker, WorkerStatus


class WorkerRegistry:
    """Store the simulated workers in memory."""

    def __init__(self) -> None:
        self.simulation_time_ms = 0
        self._workers = self._default_workers()

    @staticmethod
    def _default_workers() -> list[Worker]:
        return [
            Worker(
                worker_id="worker-1",
                name="Worker 1",
                status="healthy",
                capacity=2,
                active_slots=0,
                queued_requests=0,
                available_at_ms=[0, 0],
                service_rate=1.0,
                cost_per_service_ms=0.002,
            ),
            Worker(
                worker_id="worker-2",
                name="Worker 2",
                status="healthy",
                capacity=4,
                active_slots=0,
                queued_requests=0,
                available_at_ms=[0, 0, 0, 0],
                service_rate=1.5,
                cost_per_service_ms=0.003,
            ),
            Worker(
                worker_id="worker-3",
                name="Worker 3",
                status="degraded",
                capacity=2,
                active_slots=0,
                queued_requests=0,
                available_at_ms=[0, 0],
                service_rate=0.75,
                cost_per_service_ms=0.0015,
            ),
            Worker(
                worker_id="worker-4",
                name="Worker 4",
                status="offline",
                capacity=2,
                active_slots=0,
                queued_requests=0,
                available_at_ms=[0, 0],
                service_rate=1.0,
                cost_per_service_ms=0.0025,
            ),
        ]

    def list_workers(self) -> list[Worker]:
        """Return the current worker records."""
        return self._workers

    def clone(self) -> "WorkerRegistry":
        """Return an independent registry with equivalent virtual state."""
        registry = WorkerRegistry.__new__(WorkerRegistry)
        registry.simulation_time_ms = self.simulation_time_ms
        registry._workers = deepcopy(self._workers)
        return registry

    def reset(self) -> None:
        """Restore the initial worker state."""
        self.simulation_time_ms = 0
        self._workers = self._default_workers()

    def add_worker(
        self,
        *,
        worker_id: str,
        name: str,
        status: WorkerStatus,
        capacity: int,
        service_rate: float,
        cost_per_service_ms: float,
    ) -> Worker:
        if self.get_worker(worker_id) is not None:
            raise ValueError(f"Worker '{worker_id}' already exists")
        worker = Worker(
            worker_id=worker_id,
            name=name,
            status=status,
            capacity=capacity,
            available_at_ms=[self.simulation_time_ms] * capacity,
            service_rate=service_rate,
            cost_per_service_ms=cost_per_service_ms,
        )
        self._workers.append(worker)
        return worker

    def update_status(self, worker_id: str, status: WorkerStatus) -> Worker:
        worker = self.get_worker(worker_id)
        if worker is None:
            raise KeyError(worker_id)
        worker.status = status
        return worker

    def remove_worker(self, worker_id: str) -> Worker:
        worker = self.get_worker(worker_id)
        if worker is None:
            raise KeyError(worker_id)
        if worker.active_slots or worker.queued_requests:
            raise ValueError(
                f"Worker '{worker_id}' has assigned simulated work and cannot be removed"
            )
        self._workers.remove(worker)
        return worker

    def assign(self, worker: Worker, slot_index: int, finish_time_ms: int) -> None:
        worker.available_at_ms[slot_index] = finish_time_ms
        worker.active_slots = sum(
            timestamp > self.simulation_time_ms
            for timestamp in worker.available_at_ms
        )
        worker.queued_requests = sum(
            max(0, timestamp - self.simulation_time_ms) > 0
            for timestamp in worker.available_at_ms
        )
        self.simulation_time_ms = max(self.simulation_time_ms, finish_time_ms)

    def get_worker(self, worker_id: str) -> Worker | None:
        """Find a worker by ID."""
        for worker in self._workers:
            if worker.worker_id == worker_id:
                return worker
        return None


worker_registry = WorkerRegistry()
