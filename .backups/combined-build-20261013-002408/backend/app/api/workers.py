
from fastapi import APIRouter

from app.workers.registry import worker_registry

router = APIRouter(tags=["Workers"])


@router.get("/workers")
def get_workers() -> dict:
    """Return the current simulated worker registry."""
    return {
        "simulation_time_ms": worker_registry.simulation_time_ms,
        "workers": [
            worker.model_dump()
            for worker in worker_registry.list_workers()
        ],
    }
