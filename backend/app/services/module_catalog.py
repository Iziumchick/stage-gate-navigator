"""Presentation hierarchy: immutable SPO modules contain semester Teilmodule."""
def module_groups(courses):
    from app.services.program_editions import edition_registry
    from app.services.course_mappings import course_mapping_registry
    requirements={r['id']:r for e in edition_registry()['editions'] for r in e['requirements']}
    kinds={b['requirement_id']:b['mapping_kind'] for b in course_mapping_registry()['bindings']}
    groups={}
    for key,c in courses.items():
        links=set(c.get('slots',[])) if c['kind']=='elective' else {r for rows in c.get('requirement_links',{}).values() for r in rows}
        for requirement in sorted(links):
            r=requirements.get(requirement)
            if not r: continue
            group_id='wi.req.fwpm23' if requirement in ('wi.req.fwpm2','wi.req.fwpm3') else requirement
            kind=kinds.get(requirement)
            rule='all' if r.get('components') or kind=='required_components' else 'one' if kind=='semester_options' else 'catalog' if c['kind']=='elective' else 'single'
            g=groups.setdefault(group_id,{'id':group_id,'title':'Fachbezogene Wahlpflichtmodule 2 / 3' if group_id.endswith('fwpm23') else r['title'],
                'short_title':'FWPM 2 / 3' if group_id.endswith('fwpm23') else r['short_title'], 'stage_id':r['stage_id'],
                'completion_rule':rule,'teilmodule_ids':[]})
            if key not in g['teilmodule_ids']: g['teilmodule_ids'].append(key)
    return sorted(groups.values(),key=lambda g:(g['stage_id'],g['title']))
