"""Source-consistent, read-only scenarios; no example is saved as an import."""
from calendar import monthrange
from datetime import date
from app.services.program_editions import edition_for_start
from app.services.dashboard_service import build_dashboard

SCENARIOS = {
    'first': 'Nur Abschnitt 1',
    'open': 'Abschnitt 2 offen · Praxis noch gesperrt',
    'practice': 'Praxis offen · Abschnitt 3 noch gesperrt',
    'third': 'Abschnitt 3 offen · Praktikum noch nicht bestanden',
    'practice-seminar': 'Praktikum bestanden · Praxisseminar offen',
    'thesis': 'Bachelorarbeit und Seminar offen',
    'thesis-seminar': 'Schriftliche Arbeit bestanden · Seminar offen',
    'repeat-first': '1. Wiederholung · im aktuellen Semester',
    'repeat-later': '2. Wiederholung · für nächstes Semester',
    'repeat-due': '2. Wiederholung · im aktuellen Semester',
    'repeat-no-course': 'Wiederholung ohne bestätigte Lehrveranstaltung',
    'repeat-review': 'Weitere Wiederholung · Prüfungsamt prüfen',
    'repeat-unknown': 'Wiederholung · Veröffentlichungsdatum fehlt',
}


# Enrollment belongs to the example, never to the signed-in student's profile.
SCENARIO_START_TERMS = {
    'first': 'WiSe 2026/27',
    'open': 'WiSe 2025/26',
    'practice': 'WiSe 2024/25',
    'third': 'SoSe 2024',
    'practice-seminar': 'WiSe 2024/25',
    'thesis': 'SoSe 2021',
    'thesis-seminar': 'SoSe 2021',
    'repeat-first': 'WiSe 2025/26',
    'repeat-later': 'WiSe 2024/25',
    'repeat-due': 'WiSe 2023/24',
    'repeat-no-course': 'WiSe 2024/25',
    'repeat-review': 'SoSe 2022',
    'repeat-unknown': 'WiSe 2024/25',
}


def shift_months(d, months):
    n=d.year*12+d.month-1+months
    y,m=divmod(n,12);m+=1
    return date(y,m,min(d.day,monthrange(y,m)[1]))


def student_example(scenario, start_term=None, term=None, *, semester_data=None):
    start_term=start_term or SCENARIO_START_TERMS[scenario]
    edition=edition_for_start(start_term);requirements=edition['requirements']
    completed={'wi.req.gwi','wi.req.bwl1','wi.req.pg1','wi.req.ma1','wi.req.ma2'}
    if scenario=='first': completed=set()
    if scenario in ('practice','third','practice-seminar') or scenario.startswith('repeat-'):
        completed={r['id'] for r in requirements if r['stage_id']=='abschnitt_1'}
    if scenario in ('practice','practice-seminar'):
        for r in requirements:
            if r['stage_id']=='abschnitt_2' and sum(p['ects'] for p in requirements if p['id'] in completed)<90:
                completed.add(r['id'])
    if scenario=='third':
        completed={r['id'] for r in requirements if r['stage_id'] in ('abschnitt_1','abschnitt_2')}
    if scenario=='practice-seminar':completed.add('wi.req.praktikum')
    if scenario in ('thesis','thesis-seminar'):
        completed={r['id'] for r in requirements if r['id']!='wi.req.bachelorseminar' and (scenario=='thesis-seminar' or r['id']!='wi.req.bachelorarbeit')}
    year=int((term or 'WiSe 2026/27')[5:9])
    start=date(year,10,1) if not term or term.startswith('WiSe') else date(year,3,15)
    winter=not term or term.startswith('WiSe')
    failed_key=('wi.req.it_architektur' if winter else 'wi.req.statistik') if scenario=='repeat-no-course' else ('wi.req.statistik' if winter else 'wi.req.datenbanken')
    attempts=3 if scenario=='repeat-review' else 2 if scenario in ('repeat-later','repeat-due') else 1
    groups=[]
    for index,r in enumerate(requirements):
        passed=r['id'] in completed;failed=scenario.startswith('repeat-') and r['id']==failed_key
        if not passed and not failed: continue
        grade=str((2.3,2.7,3.0)[index%3]) if r['grade_weight'] else None
        if failed:grade='5.0'
        row={'code':f'BEISPIEL-{index+1}','short_code':r['short_title'],'title':r['title'],'attempt':attempts if failed else 1,
             'grade':float(grade) if grade else None,'ects':r['ects'] if passed else 0,'status':'BE' if passed else 'NB','released_on':shift_months(start,-8 if scenario=='repeat-due' else -2).strftime('%d.%m.%Y') if failed and scenario!='repeat-unknown' else None}
        history=[row]
        if failed: history=[{**row,'attempt':n} for n in range(1,attempts+1)]
        g={'requirement_title':r['title'],'source_code':f'example-{index}','passed':passed,
           'requirement_meta':{'ects':row['ects'],'grade_val':grade,'status_raw':row['status']},'subs':[],'attempts':history,'open_attempts':[row] if failed else []}
        groups.append(g)
    held={'wi.req.praktikum'} if scenario=='practice-seminar' else {'wi.req.bachelorarbeit'} if scenario=='thesis-seminar' else set()
    credits=sum(r['ects'] for r in requirements if r['id'] in completed and r['id'] not in held)
    weighted=[(float(g['requirement_meta']['grade_val']),next(r['grade_weight'] for r in requirements if r['title']==g['requirement_title'])) for g in groups if g['passed'] and g['requirement_meta']['grade_val'] is not None and not any(r['id'] in held and r['title']==g['requirement_title'] for r in requirements)]
    average=round(sum(g*w for g,w in weighted)/sum(w for _,w in weighted),2) if weighted else None
    data=build_dashboard(groups,program_key='wi',grade=average,credits=credits,term=term,start_term=start_term,semester_data=semester_data)
    return {'import_id':None,'program':'Wirtschaftsinformatik','example_scenario':scenario,'example_label':SCENARIOS[scenario],'example_start_term':start_term,**data}
