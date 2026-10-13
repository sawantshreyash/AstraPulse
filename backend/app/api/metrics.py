from fastapi import APIRouter

from app.api.scheduling import metrics_collector
from app.models.metrics import MetricsResponse

router = APIRouter(tags=["Metrics"])


@router.get("/metrics", response_model=MetricsResponse)
def metrics() -> MetricsResponse:
    return MetricsResponse.model_validate(metrics_collector.snapshot())