"""Five anonymous examples, isolated from accounts and the operator's semester data."""
from functools import lru_cache

from app.services.handbook_catalog import semester_catalog
from app.services.student_examples import student_example

SCENARIOS = ('first', 'open', 'practice', 'repeat-first', 'thesis')
TERM = 'WiSe 2026/27'


@lru_cache(maxsize=5)
def demo_dashboard(scenario):
    if scenario not in SCENARIOS:
        raise ValueError('Unbekanntes Beispiel.')
    # The teaching registry is versioned, bundled data. Never load the live
    # administrator catalog, uploaded PDFs, imports, accounts or SMTP settings.
    courses = semester_catalog({}, TERM)['courses']
    meetings = {
        course_id: {'offered': True, 'meetings': [{
            'weekday': index % 5 + 1, 'start': '10:00', 'end': '11:30',
            'room': f'Demoraum {index % 4 + 1}', 'group': 'Beispieltermin',
            'teachers': [], 'recurrence': 'weekly',
        }]}
        for index, course_id in enumerate(sorted(courses))
    }
    semester = {'status': 'published', 'modules': meetings, 'calendar': {
        'lectures': {'label': 'Beispiel-Vorlesungszeit', 'start': '2026-10-01', 'end': '2027-01-22'},
        'breaks': [{'start': '2026-12-24', 'end': '2027-01-06', 'label': 'Beispielpause'}],
    }}
    data = student_example(scenario, term=TERM, semester_data={TERM: semester})
    # Handbook download endpoints remain protected. No guest link is a bypass
    # to uploaded documents; guests explore the same UI with synthetic results.
    for stage in data['stages']:
        for module in stage['modules']:
            for details in [module.get('details', {}), *(option.get('details', {}) for option in module.get('course_options', []))]:
                for key in ('handbook', 'reference_handbook'):
                    if details.get(key): details[key] = {**details[key], 'url': None}
                details.pop('description_pdf', None)
    return {**data, 'demo': True, 'example_term': TERM}
