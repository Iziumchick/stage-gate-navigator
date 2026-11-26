"""Five anonymous examples, isolated from accounts and the operator's semester data."""
from functools import lru_cache
import copy

from app.services.handbook_catalog import semester_catalog
from app.services.student_examples import student_example

SCENARIOS = ('first', 'open', 'practice', 'repeat-first', 'thesis')
TERM = 'WiSe 2026/27'


def example_description(title):
    return f'''Demobeispiel – keine offizielle Modulbeschreibung.

Modul / Teilmodul: {title}
Modulverantwortung: Prof. Dr. Max Mustermann (fiktive Person)
Fakultät: Beispielfakultät (fiktiv)

Inhalte: Hier werden die Themen und Schwerpunkte des Kurses beschrieben.
Lernziele: Hier steht, welche Kenntnisse und Fähigkeiten vermittelt werden.
Lehrformen: Hier werden beispielsweise Vorlesungen, Übungen oder Seminare erläutert.
Arbeitsaufwand: Hier stehen Angaben zur Präsenzzeit und zum Selbststudium.
Prüfung: Hier werden Prüfungsform und Anforderungen beschrieben.

Dieser Text ist ein Platzhalter für die Demonstration. Für verbindliche Angaben nutze das aktuelle Modulhandbuch der Hochschule.'''


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
            for item in [module, *module.get('course_options', [])]:
                details=copy.deepcopy(item.get('details') or {})
                item['details']=details
                # Do not publish handbook excerpts containing real staff names or
                # responsibilities through the anonymous demonstration API.
                details['description']=example_description(item.get('title',module['title']))
                for key in ('handbook', 'reference_handbook'):
                    details.pop(key, None)
                details.pop('description_pdf', None)
    return {**data, 'demo': True, 'example_term': TERM}
