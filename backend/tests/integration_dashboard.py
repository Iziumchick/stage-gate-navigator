"""HTTP integration check with a synthetic PDF and a disposable SQLite database.
Run in the backend Docker image with DATABASE_URL pointing at /tmp.
"""
import json
import http.cookiejar
import socket
import threading
import time
import urllib.error
import urllib.request

import pymupdf as fitz
import uvicorn
from app.main import app
from leistungen_pdf_fixture import pdf_export

sock = socket.socket()
sock.bind(('127.0.0.1', 0))
port = sock.getsockname()[1]
server = uvicorn.Server(uvicorn.Config(app, log_level='warning'))
thread = threading.Thread(target=server.run, kwargs={'sockets': [sock]}, daemon=True)
thread.start()
for _ in range(100):
    if server.started:
        break
    time.sleep(0.05)
assert server.started
base = f'http://127.0.0.1:{port}'


opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def get(path):
    with opener.open(base + path) as response:
        return json.load(response)


try:
    registration = urllib.request.Request(base + '/auth/register', data=json.dumps({'email': 'first@example.org', 'name': 'First', 'privacy_accepted': True, 'password': 'integration-password-123'}).encode(), headers={'Content-Type': 'application/json', 'X-Requested-With': 'StudyNavigator'})
    with opener.open(registration) as response:
        assert json.load(response)['role'] == 'student'
    for scenario in ('open', 'practice', 'thesis'):
        sample=get(f'/programs/wi/examples/{scenario}?start_term=SoSe%202021&term=WiSe%202026%2F27')
        assert sample['example_scenario']==scenario and sample['import_id'] is None
        assert sum(m['required_ects'] for stage in sample['stages'] for m in stage['modules'])==210
    for scenario,start,edition in [('first','WiSe 2026/27','wi_bsc_2026'),('practice','WiSe 2024/25','wi_bsc_2023'),('thesis','SoSe 2021','wi_bsc_2012')]:
        sample=get(f'/programs/wi/examples/{scenario}?term=WiSe%202026%2F27')
        assert sample['example_start_term']==start and sample['curriculum_edition']==edition
    assert get('/imports')==[], 'Read-only examples created student imports'
    document = fitz.open()
    page = document.new_page()
    lines = [
        ('Studiengang:', False), ('Wirtschaftsinformatik', False),
        ('Vorläufige Gesamtleistung: 2,7 / 7 Credits', False),
        ('Module und Modulgruppen', True), ('Mathematik 1', True),
        ('7', False), ('7', False), ('befriedigend', False), ('2,7', False),
        ('Stand 27.09.2026', False),
    ]
    for i, (text, bold) in enumerate(lines):
        page.insert_text((50, 50 + 24 * i), text, fontname='hebo' if bold else 'helv')
    old_pdf = document.tobytes()
    pdf = pdf_export()
    document.close()
    boundary = 'stage-gate-test-boundary'
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode() + pdf + f'\r\n--{boundary}--\r\n'.encode())
    invalid_body = body.replace(pdf,old_pdf)
    wrong = urllib.request.Request(base + '/imports/upload', data=invalid_body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'X-Requested-With': 'StudyNavigator'})
    try:
        opener.open(wrong)
        raise AssertionError('Notenbestätigung accepted as Leistungen')
    except urllib.error.HTTPError as error:
        assert error.code == 422
        assert 'Leistungen' in error.read().decode()
    assert get('/imports') == [], 'Rejected export saved an import'
    request = urllib.request.Request(base + '/imports/upload', data=body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'X-Requested-With': 'StudyNavigator'})
    with opener.open(request) as response:
        imported = json.load(response)
    result = get(f'/imports/{imported["import_id"]}/dashboard')
    assert result['official_credits'] == 7, result
    assert result['official_grade'] == 2.7, result
    math = next(m for stage in result['stages'] for m in stage['modules'] if m['id'] == 'wi.req.ma1')
    assert math['status'] == 'passed', math
    assert math['source']['requirement_title'] == 'Mathematik 1'
    assert len(math['exam_history']) == 2
    assert math['exam_history'][1]['attempt'] == 2
    assert result['import_report']['open_exam_count'] == 0
    achievements = get(f'/imports/{imported["import_id"]}/achievements')
    assert len(achievements)==1 and achievements[0]['attempt'] is None
    assert get(f'/imports/{imported["import_id"]}/evaluation')['evaluation']
    try:
        get('/imports/999999/dashboard')
        raise AssertionError('Expected 404')
    except urllib.error.HTTPError as error:
        assert error.code == 404
    other = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    registration.data = json.dumps({'email': 'second@example.org', 'name': 'Second', 'privacy_accepted': True, 'password': 'integration-password-123'}).encode()
    with other.open(registration) as response:
        assert json.load(response)['role'] == 'student'
    with other.open(base + '/imports') as response:
        assert json.load(response) == []
    for suffix in ('dashboard', 'raw-lines', 'evaluation', 'achievements', 'summary'):
        try:
            other.open(base + f'/imports/{imported["import_id"]}/{suffix}')
            raise AssertionError('Another student can access the PDF')
        except urllib.error.HTTPError as error:
            assert error.code == 404
    other_upload = urllib.request.Request(base + '/imports/upload', data=body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'X-Requested-With': 'StudyNavigator'})
    with other.open(other_upload) as response:
        assert json.load(response)['import_id'] != imported['import_id']
    forced = urllib.request.Request(base + '/imports/upload?force=true', data=body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'X-Requested-With': 'StudyNavigator'})
    with opener.open(forced) as response:
        assert json.load(response)['import_id']==imported['import_id']
    print('PASS: owner-scoped imports, independent same-PDF uploads and re-import; bounded Leistungen parsing and structured-only dashboard')
finally:
    server.should_exit = True
    thread.join(timeout=5)
