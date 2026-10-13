from fastapi import APIRouter

from app.metrics.collector import MetricsCollector
from app.models.decision import (
    Candidate,
    Prediction,
    RoutingDecision,
    RoutingStage,
)
from app.models.request import InferenceRequest
from app.scheduler.base import choose, evaluate_workers
from app.workers.registry import worker_registry

router = APIRouter(tags=["Scheduling"])
metrics_collector = MetricsCollector()


def route_request(request: InferenceRequest, registry=worker_registry) -> RoutingDecision:
    evaluations = evaluate_workers(request, registry.list_workers())
    selected = choose(evaluations, request.policy)
    stages = [
        RoutingStage(
            name="request_validation",
            status="passed",
            explanation="The request matched the validated inference request schema.",
            evidence={
                "request_id": request.request_id,
                "policy": request.policy,
            },
        ),
        RoutingStage(
            name="candidate_evaluation",
            status="passed",
            explanation="Every worker in the current registry was evaluated.",
            evidence={
                "candidate_count": len(evaluations),
                "eligible_count": sum(
                    item.eligible for item in evaluations
                ),
            },
        ),
    ]
    candidates = []
    for item in evaluations:
        prediction = None
        if item.slot is not None:
            prediction = Prediction(
                queue_delay_ms=item.slot.queue_delay_ms,
                service_time_ms=item.slot.service_time_ms,
                completion_time_ms=item.completion_time_ms,
                deadline_at_ms=item.deadline_at_ms,
                predicted_deadline_miss=item.predicted_deadline_miss,
                deadline_risk=item.deadline_risk,
                estimated_cost=item.estimated_cost,
                score=item.score,
            )
        candidates.append(Candidate(worker_id=item.worker.worker_id, eligible=item.eligible, reason=item.reason, prediction=prediction))
    if selected is None:
        metrics_collector.record(False, False)
        reasons = {
            item.reason for item in evaluations if item.reason
        }
        if (
            request.deadline_mode == "hard"
            and "predicted completion exceeds hard deadline" in reasons
        ):
            constraint_explanation = (
                "Candidates were excluded because their predicted completion "
                "exceeded the hard deadline or they were unavailable."
            )
        else:
            constraint_explanation = (
                "No candidate satisfied the active worker and deadline constraints."
            )
        stages.extend(
            [
                RoutingStage(
                    name="constraint_evaluation",
                    status="failed",
                    explanation=constraint_explanation,
                    evidence={
                        "excluded_count": len(evaluations),
                        "reasons": sorted(reasons),
                    },
                ),
                RoutingStage(
                    name="worker_selection",
                    status="not_applicable",
                    explanation="Selection did not occur because no eligible worker remained.",
                ),
                RoutingStage(
                    name="simulated_execution",
                    status="not_applicable",
                    explanation="No worker was assigned, so no simulated execution was recorded.",
                ),
            ]
        )
        return RoutingDecision(
            request_id=request.request_id, status="no_eligible_worker", policy=request.policy,
            selected_worker=None, prediction=None, candidates=candidates,
            explanation=["No worker satisfied the request eligibility constraints."],
            simulation_time_ms=registry.simulation_time_ms,
            stages=stages,
        )
    selected_prediction = Prediction(
        queue_delay_ms=selected.slot.queue_delay_ms,
        service_time_ms=selected.slot.service_time_ms,
        completion_time_ms=selected.completion_time_ms,
        deadline_at_ms=selected.deadline_at_ms,
        predicted_deadline_miss=selected.predicted_deadline_miss,
        deadline_risk=selected.deadline_risk,
        estimated_cost=selected.estimated_cost,
        score=selected.score,
    )
    registry.assign(selected.worker, selected.slot.slot_index, selected.slot.finish_time_ms)
    metrics_collector.record(True, bool(selected.predicted_deadline_miss), selected.completion_time_ms, selected.estimated_cost)
    if request.policy == "astrapulse":
        explanation = [f"{selected.worker.worker_id} had the lowest AstraPulse heuristic score ({selected.score:.4f}) among eligible workers."]
    elif request.policy == "round_robin":
        explanation = [f"Round-robin selected {selected.worker.worker_id}."]
    else:
        explanation = [f"Least-loaded selected {selected.worker.worker_id}."]
    stages.extend(
        [
            RoutingStage(
                name="constraint_evaluation",
                status="passed",
                explanation="At least one candidate satisfied the active worker and deadline constraints.",
                evidence={"eligible_count": sum(item.eligible for item in evaluations)},
            ),
            RoutingStage(
                name="worker_selection",
                status="passed",
                explanation=f"{selected.worker.worker_id} was selected by the {request.policy} policy.",
                evidence={"selected_worker": selected.worker.worker_id},
            ),
            RoutingStage(
                name="simulated_execution",
                status="passed",
                explanation=(
                    "A virtual execution slot was assigned. Completion and cost "
                    "remain simulated predictions, not real model execution."
                ),
                evidence={
                    "slot_index": selected.slot.slot_index,
                    "predicted_completion_time_ms": selected.completion_time_ms,
                },
            ),
        ]
    )
    return RoutingDecision(
        request_id=request.request_id, status="routed", policy=request.policy,
        selected_worker=selected.worker.worker_id, prediction=selected_prediction,
        candidates=candidates, explanation=explanation,
        simulation_time_ms=registry.simulation_time_ms,
        stages=stages,
    )


@router.post("/route", response_model=RoutingDecision)
def route(request: InferenceRequest) -> RoutingDecision:
    return route_request(request)