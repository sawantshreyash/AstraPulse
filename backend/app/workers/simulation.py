from dataclasses import dataclass
from math import ceil

from app.models.request import InferenceRequest
from app.models.worker import Worker


@dataclass(frozen=True)
class SlotPrediction:
    slot_index: int
    start_time_ms: int
    queue_delay_ms: int
    service_time_ms: int
    finish_time_ms: int


def service_time_ms(request: InferenceRequest, worker: Worker) -> int:
    token_work = request.input_tokens + request.output_tokens
    base = 20 + (token_work / 100)
    return max(1, int(base / worker.service_rate + 0.5))


def predict_slot(request: InferenceRequest, worker: Worker) -> SlotPrediction:
    service = service_time_ms(request, worker)
    options = [
        SlotPrediction(
            slot_index=index,
            start_time_ms=max(request.arrival_time_ms, available_at),
            queue_delay_ms=max(request.arrival_time_ms, available_at) - request.arrival_time_ms,
            service_time_ms=service,
            finish_time_ms=max(request.arrival_time_ms, available_at) + service,
        )
        for index, available_at in enumerate(worker.available_at_ms)
    ]
    return min(options, key=lambda item: (item.finish_time_ms, item.slot_index))


def deadline_risk(completion_time_ms: int, deadline_ms: int) -> float:
    return min(1.0, max(0.0, completion_time_ms / deadline_ms - 0.8) / 0.2)


def projected_cost(prediction: SlotPrediction, worker: Worker) -> float:
    return prediction.service_time_ms * worker.cost_per_service_ms


def percentile(values: list[int], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return float(ordered[ceil(fraction * len(ordered)) - 1])