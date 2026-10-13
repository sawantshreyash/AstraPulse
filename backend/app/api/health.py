from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    """Report whether the AstraPulse API is responding."""
    return {
        "status": "ok",
        "service": "astrapulse-api",
        "simulation_mode": "virtual_time",
    }
