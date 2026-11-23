"""Public access is limited to predefined synthetic examples, with no mutations."""
from fastapi import APIRouter, Depends, HTTPException, Request
from app.services.public_demo import SCENARIOS, demo_dashboard
from app.services.security import rate_limit


def limit_demo(request: Request):
    rate_limit(request, 'public-demo', 120, 60)


router = APIRouter(prefix='/demo/wi', dependencies=[Depends(limit_demo)])


@router.get('/examples/{scenario}')
def example(scenario: str):
    if scenario not in SCENARIOS:
        raise HTTPException(404, 'Beispiel nicht gefunden.')
    return demo_dashboard(scenario)
