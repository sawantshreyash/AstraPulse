from dataclasses import dataclass

from app.models.request import InferenceRequest
from app.models.worker import Worker
from app.workers.simulation import SlotPrediction, deadline_risk, predict_slot, projected_cost


@dataclass
class Evaluation:
    worker: Worker
    slot: SlotPrediction | None
    eligible: bool
    reason: str | None
    completion_time_ms: int | None = None
    deadline_at_ms: int | None = None
    predicted_deadline_miss: bool | None = None
    deadline_risk: float | None = None
    estimated_cost: float | None = None
    score: float | None = None


def evaluate_workers(request: InferenceRequest, workers: list[Worker]) -> list[Evaluation]:
    evaluations: list[Evaluation] = []
    for worker in sorted(workers, key=lambda item: item.worker_id):
        if worker.status == "offline":
            evaluations.append(Evaluation(worker, None, False, "worker is offline"))
            continue
        slot = predict_slot(request, worker)
        deadline_at = request.arrival_time_ms + request.deadline_ms
        completion = slot.finish_time_ms - request.arrival_time_ms
        missed = slot.finish_time_ms > deadline_at
        risk = deadline_risk(completion, request.deadline_ms)
        cost = projected_cost(slot, worker)
        if request.deadline_mode == "hard" and missed:
            evaluations.append(Evaluation(worker, slot, False, "predicted completion exceeds hard deadline", completion, deadline_at, missed, risk, cost))
        else:
            evaluations.append(Evaluation(worker, slot, True, None, completion, deadline_at, missed, risk, cost))
    return evaluations


def normalize(value: float, values: list[float]) -> float:
    minimum, maximum = min(values), max(values)
    return 0.0 if maximum == minimum else (value - minimum) / (maximum - minimum)


def score_astrapulse(evaluations: list[Evaluation]) -> None:
    eligible = [item for item in evaluations if item.eligible]
    if not eligible:
        return
    completions = [float(item.completion_time_ms) for item in eligible]
    queues = [float(item.slot.queue_delay_ms) for item in eligible]
    costs = [float(item.estimated_cost) for item in eligible]
    for item in eligible:
        item.score = (
            0.40 * normalize(float(item.completion_time_ms), completions)
            + 0.25 * normalize(float(item.slot.queue_delay_ms), queues)
            + 0.25 * float(item.deadline_risk)
            + 0.10 * normalize(float(item.estimated_cost), costs)
        )


def choose(evaluations: list[Evaluation], policy: str, cursor: int = 0) -> Evaluation | None:
    eligible = [item for item in evaluations if item.eligible]
    if not eligible:
        return None
    if policy == "astrapulse":
        score_astrapulse(evaluations)
        return min(eligible, key=lambda item: (item.score, item.worker.worker_id))
    if policy == "least_loaded":
        return min(eligible, key=lambda item: (sum(item.worker.available_at_ms), item.worker.queued_requests, item.worker.worker_id))
    return eligible[cursor % len(eligible)]