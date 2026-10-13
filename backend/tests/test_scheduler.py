from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.api.scheduling import metrics_collector
from app.models.metrics import MetricsResponse
from app.models.request import InferenceRequest
from app.scheduler.base import choose, evaluate_workers
from app.metrics.benchmark import generate_requests, run_policy
from app.workers.registry import WorkerRegistry
from app.workers.registry import worker_registry
from app.workers.simulation import deadline_risk, service_time_ms


client = TestClient(app)


def test_service_time_and_exact_deadline_are_deterministic() -> None:
    request = InferenceRequest(
        request_id="req",
        model="simulated",
        input_tokens=500,
        output_tokens=200,
        arrival_time_ms=0,
        deadline_ms=18,
        deadline_mode="hard",
    )
    registry = WorkerRegistry()
    worker = registry.get_worker("worker-2")
    assert worker is not None
    assert service_time_ms(request, worker) == 18
    evaluations = evaluate_workers(request, [worker])
    assert evaluations[0].eligible
    assert evaluations[0].completion_time_ms == evaluations[0].deadline_at_ms - 0
    assert evaluations[0].predicted_deadline_miss is False


def test_soft_deadline_risk_has_documented_boundaries() -> None:
    assert deadline_risk(80, 100) == 0.0
    assert deadline_risk(90, 100) == pytest.approx(0.5)
    assert deadline_risk(100, 100) == pytest.approx(1.0)
    assert deadline_risk(150, 100) == pytest.approx(1.0)


def test_offline_worker_is_never_selected() -> None:
    request = InferenceRequest(
        request_id="req",
        model="simulated",
        input_tokens=0,
        output_tokens=0,
        arrival_time_ms=0,
        deadline_ms=100,
    )
    registry = WorkerRegistry()
    worker = registry.get_worker("worker-4")
    assert worker is not None
    evaluations = evaluate_workers(request, [worker])
    assert choose(evaluations, "astrapulse") is None
    assert evaluations[0].reason == "worker is offline"


def test_route_returns_candidate_predictions_for_each_worker() -> None:
    response = client.post(
        "/api/route",
        json={
            "request_id": "candidate-check",
            "model": "simulated",
            "input_tokens": 10,
            "output_tokens": 10,
            "arrival_time_ms": 0,
            "deadline_ms": 1000,
            "policy": "least_loaded",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "routed"
    assert len(payload["candidates"]) == 4
    assert any(not candidate["eligible"] for candidate in payload["candidates"])
    assert [stage["name"] for stage in payload["stages"]] == [
        "request_validation",
        "candidate_evaluation",
        "constraint_evaluation",
        "worker_selection",
        "simulated_execution",
    ]
    assert all(stage["status"] == "passed" for stage in payload["stages"])


def test_no_route_diagnostics_distinguish_hard_deadline_exclusion() -> None:
    response = client.post(
        "/api/route",
        json={
            "request_id": "hard-infeasible",
            "model": "simulated",
            "input_tokens": 500,
            "output_tokens": 200,
            "arrival_time_ms": 0,
            "deadline_ms": 1,
            "deadline_mode": "hard",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "no_eligible_worker"
    stages = {stage["name"]: stage for stage in payload["stages"]}
    assert stages["constraint_evaluation"]["status"] == "failed"
    assert "hard deadline" in stages["constraint_evaluation"]["explanation"]
    assert stages["worker_selection"]["status"] == "not_applicable"
    assert stages["simulated_execution"]["status"] == "not_applicable"


def test_invalid_route_payload_returns_validation_error() -> None:
    response = client.post(
        "/api/route",
        json={
            "request_id": "invalid",
            "model": "simulated",
            "input_tokens": 10,
            "output_tokens": 10,
            "arrival_time_ms": 0,
            "deadline_ms": 0,
        },
    )

    assert response.status_code == 422


def test_metrics_response_matches_declared_model() -> None:
    response = client.get("/api/metrics")

    assert response.status_code == 200
    payload = response.json()
    parsed = MetricsResponse.model_validate(payload)
    assert parsed.model_dump() == payload


def test_benchmark_uses_clean_baseline_after_live_route() -> None:
    route_response = client.post(
        "/api/route",
        json={
            "request_id": "live-before-benchmark",
            "model": "simulated",
            "input_tokens": 500,
            "output_tokens": 200,
            "arrival_time_ms": 0,
            "deadline_ms": 2000,
        },
    )
    assert route_response.status_code == 200

    live_workers_before = [
        worker.model_dump() for worker in worker_registry.list_workers()
    ]
    live_metrics_before = metrics_collector.snapshot()
    benchmark_response = client.post(
        "/api/benchmark",
        json={"workload_profile": "burst", "request_count": 8, "seed": 7},
    )

    assert benchmark_response.status_code == 200
    expected = client.post(
        "/api/benchmark",
        json={"workload_profile": "burst", "request_count": 8, "seed": 7},
    )
    assert expected.status_code == 200
    assert benchmark_response.json()["results"] == expected.json()["results"]
    assert [
        worker.model_dump() for worker in worker_registry.list_workers()
    ] == live_workers_before

    live_metrics_after = metrics_collector.snapshot()
    for field in (
        "routing_decisions",
        "completed_requests",
        "failed_requests",
        "deadline_misses",
        "p50_latency_ms",
        "p95_latency_ms",
        "total_estimated_cost",
    ):
        assert live_metrics_after[field] == live_metrics_before[field]


def test_benchmark_is_reproducible_and_uses_all_policies() -> None:
    payload = {
        "workload_profile": "burst",
        "request_count": 8,
        "seed": 7,
    }
    first = client.post("/api/benchmark", json=payload)
    second = client.post("/api/benchmark", json=payload)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert [result["policy"] for result in first.json()["results"]] == [
        "astrapulse",
        "round_robin",
        "least_loaded",
    ]


def test_benchmark_profiles_and_policy_runs_are_isolated() -> None:
    initial = WorkerRegistry()
    for profile in ("light", "mixed", "burst"):
        workload = generate_requests(profile, 6, 11)
        first = run_policy(workload, profile, "astrapulse", initial)
        second = run_policy(workload, profile, "round_robin", initial)
        assert first.submitted_requests == second.submitted_requests == 6
        assert first.total_estimated_cost >= 0
        assert second.total_estimated_cost >= 0
        assert initial.simulation_time_ms == 0
        assert all(
            worker.available_at_ms == [0] * worker.capacity
            for worker in initial.list_workers()
        )