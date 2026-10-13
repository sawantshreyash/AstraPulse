from fastapi.testclient import TestClient

from app.api.scheduling import metrics_collector
from app.main import app
from app.workers.registry import worker_registry


client = TestClient(app)


def test_scenario_catalog_lists_supported_and_explicit_gaps() -> None:
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    catalog = {item["scenario_id"]: item for item in response.json()}
    assert catalog["normal"]["supported"] is True
    assert catalog["low_latency_consistency"]["supported"] is False
    assert "gap" in catalog["low_latency_consistency"]


def test_burst_scenario_is_reproducible_and_restores_state() -> None:
    payload = {"seed": 9, "request_count": 5, "policy": "astrapulse"}
    first = client.post("/api/scenarios/burst/run", json=payload)
    second = client.post("/api/scenarios/burst/run", json=payload)
    assert first.status_code == second.status_code == 200
    assert first.json()["decisions"] == second.json()["decisions"]
    assert first.json()["worker_state_restored"] is True


def test_each_supported_scenario_executes() -> None:
    catalog = client.get("/api/scenarios").json()
    supported = [
        item["scenario_id"] for item in catalog if item["supported"]
    ]
    for scenario_id in supported:
        response = client.post(
            f"/api/scenarios/{scenario_id}/run",
            json={"seed": 3, "request_count": 2},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "completed"
        assert response.json()["worker_state_restored"] is True


def test_hard_deadline_scenario_has_no_feasible_route() -> None:
    response = client.post(
        "/api/scenarios/hard_deadline_infeasible/run",
        json={"seed": 1, "request_count": 1},
    )
    assert response.status_code == 200
    decision = response.json()["decisions"][0]
    assert decision["status"] == "no_eligible_worker"
    assert decision["selected_worker"] is None
    assert all(candidate["eligible"] is False for candidate in decision["candidates"])


def test_worker_failure_recovery_restores_eligibility() -> None:
    response = client.post(
        "/api/scenarios/worker_failure_recovery/run",
        json={"seed": 1, "request_count": 1},
    )
    assert response.status_code == 200
    decisions = response.json()["decisions"]
    assert decisions[0]["status"] == "routed"
    assert decisions[1]["status"] == "routed"
    failed_worker = next(
        candidate
        for candidate in decisions[0]["candidates"]
        if candidate["worker_id"] == "worker-1"
    )
    assert failed_worker["eligible"] is False
    assert response.json()["worker_state_restored"] is True


def test_worker_state_scenarios_cover_degraded_offline_and_single_eligible() -> None:
    degraded = client.post(
        "/api/scenarios/degraded_worker/run",
        json={"seed": 2, "request_count": 1},
    )
    assert degraded.status_code == 200
    assert degraded.json()["decisions"][0]["status"] == "routed"

    offline = client.post(
        "/api/scenarios/all_workers_offline/run",
        json={"seed": 2, "request_count": 1},
    )
    assert offline.status_code == 200
    assert offline.json()["decisions"][0]["status"] == "no_eligible_worker"

    single = client.post(
        "/api/scenarios/one_eligible_worker/run",
        json={"seed": 2, "request_count": 1},
    )
    assert single.status_code == 200
    assert single.json()["decisions"][0]["selected_worker"] == "worker-2"


def test_worker_add_remove_scenario_records_lifecycle() -> None:
    response = client.post(
        "/api/scenarios/worker_add_remove/run",
        json={"seed": 2, "request_count": 1},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["lifecycle"] == {
        "added_worker_id": "worker-scenario",
        "removed_worker_id": "worker-4",
        "removed_worker_was_idle": True,
    }
    assert result["worker_state_restored"] is True


def test_automated_lab_returns_assertions_and_policy_comparison() -> None:
    response = client.post(
        "/api/scenarios/automated/run",
        json={"seed": 12, "request_count": 2},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["scenario_count"] == 11
    assert payload["counts"]["PASS"] == 11
    assert payload["counts"]["FAIL"] == 0
    assert payload["policy_comparison"]["isolated"] is True
    assert len(payload["policy_comparison"]["request_ids"]) == 2
    assert [
        item["policy"] for item in payload["policy_comparison"]["policies"]
    ] == ["astrapulse", "round_robin", "least_loaded"]


def test_automated_lab_is_reproducible_and_preserves_live_state() -> None:
    workers_before = [
        worker.model_dump() for worker in worker_registry.list_workers()
    ]
    metrics_before = metrics_collector.snapshot()
    payload = {"seed": 4, "request_count": 1}
    first = client.post("/api/scenarios/automated/run", json=payload)
    second = client.post("/api/scenarios/automated/run", json=payload)
    assert first.status_code == second.status_code == 200
    first_results = [
        (item["scenario_id"], item["status"], item["actual_outcome"])
        for item in first.json()["results"]
    ]
    second_results = [
        (item["scenario_id"], item["status"], item["actual_outcome"])
        for item in second.json()["results"]
    ]
    assert first_results == second_results
    assert first.json()["policy_comparison"]["policies"] == second.json()["policy_comparison"]["policies"]
    assert [
        worker.model_dump() for worker in worker_registry.list_workers()
    ] == workers_before
    assert metrics_collector.snapshot() == metrics_before


def test_overload_scenario_records_alternative_and_candidate_scores() -> None:
    response = client.post(
        "/api/scenarios/preferred_overloaded/run",
        json={"seed": 2, "request_count": 1},
    )
    assert response.status_code == 200
    decision = response.json()["decisions"][0]
    assert decision["selected_worker"] != "worker-2"
    worker_two = next(
        candidate
        for candidate in decision["candidates"]
        if candidate["worker_id"] == "worker-2"
    )
    assert worker_two["eligible"] is True
    assert any(candidate["score"] is not None for candidate in decision["candidates"])


def test_unknown_scenario_is_rejected() -> None:
    response = client.post("/api/scenarios/unknown/run", json={})
    assert response.status_code == 404


def test_scenario_validation_and_run_audit_are_explicit() -> None:
    invalid = client.post(
        "/api/scenarios/normal/run",
        json={"seed": -1, "request_count": 1},
    )
    assert invalid.status_code == 422

    response = client.post(
        "/api/scenarios/normal/run",
        json={"seed": 4, "request_count": 1},
    )
    assert response.status_code == 200
    result = response.json()
    runs = client.get("/api/scenario-runs")
    assert runs.status_code == 200
    assert any(item["run_id"] == result["run_id"] for item in runs.json())
    assert result["decisions"][0]["simulated_outcome"]["status"] == "completed"


def test_scenario_execution_preserves_live_state_and_metrics() -> None:
    workers_before = [
        worker.model_dump() for worker in worker_registry.list_workers()
    ]
    metrics_before = metrics_collector.snapshot()

    response = client.post(
        "/api/scenarios/worker_failure_recovery/run",
        json={"seed": 8, "request_count": 1},
    )

    assert response.status_code == 200
    assert [
        worker.model_dump() for worker in worker_registry.list_workers()
    ] == workers_before
    assert metrics_collector.snapshot() == metrics_before
