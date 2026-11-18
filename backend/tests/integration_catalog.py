"""Real HTTP checks: roles, sessions, immutable curriculum, publishing and PDFs."""
import copy
import http.cookiejar
import json
import os
import socket
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uvicorn
from unittest.mock import patch
import pymupdf
from app.main import app
from app.services.semester_import import parse_calendar
from pathlib import Path

with tempfile.TemporaryDirectory() as folder:
    os.environ['WI_CATALOG_PATH'] = folder + '/catalog.json'
    os.environ['ADMIN_EMAIL'] = 'admin@example.org'
    os.environ['ADMIN_PASSWORD'] = 'integration-admin-password'
    sock = socket.socket(); sock.bind(('127.0.0.1', 0))
    base = f'http://127.0.0.1:{sock.getsockname()[1]}'
    server = uvicorn.Server(uvicorn.Config(app, log_level='warning'))
    thread = threading.Thread(target=server.run, kwargs={'sockets': [sock]}, daemon=True); thread.start()
    for _ in range(100):
        if server.started: break
        time.sleep(0.05)
    assert server.started
    cookies = http.cookiejar.CookieJar()
    admin = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
    student = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    anonymous = urllib.request.build_opener()

    def call(client, path, data=None, content_type='application/json', method=None):
        if isinstance(data, dict): data = json.dumps(data).encode()
        req = urllib.request.Request(base + path, data=data, headers={'Content-Type': content_type, 'X-Requested-With': 'StudyNavigator'}, method=method)
        with client.open(req) as response:
            return response.read()

    def fails(code, *args, **kwargs):
        try:
            call(*args, **kwargs)
            raise AssertionError(f'Expected {code}')
        except urllib.error.HTTPError as error:
            assert error.code == code, error.read()

    def pg2(term):
        result = json.loads(call(anonymous, '/programs/wi/dashboard?term=' + urllib.parse.quote(term)))
        return next(m for s in result['stages'] for m in s['modules'] if m['id'] == 'wi.req.pg2')

    try:
        fails(401, anonymous, '/programs/wi/catalog')
        fails(401, anonymous, '/auth/login', {'email': 'admin@example.org', 'password': 'wrong'})
        call(admin, '/auth/login', {'email': 'admin@example.org', 'password': 'integration-admin-password'})
        assert next(iter(cookies)).has_nonstandard_attr('HttpOnly')
        registration = {'privacy_accepted': True,'name': 'Student', 'email': 'student@example.org', 'password': 'integration-student-password'}
        fails(422, student, '/auth/register', {**registration, 'role': 'admin'})
        call(student, '/auth/register', registration)
        fails(403, student, '/programs/wi/catalog')
        fails(403, student, '/admin/programs/wi/import/schedule', {'term': 'SoSe 2029'})
        fails(422, admin, '/admin/programs/wi/import/schedule', {'term': 'WiSe 2026/29'})
        with patch('app.routers.catalog.import_schedule', return_value={'report': {'status': 'unavailable', 'fetched_at': '2026-10-12T12:00:00Z', 'source_urls': [], 'found': 0, 'missing': [], 'warnings': ['Not published'], 'unmatched': []}, 'modules': {}}):
            preview = json.loads(call(admin, '/admin/programs/wi/import/schedule', {'term': 'SoSe 2029'}))
            assert preview['term'] == 'SoSe 2029' and preview['modules'] == {}
            assert not json.loads(call(admin, '/programs/wi/catalog'))['semesters'], 'Read-only preview saved a semester'
        with patch('app.routers.catalog.import_dates', side_effect=TimeoutError()):
            preview = json.loads(call(admin, '/admin/programs/wi/import/dates', {'term': 'SoSe 2029'}))
            assert preview['report']['status'] == 'error'

        resolved = json.loads(call(anonymous, '/programs/wi/editions/resolve?start_term=SoSe%202026'))
        assert resolved['id'] == 'wi_bsc_2023'
        resolved = json.loads(call(anonymous, '/programs/wi/editions/resolve?start_term=WiSe%202026%2F27'))
        assert resolved['id'] == 'wi_bsc_2026'
        fails(422, anonymous, '/programs/wi/dashboard?start_term=WiSe%202026%2F29')
        latest = json.loads(call(anonymous, '/programs/wi/dashboard?start_term=WiSe%202026%2F27'))
        assert latest['curriculum_edition'] == 'wi_bsc_2026'
        assert any(m['id'] == 'wi.req.enterprise_systems' for s in latest['stages'] for m in s['modules'])
        old = json.loads(call(anonymous, '/programs/wi/dashboard?start_term=SoSe%202023'))
        assert next(m for s in old['stages'] for m in s['modules'] if m['id'] == 'wi.req.aw1')['required_ects'] == 5
        view = json.loads(call(admin, '/programs/wi/catalog'))
        catalog = {key: view[key] for key in ('program_id', 'revision', 'semesters')}
        url = '/admin/programs/wi/catalog'
        fails(403, student, url, catalog, method='PUT')
        fails(422, admin, url, {**catalog, 'admission_rules': {}}, method='PUT')
        fails(422, admin, url, {**catalog, 'modules': {}}, method='PUT')
        catalog['semesters']['WiSe 2026/27'] = {'status': 'draft', 'handbook': {'url': 'https://example.org/a.pdf', 'label': 'Handbook'}, 'modules': {'wi.req.pg2': {'offered': True, 'room': 'D 201', 'handbook_pages': {'start': 42, 'end': 43}}}}
        def save():
            result = json.loads(call(admin, url, catalog, method='PUT'))
            catalog['revision'] = result['revision']
        save()
        assert pg2('WiSe 2026/27')['course'] == {}, 'Draft leaked to students'
        # Structured dates and meetings are validated server-side, including direct API writes.
        invalid = copy.deepcopy(catalog)
        invalid['semesters']['WiSe 2026/27']['calendar'] = {'lectures': {'start': '2026-03-15', 'end': '2026-07-10'}}
        fails(422, admin, url, invalid, method='PUT')
        invalid = copy.deepcopy(catalog)
        invalid['semesters']['WiSe 2026/27']['modules']['wi.req.pg2']['meetings'] = [{'weekday': 1, 'start': '11:30', 'end': '10:00'}]
        fails(422, admin, url, invalid, method='PUT')
        invalid = copy.deepcopy(catalog)
        invalid['semesters']['WiSe 2026/27']['status'] = 'published'
        invalid['semesters']['WiSe 2026/27']['modules']['wi.req.pg2']['offered'] = None
        fails(422, admin, url, invalid, method='PUT')
        catalog['semesters']['WiSe 2026/27']['calendar'] = parse_calendar((Path(__file__).parent / 'fixtures/semester_sources/dates.ics').read_bytes(), 'WiSe 2026/27', 'https://www.oth-regensburg.de/calendar.ics')
        stale = copy.deepcopy(catalog)
        catalog['semesters']['WiSe 2026/27']['modules']['wi.fwpm.duxD'.lower()] = {'offered': True, 'room': 'FWPM-Raum'}
        catalog['semesters']['WiSe 2026/27']['status'] = 'published'; save()
        assert json.loads(call(admin, '/programs/wi/catalog'))['semesters']['WiSe 2026/27']['modules']['wi.fwpm.duxd']['room'] == 'FWPM-Raum'
        assert pg2('WiSe 2026/27')['course']['room'] == 'D 201'
        fails(409, admin, url, stale, method='PUT')
        catalog['semesters']['WiSe 2026/27']['status'] = 'draft'
        catalog['semesters']['WiSe 2026/27']['modules']['wi.req.pg2']['room'] = 'D 202'; save()
        assert pg2('WiSe 2026/27')['course']['room'] == 'D 201', 'Draft replaced published version'
        catalog['semesters']['SoSe 2027'] = copy.deepcopy(catalog['semesters']['WiSe 2026/27'])
        catalog['semesters']['SoSe 2027']['calendar'] = {}
        catalog['semesters']['SoSe 2027']['status'] = 'published'; save()
        assert pg2('SoSe 2027')['course']['room'] == 'D 202'
        assert pg2('SoSe 2027')['admission']['status'] == 'unknown', 'Admin data changed academic admission'
        assert pg2('WiSe 2026/27')['course']['room'] == 'D 201'
        catalog['semesters']['SoSe 2027']['modules']['wi.req.pg2']['meetings'] = [{'weekday': 3, 'start': '10:00', 'end': '11:30', 'room': 'K 014', 'group': 'Übung 1'}]
        save()
        assert pg2('SoSe 2027')['course']['schedule'] == 'Mittwoch 10:00–11:30 (Übung 1)'
        assert pg2('SoSe 2027')['course']['room'] == 'K 014'
        stored = json.loads(call(admin, '/programs/wi/catalog'))
        assert stored['semesters']['WiSe 2026/27']['calendar']['breaks'][0]['end'] == '2027-01-10'
        assert stored['semesters']['SoSe 2027']['calendar']['lectures'] is None
        catalog['semesters']['SoSe 2027']['modules']['wi.course.vs'] = {'offered': True, 'elo': 'https://example.org/vs', 'room': 'Shared room'}
        catalog['semesters']['SoSe 2027']['modules']['wi.fwpm.date'] = {'offered': True, 'elo': 'https://example.org/date', 'room': 'FWPM room'}
        catalog['semesters']['SoSe 2027']['preparation']={'core_documents':[],'confirmed':True,'fwpm_courses':[{'id':'wi.fwpm.date','title':'Data Engineering','short_title':'DATE','ects':5,'slots':['wi.req.fwpm2','wi.req.fwpm3'],'offered':True,'confirmed':True}]}
        save()
        for start in ('WiSe%202021%2F22','WiSe%202023%2F24','WiSe%202026%2F27'):
            data = json.loads(call(anonymous, '/programs/wi/dashboard?term=SoSe%202027&start_term='+start))
            flat = {m['id']:m for stage in data['stages'] for m in stage['modules']}
            assert flat['wi.req.vertiefung_in2']['course']['room'] == 'Shared room'
            for slot in ('fwpm2','fwpm3'):
                option = next(c for c in flat['wi.req.'+slot]['course_options'] if c['id']=='wi.fwpm.date')
                assert option['course']['elo'] == 'https://example.org/date'
                assert flat['wi.req.'+slot]['status'] == 'unknown'
        boundary = 'catalog-test-boundary'
        def upload(pdf, kind=None):
            body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="handbook.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode() + pdf + f'\r\n--{boundary}--\r\n'.encode())
            result = json.loads(call(admin, '/admin/programs/wi/handbook' + (f'?kind={kind}' if kind else ''), body, content_type=f'multipart/form-data; boundary={boundary}'))
            if kind:
                assert result['modules'] == {}
                assert result['edition_id'] == 'wi_bsc_2023'
            return result['url'].removeprefix('/api')
        # A course description is one immutable, readable PDF, with strict role and size checks.
        def description_body(pdf):
            return (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="description.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode()+pdf+f'\r\n--{boundary}--\r\n'.encode())
        description_path='/admin/programs/wi/fwpm-description'
        content_type=f'multipart/form-data; boundary={boundary}'
        with pymupdf.open() as doc:
            doc.new_page().insert_text((72,72),'Course description')
            description=doc.tobytes()
        body=description_body(description)
        fails(403,student,description_path,body,content_type=content_type)
        fails(401,anonymous,description_path,body,content_type=content_type)
        fails(400,admin,description_path,description_body(b'not a PDF'),content_type=content_type)
        fails(422,admin,description_path,description_body(b'%PDF-invalid'),content_type=content_type)
        fails(400,admin,description_path,description_body(b'%PDF-'+b'x'*(10*1024*1024)),content_type=content_type)
        description_url=json.loads(call(admin,description_path,body,content_type=content_type))['url']
        assert call(anonymous,description_url.removeprefix('/api'))==description
        assert json.loads(call(admin,description_path,body,content_type=content_type))['url']==description_url

        first = upload(b'%PDF-1.4\nfirst\n%%EOF'); second = upload(b'%PDF-1.4\nsecond\n%%EOF')
        assert first != second
        assert call(anonymous, first) == b'%PDF-1.4\nfirst\n%%EOF'
        assert call(anonymous, second) == b'%PDF-1.4\nsecond\n%%EOF'
        with pymupdf.open() as doc:
            doc.new_page().insert_text((50, 50), 'Modulhandbuch SPO 2023\nProgrammieren 2\nModule content')
            parsed_pdf = upload(doc.tobytes(), 'core')
        assert call(anonymous, parsed_pdf).startswith(b'%PDF-')
        # Wizard uses immutable documents to derive a seasonal catalog; no mutable ECTS API.
        documents = json.loads(call(admin, '/programs/wi/catalog'))['documents']
        core_ids = [d['digest'] for d in documents if d['kind']=='core']
        preparation = {'core_documents': core_ids, 'fwpm_document': None, 'confirmed': True}
        fails(403, student, '/admin/programs/wi/prepare', {'term':'SoSe 2028','preparation':preparation})
        prepared = json.loads(call(admin, '/admin/programs/wi/prepare', {'term':'SoSe 2028','preparation':preparation}))
        assert 'wi.course.algorithmen' in prepared['catalog']['courses']
        assert 'wi.course.betriebssysteme' not in prepared['catalog']['courses']
        catalog['semesters']['SoSe 2028'] = {'status':'published','preparation':preparation,'modules':prepared['modules'],
            'handbook':prepared['handbook'],'core_handbooks':prepared['core_handbooks'],'fwpm_handbook':prepared['fwpm_handbook']}
        save()
        assert call(anonymous, documents[0]['url'].removeprefix('/api')).startswith(b'%PDF-')
        invalid=copy.deepcopy(catalog)
        invalid['semesters']['SoSe 2028']['modules']['wi.course.algorithmen']['ects']=99
        fails(422, admin, url, invalid, method='PUT')
        # A reference PDF cannot add teaching courses or change existing module structure.
        with pymupdf.open() as doc:
            doc.new_page().insert_text((50,50),'Modulhandbuch SPO-Version ab: 31.03.2026\nSommersemester 2028')
            parent=doc.new_page()
            for position,text in [((50,50),'Modulbezeichnung'),((400,50),'Modul-KzBez.'),((50,75),'IW_ Vertiefungsmodul IN 2'),((400,75),'25'),((50,105),'Modulverantwortliche/r')]:
                parent.insert_text(position,text)
            page=doc.new_page()
            for position,text in [((50,50),'Teilmodul'),((400,50),'TM-Kurzbezeichnung'),((50,75),'New teaching course'),((400,75),'NEW'),((50,105),'Verantwortliche/r'),((300,130),'Angebotsfrequenz'),((300,155),'nur im Sommersemester'),((50,170),'Lehrform'),((450,205),'[ECTS-Credits]'),((460,230),'5'),((50,260),'Zeitaufwand')]:
                page.insert_text(position,text)
            pdf=doc.tobytes()
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="new-book.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode()+pdf+f'\r\n--{boundary}--\r\n'.encode())
        uploaded=json.loads(call(admin,'/admin/programs/wi/handbook?kind=core&extract_catalog=true',body,content_type=f'multipart/form-data; boundary={boundary}'))['document']
        assert uploaded['course_count']==0
        assert uploaded['reference_only'] is True
        preparation={'core_documents':[uploaded['digest']],'fwpm_document':None,'confirmed':True}
        prepared=json.loads(call(admin,'/admin/programs/wi/prepare',{'term':'SoSe 2028','preparation':preparation}))
        assert not any(key.startswith('wi.handbook.') for key in prepared['catalog']['courses'])
        assert prepared['catalog']['catalog_mode']=='reviewed_code'
        assert prepared['catalog']['courses']['wi.course.algorithmen']['ects']==5
        catalog['semesters']['SoSe 2028']={'status':'published','preparation':preparation,'modules':prepared['modules'],'core_handbooks':prepared['core_handbooks']}
        save()
        dashboard=json.loads(call(anonymous,'/programs/wi/dashboard?start_term=WiSe%202026%2F27&term=SoSe%202028'))
        assert sum(m['required_ects'] for s in dashboard['stages'] for m in s['modules'])==210
        in2=next(m for s in dashboard['stages'] for m in s['modules'] if m['id']=='wi.req.vertiefung_in2')
        assert in2['course_options'][0]['id']=='wi.course.vs'
        assert in2['course_options'][0]['title']!='New teaching course'
        assert in2['required_ects']==5
        assert in2['course_options'][0]['details']['handbook']['url']!=uploaded['url']
        assert in2['course_options'][0]['details']['reference_handbook']['url']==uploaded['url']
        assert in2['course_options'][0]['details']['reference_handbook']['pages'] is None
        assert in2['course_options'][0]['details']['handbook']['pages']['start']!=3
        # Even a forged known-style course ID cannot be added via the admin API.
        invalid=copy.deepcopy(catalog)
        invalid['semesters']['SoSe 2028']['modules']['wi.handbook.unknown']={'offered':True}
        fails(422,admin,url,invalid,method='PUT')
        # Semester-scoped FWPM editor: administrator only, no curriculum mutation.
        proposal={'term':'WiSe 2028/29','preparation':{'core_documents':[],'fwpm_courses':[],'confirmed':False}}
        fails(403,student,'/admin/programs/wi/fwpm-proposal',proposal)
        fails(403,student,'/admin/programs/wi/fwpm-pdf?term=WiSe%202028%2F29',b'%PDF-test')
        candidate={'id':'wi.fwpm.custom.api','title':'New IW elective','short_title':'API','ects':5,'slots':['wi.req.fwpm2','wi.req.fwpm3'],'confirmed':True,'offered':True}
        prep={'core_documents':[],'fwpm_courses':[candidate],'confirmed':True}
        prepared=json.loads(call(admin,'/admin/programs/wi/prepare',{'term':'WiSe 2028/29','preparation':prep}))
        catalog['semesters']['WiSe 2028/29']={'status':'draft','preparation':prep,'modules':prepared['modules']}
        save()
        def fwpm_options():
            data=json.loads(call(anonymous,'/programs/wi/dashboard?start_term=WiSe%202023%2F24&term=WiSe%202028%2F29'))
            assert sum(m['required_ects'] for st in data['stages'] for m in st['modules'])==210
            return next(m for st in data['stages'] for m in st['modules'] if m['id']=='wi.req.fwpm2')['course_options']
        assert 'wi.fwpm.custom.api' not in {r['id'] for r in fwpm_options()}
        catalog['semesters']['WiSe 2028/29']['status']='published'
        save()
        assert fwpm_options()[0]['id']=='wi.fwpm.custom.api'
        copy_request={'term':'WiSe 2029/30','preparation':{'core_documents':[]}}
        copied=json.loads(call(admin,'/admin/programs/wi/fwpm-proposal?copy_from=WiSe%202028%2F29',copy_request))
        assert len(copied['courses'])==1 and not copied['courses'][0]['confirmed']
        assert copied['courses'][0]['source_term']=='WiSe 2028/29'
        assert 'meetings' not in copied['courses'][0]
        # Draft removal does not alter an existing published offer until publication.
        catalog['semesters']['WiSe 2028/29']={'status':'draft','preparation':{'core_documents':[],'fwpm_courses':[],'confirmed':True},'modules':{}}
        save()
        assert fwpm_options()[0]['id']=='wi.fwpm.custom.api'
        catalog['semesters']['WiSe 2028/29']['status']='published'
        save()
        assert fwpm_options()==[]
        token = next(iter(cookies)).value
        call(admin, '/auth/logout', {})
        fails(401, admin, '/auth/me')
        replay = urllib.request.Request(base + '/auth/me', headers={'Cookie': 'study_session=' + token})
        try:
            anonymous.open(replay); raise AssertionError('Logged-out session can be replayed')
        except urllib.error.HTTPError as error:
            assert error.code == 401
        print('PASS: login roles, session revocation, immutable rules, validated semester editor, drafts, publishing, exact terms, stale-write protection, immutable PDFs')
    finally:
        server.should_exit = True; thread.join(timeout=5)
