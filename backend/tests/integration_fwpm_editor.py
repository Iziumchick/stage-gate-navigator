"""FWPM semester editor, exact PDFs, immutable module graph and foreign credits."""
import copy
import unittest
from unittest.mock import patch
from app.services.catalog_schema import Preparation, Catalog
from app.services.fwpm_semester import default_proposal, copy_proposal, parse_fwpm_proposal, fwpm_library, automatic_proposal
from app.services.handbook_catalog import semester_catalog, bundled_documents, stored_path
from app.services.dashboard_service import build_dashboard
from app.services.program_editions import edition_registry
from pydantic import ValidationError

TERM='WiSe 2026/27'
class FwpmTests(unittest.TestCase):
    def selection(self,rows): return Preparation(fwpm_courses=rows,confirmed=True).model_dump()
    def test_real_pdf_only_iw_slot_membership_and_no_automatic_confirmation(self):
        book=next(d for d in bundled_documents() if d['kind']=='fwpm')
        data=stored_path(book['digest']).read_bytes()
        _,rows=parse_fwpm_proposal(data,TERM)
        self.assertEqual(len(rows),12)
        self.assertNotIn('KBAR',{r['short_title'] for r in rows})
        self.assertTrue(all(not r['confirmed'] for r in rows))
        self.assertTrue(all(r['ects']==5 for r in rows))
        self.assertEqual(next(r for r in rows if r['short_title']=='DIOT')['slots'],['wi.req.fwpm2','wi.req.fwpm3'])
        self.assertEqual(semester_catalog(self.selection(rows),TERM)['counts']['fwpm'],0)
        rows[0]['confirmed']=True
        self.assertEqual(semester_catalog(self.selection(rows),TERM)['counts']['fwpm'],1)
        with self.assertRaises(ValueError): parse_fwpm_proposal(data,'SoSe 2027')
    def test_copy_requires_reconfirmation_and_does_not_transfer_times_or_change_original(self):
        rows=default_proposal(TERM); before=copy.deepcopy(rows)
        copied=copy_proposal(rows,TERM)
        self.assertTrue(all(not r['confirmed'] for r in copied))
        self.assertFalse(any('meetings' in r or 'room' in r for r in copied))
        copied[0]['title']='Changed future title'
        self.assertEqual(rows,before)
        self.assertEqual(semester_catalog(self.selection(copied),'WiSe 2027/28')['counts']['fwpm'],0)
        self.assertGreater(len(fwpm_library()),len(rows))
    def test_admin_can_add_edit_reassign_and_remove_without_touching_spo(self):
        original=copy.deepcopy(edition_registry())
        row={'id':'wi.fwpm.custom.sample','title':'A new IW subject','short_title':'NEW','ects':5,'slots':['wi.req.fwpm2'],'offered':True,'confirmed':True}
        selection=self.selection([row]); catalog=semester_catalog(selection,TERM)
        self.assertEqual(catalog['courses'][row['id']]['slots'],['wi.req.fwpm2','wi.req.fwpm3'])
        self.assertEqual(catalog['counts']['fwpm'],1)
        self.assertEqual(semester_catalog(self.selection([]),TERM)['counts']['fwpm'],0)
        row['offered']=False
        self.assertNotIn(row['id'],semester_catalog(self.selection([row]),TERM)['courses'])
        self.assertEqual(edition_registry(),original)
        for patch_value in ({'id':'wi.course.pg1'}, {'confirmed':True,'ects':3,'offered':True}, {'slots':['wi.req.bwl2']}):
            with self.assertRaises(ValidationError): self.selection([{**row,**patch_value}])
        with self.assertRaises(ValidationError): self.selection([row,row])
    def test_automatic_proposal_uses_latest_same_season_and_respects_explicit_empty(self):
        rows=default_proposal(TERM)
        seasons={'SoSe 2026':{'preparation':{'fwpm_courses':rows}},TERM:{'preparation':{'fwpm_courses':[]}}}
        result,source=automatic_proposal('SoSe 2027',seasons)
        self.assertEqual(source,'SoSe 2026')
        self.assertEqual(len(result),len(rows))
        self.assertTrue(all(not c['confirmed'] for c in result))
        result[0]['title']='changed'
        self.assertNotEqual(rows[0]['title'],'changed')
        result,source=automatic_proposal('WiSe 2027/28',seasons)
        self.assertEqual(source,TERM);self.assertEqual(result,[])
        result,source=automatic_proposal(TERM,seasons)
        self.assertEqual(result,[])

    def test_summer_candidates_without_slots_are_optional_and_survive_copy(self):
        rows=default_proposal('SoSe 2026')
        self.assertGreater(len(rows),10)
        self.assertTrue(any(c['offered'] for c in rows))
        self.assertTrue(all(c['slots'] for c in rows if c['offered']))
        optional=[c for c in rows if not c['slots']]
        self.assertTrue(optional)
        self.assertTrue(all(not c['offered'] and not c['confirmed'] for c in optional))
        result,source=automatic_proposal('SoSe 2027',{})
        self.assertEqual(source,'SoSe 2026')
        self.assertEqual({c['id'] for c in rows},{c['id'] for c in result})
        self.assertTrue(all(c['slots'] for c in result if c['offered']))
        self.assertTrue(all(not c['confirmed'] for c in result))
        # Old drafts may have treated unassigned candidates as offered.
        legacy=copy.deepcopy(rows)
        for c in legacy:c['offered']=True
        before=copy.deepcopy(legacy)
        terms={'SoSe 2027':{'preparation':{'fwpm_courses':legacy}}}
        cleaned,_=automatic_proposal('SoSe 2027',terms)
        self.assertEqual(legacy,before)
        self.assertTrue(all(c['slots'] for c in cleaned if c['offered']))
        prepared=self.selection([{**c,'confirmed':bool(c['offered'])} for c in cleaned])
        catalog=semester_catalog(prepared,'SoSe 2027')
        self.assertFalse({c['id'] for c in optional}.intersection(catalog['courses']))
        self.assertTrue({c['id'] for c in optional}.issubset({c['id'] for c in fwpm_library()}))

    def test_five_credits_and_description_pdf_survive_copy_and_published_student_options(self):
        row={**default_proposal(TERM)[0],'ects':None,'description_pdf':'/api/programs/wi/handbooks/'+'a'*64+'.pdf'}
        selection=self.selection([row])
        self.assertEqual(selection['fwpm_courses'][0]['ects'],5)
        self.assertEqual(copy_proposal(selection['fwpm_courses'],TERM)[0]['description_pdf'],row['description_pdf'])
        with self.assertRaises(ValidationError):self.selection([{**row,'description_pdf':'https://untrusted.example/file.pdf'}])
        sem={'status':'published','preparation':selection,'modules':{}}
        with patch('app.services.dashboard_service.published_semesters',return_value={TERM:sem}):
            report=build_dashboard([],program_key='wi',grade=None,credits=0,term=TERM,start_term='WiSe 2023/24')
            options=[c for stage in report['stages'] for m in stage['modules'] for c in m.get('course_options',[]) if c['id']==row['id']]
            self.assertTrue(options)
            self.assertEqual(options[0]['details']['description_pdf'],row['description_pdf'])

    def test_one_module_contains_both_required_parts_and_choice_keeps_two_options(self):
        catalog=semester_catalog({},TERM)
        group=next(g for g in catalog['module_groups'] if g['id']=='wi.req.bwl2')
        self.assertEqual(group['completion_rule'],'all')
        self.assertEqual(set(group['teilmodule_ids']),{'wi.course.bwl2_grundlagen','wi.course.bwl2_fallstudie'})
        self.assertEqual(len([g for g in catalog['module_groups'] if g['id']=='wi.req.bwl2']),1)
        choice=next(g for g in catalog['module_groups'] if g['id']=='wi.req.vertiefung_iw3')
        self.assertEqual(set(choice['teilmodule_ids']),{'wi.course.is'})
        summer=semester_catalog({},'SoSe 2027')
        summer_choice=next(g for g in summer['module_groups'] if g['id']=='wi.req.vertiefung_iw3')
        self.assertEqual(set(summer_choice['teilmodule_ids']),{'wi.course.isc'})
    def test_foreign_subject_closes_only_parent_and_child_grade_cannot_close_parent(self):
        groups=[{'requirement_title':'Vertiefungsmodul IW 3','requirement_meta':{'ects':5,'grade_val':'2,0'},'subs':[{'title':'Security for AI abroad','ects':5,'grade_val':'2,0'}]}]
        report=build_dashboard(groups,program_key='wi',grade=2,credits=5,term=TERM,start_term='WiSe 2023/24')
        rows={m['id']:m for stage in report['stages'] for m in stage['modules']}
        self.assertEqual(rows['wi.req.vertiefung_iw3']['status'],'passed')
        self.assertEqual(rows['wi.req.vertiefung_iw3']['source']['subs'][0]['title'],'Security for AI abroad')
        self.assertEqual(rows['wi.req.fwpm2']['status'],'unknown')
        groups[0]['requirement_meta']['grade_val']=None
        groups[0]['passed']=True  # A child success marker cannot replace a graded parent's result.
        report=build_dashboard(groups,program_key='wi',grade=None,credits=5,term=TERM,start_term='WiSe 2023/24')
        module=next(m for s in report['stages'] for m in s['modules'] if m['id']=='wi.req.vertiefung_iw3')
        self.assertEqual(module['status'],'unknown'); self.assertIsNone(module['grade'])
    def test_official_composite_parent_closes_known_children_without_inventing_grades(self):
        evidence=[{'requirement_title':'Praktisches Studiensemester','requirement_meta':{'ects':26,'grade_val':None},'passed':True,
                   'subs':[{'title':'Practical placement abroad','ects':26,'grade_val':None}]},
                  {'requirement_title':'Bachelorarbeit','requirement_meta':{'ects':15,'grade_val':'2,0'},'subs':[
                      {'title':'Foreign thesis and presentation','ects':15,'grade_val':'2,0'}]}]
        report=build_dashboard(evidence,program_key='wi',grade=2,credits=41,term=TERM,start_term='WiSe 2023/24')
        rows={m['id']:m for st in report['stages'] for m in st['modules']}
        for key in ('praktikum','praxisseminar','bachelorarbeit','bachelorseminar'):
            self.assertEqual(rows['wi.req.'+key]['status'],'passed')
            self.assertIsNone(rows['wi.req.'+key]['grade'])
        self.assertEqual(rows['wi.req.bachelorarbeit']['details']['composite_group']['grade'],'2,0')
        self.assertTrue(rows['wi.req.praktikum']['details']['composite_group']['completed'])
        self.assertEqual(report['official_credits'],41)
        self.assertEqual(sum(m['required_ects'] for m in rows.values()),210)
        self.assertEqual(report['unmatched_groups'],[])
        # A passed thesis alone (12 ECTS) must not silently pass the seminar.
        evidence[1]['requirement_meta']['ects']=12
        report=build_dashboard(evidence,program_key='wi',grade=2,credits=38,term=TERM,start_term='WiSe 2023/24')
        rows={m['id']:m for st in report['stages'] for m in st['modules']}
        self.assertEqual(rows['wi.req.bachelorarbeit']['status'],'unknown')
        self.assertTrue(rows['wi.req.bachelorarbeit']['completion_pending'])
        self.assertEqual(rows['wi.req.bachelorarbeit']['credited_ects'],0)
        self.assertEqual(rows['wi.req.bachelorseminar']['status'],'unknown')

    def test_draft_fwpm_never_reaches_students_but_published_choice_does(self):
        row={'id':'wi.fwpm.custom.sample','title':'New semester subject','short_title':'NEW','ects':5,'slots':['wi.req.fwpm2'],'confirmed':True}
        sem={'status':'draft','preparation':self.selection([row]),'modules':{row['id']:{'offered':True,'room':'D201'}}}
        def options():
            report=build_dashboard([],program_key='wi',grade=None,credits=0,term=TERM,start_term='WiSe 2023/24')
            return next(m for s in report['stages'] for m in s['modules'] if m['id']=='wi.req.fwpm2')['course_options']
        with patch('app.services.dashboard_service.published_semesters',return_value={TERM:sem}):
            self.assertNotIn(row['id'],{c['id'] for c in options()})
            sem['status']='published'
            self.assertEqual(options()[0]['id'],row['id'])
            self.assertEqual(options()[0]['course']['room'],'D201')

if __name__=='__main__': unittest.main()
