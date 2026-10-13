
from fastapi.testclient import TestClient
import pytest
from pydantic import ValidationError

from app.main import app
from app.models.worker import Worker, WorkersResponse

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
    assert WorkersResponse.model_validate(data).model_dump() == data


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


def test_worker_lifecycle_add_status_remove_and_reset() -> None:
    created = client.post(
        "/api/workers",
        json={
            "worker_id": "worker-test",
            "name": "Test Worker",
            "capacity": 2,
            "service_rate": 1.25,
            "cost_per_service_ms": 0.004,
        },
    )
    assert created.status_code == 201
    assert created.json()["available_at_ms"] == [0, 0]

    duplicate = client.post(
        "/api/workers",
        json={
            "worker_id": "worker-test",
            "name": "Duplicate",
            "capacity": 1,
            "service_rate": 1,
            "cost_per_service_ms": 0,
        },
    )
    assert duplicate.status_code == 409

    offline = client.patch(
        "/api/workers/worker-test",
        json={"status": "offline"},
    )
    assert offline.status_code == 200
    assert offline.json()["status"] == "offline"

    removed = client.delete("/api/workers/worker-test")
    assert removed.status_code == 200
    assert removed.json()["worker_id"] == "worker-test"

    reset = client.post("/api/workers/reset")
    assert reset.status_code == 200
    assert [worker["worker_id"] for worker in reset.json()["workers"]] == [
        "worker-1",
        "worker-2",
        "worker-3",
        "worker-4",
    ]


def test_worker_creation_rejects_invalid_configuration() -> None:
    response = client.post(
        "/api/workers",
        json={
            "worker_id": "invalid-worker",
            "name": "Invalid Worker",
            "capacity": 0,
            "service_rate": 1.0,
            "cost_per_service_ms": 0.002,
        },
    )
    assert response.status_code == 422


def test_busy_worker_cannot_be_removed_without_discarding_work() -> None:
    routed = client.post(
        "/api/route",
        json={
            "request_id": "busy-worker",
            "model": "simulated",
            "input_tokens": 500,
            "output_tokens": 200,
            "arrival_time_ms": 0,
            "deadline_ms": 2000,
        },
    )
    assert routed.status_code == 200
    selected_worker = routed.json()["selected_worker"]

    removed = client.delete(f"/api/workers/{selected_worker}")
    assert removed.status_code == 409
    assert client.get("/api/workers").json()["workers"]
