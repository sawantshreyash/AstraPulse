
from fastapi.testclient import TestClient
import pytest
from pydantic import ValidationError

from app.main import app
from app.models.worker import Worker

client = TestClient(app)


def test_workers_endpoint_returns_simulated_workers() -> None:
    response = client.get("/api/workers")

    assert response.status_code == 200
    data = response.json()

    assert data["simulation_time_ms"] == 0
    assert len(data["workers"]) == 4

    worker = data["workers"][0]
    assert worker["worker_id"] == "worker-1"
    assert worker["capacity"] == 2
    assert len(worker["available_at_ms"]) == worker["capacity"]


def test_worker_rejects_zero_capacity() -> None:
    with pytest.raises(ValidationError):
        Worker(
            worker_id="invalid-worker",
            name="Invalid Worker",
            capacity=0,
            available_at_ms=[],
            service_rate=1.0,
            cost_per_service_ms=0.002,
        )


def test_worker_requires_one_timestamp_per_slot() -> None:
    with pytest.raises(ValidationError):
        Worker(
            worker_id="invalid-worker",
            name="Invalid Worker",
            capacity=2,
            available_at_ms=[0],
            service_rate=1.0,
            cost_per_service_ms=0.002,
        )
