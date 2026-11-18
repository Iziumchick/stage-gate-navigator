import unittest
from unittest.mock import patch
from app.services.semester_courses import elective_options, actual_courses
from app.services.dashboard_service import build_dashboard


def modules(data): return {m['id']:m for s in data['stages'] for m in s['modules']}
def group(title, ects): return {'requirement_title':title,'requirement_meta':{'ects':ects,'grade_val':'2,0'},'subs':[]}


class SemesterCoursesTests(unittest.TestCase):
    def test_completion_rules_preserve_parts_alternatives_and_composite_credits(self):
        data=build_dashboard([],program_key='wi',grade=None,credits=0,term='WiSe 2026/27',start_term='WiSe 2026/27')
        rows=modules(data)
        for key in ('bwl2','projektmanagement'):
            self.assertEqual(rows['wi.req.'+key]['completion_rule'],'all')
            self.assertEqual(rows['wi.req.'+key]['status'],'unknown')
        choice=rows['wi.req.vertiefung_iw3']
        self.assertEqual(choice['completion_rule'],'one')
        self.assertEqual({c['id'] for c in choice['details']['linked_courses']},{'wi.course.is','wi.course.isc'})
        self.assertEqual(choice['required_ects'],5)
        self.assertEqual(rows['wi.req.fwpm2']['completion_rule'],'catalog')
        self.assertEqual(rows['wi.req.enterprise_systems']['details']['stage_id'],'abschnitt_1')
        for key,total in [('praktikum',26),('bachelorarbeit',15)]:
            composite=rows['wi.req.'+key]['details']['composite_group']
            self.assertEqual(composite['ects'],total)
            self.assertEqual(sum(c['ects'] for c in composite['children']),total)
            self.assertFalse(composite['completed'])
        self.assertEqual(sum(m['required_ects'] for m in rows.values()),210)
        self.assertEqual(data['official_credits'],0)

    def test_part_evidence_does_not_invent_a_parent_grade_or_mutate_program(self):
        import copy
        from app.services.program_editions import edition_registry
        before=copy.deepcopy(edition_registry())
        requirement=next(r for r in before['editions'][-1]['requirements'] if r['id']=='wi.req.bwl2')
        parts=requirement['components']
        evidence={'requirement_title':requirement['title'],'requirement_meta':{'ects':7,'grade_val':None},
                  'subs':[{'title':parts[0]['title'],'ects':parts[0]['ects'],'grade_val':'2,0'},
                          {'title':parts[1]['title'],'ects':0,'grade_val':'5,0'}]}
        result=modules(build_dashboard([evidence],program_key='wi',grade=2.5,credits=5,term='WiSe 2026/27',start_term='WiSe 2026/27'))
        self.assertNotEqual(result['wi.req.bwl2']['status'],'passed')
        self.assertIsNone(result['wi.req.bwl2']['grade'])
        self.assertEqual([p['status'] for p in result['wi.req.bwl2']['details']['components']],['passed','failed'])
        self.assertEqual(edition_registry(),before)

    def test_shared_course_has_one_offering_for_multiple_spo(self):
        semesters={'WiSe 2026/27':{'status':'published','handbook':{'url':'https://example.org/2023.pdf'},'modules':{'wi.course.vs':{'elo':'https://example.org/vs','room':'K014','offered':True}}}}
        with patch('app.services.dashboard_service.published_semesters',return_value=semesters):
            for start in ('WiSe 2021/22','WiSe 2023/24','WiSe 2026/27'):
                data=build_dashboard([],program_key='wi',grade=None,credits=None,term='WiSe 2026/27',start_term=start)
                option=modules(data)['wi.req.vertiefung_in2']['course_options'][0]
                self.assertEqual(option['id'],'wi.course.vs')
                self.assertEqual(option['course']['room'],'K014')
                self.assertTrue(option['details']['handbook']['url'].startswith('/api/programs/wi/handbooks/'))

    def test_fwpm_choices_share_data_without_credit_or_future_timetable(self):
        semesters={'WiSe 2026/27':{'status':'published','modules':{'wi.fwpm.date':{'elo':'https://example.org/date','offered':True,'room':'D201'}}}}
        with patch('app.services.dashboard_service.published_semesters',return_value=semesters):
            data=modules(build_dashboard([],program_key='wi',grade=None,credits=0,term='WiSe 2026/27',start_term='WiSe 2023/24'))
            for slot in ('fwpm2','fwpm3'):
                row=data['wi.req.'+slot]
                self.assertTrue(row['requires_course_selection'])
                self.assertEqual(row['status'],'unknown')
                self.assertEqual(next(c for c in row['course_options'] if c['id']=='wi.fwpm.date')['course']['room'],'D201')
            future=modules(build_dashboard([],program_key='wi',grade=None,credits=0,term='SoSe 2027',start_term='WiSe 2023/24'))
            self.assertTrue(all(not c['course'] for c in future['wi.req.fwpm2']['course_options']))

    def test_wi_seminar_uses_second_stage_threshold_and_shared_winter_offer_for_both_spo(self):
        term='WiSe 2026/27'
        meeting={'weekday':2,'start':'11:45','end':'13:15','room':'K014','group':'IW5','source_code':'SEM','recurrence':'unconfirmed'}
        semesters={term:{'status':'published','modules':{'wi.course.seminar_wi':{'offered':True,'source_term':term,'meetings':[meeting]}}}}
        below=[group('Grundlagen der Wirtschaftsinformatik',8),group('Programmieren 1',8),group('Programmieren 2',8),group('Betriebswirtschaftslehre 1',5)]
        at_threshold=[group('Betriebswirtschaftslehre 1',5),group('Betriebswirtschaftslehre 2',7),group('Programmieren 1',8),group('Mathematik 1',7),group('Anwendungsorientierte Grundlagen der Wirtschaftsinformatik',3)]
        with patch('app.services.dashboard_service.published_semesters',return_value=semesters):
            for start in ('WiSe 2023/24','WiSe 2026/27'):
                blocked=modules(build_dashboard(below,program_key='wi',grade=2,credits=210,term=term,start_term=start))
                self.assertEqual(blocked['wi.req.seminar_wi']['admission']['status'],'unknown')
                ready=modules(build_dashboard(at_threshold,program_key='wi',grade=2,credits=30,term=term,start_term=start))
                seminar=ready['wi.req.seminar_wi']
                self.assertEqual(seminar['admission']['status'],'available')
                self.assertTrue(seminar['semester_offered'])
                self.assertEqual(seminar['status'],'unknown')
                self.assertEqual(seminar['details']['stage_id'],'abschnitt_2')
                self.assertEqual(seminar['course_options'][0]['course']['meetings'],[meeting])
                self.assertFalse(any(c['id']=='wi.course.seminar_wi' for c in ready['wi.req.praxisseminar']['course_options']))
                summer=modules(build_dashboard(at_threshold,program_key='wi',grade=2,credits=30,term='SoSe 2027',start_term=start))
                self.assertTrue(summer['wi.req.seminar_wi']['semester_offered'])
                self.assertFalse(summer['wi.req.seminar_wi']['course_options'][0]['course'])

    def test_real_course_title_closes_only_its_unambiguous_program_position(self):
        data=modules(build_dashboard([group('Verteilte Systeme',5)],program_key='wi',grade=2,credits=5,term='WiSe 2026/27',start_term='WiSe 2023/24'))
        self.assertEqual(data['wi.req.vertiefung_in2']['status'],'passed')
        self.assertEqual(data['wi.req.vertiefung_iw2']['status'],'unknown')
        self.assertEqual(data['wi.req.fwpm2']['status'],'unknown')

    def test_only_iw_and_correct_slot_are_listed_in_winter(self):
        first={c['short_title'] for c in elective_options('wi.req.fwpm1','WiSe 2026/27')}
        self.assertEqual(first,{'KAPS','KDSP','KEES','KISC','KSAP1','KTAI','KBAR'})
        self.assertIn('KBAR',first)
        self.assertNotIn('DIOT',first)
        courses=actual_courses()
        self.assertIn('wi.course.vs',courses)
        self.assertNotIn('wi.req.fwpm2',courses)
        self.assertNotIn('BS',courses['wi.course.betriebssysteme']['aliases'])

    def test_verified_parent_row_unlocks_stage_without_using_global_credits(self):
        groups=[group('Grundlagen der Wirtschaftsinformatik',8),group('Programmieren 1',8),group('Programmieren 2',8),group('Mathematik 1',7)]
        data=modules(build_dashboard(groups,program_key='wi',grade=2,credits=31,term='WiSe 2026/27',start_term='WiSe 2023/24'))
        self.assertEqual(data['wi.req.fwpm1']['admission']['status'],'available')
        unsupported=modules(build_dashboard([],program_key='wi',grade=2,credits=210,term='WiSe 2026/27',start_term='WiSe 2023/24'))
        self.assertEqual(unsupported['wi.req.fwpm1']['admission']['status'],'unknown')
        self.assertEqual(unsupported['wi.req.fwpm2']['admission']['status'],'unknown')
        aw=modules(build_dashboard([group('Allgemeinwissenschaftliches Wahlpflichtmodul 1',2)],program_key='wi',grade=2,credits=2,term='WiSe 2026/27',start_term='WiSe 2023/24'))
        self.assertEqual(aw['wi.req.aw1']['status'],'passed')


if __name__=='__main__': unittest.main()
