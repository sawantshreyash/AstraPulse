from fastapi import APIRouter

from app.api.scheduling import metrics_collector

router = APIRouter(tags=["Metrics"])


@router.get("/metrics")
def metrics() -> dict:
    return metrics_collector.snapshot()