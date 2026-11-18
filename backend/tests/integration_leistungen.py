import unittest
from app.services.leistungen_import import parse_leistungen,ExportError
from app.services.dashboard_service import build_dashboard
from leistungen_pdf_fixture import pdf_export

class LeistungenTests(unittest.TestCase):
    def test_columns_move_and_history_does_not_reopen_passed_module(self):
        results=[]
        for shift in (0,25):
            v=parse_leistungen(pdf_export(shift=shift));results.append(v)
            self.assertEqual(v['overall_credits'],7);self.assertEqual(v['overall_grade'],2.7)
            self.assertEqual(v['report']['attempt_count'],2);self.assertEqual(v['report']['open_exam_count'],0)
            self.assertEqual(v['groups'][0]['attempts'][1]['attempt'],2)
            report=build_dashboard(v['groups'],program_key='wi',grade=2.7,credits=7,start_term='WiSe 2023/24')
            m=next(m for st in report['stages'] for m in st['modules'] if m['id']=='wi.req.ma1')
            self.assertEqual(m['status'],'passed');self.assertEqual(len(m['exam_history']),2)
        self.assertEqual(results[0],results[1])
    def test_current_negative_child_is_preserved_without_awarding_credits(self):
        rows=[('Mathematik 1','10007','M7',None,0,'PV',1),('Mathematik 1','4710070','MA1',5,0,'NB',2)]
        v=parse_leistungen(pdf_export(rows,total=0,average=None))
        self.assertEqual(v['report']['open_exam_count'],1)
        self.assertIsNone(v['groups'][0]['requirement_meta']['grade_val'])
        d=build_dashboard(v['groups'],program_key='wi',grade=None,credits=0,start_term='WiSe 2023/24')
        m=next(m for st in d['stages'] for m in st['modules'] if m['id']=='wi.req.ma1')
        self.assertEqual(m['status'],'failed');self.assertEqual(m['open_exam_count'],1)
        self.assertIsNone(m['grade'])
        self.assertEqual(d['official_credits'],0)
    def test_unconfirmed_parent_cannot_pass_from_child_or_numeric_grade(self):
        rows=[('Mathematik 1','10007','M7',2.7,7,'PV',1),('Mathematik 1','4710070','MA1',2.7,7,'BE',1)]
        v=parse_leistungen(pdf_export(rows))
        for start in ('SoSe 2021','WiSe 2023/24','WiSe 2026/27'):
            d=build_dashboard(v['groups'],program_key='wi',grade=2.7,credits=7,start_term=start)
            m=next(m for st in d['stages'] for m in st['modules'] if m['id']=='wi.req.ma1')
            self.assertEqual(m['status'],'unknown')
            self.assertIsNone(m['grade'])
    def test_same_parent_and_attempt_history_apply_to_all_three_cohorts(self):
        v=parse_leistungen(pdf_export())
        for start,edition,count in (('SoSe 2021','wi_bsc_2012',33),('WiSe 2023/24','wi_bsc_2023',35),('WiSe 2026/27','wi_bsc_2026',35)):
            d=build_dashboard(v['groups'],program_key='wi',grade=2.7,credits=7,start_term=start)
            self.assertEqual(d['curriculum_edition'],edition)
            modules=[m for st in d['stages'] for m in st['modules']]
            self.assertEqual(len(modules),count)
            self.assertEqual(sum(m['required_ects'] for m in modules),210)
            self.assertEqual(sum(m['status']=='passed' for m in modules),1)
            self.assertEqual(sum(len(m['exam_history']) for m in modules),2)
    def test_empty_beginner_export_is_valid_without_an_average(self):
        v=parse_leistungen(pdf_export([],total=0,average=None))
        self.assertEqual(v['groups'],[]);self.assertIsNone(v['overall_grade'])
    def test_folded_tree_or_missing_rows_rejected(self):
        for rows in ([],[('Mathematik 1','10007','M7',2.7,7,'BE',1)]):
            with self.assertRaises(ExportError):parse_leistungen(pdf_export(rows))
        with self.assertRaises(ExportError):parse_leistungen(pdf_export(total=8))
    def test_multiple_pages_keep_the_same_result(self):
        def without_pages(groups):
            for g in groups:
                for row in g['attempts']:row.pop('page',None)
            return groups
        self.assertEqual(without_pages(parse_leistungen(pdf_export())['groups']),without_pages(parse_leistungen(pdf_export(page_height=200))['groups']))
    def test_duplicate_attempts_and_contradictory_status_rejected(self):
        rows=[('Mathematik 1','10007','M7',2.7,7,'BE',1),('Mathematik 1','4710070','MA1',2.7,7,'BE',2)]
        with self.assertRaises(ExportError):parse_leistungen(pdf_export(rows+[rows[1]]))
        rows[1]=('Mathematik 1','4710070','MA1',5,7,'BE',2)
        with self.assertRaises(ExportError):parse_leistungen(pdf_export(rows))

if __name__=='__main__':unittest.main()

class ComponentEvidenceTests(unittest.TestCase):
    def test_practice_component_can_be_proven_without_the_whole_26_credits(self):
        rows=[('Praktisches Studiensemester','20023','M23',None,0,'PV',1),('Praktikum','6424444','PRAX',None,24,'BE',1)]
        v=parse_leistungen(pdf_export(rows,total=24,average=None))
        d=build_dashboard(v['groups'],program_key='wi',grade=None,credits=24,start_term='WiSe 2023/24')
        modules={m['id']:m for s in d['stages'] for m in s['modules']}
        self.assertEqual(modules['wi.req.praktikum']['status'],'unknown')
        self.assertTrue(modules['wi.req.praktikum']['completion_pending'])
        self.assertEqual(modules['wi.req.praktikum']['credited_ects'],0)
        self.assertEqual(modules['wi.req.praxisseminar']['status'],'unknown')
        self.assertFalse(modules['wi.req.praktikum']['details']['composite_group']['completed'])
        self.assertEqual(d['official_credits'],24)

    def test_written_thesis_result_does_not_invent_the_seminar_result(self):
        rows=[('Bachelorarbeit','30033','M33',None,0,'PV',1),('Schriftliche Ausarbeitung','4739000','BA',2.7,12,'BE',1)]
        v=parse_leistungen(pdf_export(rows,total=12,average=2.7))
        d=build_dashboard(v['groups'],program_key='wi',grade=2.7,credits=12,start_term='WiSe 2023/24')
        modules={m['id']:m for s in d['stages'] for m in s['modules']}
        self.assertEqual(modules['wi.req.bachelorarbeit']['status'],'unknown')
        self.assertTrue(modules['wi.req.bachelorarbeit']['completion_pending'])
        self.assertEqual(modules['wi.req.bachelorarbeit']['grade'],'2.7')
        self.assertEqual(modules['wi.req.bachelorseminar']['status'],'unknown')
        self.assertFalse(modules['wi.req.bachelorarbeit']['details']['composite_group']['completed'])

    def test_unreleased_block_credits_match_zero_gesamtkonto_without_losing_proof(self):
        cases=[('Praktisches Studiensemester','Praktikum','PRAX',None,24,'wi.req.praktikum'),('Bachelorarbeit','Schriftliche Ausarbeitung','BA',2.7,12,'wi.req.bachelorarbeit')]
        for whole,part,short,grade,ects,identifier in cases:
            rows=[(whole,'20023','M23',None,0,'PV',1),(part,'6424444',short,grade,ects,'BE',1)]
            v=parse_leistungen(pdf_export(rows,total=0,average=None))
            d=build_dashboard(v['groups'],program_key='wi',grade=None,credits=0,start_term='WiSe 2023/24')
            m=next(m for s in d['stages'] for m in s['modules'] if m['id']==identifier)
            self.assertEqual(d['official_credits'],0)
            self.assertTrue(m['completion_pending'])
            self.assertEqual(m['exam_history'][0]['status'],'BE')
            self.assertEqual(d['progress']['confirmed_ects'],0)
            with self.assertRaises(ExportError):parse_leistungen(pdf_export(rows,total=ects-1,average=None))

    def test_two_proven_parts_close_the_practice_block(self):
        rows=[('Praktisches Studiensemester','20023','M23',None,26,'BE',1),('Praktikum','6424444','PRAX',None,24,'BE',1),('Praxisseminar','6424445','PSEM',None,2,'BE',1)]
        v=parse_leistungen(pdf_export(rows,total=26,average=None))
        d=build_dashboard(v['groups'],program_key='wi',grade=None,credits=26,start_term='WiSe 2023/24')
        self.assertEqual(d['progress']['confirmed_ects'],26)
        for m in [m for s in d['stages'] for m in s['modules'] if m['id'] in ('wi.req.praktikum','wi.req.praxisseminar')]:
            self.assertEqual(m['status'],'passed')
