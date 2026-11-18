"""Reviewed code-owned teaching catalog with immutable PDF references.

Uploads never derive courses, component rules, choices or recognition.
"""
from functools import lru_cache
from pathlib import Path
import hashlib
import json
import copy
import os
import re

BUNDLED = Path(__file__).resolve().parents[1] / 'catalogs' / 'handbooks'
FREQUENCIES = {'both': 'Winter- und Sommersemester', 'summer': 'Sommersemester',
               'winter': 'Wintersemester', 'irregular': 'Unregelmäßiges Angebot', 'unknown': 'Turnus nicht angegeben'}


def stored_path(digest):
    if not re.fullmatch('[a-f0-9]{64}',digest): raise ValueError('Ungültige Dokumentkennung.')
    folder=Path(os.environ.get('WI_CATALOG_PATH','/data/wi_catalog.json')).parent/'handbooks'
    candidate=folder/(digest+'.pdf')
    if candidate.exists(): return candidate
    for path in BUNDLED.glob('*.pdf'):
        if hashlib.sha256(path.read_bytes()).hexdigest()==digest: return path
    raise ValueError('Modulhandbuch nicht gefunden.')


def cover_metadata(cover):
    edition='wi_bsc_2026' if '31.03.2026' in cover else 'wi_bsc_2012' if '2012' in cover else 'wi_bsc_2023' if '2023' in cover else None
    winters=list(re.finditer(r'Wintersemester\s+(20\d\d)\s*/\s*(\d{2,4})',cover,re.I))
    winter=winters[-1] if winters else None
    summer=re.search(r'Sommersemester\s+(20\d\d)',cover,re.I)
    term=f'WiSe {winter[1]}/{winter[2][-2:]}' if winter else f'SoSe {summer[1]}' if summer else None
    created=re.search(r'erstellt\s+am\s+(\d{2}\.\s*\d{2}\.\s*\d{4})',cover,re.I)
    kind='fwpm' if re.search(r'Fachbezogene\s+Wahlpflichtmodule',cover,re.I) else 'core'
    return {'edition_id':edition if kind=='core' else None,'term':term,'created_on':created[1].replace(' ','') if created else None,'kind':kind,'preliminary':'vorläufig' in cover.casefold()}


@lru_cache(maxsize=1)
def teaching_registry():
    """Reviewed data changed with code, never derived from an administrator upload."""
    return json.loads((BUNDLED.parent/'wi_teaching_catalog.json').read_text())


@lru_cache(maxsize=1)
def schedule_rules():
    return json.loads((BUNDLED.parent/'wi_schedule_rules.json').read_text())


def reference_document(data, kind):
    import pymupdf
    with pymupdf.open(stream=data,filetype='pdf') as document:
        if document.is_encrypted or not len(document) or len(document)>1500:
            raise ValueError('PDF geschützt oder zu umfangreich.')
        metadata=cover_metadata(document[0].get_text())
        if metadata['kind']!=kind: raise ValueError('Die PDF gehört nicht zum ausgewählten Handbuch-Typ.')
        if kind=='core' and not metadata['edition_id']:
            raise ValueError('SPO nicht erkannt. Neue Studienprogramme werden im Code ergänzt.')
        digest=hashlib.sha256(data).hexdigest()
        return {**metadata,'digest':digest,'url':f'/api/programs/wi/handbooks/{digest}.pdf',
                'page_count':len(document),'course_count':0,'reference_only':True,'courses':{}}


@lru_cache(maxsize=64)
def read_document(digest):
    reviewed=teaching_registry()['documents'].get(digest)
    if reviewed: return reviewed
    data=stored_path(digest).read_bytes()
    import pymupdf
    with pymupdf.open(stream=data,filetype='pdf') as document:
        kind=cover_metadata(document[0].get_text())['kind']
    return reference_document(data,kind)


def document_summary(doc):
    return {k:v for k,v in doc.items() if k!='courses'}


def bundled_documents():
    return [document_summary(d) for d in teaching_registry()['documents'].values()]


def semester_catalog(selection,term):
    """Filter the reviewed code catalog; uploaded PDFs are references only."""
    selection=selection or {}; result={}; pending=[]; warnings=[]
    season='summer' if term.startswith('SoSe') else 'winter'
    reviewed=list(teaching_registry()['documents'].values())
    core=[max((d for d in reviewed if d['kind']=='core'),key=lambda d:d['edition_id'])]
    fwpm=[d for d in reviewed if d['kind']=='fwpm' and d['term']==term]
    current=copy.deepcopy(core[0])
    rules=schedule_rules()
    # A current course still taught for earlier cohorts is not replaced by a new SPO course.
    for key in rules['legacy_courses']:
        if key not in current['courses']:
            historical=[d for d in reviewed if d['kind']=='core' and key in d['courses']]
            if historical:
                doc=max(historical,key=lambda d:d['edition_id'])
                current['courses'][key]={**copy.deepcopy(doc['courses'][key]),'source_url':doc['url'],'source_edition':doc['edition_id']}
    for key,frequency in rules['season_overrides'].items():
        if key in current['courses']: current['courses'][key]['frequency']=frequency
    proposal=selection.get('fwpm_courses')
    fwpm_pending=[]
    if proposal is not None:
        approved={}
        for row in proposal:
            if not row['offered']: continue
            if not row['confirmed']:
                fwpm_pending.append(row); continue
            approved[row['id']]={**row,'kind':'elective','frequency':'both','aliases':[row['short_title']],
                'requirement_links':{},'iw_mark':'Admin bestätigt','source_url':row.get('source_url',''),
                'module_page':None,'description':row.get('description','')}
        fwpm=[{'courses':approved,'kind':'fwpm','term':term,'edition_id':None,'url':''}]
    elif not fwpm:
        warnings.append(f'Für {term} bitte das FWPM-Angebot vorbereiten und bestätigen.')
    if fwpm_pending:
        warnings.append(f'{len(fwpm_pending)} FWPM-Vorschläge noch nicht bestätigt; sie werden Studierenden nicht angeboten.')
    for digest in selection.get('core_documents',[])+([selection['fwpm_document']] if selection.get('fwpm_document') else []):
        if read_document(digest).get('reference_only'):
            warnings.append('Aktualisiertes PDF dient als Referenz. Katalog, Turnus, ECTS, Zuordnungen und geprüfte Seitenverweise bleiben unverändert.')
            break
    # Historical books identify credit requirements, never expand the current teaching catalog.
    from app.services.course_mappings import course_mapping_registry
    verified_links={}
    for binding in course_mapping_registry()['bindings']:
        for member in binding['members']:
            if member.get('course_id') and member.get('role') not in ('external_elective_slot','shared_description','requirement'):
                verified_links.setdefault(member['course_id'],{}).setdefault(binding['edition_id'],set()).add(binding['requirement_id'])
    for doc in [current,*fwpm]:
        for key,course in doc['courses'].items():
            value={**course,'document_url':course.get('source_url',doc['url']),'document_term':doc['term'],'edition_id':course.get('source_edition',doc['edition_id']),'frequency_label':FREQUENCIES[course['frequency']]}
            if re.sub(r'^(?:I_IW_IT_|IW_)\s*','',value['short_title'])==course['title']:
                value['short_title']=''
            if course['frequency']=='unknown' or course['ects'] is None:
                pending.append(value); continue
            if course['frequency'] not in ('both',season) and not (doc['kind']=='fwpm' and course['frequency']=='irregular'): continue
            if key not in result:
                result[key]={**value,'references':{},'requirement_links':{}}
            links={edition:set(ids) for edition,ids in course['requirement_links'].items()}
            for edition,ids in verified_links.get(key,{}).items(): links.setdefault(edition,set()).update(ids)
            for edition, ids in links.items():
                result[key]['requirement_links'][edition]=sorted(set(result[key]['requirement_links'].get(edition,[])+list(ids)))
            if doc['edition_id']:
                result[key]['references'][value['edition_id']]={'url':value['document_url'],'pages':course['pages']}
    unresolved={}
    for course in pending:
        if course['id'] not in result: unresolved.setdefault(course['id'],course)
    from app.services.program_editions import edition_registry
    editions=edition_registry()['editions']
    for course in [*result.values(),*unresolved.values()]:
        stages=set()
        for edition in editions:
            ids=course.get('requirement_links',{}).get(edition['id'],[])
            stages.update(r['stage_id'] for r in edition['requirements'] if r['id'] in ids)
        stages.update('abschnitt_2' if slot.endswith('1') else 'abschnitt_3' for slot in course.get('slots',[]))
        course['stages']=sorted(stages)
    from app.services.module_catalog import module_groups
    return {'module_groups':module_groups(result),'fwpm_pending':fwpm_pending,'courses':result,'pending':list(unresolved.values()),'warnings':list(dict.fromkeys(warnings)),
            'catalog_version':teaching_registry()['reviewed_on'],'catalog_mode':'reviewed_code',
            'counts':{'core':sum(c['kind']=='course' for c in result.values()),'fwpm':sum(c['kind']=='elective' for c in result.values()),'total':len(result),'pending':len(unresolved)}}
