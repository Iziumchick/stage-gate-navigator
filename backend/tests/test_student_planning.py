import unittest
from app.services.dashboard_service import build_dashboard
from app.services.student_examples import SCENARIOS, SCENARIO_START_TERMS, student_example

class StudentPlanningTests(unittest.TestCase):
    def modules(self,d):
        return {m['id']:m for s in d['stages'] for m in s['modules']}

    def test_examples_have_distinct_progress_and_do_not_invent_admissions(self):
        for start in ('SoSe 2021','WiSe 2023/24','WiSe 2026/27'):
            partial=student_example('open',start,'WiSe 2026/27')
            practice=student_example('practice',start,'WiSe 2026/27')
            thesis=student_example('thesis',start,'WiSe 2026/27')
            self.assertLess(partial['official_credits'],90)
            self.assertGreaterEqual(practice['official_credits'],90)
            self.assertEqual(thesis['official_credits'],195)
            self.assertEqual(sum(m['open_exam_count'] for m in self.modules(partial).values()),0)
            self.assertEqual(self.modules(partial)['wi.req.praktikum']['planning']['status'],'blocked')
            self.assertEqual(self.modules(practice)['wi.req.praktikum']['planning']['status'],'available')
            self.assertEqual(self.modules(practice)['wi.req.praxisseminar']['planning']['status'],'available')
            self.assertEqual(self.modules(practice)['wi.req.bachelorarbeit']['planning']['status'],'blocked')
            for key in ('wi.req.bachelorarbeit','wi.req.bachelorseminar'):
                m=self.modules(thesis)[key]
                self.assertEqual(m['planning']['status'],'available')
                self.assertNotEqual(m['admission']['status'],'available')
                self.assertNotEqual(m['status'],'passed')
            self.assertEqual(sum(m['required_ects'] for m in self.modules(thesis).values()),210)
            self.assertEqual(sum(m['status']!='passed' for m in self.modules(thesis).values()),2)

    def test_section_gates_are_independent_of_season_and_of_practice(self):
        for start in ('SoSe 2021','WiSe 2023/24','WiSe 2026/27'):
            first=student_example('first',start,'WiSe 2026/27')
            second=student_example('open',start,'WiSe 2026/27')
            third=student_example('third',start,'WiSe 2026/27')
            stages=lambda d:{s['id']:s for s in d['stages']}
            self.assertEqual(stages(first)['abschnitt_2']['access']['status'],'blocked')
            self.assertEqual(stages(second)['abschnitt_2']['access']['status'],'available')
            for m in stages(second)['abschnitt_2']['modules']:
                self.assertEqual(m['admission']['status'],'available')
            self.assertTrue(any(m['semester_offered'] is False for m in stages(second)['abschnitt_2']['modules']))
            self.assertEqual(stages(third)['abschnitt_3']['access']['status'],'available')
            rows=self.modules(third)
            self.assertEqual(rows['wi.req.praktikum']['status'],'unknown')
            self.assertEqual(rows['wi.req.bachelorarbeit']['planning']['status'],'blocked')

    def test_retake_scenarios_carry_publication_dates_in_the_same_field_as_imports(self):
        for key in ('repeat-first','repeat-later','repeat-due','repeat-no-course','repeat-unknown','repeat-review'):
            d=student_example(key,'WiSe 2023/24','WiSe 2026/27')
            failed=[m for m in self.modules(d).values() if m['open_exam_count']]
            self.assertEqual(len(failed),1)
            self.assertEqual(failed[0]['exam_history'][-1]['released_on'] is not None,key!='repeat-unknown')
            self.assertNotIn('example_retake',failed[0])
            if key=='repeat-no-course':self.assertFalse(failed[0]['semester_offered'])
            elif key not in ('repeat-unknown','repeat-review'):self.assertTrue(failed[0]['semester_offered'])

    def test_explicit_component_does_not_close_the_entire_practical_group(self):
        g={'requirement_title':'Praktisches Studiensemester','source_code':'23000','requirement_meta':{'ects':0,'grade_val':None,'status_raw':'PV'},'passed':False,'subs':[],'attempts':[{'code':'1234567','attempt':1,'title':'Praktikum','status':'BE','grade':None,'ects':24}]}
        d=build_dashboard([g],program_key='wi',grade=None,credits=24,start_term='WiSe 2023/24')
        rows=self.modules(d)
        self.assertEqual(rows['wi.req.praktikum']['status'],'unknown')
        self.assertTrue(rows['wi.req.praktikum']['completion_pending'])
        self.assertEqual(rows['wi.req.praktikum']['credited_ects'],0)
        self.assertEqual(rows['wi.req.praktikum']['planning']['status'],'completed')
        self.assertEqual(rows['wi.req.praxisseminar']['status'],'unknown')
        self.assertFalse(rows['wi.req.praktikum']['details']['composite_group']['completed'])
        self.assertEqual(d['official_credits'],24)

    def test_unallocated_official_credits_do_not_unlock_milestones(self):
        d=build_dashboard([],program_key='wi',grade=2.0,credits=195,start_term='SoSe 2021')
        for m in self.modules(d).values():
            if m.get('planning'):
                self.assertEqual(m['planning']['status'],'blocked')

    def test_seminar_attendance_can_be_planned_without_a_passed_thesis(self):
        d=student_example('thesis','WiSe 2023/24','WiSe 2026/27')
        rows=self.modules(d)
        self.assertEqual(rows['wi.req.bachelorarbeit']['status'],'unknown')
        self.assertEqual(rows['wi.req.bachelorseminar']['planning']['status'],'available')
        self.assertIn('schriftliche Arbeit bestanden', ' '.join(rows['wi.req.bachelorseminar']['planning']['steps']))

    def test_pending_practice_does_not_unlock_third_stage_or_thesis(self):
        for start in ('SoSe 2021','WiSe 2023/24','WiSe 2026/27'):
            d=student_example('practice-seminar',start,'WiSe 2026/27')
            rows=self.modules(d)
            self.assertLess(d['progress']['confirmed_ects'],100)
            self.assertEqual(rows['wi.req.praktikum']['result_status'],'passed')
            self.assertEqual(rows['wi.req.praktikum']['credited_ects'],0)
            self.assertEqual(rows['wi.req.bachelorarbeit']['planning']['status'],'blocked')
            stage=next(s for s in d['stages'] if s['id']=='abschnitt_3')
            self.assertEqual(stage['access']['status'],'blocked')
            self.assertIn('ECTS',stage['access']['reason'])
            milestone=next(m for m in d['progress']['milestones'] if m['id']=='practice')
            self.assertTrue(milestone['available']);self.assertFalse(milestone['completed'])

    def test_completed_blocks_release_all_credits_once(self):
        d=student_example('thesis','WiSe 2023/24','WiSe 2026/27')
        rows=self.modules(d)
        self.assertEqual(d['progress']['confirmed_ects'],195)
        self.assertEqual(rows['wi.req.praktikum']['credited_ects'],24)
        self.assertEqual(rows['wi.req.praxisseminar']['credited_ects'],2)
        self.assertTrue(next(m for m in d['progress']['milestones'] if m['id']=='practice')['completed'])
        pending=student_example('thesis-seminar','WiSe 2023/24','WiSe 2026/27')
        self.assertEqual(pending['official_credits'],195)
        self.assertEqual(pending['progress']['confirmed_ects'],195)
        self.assertFalse(next(m for m in pending['progress']['milestones'] if m['id']=='thesis')['completed'])

    def test_locked_stages_and_modules_explain_exact_missing_requirements(self):
        d=student_example('first','WiSe 2023/24','WiSe 2026/27')
        stages={s['id']:s for s in d['stages']}
        self.assertIn('30 ECTS',stages['abschnitt_2']['access']['reason'])
        self.assertIn('Es fehlen noch',stages['abschnitt_2']['access']['reason'])
        reason=self.modules(d)['wi.req.bachelorarbeit']['planning']['reason']
        self.assertIn('Abschnitt 1 muss vollständig abgeschlossen sein.',reason)
        self.assertNotIn('Offen in Abschnitt 1:',reason)
        self.assertNotIn('PG1',reason)
        for m in stages['abschnitt_2']['modules']:
            self.assertEqual(m['admission']['reason'],stages['abschnitt_2']['access']['reason'])

    def test_forecast_thresholds_are_exported_from_the_selected_spo(self):
        for start,minimum in [('SoSe 2021',110),('WiSe 2023/24',100),('WiSe 2026/27',100)]:
            d=student_example('open',start,'WiSe 2026/27')
            gates={g['id']:g for g in d['progress']['gates']}
            self.assertEqual(gates['abschnitt_2']['minimum_ects'],30)
            self.assertEqual(gates['practice']['minimum_ects'],90)
            self.assertEqual(gates['abschnitt_3']['minimum_ects'],minimum)
            self.assertTrue(gates['abschnitt_3']['all_first'])


    def test_default_examples_use_their_own_enrollment_and_spo(self):
        self.assertEqual(set(SCENARIOS),set(SCENARIO_START_TERMS))
        for scenario,start,edition in [
            ('first','WiSe 2026/27','wi_bsc_2026'),
            ('open','WiSe 2025/26','wi_bsc_2023'),
            ('practice','WiSe 2024/25','wi_bsc_2023'),
            ('third','SoSe 2024','wi_bsc_2023'),
            ('thesis','SoSe 2021','wi_bsc_2012'),
            ('thesis-seminar','SoSe 2021','wi_bsc_2012'),
        ]:
            with self.subTest(scenario=scenario):
                data=student_example(scenario,term='WiSe 2026/27')
                self.assertEqual(data['example_start_term'],start)
                self.assertEqual(data['curriculum_edition'],edition)
                self.assertIsNone(data['import_id'])
                self.assertEqual(sum(m['required_ects'] for s in data['stages'] for m in s['modules']),210)
        self.assertEqual(student_example('thesis',term='WiSe 2026/27')['official_credits'],195)

    def test_explicit_example_enrollment_remains_available_for_spo_regression_checks(self):
        data=student_example('first','SoSe 2021','WiSe 2026/27')
        self.assertEqual(data['example_start_term'],'SoSe 2021')
        self.assertEqual(data['curriculum_edition'],'wi_bsc_2012')
