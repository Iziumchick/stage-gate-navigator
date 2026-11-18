"""Personal semester planning hints; deliberately separate from formal admission."""
FACULTY_STUDY = 'https://informatik-mathematik.oth-regensburg.de/studium'
PRACTICE_INFO = 'https://elearning.oth-regensburg.de/course/view.php?id=3696'


def apply_milestone_planning(stages, edition):
    modules = {m['id']: m for s in stages.values() for m in s['modules']}
    earned = sum(m['required_ects'] for m in modules.values() if m['status'] == 'passed')
    first_done = all(m['status'] == 'passed' for m in stages['abschnitt_1']['modules'])
    practical_done = modules['wi.req.praktikum']['status'] == 'passed'
    third_ready = first_done and earned >= edition['rules']['third_stage']['minimum_ects']
    practical_ready = practical_done or earned >= edition['rules']['practical']['minimum_ects']
    old = edition['id'] == 'wi_bsc_2012'
    thesis_practice_ready=practical_done and (not old or modules['wi.req.praxisseminar']['status']=='passed')
    third_min=edition['rules']['third_stage']['minimum_ects']
    third_reason=(f'Abschnitt 3: mindestens {third_min} ECTS (bestätigt: {earned:g}). '+('Abschnitt 1 muss vollständig abgeschlossen sein.' if not first_done else 'Abschnitt 1 abgeschlossen.'))
    thesis_missing=[]
    if not thesis_practice_ready:
        thesis_missing.append('Praxisteil noch nicht vollständig abgeschlossen.')
    if not third_ready:thesis_missing.append(third_reason)
    definitions = {
        'wi.req.praktikum': ('practice', practical_ready,
            f"Praxisplanung benötigt 90 ECTS. Bestätigt: {earned:g} ECTS; noch {max(0,90-earned):g} ECTS erforderlich.",
            'Praktikumsstelle und Anmeldung vor Beginn mit der OTH klären.',
            ['Praktikumsstelle und Vertrag mit der OTH abstimmen.', 'Anmeldung und Fristen im Praxissemester-Kurs prüfen.'], PRACTICE_INFO),
        'wi.req.praxisseminar': ('practice_seminar', practical_ready,
            f'Praxisseminar zusammen mit der Praxis ab 90 ECTS planbar. Bestätigt: {earned:g}; noch {max(0,90-earned):g} ECTS erforderlich.',
            'Termin und Anmeldung im Praxissemester-Kurs prüfen.',
            ['Teilnahme und eigenen Vortrag im Praxissemester-Kurs klären.', 'Praktikum und Seminar haben getrennte Nachweise. Der ganze Praxisblock ist erst mit beiden abgeschlossen.', 'Ein persönlicher Vortragstermin wird hier nicht automatisch vergeben.'], PRACTICE_INFO),
        'wi.req.bachelorarbeit': ('thesis', thesis_practice_ready and third_ready,
            ' '.join(thesis_missing),
            'Betreuung und Thema klären; die Bachelorarbeit gesondert anmelden.',
            ['Betreuung und Thema vereinbaren.', 'Bachelorarbeit offiziell anmelden.'] + (['Für PO2012 muss der Praxisteil gemäß §11 abgeschlossen sein; offene Seminar-Nachweise vor der Anmeldung klären.'] if old else ['Themenausgabe frühestens im 6. Studiensemester; die persönliche Einstufung bitte bei der Anmeldung prüfen.']), FACULTY_STUDY),
        'wi.req.bachelorseminar': ('thesis_seminar', third_ready,
            'Teilnahme im Bachelorseminar ab Abschnitt 3. '+third_reason,
            'Vortrag mit der prüfenden Person abstimmen; kein automatisch zugeteilter Termin.',
            ['Teilnahme an neun weiteren Seminarvorträgen einplanen.',
             'Für den eigenen Vortrag muss die Bachelorarbeit angemeldet sein.' if old else 'Den eigenen Vortrag bei der Prüferin oder dem Prüfer anmelden; für den Abschluss muss die schriftliche Arbeit bestanden sein.'], FACULTY_STUDY),
    }
    for key, (kind, ready, reason, note, steps, url) in definitions.items():
        module = modules[key]
        module['planning'] = {
            'status': 'completed' if module['status'] == 'passed' or module.get('completion_pending') else 'available' if ready else 'blocked',
            'kind': kind, 'reason': 'Für den persönlichen Semesterplan verfügbar.' if ready else reason,
            'registration_note': note, 'steps': steps, 'info_url': url,
            'source': edition['label'],
        }
