from pydantic import BaseModel

from app.models.request import Policy


class Prediction(BaseModel):
    queue_delay_ms: int
    service_time_ms: int
    completion_time_ms: int
    deadline_at_ms: int
    predicted_deadline_miss: bool
    deadline_risk: float
    estimated_cost: float
    score: float | None = None


class Candidate(BaseModel):
    worker_id: str
    eligible: bool
    reason: str | None = None
    prediction: Prediction | None = None


class RoutingDecision(BaseModel):
    request_id: str
    status: str
    policy: Policy
    selected_worker: str | None
    prediction: Prediction | None
    candidates: list[Candidate]
    explanation: list[str]
    simulation_time_ms: int