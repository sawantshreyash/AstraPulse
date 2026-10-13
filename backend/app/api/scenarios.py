from fastapi import APIRouter, HTTPException

from app.scenarios import (
    SCENARIOS,
    ScenarioId,
    AutomatedLabRequest,
    ScenarioRunRequest,
    run_automated_lab,
    run_scenario,
    scenario_catalog,
    scenario_runs,
)

router = APIRouter(tags=["Scenarios"])


@router.get("/scenarios")
def scenarios() -> list[dict[str, object]]:
    return scenario_catalog()


@router.get("/scenario-runs")
def runs() -> list[dict[str, object]]:
    return scenario_runs


@router.post("/scenarios/automated/run")
def automated_run(request: AutomatedLabRequest) -> dict[str, object]:
    return run_automated_lab(request)


@router.post("/scenarios/{scenario_id}/run")
def run(scenario_id: str, request: ScenarioRunRequest) -> dict[str, object]:
    if scenario_id not in SCENARIOS:
        raise HTTPException(status_code=404, detail="Unknown scenario identifier")
    return run_scenario(scenario_id, request)  # type: ignore[arg-type]
