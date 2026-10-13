
from fastapi import APIRouter

from app.models.worker import WorkersResponse
from app.workers.registry import worker_registry

router = APIRouter(tags=["Workers"])


@router.get("/workers", response_model=WorkersResponse)
def get_workers() -> WorkersResponse:
    """Return the current simulated worker registry."""
    return WorkersResponse(
        simulation_time_ms=worker_registry.simulation_time_ms,
        workers=[
            worker.model_dump()
            for worker in worker_registry.list_workers()
        ],
    )
