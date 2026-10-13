
from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.workers import router as workers_router
from app.api.scheduling import router as scheduling_router
from app.api.benchmarks import router as benchmarks_router
from app.api.metrics import router as metrics_router
from app.api.scenarios import router as scenarios_router

app = FastAPI(
    title="AstraPulse API",
    description="Predictive AI workload orchestration simulation API",
    version="0.1.0",
)

app.include_router(health_router, prefix="/api")
app.include_router(workers_router, prefix="/api")
app.include_router(scheduling_router, prefix="/api")
app.include_router(benchmarks_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")
app.include_router(scenarios_router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    """Return basic API information."""
    return {
        "name": "AstraPulse API",
        "status": "running",
        "docs": "/docs",
    }
