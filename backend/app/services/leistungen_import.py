"""HISinOne Leistungen PDF adapter. Outcomes and attempts are separate evidence."""
import copy
import json
import re

import pymupdf

FORMAT = 'hisinone_leistungen'
VERSION = 'leistungen-1.1'
REPRINT = 'Bitte Leistungsdaten mit „Alle aufklappen“ öffnen, den unteren Block Studienverlauf einklappen und die Tabelle vollständig als PDF drucken. Prüfe alle Seiten in der Druckvorschau.'

class ExportError(ValueError):
    def __init__(self, message, code='incomplete_export'):
        self.code = code
        super().__init__(message + ' ' + REPRINT)


def clean(value):
    return re.sub(r'[\ue000-\uf8ff]', '', value).replace('!', 'ft').strip()


def numeric(value):
    if value is None or not value.strip(): return None
    if not re.fullmatch(r'\d+(?:[.,]\d+)?', value): raise ExportError('Ein Zahlenfeld der Tabelle ist abgeschnitten oder nicht lesbar.')
    return float(value.replace(',', '.'))


def read_rows(data):
    """Locate column headings and read by position, retaining page-spanning rows."""
    pages=[]; columns=None; offset=0; warnings=[]; root_po=None
    with pymupdf.open(stream=data, filetype='pdf') as doc:
        if doc.page_count > 80: raise ExportError('Die PDF enthält zu viele Seiten.')
        for page in doc:
            ws=[{'text':w[4], 'x':w[0], 'right':w[2], 'y':w[1]+offset, 'page':page.number+1} for w in page.get_text('words')]
            heads=[w for w in ws if w['text']=='Nummer']
            for h in heads:
                row={w['text']:w['x'] for w in ws if abs(w['y']-h['y'])<3}
                if all(k in row for k in ('Titel','Nummer','Versuch','Rücktritt','Bewertung','Bonus','Malus','Status')):
                    columns=row; break
            if columns is None: raise ExportError('Keine Leistungen-Tabelle erkannt. Bitte die Seite „Leistungen“ aus HISinOne als PDF speichern.', 'wrong_document')
            for w in ws:
                found=re.search(r'\|IW\|[^\s]*\|(\d{5})\b', w['text'])
                if found: root_po=found[1]
            pages.append((ws,copy.deepcopy(columns)))
            offset+=page.rect.height+20
        if sum(len(ws) for ws,_ in pages)>100000: raise ExportError('Die Tabelle ist zu umfangreich.')
    anchors=[]
    all_words=[]
    for ws,cols in pages:
        scale=(cols['Versuch']-cols['Nummer'])/30
        number_left=cols['Nummer']-6*scale
        for w in ws:
            w['columns']=cols; all_words.append(w)
            if number_left<=w['x']<cols['Versuch']-6*scale and re.fullmatch(r'(?:IW|AW)(?:\d{2,5})?',w['text']):
                anchors.append(w)
            elif w['x']<number_left<w['right'] and re.search(r'(IW|AW)$',w['text']):
                # Long titles can touch the programme cell without a space.
                match=re.search(r'(IW|AW)$',w['text'])
                if any(re.fullmatch(r'\d{2,5}',v['text']) and abs(v['y']-w['y'])<3 and number_left<v['x']<cols['Versuch']-6*scale for v in ws):
                    anchors.append({**w,'text':match[1],'x':cols['Nummer']-2*scale,'columns':cols})
                    w['text']=w['text'][:-len(match[1])]

    anchors.sort(key=lambda w:w['y'])
    if len(anchors)>1500: raise ExportError('Die Tabelle ist zu umfangreich.')
    rows=[]
    # Anchors share the numeric-column origin. Following numeric lines belong to
    # that row, including when its identifier continues on the next page.
    for index,a in enumerate(anchors):
        cols=a['columns']; scale=(cols['Versuch']-cols['Nummer'])/30
        end=anchors[index+1]['y'] if index+1<len(anchors) else float('inf')
        number_words=sorted([w for w in all_words if a['y']-2<=w['y']<end-2 and w['columns']['Nummer']-6*scale<=w['x']<w['columns']['Versuch']-6*scale],key=lambda w:(w['y'],w['x']))
        # The first line is programme + PO; the next line is the result code.
        code_word=next((w for w in number_words if w['y']>a['y']+3 and re.fullmatch(r'\d{2,10}',w['text'])),None)
        if code_word is None: raise ExportError(f'Eine Ergebnisnummer auf Seite {a["page"]} ist nicht vollständig lesbar.')
        code=code_word['text']
        short_words=[w['text'] for w in number_words if w['y']>=code_word['y']-2 and w is not code_word]
        short=' '.join(short_words).strip()
        base=[w for w in all_words if abs(w['y']-a['y'])<3 and w['page']==a['page']]
        def field(name,next_name):
            left=cols[name]-6*scale; right=cols.get(next_name,float('inf'))-6*scale
            return ' '.join(w['text'] for w in sorted(base,key=lambda w:w['x']) if left<=w['x']<right)
        attempt_text=field('Versuch','Rücktritt')
        if not re.fullmatch(r'\d{1,2}',attempt_text): raise ExportError(f'Die Versuchsspalte auf Seite {a["page"]} ist nicht lesbar.')
        grade=numeric(field('Bewertung','Bonus')); credits=numeric(field('Bonus','Malus'))
        # MuPDF may join touching text (e.g. 0.0NB) across Malus/Status.
        status_words=[w['text'] for w in base if w['right']>cols['Status']-6*scale and w['x']<min((x for x in cols.values() if x>cols['Status']),default=float('inf'))-6*scale]
        status_match=re.search(r'(BE|NB|PV|EN|Freigabe)\s*$', ' '.join(status_words))
        status=status_match[1] if status_match else None
        if status is None: raise ExportError(f'Ein Ergebnisstatus auf Seite {a["page"]} ist nicht lesbar.')
        if grade is not None and not (1<=grade<=5):
            if grade==0: grade=None
            else: raise ExportError('Eine Bewertung liegt außerhalb des erkannten Notenbereichs.')
        if status=='BE' and grade is not None and grade>4 or status=='NB' and grade is not None and grade<=4:
            raise ExportError('Bewertung und Ergebnisstatus widersprechen sich. Bitte die Druckansicht prüfen.')
        title_words=sorted([w for w in all_words if a['y']-3<=w['y']<end-3 and w['x']<w['columns']['Nummer']-6*scale],key=lambda w:(w['y'],w['x']))
        # Navigation above the table can overlap in the print. Restrict title
        # continuation to the indentation of the source's first title line.
        first=[w for w in title_words if abs(w['y']-a['y'])<4]
        icons=[w for w in first if re.search(r'[\ue900\uea0f]',w['text'])]
        left=max((w['x'] for w in icons),default=min((w['x'] for w in first),default=0))
        title=' '.join(clean(w['text']) for w in title_words if w['x']>=left-1 and clean(w['text']) and not re.search(r'https?://|Menü|durchsuchen|Studienverlauf|Default|language|Страница',w['text']))
        # Stop common browser footer/navigation tokens instead of treating them as a title.
        title=re.sub(r'\s+\d+/\d+\s*$', '', title).strip()
        title=re.sub(r'\s+(?:20\d{2}|Regensburg|Mein Studium)\s*$', '', title).strip()
        date=None
        date_column=next((key for key in ('Freigabedatum','Freigabe') if key in cols),None)
        if date_column:
            raw_date=field(date_column,'Aktionen')
            match=re.search(r'\b(\d{2}\.\d{2}\.\d{4})\b',raw_date)
            if match: date=match[1]
            elif re.search(r'\d{2}\.\d{2}\.',raw_date): warnings.append('Einige Freigabedaten sind abgeschnitten; diese Datumsfelder wurden nicht übernommen.')
        rows.append({'code':code,'short_code':short,'title':title,'attempt':int(attempt_text),
                     'grade':grade,'ects':credits,'status':status,'released_on':date,'page':a['page']})
    if not any(a['text'].startswith('IW') for a in anchors):
        raise ExportError('Diese Version unterstützt Leistungen für Wirtschaftsinformatik. Bitte den Studiengang in HISinOne prüfen.', 'unsupported_program')
    return rows,root_po,list(dict.fromkeys(warnings))


TITLE_ALIASES={
    'Grundlagen der WI':'Grundlagen der Wirtschaftsinformatik',
    'BWL 1':'Betriebswirtschaftslehre 1','BWL 2':'Betriebswirtschaftslehre 2',
    'GP-analyse und -design':'Geschäftsprozessanalyse und -design',
    'Allgemeinw. WPF 1':'Allgemeinwissenschaftliches Wahlpflichtmodul 1',
    'AWPF 1':'Allgemeinwissenschaftliches Wahlpflichtmodul 1',
    'AWPF 2':'Allgemeinwissenschaftliches Wahlpflichtmodul 2',
    'Praktikum im Betrieb':'Praktikum',
    **{f'FWPF {n}':f'Fachbezogenes Wahlpflichtmodul {n}' for n in (1,2,3)},
    **{f'FWPM {n}':f'Fachbezogenes Wahlpflichtmodul {n}' for n in (1,2,3)},
}

def groups_from_rows(rows):
    groups=[]; current=None; totals=None; seen=set(); warnings=[]
    for row in rows:
        code=row['code']
        if code=='9000':
            if totals is not None: raise ExportError('Mehrere Gesamtkonten gefunden. Bitte nur den gewählten Studiengang exportieren.')
            totals=row; current=None; continue
        if int(code)<10000 or code in ('10000','20000','30000'): current=None; continue
        if len(code)<=5:
            if current and current['source_code']==code:
                # Nested component account (e.g. AW-Teilmodul) is not a second module.
                current['subs'].append({'title':row['title'],'ects':row['ects'],'grade_val':str(row['grade']) if row['grade'] is not None else None})
                continue
            if code in seen: raise ExportError('Ein Modul ist mehrfach enthalten. Bitte nur eine vollständige Ansicht exportieren.')
            seen.add(code)
            key=lambda t:re.sub(r'[^a-z0-9äöüß]','',t.casefold())
            title=next((v for k,v in TITLE_ALIASES.items() if key(k)==key(row['title'])),row['title'])
            current={'requirement_title':title, 'source_title':row['title'],'source_code':code,
                     'requirement_meta':{'ects':row['ects'],'grade_val':str(row['grade']) if row['grade'] is not None else None,'status_raw':row['status']},
                     'passed':row['status']=='BE','subs':[],'attempts':[]}
            groups.append(current)
        else:
            if current is None: raise ExportError('Eine Prüfungszeile lässt sich keinem Modul zuordnen. Bitte alle Module aufklappen.')
            if not row['title']: raise ExportError('Ein Prüfungsname ist nicht lesbar.')
            identity=(code,row['attempt'])
            if any((r['code'],r['attempt'])==identity for g in groups for r in g['attempts']):
                raise ExportError('Dieselbe Prüfungsnummer und Versuchszahl kommt mehrfach vor.')
            current['attempts'].append(row)
    if totals is None or totals['ects'] is None: raise ExportError('Das Gesamtkonto mit der ECTS-Summe konnte nicht gelesen werden.')
    if not float(totals['ects']).is_integer() or totals['ects']<0: raise ExportError('Die ECTS-Summe im Gesamtkonto ist nicht lesbar.')
    possible_earned={0.0}
    key=lambda t:re.sub(r'[^a-z0-9äöüß]','',t.casefold())
    passed_names={key(g['requirement_title']) for g in groups if g['passed']}
    for g in groups:
        by_code={}
        for r in g['attempts']:
            by_code.setdefault(r['code'],[]).append(r)
        for code,history in by_code.items():
            history.sort(key=lambda r:r['attempt']); last=history[-1]
            g['subs'].append({'title':last['title'],'ects':last['ects'],'grade_val':str(last['grade']) if last['grade'] is not None else None})
            if any(r['status']=='BE' for r in history[:-1]) and last['status']=='NB':
                raise ExportError('Die Versuchshistorie widerspricht einem bereits erfolgreichen Ergebnis.')
        evidence=sum((rs[-1]['ects'] or 0) for rs in by_code.values() if rs[-1]['status']=='BE')
        meta=g['requirement_meta']
        nominal=(meta['ects'] if meta['ects'] is not None else evidence) if g['passed'] else evidence
        name=key(g['requirement_title'])
        pending_whole=not g['passed'] and (name.startswith('allgemeinwissenschaftlicheswahlpflichtmodul') or name in ('praktischesstudiensemester','praktikummitpraxisseminar','bachelorarbeit'))
        pending_pair=g['passed'] and ((name in ('praktikum','praktikumimbetrieb') and 'praxisseminar' not in passed_names) or (name=='bachelorarbeit' and 'bachelorseminar' not in passed_names))
        choices={0.0,float(nominal or 0)} if pending_whole or pending_pair else {float(nominal or 0)}
        # Only known pending blocks admit an unreleased-credit alternative. The
        # official Gesamtkonto must still match an exact reconciled sum.
        possible_earned={round(v+c,2) for v in possible_earned for c in choices if v+c<=totals['ects']+0.01}

        latest=[rs[-1] for rs in by_code.values()]
        g['open_attempts']=[r for r in latest if r['status']=='NB'] if not g['passed'] else []
        # The parent status is preserved independently of the attempt history.
        if g['passed'] and not g['attempts'] and (meta['ects'] or 0)>0:
            raise ExportError('Ein abgeschlossenes Modul enthält keine Prüfungsdetails. Bitte „Alle aufklappen“ verwenden.')
    if not any(abs(v-totals['ects'])<=0.01 for v in possible_earned):
        raise ExportError('Die lesbaren Modul- und Prüfungsnachweise passen nicht zur ECTS-Summe im Gesamtkonto. Möglicherweise fehlen aufgeklappte Zeilen.')
    if not groups and totals['ects']>0: raise ExportError('Die einzelnen Module fehlen. Bitte „Alle aufklappen“ verwenden.')
    return groups,totals,warnings


def parse_leistungen(data):
    rows,po,warnings=read_rows(data)
    groups,totals,group_warnings=groups_from_rows(rows)
    attempts=[a for g in groups for a in g['attempts']]
    return {'format':FORMAT,'parser_version':VERSION,'source_po':po,'groups':groups,
            'overall_grade':totals['grade'],'overall_credits':int(totals['ects']),
            'report':{'format':FORMAT,'module_count':len(groups),'attempt_count':len(attempts),
                      'open_exam_count':sum(len(g['open_attempts']) for g in groups),
                      'historical_failure_count':sum(a['status']=='NB' for a in attempts),
                      'warnings':list(dict.fromkeys(warnings+group_warnings))}}


def stored_payload(imp):
    if imp.source!='hisinone_leistungen': return None
    value=json.loads(imp.parsed_modules_json or '{}')
    return value if isinstance(value,dict) and value.get('format')==FORMAT else None


def import_groups(imp):
    payload=stored_payload(imp)
    if payload is not None: return payload['groups']
    legacy=json.loads(imp.parsed_modules_json or '{}')
    if isinstance(legacy,dict) and legacy.get('format')=='legacy_module_groups':return legacy.get('groups',[])
    from app.services.module_structure_service import parse_groups_from_styled_lines
    return parse_groups_from_styled_lines(json.loads(imp.raw_lines_json or '[]'),limit=500)
