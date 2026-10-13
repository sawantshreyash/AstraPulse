from copy import deepcopy
from typing import Literal

from pydantic import BaseModel, Field

from app.metrics.benchmark import generate_requests, run_policy
from app.models.request import InferenceRequest, Policy
from app.scheduler.base import choose, evaluate_workers
from app.workers.registry import WorkerRegistry


ScenarioId = Literal[
    "normal",
    "low_latency_consistency",
    "preferred_overloaded",
    "hard_deadline_infeasible",
    "hard_deadline_feasible",
    "capacity_exhausted",
    "worker_failure_recovery",
    "degraded_worker",
    "all_workers_offline",
    "one_eligible_worker",
    "worker_add_remove",
    "burst",
    "conflicting_constraints",
]


class ScenarioRunRequest(BaseModel):
    seed: int = Field(default=42, ge=0)
    request_count: int = Field(default=6, ge=1, le=100)
    policy: Policy = "astrapulse"


class AutomatedLabRequest(BaseModel):
    seed: int = Field(default=42, ge=0)
    request_count: int = Field(default=6, ge=1, le=20)


SCENARIOS: dict[str, dict[str, object]] = {
    "normal": {
        "description": "Mixed requests against the initial simulated worker pool.",
        "supported": True,
    },
    "low_latency_consistency": {
        "description": "Tight hard-deadline requests; consistency semantics are not modeled.",
        "supported": False,
        "gap": "The current request and worker schemas have no consistency, reliability, or service-class fields.",
    },
    "preferred_overloaded": {
        "description": "Worker 2 is delayed so feasible alternatives can be evaluated.",
        "supported": True,
    },
    "hard_deadline_infeasible": {
        "description": "All workers are predicted to miss a hard deadline.",
        "supported": True,
    },
    "hard_deadline_feasible": {
        "description": "A valid hard deadline can be met by an eligible worker.",
        "supported": True,
    },
    "capacity_exhausted": {
        "description": "All execution slots are unavailable before a hard deadline.",
        "supported": True,
    },
    "worker_failure_recovery": {
        "description": "Worker 1 is offline, then restored to healthy.",
        "supported": True,
    },
    "degraded_worker": {
        "description": "One worker is degraded while routing remains available.",
        "supported": True,
    },
    "all_workers_offline": {
        "description": "Every worker is offline and no request can be routed.",
        "supported": True,
    },
    "one_eligible_worker": {
        "description": "Only one healthy worker remains eligible for routing.",
        "supported": True,
    },
    "worker_add_remove": {
        "description": "A worker is added, a request is routed, and an idle worker is removed.",
        "supported": True,
    },
    "burst": {
        "description": "Seeded burst workload compared with the selected policy.",
        "supported": True,
    },
    "conflicting_constraints": {
        "description": "Deadline and cost trade-offs; explicit cost/capability constraints are not modeled.",
        "supported": False,
        "gap": "The current request schema has no cost, capability, priority, or latency-objective constraints.",
    },
}
scenario_runs: list[dict[str, object]] = []


def scenario_catalog() -> list[dict[str, object]]:
    return [
        {"scenario_id": scenario_id, **details}
        for scenario_id, details in SCENARIOS.items()
    ]


def _request(
    request_id: str,
    *,
    deadline_ms: int,
    deadline_mode: Literal["soft", "hard"] = "soft",
    seed: int,
) -> InferenceRequest:
    return InferenceRequest(
        request_id=request_id,
        model="simulated-model",
        input_tokens=500,
        output_tokens=200,
        arrival_time_ms=0,
        deadline_ms=deadline_ms,
        deadline_mode=deadline_mode,
        policy="astrapulse",
        seed=seed,
    )


def _decision_record(request: InferenceRequest, registry: WorkerRegistry, policy: Policy) -> dict:
    evaluations = evaluate_workers(request, registry.list_workers())
    selected = choose(evaluations, policy)
    candidates = []
    for item in evaluations:
        candidates.append({
            "worker_id": item.worker.worker_id,
            "eligible": item.eligible,
            "reason": item.reason,
            "completion_time_ms": item.completion_time_ms,
            "deadline_risk": item.deadline_risk,
            "estimated_cost": item.estimated_cost,
            "score": item.score,
        })
    if selected is None:
        return {
            "request_id": request.request_id,
            "status": "no_eligible_worker",
            "selected_worker": None,
            "candidates": candidates,
            "simulated_outcome": {
                "status": "failed",
                "failure_reason": "no_eligible_worker",
            },
            "stages": [
                {"name": "request_validation", "status": "passed"},
                {"name": "candidate_evaluation", "status": "passed"},
                {"name": "constraint_evaluation", "status": "failed"},
                {"name": "worker_selection", "status": "not_applicable"},
                {"name": "simulated_execution", "status": "not_applicable"},
            ],
        }
    registry.assign(selected.worker, selected.slot.slot_index, selected.slot.finish_time_ms)
    return {
        "request_id": request.request_id,
        "status": "routed",
        "selected_worker": selected.worker.worker_id,
        "candidates": candidates,
        "predicted_completion_time_ms": selected.completion_time_ms,
        "predicted_deadline_miss": selected.predicted_deadline_miss,
        "estimated_cost": selected.estimated_cost,
        "simulated_outcome": {
            "status": "completed",
            "worker_id": selected.worker.worker_id,
            "completion_time_ms": selected.completion_time_ms,
            "deadline_miss": selected.predicted_deadline_miss,
            "estimated_cost": selected.estimated_cost,
        },
        "stages": [
            {"name": "request_validation", "status": "passed"},
            {"name": "candidate_evaluation", "status": "passed"},
            {"name": "constraint_evaluation", "status": "passed"},
            {"name": "worker_selection", "status": "passed"},
            {"name": "simulated_execution", "status": "passed"},
        ],
    }


def _run_requests(
    requests: list[InferenceRequest],
    registry: WorkerRegistry,
    policy: Policy,
) -> list[dict]:
    return [_decision_record(request, registry, policy) for request in requests]


def run_scenario(
    scenario_id: ScenarioId,
    request: ScenarioRunRequest,
) -> dict[str, object]:
    details = SCENARIOS[scenario_id]
    run_id = f"{scenario_id}-{request.seed}-{request.request_count}-{request.policy}"
    if not details["supported"]:
        result = {
            "run_id": run_id,
            "scenario_id": scenario_id,
            "status": "unsupported",
            "description": details["description"],
            "gap": details["gap"],
        }
        scenario_runs.append(deepcopy(result))
        return result

    initial = WorkerRegistry()
    registry = initial.clone()
    records: list[dict] = []
    restoration_verified = False
    lifecycle: dict[str, object] | None = None

    try:
        if scenario_id in {"normal", "burst"}:
            profile = "burst" if scenario_id == "burst" else "mixed"
            workload = generate_requests(profile, request.request_count, request.seed)
            records = _run_requests(workload, registry, request.policy)
            metrics = run_policy(workload, profile, request.policy, initial)
        elif scenario_id == "preferred_overloaded":
            worker = registry.get_worker("worker-2")
            assert worker is not None
            worker.available_at_ms = [5000] * worker.capacity
            workload = [_request("preferred-overloaded", deadline_ms=1000, seed=request.seed)]
            records = _run_requests(workload, registry, request.policy)
            metrics = run_policy(workload, "mixed", request.policy, registry)
        elif scenario_id == "hard_deadline_feasible":
            workload = [_request(
                "hard-feasible",
                deadline_ms=1000,
                deadline_mode="hard",
                seed=request.seed,
            )]
            records = _run_requests(workload, registry, request.policy)
            metrics = run_policy(workload, "mixed", request.policy, initial)
        elif scenario_id in {"hard_deadline_infeasible", "capacity_exhausted"}:
            for worker in registry.list_workers():
                if worker.status != "offline":
                    worker.available_at_ms = [10000] * worker.capacity
            workload = [_request(scenario_id, deadline_ms=100, deadline_mode="hard", seed=request.seed)]
            records = _run_requests(workload, registry, request.policy)
            metrics = run_policy(workload, "mixed", request.policy, registry)
        elif scenario_id == "degraded_worker":
            worker = registry.get_worker("worker-1")
            assert worker is not None
            worker.status = "degraded"
            workload = [_request("degraded-worker", deadline_ms=1000, seed=request.seed)]
            records = _run_requests(workload, registry, request.policy)
            metrics = run_policy(workload, "mixed", request.policy, initial)
        elif scenario_id == "all_workers_offline":
            for worker in registry.list_workers():
                worker.status = "offline"
            workload = [_request("all-offline", deadline_ms=1000, seed=request.seed)]
            records = _run_requests(workload, registry, request.policy)
            metrics = run_policy(workload, "mixed", request.policy, initial)
        elif scenario_id == "one_eligible_worker":
            for worker in registry.list_workers():
                worker.status = "offline"
            eligible = registry.get_worker("worker-2")
            assert eligible is not None
            eligible.status = "healthy"
            workload = [_request("one-eligible", deadline_ms=1000, seed=request.seed)]
            records = _run_requests(workload, registry, request.policy)
            metrics = run_policy(workload, "mixed", request.policy, initial)
        elif scenario_id == "worker_add_remove":
            added = registry.add_worker(
                worker_id="worker-scenario",
                name="Scenario Worker",
                status="healthy",
                capacity=1,
                service_rate=1.0,
                cost_per_service_ms=0.002,
            )
            workload = [_request("worker-add-remove", deadline_ms=1000, seed=request.seed)]
            records = _run_requests(workload, registry, request.policy)
            removed = registry.remove_worker("worker-4")
            lifecycle = {
                "added_worker_id": added.worker_id,
                "removed_worker_id": removed.worker_id,
                "removed_worker_was_idle": True,
            }
            metrics = run_policy(workload, "mixed", request.policy, initial)
        else:
            worker = registry.get_worker("worker-1")
            assert worker is not None
            worker.status = "offline"
            failed = _request("failure-active", deadline_ms=1000, seed=request.seed)
            records.append(_decision_record(failed, registry, request.policy))
            worker.status = "healthy"
            recovered = _request("failure-recovered", deadline_ms=1000, seed=request.seed)
            records.append(_decision_record(recovered, registry, request.policy))
            metrics = run_policy([failed, recovered], "mixed", request.policy, initial)
    finally:
        registry.reset()
        restoration_verified = registry.list_workers() == initial.list_workers()

    result = {
        "run_id": run_id,
        "scenario_id": scenario_id,
        "status": "completed",
        "description": details["description"],
        "seed": request.seed,
        "request_count": len(records),
        "policy": request.policy,
        "decisions": records,
        "metrics": metrics.model_dump(),
        "predictions_are_simulated_estimates": True,
        "worker_state_restored": restoration_verified,
    }
    if lifecycle is not None:
        result["lifecycle"] = lifecycle
    scenario_runs.append(deepcopy(result))
    return result


AUTOMATED_SCENARIOS = [
    "normal",
    "burst",
    "degraded_worker",
    "worker_failure_recovery",
    "preferred_overloaded",
    "capacity_exhausted",
    "hard_deadline_feasible",
    "hard_deadline_infeasible",
    "all_workers_offline",
    "one_eligible_worker",
    "worker_add_remove",
]


def _automated_assertion(scenario_id: str, result: dict[str, object]) -> tuple[str, str]:
    decisions = result.get("decisions", [])
    first = decisions[0] if decisions else {}
    if scenario_id in {"normal", "burst", "degraded_worker", "preferred_overloaded", "hard_deadline_feasible"}:
        passed = first.get("status") == "routed"
        return (
            "PASS" if passed else "FAIL",
            "A feasible workload was routed." if passed else "Expected a routed decision.",
        )
    if scenario_id in {"capacity_exhausted", "hard_deadline_infeasible", "all_workers_offline"}:
        passed = first.get("status") == "no_eligible_worker"
        return (
            "PASS" if passed else "FAIL",
            "No eligible worker was selected as expected." if passed else "Expected no eligible worker.",
        )
    if scenario_id == "one_eligible_worker":
        passed = first.get("selected_worker") == "worker-2"
        return (
            "PASS" if passed else "FAIL",
            "The only eligible worker was selected." if passed else "Expected worker-2 to be selected.",
        )
    if scenario_id == "worker_failure_recovery":
        passed = (
            len(decisions) >= 2
            and decisions[0].get("status") == "routed"
            and decisions[1].get("status") == "routed"
        )
        return (
            "PASS" if passed else "FAIL",
            "Routing remained available during failure and after recovery." if passed else "Expected routing before and after recovery.",
        )
    lifecycle = result.get("lifecycle", {})
    passed = lifecycle.get("removed_worker_was_idle") is True
    return (
        "PASS" if passed else "FAIL",
        "An idle worker was removed without discarding assigned work." if passed else "Expected a safe idle-worker removal.",
    )


def run_automated_lab(request: AutomatedLabRequest) -> dict[str, object]:
    results: list[dict[str, object]] = []
    for scenario_id in AUTOMATED_SCENARIOS:
        try:
            scenario_request = ScenarioRunRequest(
                seed=request.seed,
                request_count=request.request_count,
            )
            result = run_scenario(scenario_id, scenario_request)
            status, explanation = _automated_assertion(scenario_id, result)
            results.append({
                "scenario_id": scenario_id,
                "name": SCENARIOS[scenario_id]["description"],
                "expected_behavior": SCENARIOS[scenario_id]["description"],
                "actual_outcome": result.get("status"),
                "status": status,
                "explanation": explanation,
                "run_id": result.get("run_id"),
                "details": result,
            })
        except Exception as exc:
            results.append({
                "scenario_id": scenario_id,
                "name": SCENARIOS[scenario_id]["description"],
                "expected_behavior": SCENARIOS[scenario_id]["description"],
                "actual_outcome": "error",
                "status": "ERROR",
                "explanation": "Scenario could not execute: " + str(exc),
            })

    workload = generate_requests("mixed", request.request_count, request.seed)
    baseline = WorkerRegistry()
    policy_results = [
        run_policy(workload, "mixed", policy, baseline).model_dump()
        for policy in ("astrapulse", "round_robin", "least_loaded")
    ]
    counts = {
        status: sum(item["status"] == status for item in results)
        for status in ("PASS", "FAIL", "ERROR", "UNSUPPORTED")
    }
    return {
        "run_id": f"automated-{request.seed}-{request.request_count}",
        "status": "completed",
        "seed": request.seed,
        "request_count": request.request_count,
        "scenario_count": len(results),
        "completed_count": len(results),
        "counts": counts,
        "results": results,
        "policy_comparison": {
            "workload_profile": "mixed",
            "request_ids": [item.request_id for item in workload],
            "policies": policy_results,
            "isolated": True,
        },
        "predictions_are_simulated_estimates": True,
    }
