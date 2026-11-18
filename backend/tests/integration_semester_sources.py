"""Deterministic parser checks against public OTH fixtures, without network."""
from pathlib import Path
import unittest
import pymupdf
from app.services.semester_import import parse_teachers, parse_timetable, parse_calendar, import_schedule, import_handbook, lecture_details, meeting_variants
from app.services.catalog_service import editor_catalog
from app.services.catalog_schema import Catalog

FIXTURES = Path(__file__).parent / 'fixtures' / 'semester_sources'


class SourcesTests(unittest.TestCase):
    def test_all_iw_rows_and_teacher_names(self):
        teachers = parse_teachers((FIXTURES / 'teachers.html').read_bytes(), 'SS 26')
        self.assertEqual(teachers['Kna'], 'Angelika Kneidl')
        self.assertEqual(teachers['Wöt'], 'Thomas Wölfl')
        meetings, unmatched, unknown, sections = parse_timetable((FIXTURES / 'iw.html').read_bytes(), 'SS 26', teachers, editor_catalog()['modules'], {'KAPT'})
        self.assertEqual(sections, 7)
        # Real BOSS HTML omits outer row closing tags; later rows must not vanish.
        self.assertTrue(any(m['weekday'] == 3 and m['start'] == '10:00' and m['room'] == 'K014' and m['teachers'] == ['Angelika Kneidl'] for m in meetings['wi.course.pg1']))
        self.assertTrue(any(m['start'] == '15:45' for m in meetings['wi.course.ma1']))
        self.assertGreater(sum(map(len, meetings.values())), 100)
        self.assertNotIn('VS', unmatched)
        self.assertIn('wi.course.vs', meetings)
        self.assertEqual(unknown, [])
        self.assertTrue(all(m['recurrence'] == 'weekly' for m in meetings['wi.fwpm.kapt']))
        # API model validates every proposed meeting and preserves instructor names.
        Catalog.model_validate({'program_id': 'wi_bsc_2023', 'revision': '', 'semesters': {'SoSe 2026': {'modules': {key: {'offered': True, 'meetings': value} for key, value in meetings.items()}}}})

    def test_source_full_title_can_resolve_unique_code_without_mixing_rooms(self):
        html=b'<a href="/switchterm/2026">SS26</a><h2>IW2 - SS 26</h2><table><tr><td>08:15-09:45</td><td><table><tr><td>NEW<span>D201</span><span>Prof</span></td></tr></table></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>10:00-11:30</td><td></td><td><table><tr><td>NEW<span>K014</span><span>Prof</span></td></tr></table></td><td></td><td></td><td></td><td></td></tr></table>'
        class Client:
            def get(self,url,referer=None):
                if url.endswith('lecturesbyterm'): return b'<h1>SS 26</h1><table><tr><td>IW2</td><td></td><td>NEW (Same full title)</td></tr></table>'
                return html
        modules={'same':{'short_title':'OLD','title':'Same full title'}}
        result=import_schedule('SoSe 2026',Client(),modules_override=modules)
        meetings=result['modules']['same']['meetings']
        self.assertEqual([(m['weekday'],m['start'],m['room']) for m in meetings],[(1,'08:15','D201'),(2,'10:00','K014')])
        # An ambiguous full title must not choose between two catalog courses.
        result=import_schedule('SoSe 2026',Client(),modules_override={**modules,'other':{'short_title':'OTHER','title':'Same full title'}})
        self.assertEqual(result['modules'],{})

    def test_winter_shared_modules_hosted_fwpm_and_legacy_hardware(self):
        from app.services.handbook_catalog import semester_catalog
        catalog=semester_catalog({},'WiSe 2026/27')
        self.assertIn('wi.course.seminar_wi',catalog['courses'])
        self.assertNotIn('wi.course.isc',catalog['courses'])
        self.assertIn('wi.course.is',catalog['courses'])
        self.assertIn('wi.course.hardware',catalog['courses'])
        class Client:
            def get(self,url,referer=None):
                name={'classes/IW':'iw_ws26.html','classes/I':'in_ws26.html','classes/IT':'it_ws26.html','lecturesbyterm':'lectures_ws26.html','teachers':'teachers_ws26.html'}.get(url.split('/public/')[-1])
                return (FIXTURES/name).read_bytes() if name else b''
        result=import_schedule('WiSe 2026/27',Client(),catalog['courses'])
        self.assertEqual(result['report']['found'],len(catalog['courses']))
        self.assertEqual(result['report']['missing'],[])
        self.assertEqual(result['report']['unmatched'],[])
        seminar=result['modules']['wi.course.seminar_wi']['meetings']
        self.assertTrue(seminar)
        self.assertTrue(all(m['source_code']=='SEM' and m['group']=='IW5' and m['recurrence']=='unconfirmed' for m in seminar))
        modules=result['modules']
        for prefix in ('bwl2','pm'):
            a=modules['wi.course.'+prefix+'_grundlagen']['meetings']
            b=modules['wi.course.'+prefix+'_fallstudie']['meetings']
            self.assertEqual(a,b)
            self.assertTrue(all(m['shared_with'] and (m['source_color'] or m.get('dates')) for m in a))
        self.assertTrue(all(m['source_code']=='KSAP' for m in modules['wi.fwpm.ksap1']['meetings']))
        for key,host in {'kees':'I','diot':'IT','dmse':'I','dsds':'I','duxd':'IT'}.items():
            self.assertTrue(all(m['source_url'].endswith('/'+host) for m in modules['wi.fwpm.'+key]['meetings']))
        Catalog.model_validate({'program_id':'wi_bsc_2023','revision':'','semesters':{'WiSe 2026/27':{'modules':modules}}})

    def test_sem_alias_requires_iw5_and_never_closes_a_practice_seminar(self):
        modules={'wi.course.seminar_wi':{'title':'Seminar Wirtschaftsinformatik','short_title':'SWI'}}
        html=(FIXTURES/'iw_ws26.html').read_bytes()
        meetings,unmatched,_,_=parse_timetable(html,'WS 26/27',{},modules)
        self.assertIn('wi.course.seminar_wi',meetings)
        self.assertNotIn('SEM',unmatched)
        # Another group's generic SEM must not be silently assigned to the WI seminar.
        other=html.replace(b'IW5',b'IW4')
        meetings,unmatched,_,_=parse_timetable(other,'WS 26/27',{},modules)
        self.assertNotIn('wi.course.seminar_wi',meetings)
        self.assertIn('SEM',unmatched)
        meetings,_,_,_=parse_timetable(html,'WS 27/28',{},modules)
        self.assertEqual(meetings,{})

    def test_project_study_has_three_documented_groups_without_guessed_room_pairs(self):
        from app.services.handbook_catalog import semester_catalog
        teachers=parse_teachers((FIXTURES/'teachers_ws26.html').read_bytes(),'WS 26/27')
        details=lecture_details((FIXTURES/'lectures_ws26.html').read_bytes(),'WS 26/27',teachers)
        catalog=semester_catalog({},'WiSe 2026/27')['courses']
        result,_,_,_=parse_timetable((FIXTURES/'iw_ws26.html').read_bytes(),'WS 26/27',teachers,catalog,details=details)
        pj=result['wi.course.pj']
        self.assertEqual({(m['source_group'],tuple(m['teacher_codes'])) for m in pj},{('[1]',('Wöt',)),('[2]',('Her',)),('[3]',('Hak',))})
        for meeting in pj:
            if meeting['source_group']=='[1]':
                self.assertEqual(meeting['room'],'K018')
                self.assertEqual(meeting['teaching_type'],'unknown')
                self.assertEqual(meeting['type_source'],'unknown')
                self.assertEqual(meeting['source_color'],'#ffffff')
            else:
                self.assertEqual(meeting['room'],'')
                self.assertEqual(meeting['room_candidates'],['P123','P125'])
                self.assertEqual(meeting['room_assignment'],'unresolved')
                self.assertEqual(meeting['source_teacher_codes'],['Her','Hak'])
        self.assertEqual(lecture_details((FIXTURES/'lectures_ws26.html').read_bytes(),'SS 27',teachers),[])

    def test_color_does_not_infer_teaching_type_and_joint_teaching_is_not_split(self):
        meeting={'source_code':'TEST','source_color':'#ffffff','teacher_codes':['A','B'],'teachers':['One','Two'],'room':'R1,R2'}
        original=meeting.copy()
        rows=meeting_variants(meeting,'IW1',[])
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['teaching_type'],'unknown')
        self.assertEqual(rows[0]['type_source'],'unknown')
        self.assertEqual(rows[0]['room_assignment'],'unresolved')
        self.assertEqual(rows[0]['teacher_codes'],['A','B'])
        self.assertEqual(meeting,original)
        green=meeting_variants({**meeting,'source_color':'#00ff80'},'IW1',[])
        self.assertEqual(green[0]['teaching_type'],'unknown')
        joint=[{'code':'TEST','teacher':c,'groups':['IW1'],'source_group':'[1]','teaching_type':'seminar'} for c in ('A','B')]
        rows=meeting_variants(meeting,'IW1',joint)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['teaching_type'],'unknown')
        self.assertEqual(rows[0]['type_source'],'unknown')

    def test_hosted_fwpm_wrong_semester_is_ignored_and_core_never_imported_from_other_program(self):
        class Client:
            def get(self,url,referer=None):
                name={'classes/IW':'iw_ws26.html','classes/I':'in_ws26.html','lecturesbyterm':'lectures_ws26.html','teachers':'teachers_ws26.html'}.get(url.split('/public/')[-1])
                data=(FIXTURES/name).read_bytes() if name else b''
                return data.replace(b'WS 26/27',b'SS 26') if url.endswith('/classes/I') else data
        modules={'wi.fwpm.kees':{'title':'Einführung Eingebettete Systeme','short_title':'KEES'},'wi.course.other':{'title':'Other','short_title':'DIOT'}}
        result=import_schedule('WiSe 2026/27',Client(),modules)
        self.assertEqual(result['modules'],{})
        self.assertEqual(len(result['report']['missing']),2)

    def test_wrong_semester_does_not_leak(self):
        self.assertEqual(parse_teachers((FIXTURES / 'teachers.html').read_bytes(), 'SS 29'), {})
        meetings, _, _, count = parse_timetable((FIXTURES / 'iw.html').read_bytes(), 'SS 29', {}, editor_catalog()['modules'])
        self.assertEqual((meetings, count), ({}, 0))
        class Client:
            def __init__(self): self.calls = []
            def get(self, url, referer=None):
                self.calls.append(url)
                return (FIXTURES / 'iw.html').read_bytes()
        client = Client()
        result = import_schedule('SoSe 2029', client)
        self.assertEqual(result['report']['status'], 'unavailable')
        self.assertEqual(result['modules'], {})
        self.assertEqual(len(client.calls), 1)

    def test_real_ics_uses_event_dates_not_mislabelled_calendar_title(self):
        result = parse_calendar((FIXTURES / 'dates.ics').read_bytes(), 'WiSe 2026/27', 'https://www.oth-regensburg.de/calendar.ics')
        self.assertEqual(result['lectures']['start'], '2026-10-01')
        self.assertEqual(result['lectures']['end'], '2027-01-22')
        self.assertEqual(result['breaks'][0]['end'], '2027-01-10')
        self.assertEqual(result['exam_registration']['end'], '2026-11-17')
        self.assertEqual(result['exams']['end'], '2027-02-11')
        future = parse_calendar((FIXTURES / 'dates.ics').read_bytes(), 'SoSe 2029', 'https://www.oth-regensburg.de/calendar.ics')
        self.assertNotIn('lectures', future)
        self.assertEqual(future['breaks'], [])

    def test_ics_all_day_end_is_exclusive(self):
        result = parse_calendar(b'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261223\r\nDTEND;VALUE=DATE:20270111\r\nSUMMARY:Vorlesungsfrei\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n', 'WiSe 2026/27', 'https://www.oth-regensburg.de/calendar.ics')
        self.assertEqual(result['breaks'][0]['end'], '2027-01-10')

    def test_pdf_bookmarks_and_headings_use_actual_pages(self):
        with pymupdf.open() as doc:
            doc.new_page().insert_text((50, 50), 'Cover')
            doc.new_page().insert_text((50, 50), 'Programmieren 2\nDescription')
            doc.set_toc([[1, 'Programmieren 2', 2]])
            result = import_handbook(doc.tobytes(), 'core')
        self.assertEqual(result['modules']['wi.req.pg2']['handbook_pages'], {'start': 2})
        self.assertNotIn('offered', result['modules']['wi.req.pg2'])
        self.assertNotIn('ects', result['modules']['wi.req.pg2'])
        self.assertIn('Description', result['modules']['wi.req.pg2']['handbook_excerpt'])
        with pymupdf.open() as doc:
            doc.new_page().insert_text((50, 50), 'Modulliste\nProgrammieren 2 ............ 42\nData Engineering ............ 77\nMathematik 1 ............ 88')
            result = import_handbook(doc.tobytes(), 'core')
        self.assertEqual(result['modules'], {})


if __name__ == '__main__':
    unittest.main()


class OperatingSystemsScheduleTests(unittest.TestCase):
    def test_four_distinct_operating_systems_slots_survive_without_inferred_types(self):
        from app.services.handbook_catalog import semester_catalog
        teachers=parse_teachers((FIXTURES/'teachers_ws26.html').read_bytes(),'WS 26/27')
        details=lecture_details((FIXTURES/'lectures_ws26.html').read_bytes(),'WS 26/27',teachers)
        courses=semester_catalog({},'WiSe 2026/27')['courses']
        timetable,_,_,_=parse_timetable((FIXTURES/'iw_ws26.html').read_bytes(),'WS 26/27',teachers,courses,details=details)
        os=timetable['wi.course.betriebssysteme']
        self.assertEqual({(m['weekday'],m['start'],m['room']) for m in os}, {(3,'14:00','K220'),(3,'15:45','K220'),(4,'14:00','K001'),(4,'15:45','K223')})
        self.assertTrue(all(m['teaching_type']=='unknown' and m['type_source']=='unknown' for m in os))


class ExplicitCalendarTests(unittest.TestCase):
    def test_bwl2_dated_intro_does_not_make_other_lecturers_weekly_slots_irregular(self):
        from app.services.boss_calendar import directory_blocks,apply_blocks,calendar_meetings
        teachers=parse_teachers((FIXTURES/'teachers_ws26.html').read_bytes(),'WS 26/27')
        blocks=directory_blocks((FIXTURES/'lectures_ws26.html').read_bytes(),'WS 26/27',teachers)
        bw=[b for b in blocks if b['code']=='BW2']
        self.assertEqual(len(bw),1)
        self.assertEqual((bw[0]['date'],bw[0]['start'],bw[0]['room']),('2026-10-01','10:00','Zoom'))
        self.assertEqual(directory_blocks((FIXTURES/'lectures_ws26.html').read_bytes(),'SS 27',teachers),[])
        base={'source_code':'BW2','group':'IW2','source_group':'','source_url':'https://stpim.oth-regensburg.de/public/classes/IW','start':'10:00','end':'11:30','weekday':4,'room':'virt','recurrence':'unconfirmed','teacher_codes':['Wem','Woli','Fedo'],'teachers':[]}
        regular={**base,'weekday':2,'room':'K008','teacher_codes':['Woli']}
        source=[base,regular]
        result=calendar_meetings(source,'WiSe 2026/27')
        self.assertEqual(source,[base,regular])
        self.assertEqual(len(result),2)
        intro=next(m for m in result if m.get('dates'))
        self.assertEqual(intro['dates'],['2026-10-01'])
        self.assertEqual(next(m for m in result if not m.get('dates'))['recurrence'],'weekly')
        self.assertEqual(calendar_meetings(result,'WiSe 2026/27'),result)
        self.assertEqual(calendar_meetings(source,'WiSe 2027/28'),source)
        manual=[{**base,'source_url':''}]
        self.assertEqual(calendar_meetings(manual,'WiSe 2026/27'),manual)
        Catalog.model_validate({'program_id':'wi_bsc_2023','revision':'','semesters':{'WiSe 2026/27':{'modules':{'wi.course.bwl2_grundlagen':{'meetings':result}}}}})
