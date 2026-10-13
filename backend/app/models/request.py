from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Policy = Literal["astrapulse", "round_robin", "least_loaded"]
DeadlineMode = Literal["soft", "hard"]


class InferenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(min_length=1, max_length=128)
    model: str = Field(min_length=1, max_length=128)
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    arrival_time_ms: int = Field(ge=0)
    deadline_ms: int = Field(gt=0)
    deadline_mode: DeadlineMode = "soft"
    policy: Policy = "astrapulse"
    seed: int | None = Field(default=None, ge=0)


class BenchmarkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workload_profile: Literal["light", "mixed", "burst"] = "mixed"
    request_count: int = Field(default=30, ge=1, le=1000)
    seed: int = Field(default=42, ge=0)
    policies: list[Policy] | None = None

    @field_validator("policies")
    @classmethod
    def validate_policies(cls, value: list[Policy] | None) -> list[Policy] | None:
        if value is not None and len(value) == 0:
            raise ValueError("policies must contain at least one policy")
        if value is not None and len(set(value)) != len(value):
            raise ValueError("policies must not contain duplicates")
        return value