"""Calendar dates explicitly published in the selected-term BOSS directory."""
import copy
import json
import re
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path


def directory_blocks(html, label, teachers):
    from bs4 import BeautifulSoup
    soup=BeautifulSoup(html,'html.parser')
    if not any(label in h.get_text(' ',strip=True) for h in soup.find_all('h1')):return []
    year_match=re.fullmatch(r'(WS|SS) (\d{2})(?:/(\d{2}))?',label)
    if not year_match:return []
    year=2000+int(year_match[2])
    first,last=(date(year,10,1),date(year+1,3,14)) if year_match[1]=='WS' else (date(year,3,15),date(year,9,30))
    result=[]
    for cell in soup.find_all('td',string=re.compile(r'^Blocks:$')):
        row=cell.find_parent('tr').find_previous_sibling('tr')
        while row and len(row.find_all('td',recursive=False))<5:row=row.find_previous_sibling('tr')
        if not row:continue
        columns=row.find_all('td',recursive=False)
        codes=set(re.findall(r'\b([A-Z][A-Z0-9]+)\s*\(',columns[2].get_text(' ',strip=True)))
        if len(codes)!=1:continue
        names=columns[3].get_text(' ',strip=True).casefold()
        teacher_codes=sorted(code for code,name in teachers.items() if len(name.split())>1 and ', '.join([name.split()[-1],' '.join(name.split()[:-1])]).casefold() in names)
        # Keep the directory's own person spelling if its public short-code map is ambiguous.
        people=[n.strip() for n in columns[3].get_text('\n',strip=True).split('\n') if n.strip()]
        groups=sorted(set(re.findall(r'\b(?:IW|IT|IM|KI|ICS|I)\d+\b',columns[0].get_text(' ',strip=True))))
        dates_cell=cell.find_next_sibling('td')
        if dates_cell is None:continue
        for text in dates_cell.stripped_strings:
            match=re.fullmatch(r'(\d{2}\.\d{2}\.\d{4})\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})(?:\s*\(([^()]*)\))?',text)
            if not match:continue
            try:
                day=datetime.strptime(match[1],'%d.%m.%Y').date()
                start=datetime.strptime(match[2],'%H:%M').strftime('%H:%M')
                end=datetime.strptime(match[3],'%H:%M').strftime('%H:%M')
                if end<=start or not first<=day<=last:continue
            except ValueError:continue
            item={'code':next(iter(codes)),'groups':groups,'source_group':columns[1].get_text(' ',strip=True),'teacher_codes':teacher_codes,'teachers':[teachers[c] for c in teacher_codes] or people,'date':day.isoformat(),'start':start,'end':end,'room':match[4] or ''}
            if item not in result:result.append(item)
    return result


def apply_blocks(items, blocks, source_url='https://stpim.oth-regensburg.de/public/lecturesbyterm'):
    """A dated offering replaces only its same code, cohort and exact teacher set."""
    result=copy.deepcopy(items)
    for block in blocks:
        relevant=[m for m in result if m.get('source_code')==block['code'] and any(re.match(re.escape(g)+r'(?:\b|$)',m.get('group','')) for g in block['groups'])]
        if not relevant:continue
        matching=[m for m in relevant if block['teacher_codes'] and set(m.get('teacher_codes',[]))==set(block['teacher_codes']) and m.get('source_group','')==block['source_group']]
        exact=[m for m in result if m.get('dates') and m.get('source_code')==block['code'] and m['start']==block['start'] and m['end']==block['end'] and m.get('room','')==block['room'] and m.get('teacher_codes',[])==block['teacher_codes']]
        if exact:
            exact[0]['dates']=sorted(set(exact[0]['dates']+[block['date']]))
            continue
        # Other lecturers/groups retain their regular grid. A block is never
        # propagated to every class merely because it has the same module code.
        result=[m for m in result if m not in matching or m.get('dates')]
        sample=matching[0] if matching else relevant[0]
        result.append({**sample,'weekday':datetime.fromisoformat(block['date']).isoweekday(),'start':block['start'],'end':block['end'],'room':block['room'],'teachers':block['teachers'],'teacher_codes':block['teacher_codes'],'source_teacher_codes':block['teacher_codes'],'source_group':block['source_group'],'source_url':source_url,'source_color':'','dates':[block['date']],'recurrence':'weekly','recurrence_note':'','room_candidates':[],'room_assignment':'source'})
    return result


@lru_cache(maxsize=1)
def bundled_blocks():
    path=Path(__file__).resolve().parents[1]/'catalogs/wi_calendar_dates.json'
    return json.loads(path.read_text()) if path.exists() else {} if path.exists() else {}


def calendar_meetings(items, term):
    """Read-only repair for saved BOSS grids; never changes admin or student data."""
    snapshot=bundled_blocks()
    blocks=snapshot.get('terms',{}).get(term,[])
    if not blocks:return items
    # Match only BOSS-derived records from this exact semester's public snapshot.
    source=[m for m in items if str(m.get('source_url','')).startswith('https://stpim.oth-regensburg.de/')]
    other=[m for m in items if m not in source]
    return other+apply_blocks(source,blocks)


def calendar_meetings(items,term):
    """Upgrade old imported BW2/PM data without changing the saved admin draft."""
    document=bundled_blocks()
    blocks=document.get('semesters',{}).get(term,[])
    if not blocks:return items
    source=[m for m in items if m.get('source_url','').startswith('https://stpim.oth-regensburg.de/')]
    other=[m for m in items if m not in source]
    updated=apply_blocks(source,blocks,document.get('source_url',''))
    for m in updated:
        if m.get('source_code') in {b['code'] for b in blocks} and not m.get('recurrence_note',''):
            m['recurrence']='weekly'
    return other+updated
