from fastapi import APIRouter

from app.metrics.collector import MetricsCollector
from app.models.decision import Candidate, Prediction, RoutingDecision
from app.models.request import InferenceRequest
from app.scheduler.base import choose, evaluate_workers
from app.workers.registry import worker_registry

router = APIRouter(tags=["Scheduling"])
metrics_collector = MetricsCollector()


def route_request(request: InferenceRequest, registry=worker_registry) -> RoutingDecision:
    evaluations = evaluate_workers(request, registry.list_workers())
    selected = choose(evaluations, request.policy)
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
        return RoutingDecision(
            request_id=request.request_id, status="no_eligible_worker", policy=request.policy,
            selected_worker=None, prediction=None, candidates=candidates,
            explanation=["No worker satisfied the request eligibility constraints."],
            simulation_time_ms=registry.simulation_time_ms,
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
    return RoutingDecision(
        request_id=request.request_id, status="routed", policy=request.policy,
        selected_worker=selected.worker.worker_id, prediction=selected_prediction,
        candidates=candidates, explanation=explanation,
        simulation_time_ms=registry.simulation_time_ms,
    )


@router.post("/route", response_model=RoutingDecision)
def route(request: InferenceRequest) -> RoutingDecision:
    return route_request(request)