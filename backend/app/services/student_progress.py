"""Effective progress and transparent gates, separate from raw result evidence."""
GROUPS = [
    ('practice', 'Praxisblock', ['wi.req.praktikum', 'wi.req.praxisseminar']),
    ('thesis', 'Bachelorarbeit und Seminar', ['wi.req.bachelorarbeit', 'wi.req.bachelorseminar']),
]


def hold_incomplete_blocks(stages):
    rows={m['id']:m for s in stages.values() for m in s['modules']}
    for _,title,ids in GROUPS:
        parts=[rows[k] for k in ids if k in rows]
        if len(parts)!=len(ids):continue
        complete=all(m['status']=='passed' for m in parts)
        if not complete:
            missing=', '.join(m['title'] for m in parts if m['status']!='passed')
            for m in parts:
                if m['status']=='passed':
                    m.update(result_status='passed',status='unknown',completion_pending=True,
                             credit_hold_reason=f'Nachweis für diesen Teil vorhanden. {title} noch offen: {missing}. Die Block-ECTS werden noch nicht für den Studienfortschritt angesetzt.')
    for m in rows.values():
        m['credited_ects']=m['required_ects'] if m['status']=='passed' else 0


def apply_progress_gates(stages,edition):
    rows={m['id']:m for s in stages.values() for m in s['modules']}
    earned=sum(m['credited_ects'] for m in rows.values())
    first=stages['abschnitt_1']['modules']
    first_earned=sum(m['credited_ects'] for m in first)
    unfinished=[m['short_title'] for m in first if m['status']!='passed']
    third_min=edition['rules']['third_stage']['minimum_ects']
    second_ready=first_earned>=30
    third_ready=not unfinished and earned>=third_min
    second_reason=(f'Abschnitt 2 benötigt 30 ECTS aus Abschnitt 1. Bestätigt: {first_earned:g} ECTS.' +
                   (f' Es fehlen noch {max(0,30-first_earned):g} ECTS aus Abschnitt 1.' if not second_ready else ' Voraussetzung erfüllt.'))
    third_reason=(f'Abschnitt 3 benötigt alle Module aus Abschnitt 1 und mindestens {third_min} ECTS. Bestätigt: {earned:g} ECTS.' +
                  (f' Es fehlen noch {max(0,third_min-earned):g} ECTS.' if earned<third_min else '') +
                  (f' Noch offen in Abschnitt 1: {", ".join(unfinished)}.' if unfinished else ' Abschnitt 1 vollständig abgeschlossen.'))
    practice_reason=f'Praxisplanung ab 90 ECTS. Bestätigt: {earned:g} ECTS.'+(f' Es fehlen noch {90-earned:g} ECTS.' if earned<90 else ' ECTS-Voraussetzung erfüllt.')
    for key,ready,reason in [('abschnitt_1',True,'Abschnitt 1 ist ab Studienbeginn zugänglich.'),('abschnitt_2',second_ready,second_reason),('praxissemester',earned>=90,practice_reason),('abschnitt_3',third_ready,third_reason)]:
        stages[key]['access']={'status':'available' if ready else 'blocked','reason':reason}
        for m in stages[key]['modules']:
            if m['status']=='passed' or m['id'] in {k for _,_,ids in GROUPS for k in ids}:continue
            m['admission']={'status':'available' if ready else 'unknown','reason':reason,'source':edition['label']}
    milestones=[]
    for key in ('abschnitt_1','abschnitt_2','abschnitt_3'):
        parts=stages[key]['modules'];complete=bool(parts) and all(m['status']=='passed' for m in parts)
        milestones.append({'id':key,'title':stages[key]['title'],'available':complete or stages[key]['access']['status']=='available','completed':complete,'reason':stages[key]['access']['reason']})
    for key,title,ids in GROUPS:
        parts=[rows[k] for k in ids];complete=all(m['status']=='passed' for m in parts)
        cap=rows[ids[0]].get('planning',{})
        ready=complete or cap.get('status')=='available' or any(m.get('result_status')=='passed' for m in parts)
        milestones.append({'id':key,'title':'Praxis' if key=='practice' else 'Bachelorarbeit','available':ready,'completed':complete,'reason':cap.get('reason','')})
    return {'confirmed_ects':earned,'milestones':milestones,'gates':[
        {'id':'abschnitt_2','minimum_ects':30,'scope':'first','all_first':False},
        {'id':'practice','minimum_ects':edition['rules']['practical']['minimum_ects'],'scope':'total','all_first':False},
        {'id':'abschnitt_3','minimum_ects':third_min,'scope':'total','all_first':True},
    ]}
