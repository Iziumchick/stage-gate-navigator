"""Conservative presentation of transcript evidence against the draft WI catalog.

This does not activate the academic evaluator or infer enrollment/admission.
Only unambiguous whole-module matches with explicit passing evidence are marked
passed. Slots and unrecognized source rows remain available for manual review.
"""
import copy
import re
import unicodedata

from app.services.catalog_service import apply_catalog, load_wi_catalog, published_semesters

from app.academic.programs.wi_program import WI_BSC_2023_PROGRAM
from app.academic.rules import ModulePassedRule
from app.services.program_editions import edition_for_start
from app.services.semester_courses import apply_course_options
from app.services.course_mappings import mappings_for_edition
from app.services.student_planning import apply_milestone_planning
from app.services.student_progress import hold_incomplete_blocks, apply_progress_gates


def normalize(title: str) -> str:
    title = unicodedata.normalize('NFKC', title).casefold()
    title = title.replace('programmierung', 'programmieren')
    return re.sub(r'[^\w]', '', title)


def build_dashboard(groups: list[dict], *, program_key: str | None, grade, credits, term: str | None = None, catalog: dict | None = None, start_term: str | None = None) -> dict:
    supported = program_key == 'wi'
    edition = edition_for_start(start_term) if supported and start_term else None
    requirements = edition['requirements'] if edition else [
        {'id': r.id, 'title': r.title, 'short_title': r.short_title, 'ects': float(r.required_ects), 'stage_id': r.stage_id,
         'completion_kind': 'single' if isinstance(r.rule, ModulePassedRule) else 'elective'}
        for r in WI_BSC_2023_PROGRAM.requirements if r.stage_id != 'gate'
    ]
    stages = {key: {'id': key, 'title': title, 'modules': []} for key, title in [
        ('abschnitt_1', 'Abschnitt 1'), ('abschnitt_2', 'Abschnitt 2'),
        ('praxissemester', 'Praxissemester'), ('abschnitt_3', 'Abschnitt 3 / Abschluss'),
    ]}
    matched_indexes: set[int] = set()
    bindings = {b['requirement_id']: b for b in mappings_for_edition(edition['id'], 'WiSe 2026/27')} if edition else {}
    if supported:
        for requirement in requirements:
            binding = bindings.get(requirement['id'], {})
            aliases = {normalize(requirement['title'])}
            if binding.get('mapping_kind') == 'direct' and binding.get('status') != 'source_disagreement':
                aliases.add(normalize(binding.get('module_title_as_printed', '')))
                for member in binding.get('members', []):
                    aliases.add(normalize(member['title_as_printed']))
                    aliases.add(normalize(re.sub(r'^IW_\s*', '', member['title_as_printed'])))
            candidates = [(i, g) for i, g in enumerate(groups)
                          if i not in matched_indexes and normalize(g.get('requirement_title', '')) in aliases]
            # Multiple source rows and elective allocations require a verified adapter.
            source = candidates[0][1] if len(candidates) == 1 else None
            if source:
                matched_indexes.add(candidates[0][0])
            meta = (source or {}).get('requirement_meta') or {}
            raw_grade = meta.get('grade_val')
            try:
                grade_value = float(str(raw_grade).replace(',', '.')) if raw_grade is not None else None
            except ValueError:
                grade_value = None
            actual = meta.get('ects')
            status = 'unknown'
            if source and requirement['completion_kind'] == 'single':
                # A failing grade always overrides the parser's passed flag.
                if grade_value is not None and grade_value > 4:
                    status = 'failed'
                elif (grade_value is not None and 1 <= grade_value <= 4) or (grade_value is None and source.get('passed')):
                    if actual is not None:
                        status = 'passed' if actual >= requirement['ects'] else 'unknown'
            elif source:
                status = 'unknown' if edition else 'review'
                # The official parent row can prove completion of a choice or
                # composite module. Personal choices/child sums never do so.
                if grade_value is not None and grade_value>4:
                    status='failed'
                elif edition and actual is not None and actual >= requirement['ects']:
                    if grade_value is not None and 1 <= grade_value <= 4:
                        status = 'passed'
                    elif grade_value is not None and grade_value > 4:
                        status = 'failed'
                    elif grade_value is None and source.get('passed') and requirement.get('grade_weight') == 0:
                        status = 'passed'
            if source and source.get('source_code') and not source.get('passed'):
                if status == 'passed':
                    status = 'unknown'
                if source.get('open_attempts') or meta.get('status_raw') == 'NB':
                    status = 'failed'
                    # A failed child does not establish an overall module grade.
                    raw_grade = meta.get('grade_val') if meta.get('status_raw') == 'NB' else None
            stage = 'abschnitt_3' if requirement['stage_id'] == 'abschluss' else requirement['stage_id']
            stages[stage]['modules'].append({
                'id': requirement['id'], 'title': requirement['title'],
                'short_title': requirement['short_title'], 'required_ects': float(requirement['ects']),
                'actual_ects': actual, 'grade': raw_grade if status in ('passed','failed') else None, 'status': status,
                'source': source,
                'exam_history':(source or {}).get('attempts',[]),
                'open_exam_count':len((source or {}).get('open_attempts',[])),
            })
    composite_evidence={}
    if edition:
        rows={m['id']:m for stage in stages.values() for m in stage['modules']}
        definitions={r['id']:r for r in requirements}
        for group in edition.get('composite_groups',[]):
            candidates=[(i,g) for i,g in enumerate(groups) if normalize(g.get('requirement_title',''))==normalize(group['title'])]
            if len(candidates)!=1: continue
            index,evidence=candidates[0]; meta=evidence.get('requirement_meta') or {}
            try: value=float(str(meta.get('grade_val')).replace(',','.')) if meta.get('grade_val') is not None else None
            except ValueError: value=None
            enough=meta.get('ects') is not None and meta['ects']>=group['ects']
            ungraded=all(definitions[key].get('grade_weight')==0 for key in group['children'])
            completed=enough and ((value is not None and 1<=value<=4) or (value is None and ungraded and evidence.get('passed')))
            if evidence.get('source_code') and not evidence.get('passed'): completed = False
            # Named BE child results may prove only their own SPO child position.
            # They never manufacture completion or a grade for the whole module.
            latest={}
            for row in evidence.get('attempts',[]):
                if row['code'] not in latest or row['attempt']>latest[row['code']]['attempt']:
                    latest[row['code']]=row
            part_aliases={
                'wi.req.praktikum': {'praktikum','praktikumimbetrieb','industrialplacement'},
                'wi.req.praxisseminar': {'praxisseminar','praktikumsseminar'},
                'wi.req.bachelorarbeit': {'bachelorarbeit','schriftlicheausarbeitung','schriftlicheausarbeitungthesis'},
                'wi.req.bachelorseminar': {'bachelorseminar'},
            }
            for key in group['children']:
                child=rows[key]
                part_matches=[r for r in latest.values() if normalize(r['title']) in part_aliases.get(key,set())]
                if child['status']!='passed' and len(part_matches)==1:
                    row=part_matches[0]
                    value=row.get('grade')
                    proven=row.get('status')=='BE' and (row.get('ects') or 0)>=child['required_ects'] and (value is not None and 1<=value<=4 or value is None and definitions[key].get('grade_weight')==0)
                    if proven:
                        proof={'requirement_title':child['title'],'requirement_meta':{'ects':row['ects'],'grade_val':str(value) if value is not None else None,'status_raw':'BE'},'passed':True,'subs':[],'parent_title':evidence['requirement_title']}
                        child.update(status='passed',grade=proof['requirement_meta']['grade_val'],actual_ects=row['ects'],source=proof,completion_evidence='official_component_result',exam_history=[r for r in evidence['attempts'] if r['code']==row['code']],open_exam_count=0)
                        matched_indexes.add(index)
            if not completed: continue
            # Contradictory explicit child failures need review rather than an overwrite.
            if any(rows[key]['status']=='failed' and rows[key]['source'] is not evidence for key in group['children']): continue
            matched_indexes.add(index)
            composite_evidence[group['title']]={'grade':meta.get('grade_val'),'source':evidence}
            for key in group['children']:
                child=rows[key]
                if child['source'] is None or child['source'] is evidence:
                    # Completion of the official whole proves the fixed child
                    # positions, but does not disclose their individual grades.
                    child.update(status='passed',grade=None,actual_ects=child['required_ects'],source=evidence,
                                 completion_evidence='official_composite_parent')
    if edition:
        hold_incomplete_blocks(stages)
    if supported:
        metadata = catalog if catalog is not None else load_wi_catalog()
        if edition:
            metadata = copy.deepcopy(metadata) if edition['id'] == 'wi_bsc_2023' else {'modules': {}}
            for r in requirements:
                entry = metadata.setdefault('modules', {}).setdefault(r['id'], {})
                entry.update(grade_weight=str(r['grade_weight']), components=r.get('components', []))
                if r['id'] in ('wi.req.aw1','wi.req.aw2'):
                    entry['aw_components'] = r.get('components') or [{'title':r['title'],'ects':r['ects'],'kind':'elective'}]
                if r.get('notes'): entry['description'] = '\n'.join(r['notes'])
        apply_catalog(stages, metadata, credits, term, include_semester_data=not edition or edition['id'] == 'wi_bsc_2023')
        apply_course_options(stages, edition['id'] if edition else 'wi_bsc_2023', term, published_semesters())
    if edition:
        by_id={m['id']:m for stage in stages.values() for m in stage['modules']}
        for requirement in requirements:
            module=by_id[requirement['id']]
            binding=bindings.get(requirement['id'],{})
            kind=binding.get('mapping_kind')
            completion='all' if requirement.get('components') or kind=='required_components' else 'one' if kind=='semester_options' else 'catalog' if kind=='semester_elective_pool' else 'single'
            if requirement['id'] in ('wi.req.aw1','wi.req.aw2'):
                module['details']['aw_components']=requirement.get('components') or [{'title':requirement['title'],'ects':requirement['ects'],'kind':'elective'}]
            module['completion_rule']=completion
            module['details']['completion_rule']=completion
            module['details']['stage_id']=requirement['stage_id']
            module['details']['recommended_semesters']=requirement.get('recommended_semesters',{})
            parts=copy.deepcopy(module['details'].get('components',[]))
            for part in parts:
                part_name=normalize(re.sub(r'^\d+(?:\.\d+)*\s*','',part['title']))
                candidates=[row for row in (module.get('source') or {}).get('subs',[])
                    if normalize(re.sub(r'^\d+(?:\.\d+)*\s*','',row.get('title','')))==part_name]
                part['status']='unknown'; part['grade']=None
                if len(candidates)==1:
                    row=candidates[0]; raw=row.get('grade_val')
                    try: value=float(str(raw).replace(',','.')) if raw is not None else None
                    except ValueError: value=None
                    part['grade']=raw
                    if value is not None and value>4: part['status']='failed'
                    elif value is not None and 1<=value<=4 and row.get('ects') is not None and row['ects']>=part['ects']: part['status']='passed'
            module['details']['components']=parts
            # Known parts and alternatives remain visible even when no semester
            # has been published. These are program links, not current offerings.
            module['details']['linked_courses']=[{'id':m['course_id'],'title':m['title_as_printed']}
                for m in binding.get('members',[]) if m.get('course_id') and m.get('role') not in ('shared_description','requirement','external_elective_slot')]
        for group in edition.get('composite_groups',[]):
            children=[by_id[key] for key in group['children']]
            summary={'title':group['title'],'ects':group['ects'],'children':[
                {'id':m['id'],'title':m['title'],'ects':m['required_ects'],'status':m['status'],'grade':m['grade']} for m in children],
                'completed':all(m['status']=='passed' for m in children),
                'grade':composite_evidence.get(group['title'],{}).get('grade')}
            for child in children:
                child['details']['composite_group']=summary
    progress={}
    if edition:
        apply_milestone_planning(stages, edition)
        progress=apply_progress_gates(stages, edition)
    return {
        'progress':progress,
        'supported': supported, 'official_grade': grade, 'official_credits': credits,
        'catalog_status': 'source_reviewed' if edition else 'draft',
        'spo_version': edition['label'] if edition else WI_BSC_2023_PROGRAM.spo_version if supported else None,
        'curriculum_edition': edition['id'] if edition else None,
        'curriculum_assignment': 'regular_start_term' if edition else 'legacy_preview',
        'semester_data_configured': True,
        'semester_calendar': published_semesters().get(term, {}).get('calendar', {}) if supported and term else {},
        'stages': list(stages.values()) if supported else [],
        'unmatched_groups': [g for i, g in enumerate(groups) if i not in matched_indexes],
    }
