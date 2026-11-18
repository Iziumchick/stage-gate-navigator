"""Real PDF extraction and exact-semester source tests; run in backend image."""
import unittest
import pymupdf
from app.services.handbook_catalog import bundled_documents, read_document, semester_catalog, reference_document
from app.services.semester_import import import_schedule, import_dates
from app.services.program_editions import edition_registry
from pathlib import Path

FIXTURES=Path(__file__).parent/'fixtures'/'semester_sources'


class HandbookWizardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs=bundled_documents()
        cls.selection={'core_documents':[d['digest'] for d in cls.docs if d['kind']=='core'],
                       'fwpm_document':next(d['digest'] for d in cls.docs if d['kind']=='fwpm'),'confirmed':True}

    def test_current_term_is_not_the_study_start_on_the_cover(self):
        middle=next(d for d in self.docs if d['edition_id']=='wi_bsc_2023')
        self.assertEqual(middle['term'],'WiSe 2026/27')
        self.assertEqual(middle['created_on'],'09.10.2026')
        self.assertEqual(len(self.docs),4)

    def test_iw_courses_and_reviewed_boss_exception_enter_fwpm_catalog(self):
        doc=read_document(self.selection['fwpm_document'])
        courses=doc['courses']
        self.assertEqual(len(courses),13)
        self.assertIn('wi.fwpm.kbar',courses)
        self.assertNotIn('wi.fwpm.kbis',courses)
        self.assertNotIn('wi.fwpm.dbpm',courses)
        self.assertEqual(courses['wi.fwpm.diot']['iw_mark'],'(X)')
        self.assertEqual(courses['wi.fwpm.diot']['slots'],['wi.req.fwpm2','wi.req.fwpm3'])
        self.assertEqual(courses['wi.fwpm.kaps']['slots'],['wi.req.fwpm1','wi.req.fwpm2','wi.req.fwpm3'])
        self.assertEqual(courses['wi.fwpm.date']['pages'],{'start':28,'end':29})

    def test_season_filter_and_wrong_semester_fwpm_never_claim_current_offering(self):
        summer=semester_catalog(self.selection,'SoSe 2027')
        winter=semester_catalog(self.selection,'WiSe 2026/27')
        self.assertIn('wi.course.algorithmen',summer['courses'])
        self.assertNotIn('wi.course.algorithmen',winter['courses'])
        self.assertNotIn('wi.course.betriebssysteme',summer['courses'])
        self.assertIn('wi.course.betriebssysteme',winter['courses'])
        self.assertFalse(any(c['kind']=='elective' for c in summer['courses'].values()))
        self.assertTrue(summer['warnings'])
        self.assertEqual(sum(c['kind']=='elective' for c in winter['courses'].values()),13)
        self.assertEqual(summer['courses']['wi.course.algorithmen']['ects'],5)
        self.assertTrue(summer['courses']['wi.course.algorithmen']['references']['wi_bsc_2026']['pages'])
        self.assertNotIn('wi.course.enterprise_systems',summer['courses'])
        self.assertTrue(any(c['id']=='wi.course.enterprise_systems' for c in summer['pending']))

    def test_latest_book_alone_supplies_catalog_but_preserves_verified_old_spo_links(self):
        newest=next(d for d in self.docs if d['edition_id']=='wi_bsc_2026')
        single={**self.selection,'core_documents':[newest['digest']]}
        combined=semester_catalog(self.selection,'WiSe 2026/27')
        current=semester_catalog(single,'WiSe 2026/27')
        self.assertEqual(combined,current)
        self.assertEqual([c['id'] for c in current['pending']],['wi.course.enterprise_systems'])
        self.assertEqual(current['pending'][0]['pages'],{'start':5,'end':8})
        gwi=current['courses']['wi.course.gwi']
        self.assertIn('wi.req.gwi',gwi['requirement_links']['wi_bsc_2012'])
        self.assertIn('wi.req.gwi',gwi['requirement_links']['wi_bsc_2023'])
        self.assertEqual(set(gwi['references']),{'wi_bsc_2026'})
        self.assertIn('wi.course.hardware',current['courses'])

    def test_reference_update_never_changes_reviewed_catalog_or_links(self):
        from app.services.handbook_catalog import reference_document
        from unittest.mock import patch
        original=semester_catalog(self.selection,'WiSe 2026/27')
        with pymupdf.open() as doc:
            doc.new_page().insert_text((50,50),'Modulhandbuch SPO-Version ab: 31.03.2026\nWintersemester 2026/27\nerstellt am 24.10.2026')
            doc.new_page().insert_text((50,50),'New course or changed mandatory parts 99 ECTS')
            uploaded=reference_document(doc.tobytes(),'core')
        self.assertTrue(uploaded['reference_only'])
        self.assertEqual(uploaded['courses'],{})
        from app.services.handbook_catalog import read_document
        def resolve(key): return uploaded if key==uploaded['digest'] else read_document(key)
        with patch('app.services.handbook_catalog.read_document',side_effect=resolve):
            updated=semester_catalog({**self.selection,'core_documents':[uploaded['digest']]},'WiSe 2026/27')
        self.assertEqual(original['courses'],updated['courses'])
        self.assertEqual(original['pending'],updated['pending'])
        self.assertEqual(original['counts'],{'core':22,'fwpm':13,'total':35,'pending':1})
        self.assertEqual(original['pending'][0]['stages'],['abschnitt_1'])
        self.assertTrue(updated['warnings'])

    def test_unstructured_reference_pdf_never_creates_spo_or_teaching_courses(self):
        before=repr(edition_registry())
        with pymupdf.open() as doc:
            doc.new_page().insert_text((50,50),'Modulhandbuch SPO-Version ab: 31.03.2026\nSommersemester 2027\nerstellt am 01.03.2027')
            doc.new_page().insert_text((50,50),'An entirely new compound module with different examination rules')
            parsed=reference_document(doc.tobytes(),'core')
        self.assertTrue(parsed['reference_only'])
        self.assertEqual(parsed['courses'],{})
        self.assertEqual(parsed['course_count'],0)
        self.assertEqual(repr(edition_registry()),before)

    def test_schedule_link_for_future_term_with_old_content_is_rejected(self):
        class Client:
            def get(self,url,referer=None):
                html=(FIXTURES/'iw.html').read_bytes()
                return html+b'<a href="/switchterm/2029">SS 29</a>'
        result=import_schedule('SoSe 2029',Client(),modules_override={})
        self.assertEqual(result['report']['status'],'unavailable')
        self.assertEqual(result['modules'],{})

    def test_calendar_named_for_future_term_with_old_event_dates_is_rejected(self):
        class Client:
            def get(self,url,referer=None):
                if url.endswith('.ics'): return (FIXTURES/'dates.ics').read_bytes()
                return b'<a href="/calendar/SoSe2029_termine.ics">SS29</a>'
        result=import_dates('SoSe 2029',Client())
        self.assertEqual(result['report']['status'],'unavailable')
        self.assertIsNone(result['calendar'])


if __name__=='__main__': unittest.main()
