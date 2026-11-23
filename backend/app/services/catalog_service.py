"""Code-owned curriculum, separate from editable semester presentation data."""
import copy
import hashlib
import json
import os
from pathlib import Path
from app.academic.programs.wi_program import WI_BSC_2023_PROGRAM
from app.services.elective_catalog import fwpm_courses
from app.services.semester_courses import actual_courses


def catalog_path() -> Path:
    return Path(os.environ.get('WI_CATALOG_PATH', '/data/wi_catalog.json'))


def load_wi_catalog() -> dict:
    # Titles, ECTS, weights and rules are always loaded from versioned source code.
    return json.loads((Path(__file__).resolve().parents[1] / 'catalogs' / 'wi_bsc_2023.json').read_text())


def load_semesters() -> dict:
    saved = catalog_path()
    if not saved.exists():
        return {}
    stored = json.loads(saved.read_text())
    if 'semesters' in stored:
        return stored['semesters']
    # Preserve semester course data written by the previous editor. Its editable
    # rules and curriculum overrides deliberately do not influence admissions.
    semesters = {}
    for module_id, entry in stored.get('modules', {}).items():
        for term, course in entry.get('offerings', {}).items():
            semester = semesters.setdefault(term, {'status': 'published', 'handbook': stored.get('handbook', {}), 'modules': {}})
            semester['modules'][module_id] = {**course, 'offered': True, 'handbook_pages': entry.get('handbook_pages')}
    return semesters


def published_semesters() -> dict:
    saved = catalog_path()
    if saved.exists():
        stored = json.loads(saved.read_text())
        if 'published_semesters' in stored:
            return stored['published_semesters']
    return {term: value for term, value in load_semesters().items() if value.get('status') == 'published'}


def revision() -> str:
    saved = catalog_path()
    return hashlib.sha256(saved.read_bytes() if saved.exists() else b'').hexdigest()


def editor_catalog() -> dict:
    from app.services.handbook_catalog import bundled_documents, document_summary, read_document, semester_catalog
    modules = {r.id: {'title': r.title, 'short_title': r.short_title, 'ects': float(r.required_ects),
                     'kind': 'requirement', 'groups': ['abschnitt_3' if r.stage_id == 'abschluss' else r.stage_id]}
               for r in WI_BSC_2023_PROGRAM.requirements if r.stage_id != 'gate'}
    for course in fwpm_courses():
        groups = []
        if 'wi.req.fwpm1' in course['slots']:
            groups.append('abschnitt_2_fwpm')
        if any(slot in course['slots'] for slot in ('wi.req.fwpm2', 'wi.req.fwpm3')):
            groups.append('abschnitt_3_fwpm')
        if not groups:
            groups.append('fwpm_unassigned')
        modules[course['id']] = {**course, 'kind': 'elective', 'groups': groups}
    modules.update(actual_courses())
    for key, value in modules.items():
        if value['kind'] == 'requirement':
            value['legacy'] = True
    defaults = json.loads((Path(__file__).resolve().parents[1] / 'catalogs' / 'wi_semester_defaults.json').read_text())
    semesters=load_semesters()
    documents={d['digest']:d for d in bundled_documents()}
    semester_catalogs={}
    for term, semester in semesters.items():
        selection=semester.get('preparation')
        if not selection: continue
        semester_catalogs[term]=semester_catalog(selection,term)
        for digest in [*selection['core_documents'], *([selection['fwpm_document']] if selection.get('fwpm_document') else [])]:
            documents[digest]=document_summary(read_document(digest))
    from app.services.fwpm_semester import fwpm_library
    library={c['id']:copy.deepcopy(c) for c in fwpm_library()}
    for saved_term, saved_semester in sorted(semesters.items()):
        for row in (saved_semester.get('preparation') or {}).get('fwpm_courses') or []:
            previous=library.get(row['id'],{})
            library[row['id']]={**copy.deepcopy(row),'confirmed':False,'terms':sorted(set(previous.get('terms',[])+[saved_term]))}
    return {**defaults, 'fwpm_library':list(library.values()), 'program_id': WI_BSC_2023_PROGRAM.id, 'revision': revision(), 'semesters': semesters,
            'documents':list(documents.values()), 'semester_catalogs':semester_catalogs,
            'program': {'name': WI_BSC_2023_PROGRAM.name, 'spo_version': WI_BSC_2023_PROGRAM.spo_version},
            'modules': modules}


def admission_for(rule: dict | None, modules: list[dict], credits) -> dict:
    if not rule or not rule.get('verified') or not rule.get('source'):
        return {'status': 'unknown', 'reason': 'Zulassungsbedingungen noch nicht anhand der Studienordnung bestätigt.'}
    reasons = []
    minimum = rule.get('minimum_ects', 0)
    if minimum:
        if credits is None:
            return {'status': 'unknown', 'reason': 'ECTS-Nachweis fehlt.', 'source': rule['source']}
        if credits < minimum:
            reasons.append(f'Mindestens {minimum} ECTS erforderlich; nachgewiesen: {credits}.')
    by_id = {m['id']: m for m in modules}
    for required in rule.get('required_modules', []):
        module = by_id.get(required)
        if not module or module['status'] != 'passed':
            reasons.append(f"Bestandener Nachweis fehlt: {module['title'] if module else required}.")
    return {'status': 'blocked' if reasons else 'available',
            'reason': ' '.join(reasons) or 'Hinterlegte Zulassungsbedingungen erfüllt.', 'source': rule['source']}


def apply_catalog(stages: dict, catalog: dict, credits, term: str | None, *, include_semester_data: bool = True, semester_data: dict | None = None) -> None:
    modules = [m for stage in stages.values() for m in stage['modules']]
    semesters = (published_semesters() if semester_data is None else semester_data) if include_semester_data else {}
    semester = semesters.get(term, {}) if term else {}
    published = semester.get('status') == 'published'
    for stage in stages.values():
        for module in stage['modules']:
            entry = catalog.get('modules', {}).get(module['id'], {})
            course = copy.deepcopy(semester.get('modules', {}).get(module['id'], {})) if published else {}
            # Allow injected catalog fixtures in domain tests, never administrator rules.
            handbook_key = 'fwpm_handbook' if course.get('handbook_kind') == 'fwpm' else 'handbook'
            handbook = semester.get(handbook_key, {}) if published else catalog.get('handbook', {})
            module['details'] = {
                'description': course.get('handbook_excerpt') or entry.get('description'), 'offered_in': entry.get('offered_in'),
                'grade_weight': entry.get('grade_weight'), 'components': entry.get('components', []),
                'handbook': {**handbook, 'pages': course.get('handbook_pages') or entry.get('handbook_pages')},
            }
            module['course'] = course
            rule = entry.get('admission') or catalog.get('admission_rules', {}).get(stage['id'])
            module['admission'] = ({'status': 'completed', 'reason': 'Modul bereits bestanden.'}
                                   if module['status'] == 'passed' else admission_for(rule, modules, credits))
            if module['status'] != 'passed' and course.get('offered') is False:
                module['admission'] = {'status': 'blocked', 'reason': 'Dieses Modul wird im ausgewählten Semester nicht angeboten.'}
