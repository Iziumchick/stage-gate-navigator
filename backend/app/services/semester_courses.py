"""Code-owned actual courses shared by curriculum slots and semester offerings."""
import copy
from app.services.course_mappings import course_mapping_registry, mappings_for_edition
from app.services.elective_catalog import fwpm_courses


def actual_courses():
    registry = course_mapping_registry()
    result = {}
    for binding in registry['bindings']:
        for member in binding['members']:
            key = member.get('course_id')
            if not key or member['role'] in ('external_elective_slot', 'shared_description', 'requirement'):
                continue
            if key == 'wi.course.english_legacy':
                continue
            course = result.setdefault(key, {'title': next(c['title'] for c in registry['courses'] if c['id'] == key),
                'short_title': member.get('short_code_as_printed') or binding['requirement_title'],
                'ects': member.get('ects_as_documented'), 'kind': 'course', 'groups': [], 'aliases': [], 'requirements': [], 'editions': []})
            if binding['edition_id'] not in course['editions']:
                course['editions'].append(binding['edition_id'])
            # Number-only codes and template labels cannot identify timetable courses.
            code = member.get('short_code_as_printed')
            if code and not code.isdigit() and code != 'Vorlage' and code not in course['aliases']:
                course['aliases'].append(code)
            if binding['requirement_id'] not in course['requirements']:
                course['requirements'].append(binding['requirement_id'])
            req = binding['requirement_id'].split('.')[-1]
            group = 'abschnitt_3' if req.startswith('vertiefung') else 'abschnitt_1' if req in ('hardware','enterprise_systems','gwi','bwl1','bwl2','pg1','pg2','ma1','ma2','angewandte_gwi','nachhaltigkeit') else 'abschnitt_2'
            if group not in course['groups']: course['groups'].append(group)
    aliases = {'hardware':['HW'], 'gwi':['WI'], 'bwl1':['BW1'], 'pg1':['PG1'], 'pg2':['PG2'],
               'angewandte_gwi':['AGWI'], 'nachhaltigkeit':['NHI'],
               'ma1':['MA1'], 'ma2':['MA2'], 'it_architektur':['IA','ITA'], 'datenbanken':['DAB','DB'],
               'gpad':['GA','GPAD'], 'betriebssysteme':['OS'], 'software_engineering':['SE'],
               'seminar_wi':['SWI','SIW'], 'bwl2_grundlagen':['BW2G'], 'bwl2_fallstudie':['BW2F']}
    for key, codes in aliases.items():
        if 'wi.course.'+key in result:
            result['wi.course.'+key]['aliases'] = sorted(set(result['wi.course.'+key]['aliases'] + codes))
    return result


def elective_options(requirement_id, term):
    registry = course_mapping_registry()
    pool = next((p for p in registry['elective_pools'] if p['requirement_id']==requirement_id and p['term']==term), None)
    known = {c['id']: c for c in fwpm_courses()}
    from app.services.handbook_catalog import teaching_registry
    reviewed=[c for d in teaching_registry()['documents'].values() if d['kind']=='fwpm' and d['term']==term for c in d['courses'].values() if requirement_id in c['slots']]
    if reviewed:
        return [{'id':c['id'],'title':c['title'],'short_title':c['short_title'],'catalog_status':'semester_catalog','source_term':term,'section_verified':True} for c in reviewed]
    if pool:
        return [{'id':m['course_id'], 'title':m['title_as_printed'], 'short_title':m['short_code_as_printed'],
                 'catalog_status':'semester_catalog', 'source_term':term, 'section_verified':True} for m in pool['members']]
    selected=[]
    for c in known.values():
        if c['slots'] and requirement_id not in c['slots']: continue
        exact=term in c['terms']
        historical=term.startswith('SoSe') and any(t.startswith('SoSe') and t < term for t in c['terms'])
        if not exact and not historical: continue
        selected.append({'id':c['id'],'title':c['title'],'short_title':c['short_title'],
                         'catalog_status':'semester_catalog' if exact else 'previous_summer',
                         'source_term':term if exact else max(t for t in c['terms'] if t.startswith('SoSe') and t<term),
                         'section_verified':bool(c['slots'])})
    return selected


def apply_course_options(stages, edition_id, term, semesters):
    """Attach presentation only; selections never count as student achievements."""
    registry=course_mapping_registry()
    bindings=mappings_for_edition(edition_id, registry['term'])
    by_req={b['requirement_id']:b for b in bindings}
    semester=semesters.get(term,{})
    semester=semester if semester.get('status')=='published' else {}
    from app.services.handbook_catalog import semester_catalog
    prepared=semester_catalog(semester.get('preparation') or {},term or registry['term'])['courses']
    for stage in stages.values():
        for module in stage['modules']:
            b=by_req.get(module['id'])
            if not b: continue
            module['mapping_status']=b['status']
            module['mapping_notes']=b['notes']
            elective=b['mapping_kind']=='semester_elective_pool'
            eligible={key:c for key,c in prepared.items() if
                (c['kind']=='elective' and module['id'] in c['slots'])} if elective else {
                key:c for key,c in prepared.items() if module['id'] in c['requirement_links'].get(edition_id,[])}
            options=[{'id':key,'title':c['title'],'short_title':c['short_title'],'ects':c['ects'],
                      'catalog_status':'semester_catalog' if elective else 'program_mapping',
                      'source_term':term,'section_verified':True} for key,c in eligible.items()]
            for option in options:
                option['course']=copy.deepcopy(semester.get('modules',{}).get(option['id'],{}))
                # Legacy requirement course records remain readable for single-course bindings.
                if not option['course'] and len(options)==1 and edition_id=='wi_bsc_2023':
                    option['course']=copy.deepcopy(semester.get('modules',{}).get(module['id'],{}) or module.get('course',{}))
                option['details']=copy.deepcopy(module['details'])
                member = next((m for m in b['members'] if m.get('course_id')==option['id']), {})
                if prepared and option['id'] in prepared:
                    member=prepared[option['id']]
                option['details']['offered_in'] = {'both':'Winter- und Sommersemester', 'winter':'Wintersemester', 'summer':'Sommersemester', 'irregular':'Unregelmäßig'}.get(member.get('frequency'))
                course=option['course']
                if course.get('meetings'):
                    from app.services.boss_calendar import calendar_meetings
                    course['meetings']=calendar_meetings(course['meetings'],term)
                handbook=semester.get('fwpm_handbook' if option['id'].startswith('wi.fwpm.') else 'handbook',{})
                # The legacy core handbook belongs to 2023 only. Other editions need their own uploaded file.
                if not option['id'].startswith('wi.fwpm.'):
                    handbook=semester.get('core_handbooks',{}).get(edition_id,handbook if edition_id=='wi_bsc_2023' else {})
                pages=course.get('handbook_references',{}).get(edition_id)
                if edition_id not in course.get('handbook_references',{}):
                    pages=course.get('handbook_pages') if course.get('handbook_edition','wi_bsc_2023')==edition_id or option['id'].startswith('wi.fwpm.') else None
                option['details']['handbook']={**handbook,'pages':pages}
                option['details']['description']=(course.get('handbook_excerpt') or None) if option['id'].startswith('wi.fwpm.') or course.get('handbook_edition','wi_bsc_2023')==edition_id else None
                if prepared and option['id'] in prepared:
                    current=prepared[option['id']]
                    option['details']['handbook']={'url':current['document_url'],'label':'Aktuelles Modulhandbuch','pages':current['pages']}
                    option['details']['description']=current.get('description')
                    option['details']['description_pdf']=current.get('description_pdf')
                    reference=semester.get('fwpm_handbook',{}) if option['id'].startswith('wi.fwpm.') else next((v for _,v in sorted(semester.get('core_handbooks',{}).items(),reverse=True)),{})
                    if reference.get('url') and reference['url']!=current['document_url']:
                        option['details']['reference_handbook']={**reference,'pages':None}
                if option['catalog_status']=='previous_summer':
                    option['notice']='Im Sommersemester zuvor angeboten; aktuelles Angebot und Platz selbst bestätigen. Vorjahreszeiten werden nicht übernommen.'
                if not option['section_verified']:
                    option['notice']=(option.get('notice','')+' Abschnittszuordnung in der Quelle noch nicht bestätigt.').strip()
            module['semester_offered']=bool(options)
            module['course_options']=options
            module['requires_course_selection']=b['mapping_kind'] in ('semester_elective_pool','semester_options')
            if len(options)==1 and not module['requires_course_selection']:
                module['course']=options[0]['course']
                # Preserve normative components/weight in the overview, attach the actual course title.
                module['actual_course_title']=options[0]['title']
                if options[0]['course'] or options[0]['details']['handbook'].get('url'):
                    module['details']=options[0]['details']


def expected_schedule_ids(term):
    """A teaching frequency only controls the missing report, never admission."""
    frequencies={}
    for binding in course_mapping_registry()['bindings']:
        for member in binding['members']:
            if member.get('course_id') and member['frequency'] != 'unknown':
                frequencies.setdefault(member['course_id'],set()).add(member['frequency'])
    season='summer' if term.startswith('SoSe') else 'winter'
    core={key for key in actual_courses() if 'both' in frequencies.get(key,set()) or season in frequencies.get(key,set())}
    electives={c['id'] for slot in ('fwpm1','fwpm2','fwpm3') for c in elective_options('wi.req.'+slot,term) if c['catalog_status']=='semester_catalog'}
    return core | electives
