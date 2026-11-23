import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.auth_service import import_owner,institutional_access
from app.models import Import
from app.services.dashboard_service import build_dashboard
from app.services.program_editions import edition_for_start, edition_registry, public_edition
from app.services.leistungen_import import import_groups, stored_payload

router = APIRouter(dependencies=[Depends(institutional_access)])


@router.get('/imports/{import_id}/dashboard', dependencies=[Depends(import_owner)])
def dashboard(import_id: int, term: str | None = Query(None, max_length=40), start_term: str | None = Query(None, max_length=40), db: Session = Depends(get_db)):
    validate_start(start_term)
    imp = db.get(Import, import_id)
    if imp is None:
        raise HTTPException(404, 'Import not found')
    if imp.status != 'success':
        raise HTTPException(409, 'Diese PDF konnte nicht verarbeitet werden. Bitte die Leistungen-Tabelle aus HISinOne erneut als PDF hochladen.')
    groups = import_groups(imp)
    payload = stored_payload(imp)
    if payload and payload.get('source_po')=='20122' and start_term and edition_for_start(start_term)['id']!='wi_bsc_2012':
        raise HTTPException(409, 'Die PDF enthält die Prüfungsordnung 2012. Bitte deinen Studienbeginn unter Studienangaben prüfen; ein PO-Wechsel muss gesondert geklärt werden.')
    return {
        'import_id': imp.id, 'program': imp.degree_program_raw,
        'import_report':payload['report'] if payload else None,
        **build_dashboard(groups, program_key=imp.degree_program_key,
                          grade=imp.overall_grade, credits=imp.overall_credits, term=term, start_term=start_term),
    }


@router.get('/programs/wi/dashboard')
def empty_dashboard(term: str | None = Query(None, max_length=40), start_term: str | None = Query(None, max_length=40)):
    """All curriculum cards before the student's first transcript."""
    validate_start(start_term)
    return {'import_id': None, 'program': 'Wirtschaftsinformatik',
            **build_dashboard([], program_key='wi', grade=None, credits=None, term=term, start_term=start_term)}


def validate_start(value):
    if value is not None:
        try:
            edition_for_start(value)
        except ValueError as error:
            raise HTTPException(422, str(error))


@router.get('/programs/wi/editions')
def editions():
    return {'editions': [public_edition(e) for e in edition_registry()['editions']]}


@router.get('/programs/wi/editions/resolve')
def resolve_edition(start_term: str = Query(..., max_length=40)):
    validate_start(start_term)
    return {**public_edition(edition_for_start(start_term)), 'assignment': 'regular_start_term',
            'note': 'Bei PO-Wechsel, Hochschulwechsel oder späterem Einstieg ist die Zuordnung gesondert zu bestätigen.'}


@router.get('/programs/wi/examples/{scenario}')
def example_dashboard(scenario: str, term: str | None = Query(None, max_length=40), start_term: str | None = Query(None, max_length=40)):
    from app.services.student_examples import SCENARIOS, student_example
    if scenario not in SCENARIOS:
        raise HTTPException(404, 'Beispiel nicht gefunden.')
    validate_start(start_term)
    return student_example(scenario, start_term, term)
