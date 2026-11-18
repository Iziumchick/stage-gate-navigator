"""Admin-owned semester FWPM proposals. No curriculum or credit mutations."""
import copy
import hashlib
import re
from functools import lru_cache
from app.services.handbook_catalog import teaching_registry, reference_document
from app.services.elective_catalog import fwpm_courses


def code_key(value):
    return re.sub(r'[^a-z0-9]', '', value.casefold())


def candidate(course, term=None, confirmed=False):
    return {'id':course['id'],'title':course['title'],'short_title':course['short_title'],
            'ects':5,'slots':course.get('slots',[]),'offered':True,'confirmed':confirmed,
            'source_term':term,'source_url':course.get('source_url',''),'pages':course.get('pages'),
            'description':course.get('description','')[:8000],'description_pdf':course.get('description_pdf')}


@lru_cache(maxsize=1)
def fwpm_library():
    result={}
    winter=max(d['term'] for d in teaching_registry()['documents'].values() if d['kind']=='fwpm' and d['term'].startswith('WiSe'))
    year=int(winter[5:9]); recent={winter,f'SoSe {year}',f'SoSe {year+1}'}
    for course in fwpm_courses():
        if not recent.intersection(course['terms']): continue
        result[course['id']]={**candidate(course),'terms':course['terms']}
    for doc in teaching_registry()['documents'].values():
        if doc['kind']!='fwpm': continue
        for key,c in doc['courses'].items():
            result[key]={**candidate({**c,'source_url':doc['url']},doc['term']),
                         'terms':sorted(set(result.get(key,{}).get('terms',[])+[doc['term']]))}
    return list(result.values())


def selectable_proposal(courses):
    """Unassigned entries stay in the add-catalog, never in the active offer."""
    result=copy.deepcopy(courses)
    for row in result:
        if not row.get('slots'):
            row.update(offered=False,confirmed=False)
    return result


def default_proposal(term):
    """Only exact reviewed PDF offers are initially confirmed."""
    reviewed={}
    for doc in teaching_registry()['documents'].values():
        if doc['kind']=='fwpm' and doc['term']==term:
            reviewed.update({key:candidate({**c,'source_url':doc['url']},term,True) for key,c in doc['courses'].items()})
    if reviewed: return list(reviewed.values())
    return selectable_proposal([{k:copy.deepcopy(v) for k,v in c.items() if k!='terms'} for c in fwpm_library() if term in c['terms']])


def automatic_proposal(term, semesters):
    """Use this semester's saved list, otherwise the latest same-season list."""
    current=(semesters.get(term,{ }).get('preparation') or {}).get('fwpm_courses')
    if current is not None: return selectable_proposal(current),term
    reviewed=any(d['kind']=='fwpm' and d['term']==term for d in teaching_registry()['documents'].values())
    if reviewed: return default_proposal(term),term
    key=lambda t:int(t[5:9])*2+int(t.startswith('WiSe'))
    previous=[t for t,s in semesters.items() if t.startswith(term[:4]) and key(t)<key(term) and (s.get('preparation') or {}).get('fwpm_courses') is not None]
    if previous:
        source=max(previous,key=key)
        return copy_proposal(semesters[source]['preparation']['fwpm_courses'],source),source
    known={t for c in fwpm_library() for t in c['terms'] if t.startswith(term[:4]) and key(t)<key(term)}
    if known:
        source=max(known,key=key)
        return copy_proposal(default_proposal(source),source),source
    return default_proposal(term),term


def copy_proposal(courses, source_term):
    return selectable_proposal([{**copy.deepcopy(candidate(c,source_term,False)),'offered':c.get('offered',True)} for c in courses])


def parse_fwpm_proposal(data, term):
    """Read IW table marks and explicit FWPM section headers; return unconfirmed rows."""
    import pymupdf
    docmeta=reference_document(data,'fwpm')
    if docmeta['term']!=term:
        raise ValueError(f"Das PDF gehört zu {docmeta['term'] or 'keinem erkannten Semester'}, nicht zu {term}.")
    known={code_key(c['short_title']):c for c in fwpm_library()}
    with pymupdf.open(stream=data,filetype='pdf') as doc:
        marks={}
        for page in list(doc)[:4]:
            words=page.get_text('words'); headers=[w for w in words if w[4] in ('IN','IT','IW','KI','IM','ICS')]
            iw=next((w for w in headers if w[4]=='IW'),None)
            if not iw: continue
            center=(iw[0]+iw[2])/2
            centers=sorted(set((w[0]+w[2])/2 for w in headers if abs(w[1]-iw[1])<12))
            if not any(c<center for c in centers) or not any(c>center for c in centers): continue
            left=(max(c for c in centers if c<center)+center)/2; right=(min(c for c in centers if c>center)+center)/2
            codes=sorted([w for w in words if w[0]<min(h[0] for h in headers)-15 and w[1]>iw[3] and re.fullmatch('[A-Z][A-Z0-9]{2,7}',w[4])],key=lambda w:w[1])
            for i,w in enumerate(codes):
                top=(codes[i-1][3]+w[1])/2 if i else w[1]-4
                bottom=(w[3]+codes[i+1][1])/2 if i+1<len(codes) else w[3]+12
                if any(left<=(x[0]+x[2])/2<right and top<=(x[1]+x[3])/2<bottom and x[4].upper() in ('X','(X)') for x in words): marks[w[4]]=True
        if not marks: raise ValueError('Keine eindeutige IW-Spalte mit X/(X) gefunden. Kein Vorschlag übernommen.')
        rows={}; slot=None; starts=[]
        for index,page in enumerate(doc):
            text=page.get_text(sort=True)
            if 'Modulliste' in text or len(re.findall(r'\.{3,}\s*\d+',text))>2: continue
            parent=re.search(r'Fachbezogenes\s+Wahlpflichtmodul\s+([123])',text)
            if parent: slot='wi.req.fwpm'+parent[1]
            words=page.get_text('words')
            header=next((w for w in words if w[4]=='Teilmodul'),None)
            tm=next((w for w in words if w[4]=='TM-Kurzbezeichnung' and header and abs(w[1]-header[1])<5),None)
            if any(w[4]=='Modulbezeichnung' for w in words) or header and tm: starts.append(index+1)
            if not header or not tm: continue
            bottom=min((w[1] for w in words if w[4].startswith('Verantwortliche/r') and w[1]>header[3]),default=header[3]+45)
            title=' '.join(w[4] for w in sorted(words,key=lambda w:(round(w[1]/4),w[0])) if header[1]+6<w[1]<bottom-1 and w[0]<tm[0]-5)
            match=re.match(r'^([A-Z][A-Z0-9]{2,7}):\s*(.*)',title)
            if not match or match[1] not in marks: continue
            code,title=match.groups(); key=code_key(code)
            old=known.get(key)
            credits=None
            for label in [w for w in words if 'ECTS-Credits' in w[4]]:
                end=min((w[1] for w in words if w[4].startswith('Zeitaufwand') and w[1]>label[1]),default=label[3]+70)
                nums=[w for w in words if w[0]>=label[0]-12 and label[1]+7<w[1]<end and re.fullmatch(r'\d+(?:[.,]\d+)?',w[4])]
                if len(nums)==1: credits=float(nums[0][4].replace(',','.'))
            row=rows.setdefault(code,{'id':old['id'] if old else 'wi.fwpm.custom.'+hashlib.sha256(key.encode()).hexdigest()[:16],
                'title':title,'short_title':code,'ects':credits,'slots':[],'offered':True,'confirmed':False,'source_term':term,
                'source_url':docmeta['url'],'pages':{'start':index+1},'description':text[:8000]})
            if slot and slot not in row['slots']: row['slots'].append(slot)
        for row in rows.values():
            row['pages']['end']=next((p-1 for p in starts if p>row['pages']['start']),len(doc))
            if any(s.endswith(('2','3')) for s in row['slots']): row['slots']=sorted(set(row['slots']+['wi.req.fwpm2','wi.req.fwpm3']))
        if not rows: raise ValueError('IW-Markierungen gefunden, aber keine eindeutigen Teilmodulbeschreibungen. Bitte Vorschlag manuell ergänzen.')
    return docmeta,list(rows.values())
