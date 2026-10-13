
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


WorkerStatus = Literal["healthy", "degraded", "offline"]


class Worker(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    worker_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    status: WorkerStatus = "healthy"
    capacity: int = Field(gt=0)
    active_slots: int = Field(default=0, ge=0)
    queued_requests: int = Field(default=0, ge=0)
    available_at_ms: list[int] = Field(min_length=1)
    service_rate: float = Field(gt=0)
    cost_per_service_ms: float = Field(ge=0)

    @model_validator(mode="after")
    def validate_slots(self) -> "Worker":
        if len(self.available_at_ms) != self.capacity:
            raise ValueError(
                "available_at_ms must contain one timestamp per execution slot"
            )

        if self.active_slots > self.capacity:
            raise ValueError("active_slots cannot exceed capacity")

        if any(timestamp < 0 for timestamp in self.available_at_ms):
            raise ValueError("availability timestamps must be non-negative")

        return self


class WorkerCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worker_id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=128)
    status: WorkerStatus = "healthy"
    capacity: int = Field(gt=0)
    service_rate: float = Field(gt=0)
    cost_per_service_ms: float = Field(ge=0)


class WorkerStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: WorkerStatus


class WorkersResponse(BaseModel):
    simulation_time_ms: int
    workers: list[Worker]
