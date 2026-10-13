
from fastapi import APIRouter, HTTPException, status

from app.models.worker import (
    Worker,
    WorkerCreateRequest,
    WorkerStatusUpdate,
    WorkersResponse,
)
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


@router.post("/workers", response_model=Worker, status_code=status.HTTP_201_CREATED)
def add_worker(request: WorkerCreateRequest) -> Worker:
    try:
        return worker_registry.add_worker(**request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/workers/{worker_id}", response_model=Worker)
def update_worker_status(
    worker_id: str,
    request: WorkerStatusUpdate,
) -> Worker:
    try:
        return worker_registry.update_status(worker_id, request.status)
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Worker '{worker_id}' was not found",
        ) from exc


@router.delete("/workers/{worker_id}", response_model=Worker)
def remove_worker(worker_id: str) -> Worker:
    try:
        return worker_registry.remove_worker(worker_id)
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Worker '{worker_id}' was not found",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/workers/reset", response_model=WorkersResponse)
def reset_workers() -> WorkersResponse:
    worker_registry.reset()
    return get_workers()
