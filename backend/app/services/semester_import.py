"""Read-only source previews. Exact semester selection; no curriculum/rule mutations."""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from http.cookiejar import CookieJar
import re
import unicodedata
from zoneinfo import ZoneInfo
from urllib.parse import urljoin, urlparse
from urllib.request import Request, build_opener, HTTPCookieProcessor, HTTPRedirectHandler
from bs4 import BeautifulSoup
from icalendar import Calendar
from app.services.catalog_service import editor_catalog
from app.services.semester_courses import expected_schedule_ids, elective_options

BOSS = 'https://stpim.oth-regensburg.de'
DATES = 'https://www.oth-regensburg.de/die-oth/termine-und-oeffnungszeiten'


def term_info(term):
    if not re.fullmatch(r'(SoSe 20\d{2}|WiSe 20\d{2}/\d{2})', term):
        raise ValueError('Semesterformat: SoSe 2027 oder WiSe 2026/27')
    year = int(term[5:9])
    winter = term.startswith('WiSe')
    if winter and int(term[-2:]) != (year + 1) % 100:
        raise ValueError('Ungültiges Wintersemester')
    return (str(year) + str(year + 1) if winter else str(year),
            f'WS {year % 100:02}/{(year + 1) % 100:02}' if winter else f'SS {year % 100:02}',
            date(year, 10, 1) if winter else date(year, 3, 15),
            date(year + 1, 3, 14) if winter else date(year, 9, 30))


class SameHostRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlparse(newurl).netloc != urlparse(req.full_url).netloc or urlparse(newurl).scheme != 'https':
            raise ValueError('Unerwartete Weiterleitung der Quelle.')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class SourceClient:
    def __init__(self):
        self.opener = build_opener(HTTPCookieProcessor(CookieJar()), SameHostRedirect())

    def get(self, url, referer=None):
        parsed = urlparse(url)
        if parsed.scheme != 'https' or parsed.netloc not in ('stpim.oth-regensburg.de', 'www.oth-regensburg.de'):
            raise ValueError('Unzulässige Quellenadresse.')
        headers = {'User-Agent': 'StudyNavigator/1.0 (semester source import)'}
        if referer:
            headers['Referer'] = referer
        with self.opener.open(Request(url, headers=headers), timeout=12) as response:
            data = response.read(4 * 1024 * 1024 + 1)
        if len(data) > 4 * 1024 * 1024:
            raise ValueError('Die Quelle ist zu groß.')
        return data


def report(status='unavailable', urls=()):
    return {'status': status, 'fetched_at': datetime.now(timezone.utc).isoformat(), 'source_urls': list(urls), 'found': 0, 'missing': [], 'warnings': [], 'unmatched': []}


def norm(value):
    return re.sub(r'[^\w]', '', unicodedata.normalize('NFKC', value).casefold())


def code_map(modules):
    grouped = defaultdict(list)
    for key, module in modules.items():
        grouped[norm(module['short_title'])].append(key)
    mapping = {code: keys[0] for code, keys in grouped.items() if len(keys) == 1}
    mapping.pop(norm('BS'), None)  # Bachelorseminar in IM; never guess Betriebssysteme.
    actual = defaultdict(set)
    for key, module in modules.items():
        for code in module.get('aliases', []):
            actual[norm(code)].add(key)
    for code, keys in actual.items():
        if len(keys) == 1:
            mapping[code] = next(iter(keys))
    # Faculty abbreviations differ from the transcript/program abbreviations.
    for code, key in {'WI': 'gwi', 'BW1': 'bwl1', 'BW2': 'bwl2', 'ST': 'statistik', 'IA': 'it_architektur', 'OS': 'betriebssysteme'}.items():
        if norm(code) not in mapping and 'wi.req.' + key in modules:
            mapping[norm(code)] = 'wi.req.' + key
    return mapping


def parse_teachers(html, label):
    soup = BeautifulSoup(html, 'html.parser')
    if not any(label in h.get_text(' ', strip=True) for h in soup.find_all('h1')):
        return {}
    result = {}
    for row in soup.select('table tr'):
        cells = row.find_all('td', recursive=False)
        if len(cells) == 3:
            code, last, first = [cell.get_text(' ', strip=True) for cell in cells]
            if code in result:
                result[code] = code  # Ambiguous source rows must not be guessed.
            else:
                result[code] = 'Tutor' if code == 'TT' else f'{first} {last}'.strip()
    return result


def lecture_details(html, label, teachers):
    """Explicit group numbers and teaching types from the selected-term directory."""
    soup=BeautifulSoup(html,'html.parser')
    if not any(label in h.get_text(' ',strip=True) for h in soup.find_all('h1')): return []
    result=[]
    for row in soup.select('table tr'):
        cells=row.find_all('td',recursive=False)
        if len(cells)<5: continue
        subject=re.fullmatch(r'([A-Z][A-Z0-9]+)\s*\(([^()]+)\)',cells[2].get_text(' ',strip=True))
        if not subject: continue  # Aggregated rows do not establish a person/group pairing.
        person=cells[3].get_text(' ',strip=True)
        parts=person.split(',')
        person_key=norm(' '.join(reversed(parts))) if len(parts)==2 else norm(person)
        codes=[code for code,name in teachers.items() if norm(name)==person_key]
        if len(codes)!=1: continue
        text=cells[4].get_text(' ',strip=True).casefold()
        kind='exercise' if 'übung' in text else 'tutorial' if 'tutor' in text else 'lecture' if 'vorlesung' in text or 'seminaristischer' in text else 'seminar' if 'seminar' in text else 'unknown'
        result.append({'code':subject[1],'groups':re.findall(r'\b(?:IW|IT|IM|KI|ICS|I)\d+\b',cells[0].get_text(' ',strip=True)),
                       'source_group':cells[1].get_text(' ',strip=True),'teacher':codes[0],'teaching_type':kind})
    return result


def classify_meeting(meeting, details):
    """Course-wide format and colors do not prove the type of a concrete slot."""
    return 'unknown', 'unknown'


def meeting_variants(meeting, group, details):
    """Split documented parallel teaching groups, never guess room/person pairs."""
    applicable=[d for d in details if d['code']==meeting['source_code'] and group in d['groups'] and d['teacher'] in meeting['teacher_codes']]
    numbered={code:{d['source_group'] for d in applicable if d['teacher']==code and d['source_group']} for code in meeting['teacher_codes']}
    split=len(numbered)>1 and all(len(ids)==1 for ids in numbered.values()) and len({next(iter(ids)) for ids in numbered.values()})==len(numbered)
    variants=[]
    for index,code in enumerate(meeting['teacher_codes'] if split else [None]):
        value={**meeting}
        matching=[d for d in applicable if code is None or d['teacher']==code]
        ids={d['source_group'] for d in matching if d['source_group']}
        value['source_group']=next(iter(ids)) if len(ids)==1 else ''
        value['teaching_type'],value['type_source']=classify_meeting(value,matching)
        value['source_teacher_codes']=meeting['teacher_codes']
        value['room_candidates']=[]
        value['room_assignment']='source'
        if split:
            value['teacher_codes']=[code]
            value['teachers']=[meeting['teachers'][index]]
        rooms=[r.strip() for r in meeting['room'].split(',') if r.strip()]
        if len(rooms)>1 and len(meeting['teacher_codes'])>1:
            value['room']=''
            value['room_candidates']=rooms
            value['room_assignment']='unresolved'
        variants.append(value)
    return variants


def parse_timetable(html, label, teachers, modules, block_codes=(), source_aliases=None, group_prefix='IW', source_url='', details=()):
    soup = BeautifulSoup(html, 'html.parser')
    mapping = code_map(modules)
    mapping.update({code:key for code,key in (source_aliases or {}).items() if key in modules})
    from app.services.handbook_catalog import schedule_rules
    rules=schedule_rules()
    for code,key in rules['aliases'].items():
        if key in modules: mapping[norm(code)]=key
    for code,keys in rules['shared_events'].items():
        targets=[key for key in keys if key in modules]
        if targets: mapping[norm(code)]=targets
    result, unmatched, unknown_teachers = defaultdict(list), set(), set()
    sections = [h for h in soup.find_all('h2') if re.fullmatch(re.escape(group_prefix)+r'\d+\s*[—–-]\s*' + re.escape(label), h.get_text(' ', strip=True))]
    for heading in sections:
        group = re.split(r'\s*[—–-]\s*',heading.get_text(' ', strip=True),maxsplit=1)[0]
        group_aliases={norm(code):key for code,key in rules.get('group_aliases',{}).get(group,{}).items() if key in modules}
        table = heading.find_next_sibling('table')
        if not table:
            continue
        for row in table.find_all('tr'):
            if row.find_parent('table') is not table:
                continue
            cells = row.find_all('td', recursive=False)
            if len(cells) != 7:
                continue
            times = re.fullmatch(r'(\d{2}:\d{2})-(\d{2}:\d{2})', cells[0].get_text(strip=True))
            if not times:
                continue
            for weekday, cell in enumerate(cells[1:], 1):
                for entry in cell.select('table td'):
                    spans = entry.find_all('span', recursive=False)
                    code = next((str(node).strip() for node in entry.children if isinstance(node, str) and str(node).strip()), '')
                    if not code or len(spans) < 2:
                        continue
                    base = code.removesuffix('/w').removesuffix('/T')
                    target = group_aliases.get(norm(base),mapping.get(norm(base)))
                    if not target:
                        unmatched.add(code)
                        continue
                    targets=target if isinstance(target,list) else [target]
                    codes = [c.strip() for c in spans[1].get_text(strip=True).split(',') if c.strip()]
                    unknown_teachers.update(c for c in codes if c not in teachers)
                    note = entry.find('div', recursive=False)
                    note = note.get_text(' ', strip=True) if note else ''
                    meeting = {'weekday': weekday, 'start': times[1], 'end': times[2], 'room': spans[0].get_text(' ', strip=True),
                               'group': ' · '.join(v for v in (group, code if code != base else '', note) if v)[:100],
                               'teachers': [teachers.get(c, c) for c in codes], 'teacher_codes': codes,
                               'recurrence': 'unconfirmed' if note or base in rules.get('unconfirmed_codes',[]) else 'weekly'}
                    if meeting['recurrence']=='unconfirmed':
                        meeting['recurrence_note']=note[:500] if note else 'Im BOSS-Verzeichnis sind Blocktermine für dieses Modul hinterlegt; der Rhythmus dieses Rasters ist nicht bestätigt.'
                    color=re.search(r'background-color:\s*([^;]+)',entry.get('style',''),re.I)
                    meeting.update(source_code=base,source_color=color[1].strip().lower() if color else '',source_url=source_url,
                                   shared_with=targets if isinstance(target,list) else [])
                    for variant in meeting_variants(meeting,group,details):
                        for key in targets:
                            if variant not in result[key]: result[key].append(variant.copy())
    return dict(result), sorted(unmatched), sorted(unknown_teachers), len(sections)


def import_schedule(term, client=None, modules_override=None):
    client = client or SourceClient()
    term_id, label, _, _ = term_info(term)
    url = BOSS + '/public/classes/IW'
    info = report(urls=[url, BOSS + '/public/teachers', BOSS + '/public/lecturesbyterm'])
    index = BeautifulSoup(client.get(url), 'html.parser')
    if not index.find('a', href='/switchterm/' + term_id):
        info['warnings'].append(f'{term}: noch nicht in B.O.S.S. veröffentlicht. Es wurde kein anderes Semester verwendet.')
        return {'report': info, 'modules': {}}
    client.get(BOSS + '/switchterm/' + term_id, referer=url)
    html = client.get(url)
    teachers = parse_teachers(client.get(BOSS + '/public/teachers'), label)
    directory_html=client.get(BOSS + '/public/lecturesbyterm')
    lectures = BeautifulSoup(directory_html, 'html.parser')
    details=lecture_details(directory_html,label,teachers)
    block_codes = set()
    if any(label in h.get_text(' ', strip=True) for h in lectures.find_all('h1')):
        for cell in lectures.find_all('td', string=re.compile(r'^Blocks:$')):
            row = cell.find_parent('tr').find_previous_sibling('tr')
            while row and not re.search(r'\b[A-Z][A-Z0-9]+\s*\(', row.get_text(' ', strip=True)):
                row = row.find_previous_sibling('tr')
            if row:
                block_codes.update(re.findall(r'\b([A-Z][A-Z0-9]+)\s*\(', row.get_text(' ', strip=True)))
    available = editor_catalog()['modules']
    elective_ids = {c['id'] for slot in ('fwpm1','fwpm2','fwpm3') for c in elective_options('wi.req.'+slot,term)}
    modules = modules_override if modules_override is not None else {key: m for key,m in available.items() if m['kind']=='course' or key in elective_ids}
    # Exact full names in the selected-semester lecture directory can resolve a
    # different abbreviation. No fuzzy, substring or cross-semester matching.
    directory=defaultdict(set)
    directory_groups=defaultdict(set)
    if any(label in h.get_text(' ', strip=True) for h in lectures.find_all('h1')):
        for cell in lectures.find_all('td'):
            match=re.fullmatch(r'([A-Z][A-Z0-9]+)\s*\(([^()]+)\)',cell.get_text(' ',strip=True))
            if match:
                directory[match[1]].add(match[2])
                cells=cell.find_parent('tr').find_all('td',recursive=False)
                if cells: directory_groups[match[1]].update(re.findall(r'\b(?:I|IT|IM|IW|KI|ICS)\d+\b',cells[0].get_text(' ',strip=True)))
    titles=defaultdict(set)
    for key,m in modules.items(): titles[norm(m['title'])].add(key)
    aliases={}
    for code,names in directory.items():
        matches=set().union(*(titles.get(norm(name),set()) for name in names))
        if len(names)==len(matches)==1 and norm(code) not in code_map(modules): aliases[norm(code)]=next(iter(matches))
    meetings, unmatched, unknown, sections = parse_timetable(html, label, teachers, modules, block_codes, aliases, source_url=url, details=details)
    from app.services.boss_calendar import directory_blocks, apply_blocks
    blocks=directory_blocks(directory_html,label,teachers)
    meetings={key:apply_blocks(items,blocks) for key,items in meetings.items()}
    if not sections:
        info['warnings'].append(f'Kein Stundenplan mit eindeutigem Semester {label} gefunden. Bestehende Daten bleiben erhalten.')
        return {'report': info, 'modules': {}}
    # Opened-for IW electives may be scheduled only in their hosting study program.
    # Fetch only host plans needed by selected, still unmatched FWPM courses.
    from app.services.handbook_catalog import schedule_rules
    host_rules=schedule_rules()['fwpm_host_plans']
    external=defaultdict(dict)
    for key,m in modules.items():
        if not key.startswith('wi.fwpm.') or key in meetings: continue
        codes={m['short_title'],*m.get('aliases',[])}
        declared=set().union(*(directory_groups.get(code,set()) for code in codes))
        hosts={re.sub(r'\d+$','',g) for g in declared}-{ 'IW' }
        chosen=[host_rules[key]] if key in host_rules else sorted(hosts & {'I','IT','IM','KI','ICS'})
        for host in chosen: external[host][key]=m
    for host,candidates in external.items():
        host_url=BOSS+'/public/classes/'+host
        try:
            host_html=client.get(host_url)
            found,_,unknown_host,host_sections=parse_timetable(host_html,label,teachers,candidates,block_codes,aliases,host,host_url,details)
            # Aliases supplied by the full catalog must not introduce unrelated course IDs.
            found={key:apply_blocks(items,blocks) for key,items in found.items() if key in candidates}
            if host_sections:
                for key,items in found.items():
                    if key not in meetings: meetings[key]=items
                unknown=sorted(set(unknown+unknown_host))
                if len(info['source_urls'])<10: info['source_urls'].append(host_url)
        except Exception:
            info['warnings'].append(f'{host}-Stundenplan nicht erreichbar; vorhandene IW-Termine bleiben erhalten.')
    info['found'] = len(meetings)
    info['unmatched'] = [code + (' · ' + ' / '.join(sorted(directory[code])) if code in directory else '') for code in unmatched]
    expected = set(modules) if modules_override is not None else expected_schedule_ids(term)
    info['missing'] = [(m['title'] if not m['short_title'] or m['short_title']==m['title'] else m['short_title']+' · '+m['title']) if modules_override is not None else m['short_title'] for key, m in modules.items() if key not in meetings and key in expected]
    info['warnings'].append('FWPM-Termine können aus dem anbietenden Studiengang stammen. Gruppen und Lehrende vor persönlicher Planung prüfen.')
    shared=sorted({m['source_code'] for items in meetings.values() for m in items if m.get('shared_with')})
    if shared:
        info['warnings'].append('Gemeinsamer Stundenplan je Modul: '+', '.join(shared)+'.')
    info['warnings'].append('AW und FWPM-Platzhalter haben keinen eigenen Stundenplan. Gesucht werden reale IW-Disziplinen; ein fehlender Treffer bedeutet keine Absage. AW-Zeiten sind in dieser IM-Quelle nicht vollständig enthalten.')
    if unknown:
        info['warnings'].append('Lehrendenkürzel ohne eindeutigen Namen: ' + ', '.join(unknown))
    uncertain = sorted({modules[key]['short_title'] for key, items in meetings.items() if any(m['recurrence'] == 'unconfirmed' for m in items)})
    if uncertain:
        info['warnings'].append('Blocktermine / wechselnde Wochen separat prüfen: ' + ', '.join(uncertain))
    if not meetings:
        info['warnings'].append('Semester auswählbar, aber noch keine zuordenbaren Termine veröffentlicht.')
    info['status'] = 'partial' if meetings else 'unavailable'
    return {'report': info, 'modules': {key: {'offered': True, 'source_term': term, 'meetings': items} for key, items in meetings.items()}}


def parse_calendar(data, term, source_url):
    _, _, first, last = term_info(term)
    calendar = Calendar.from_ical(data)
    fields, breaks = defaultdict(list), []
    for event in calendar.walk('VEVENT'):
        if not event.get('DTSTART'):
            continue
        start = event.decoded('DTSTART')
        end = event.decoded('DTEND') if event.get('DTEND') else start
        # RFC 5545 all-day DTEND is exclusive; OTH timed 23:59:59 is inclusive.
        if isinstance(start, datetime):
            local_date = lambda value: (value.astimezone(ZoneInfo('Europe/Berlin')) if value.tzinfo else value).date()
            start, end = local_date(start), local_date(end) if isinstance(end, datetime) else end
        elif end > start:
            end -= timedelta(days=1)
        if not (first <= start <= end <= last):
            continue
        title = str(event.get('SUMMARY', ''))
        span = {'label': title[:200], 'start': start.isoformat(), 'end': end.isoformat()}
        text = title.casefold()
        if 'beginn' in text and ('lehrveranstaltung' in text or 'vorlesung' in text): fields['begin'].append(span)
        if 'ende' in text and ('lehrveranstaltung' in text or 'vorlesung' in text): fields['end'].append(span)
        if ('keine lehrveranstaltung' in text or 'vorlesungsfrei' in text) and span not in breaks: breaks.append(span)
        if 'prüfungsanmeldung' in text: fields['exam_registration'].append(span)
        if 'semesterprüfungszeitraum' in text: fields['exams'].append(span)
    result = {'breaks': breaks, 'source_url': source_url, 'checked_on': date.today().isoformat()}
    if len(fields['begin']) == len(fields['end']) == 1:
        result['lectures'] = {'label': 'Vorlesungszeit', 'start': fields['begin'][0]['start'], 'end': fields['end'][0]['end']}
    for key in ('exam_registration', 'exams'):
        if len(fields[key]) == 1:
            result[key] = fields[key][0]
    return result


def import_dates(term, client=None):
    client = client or SourceClient()
    term_info(term)
    info = report(urls=[DATES])
    soup = BeautifulSoup(client.get(DATES), 'html.parser')
    prefix = ('WiSe' if term.startswith('WiSe') else 'SoSe') + term[5:9]
    links = sorted({urljoin(DATES, a['href']) for a in soup.find_all('a', href=True) if re.search(r'/' + prefix + r'[_-][^/]*\.ics$', a['href'], re.I)})
    if len(links) != 1:
        info['warnings'].append(f'Kein eindeutiger offizieller ICS-Terminplan für {term} veröffentlicht. Keine Termine aus anderen Semestern übernommen.')
        return {'report': info, 'calendar': None}
    info['source_urls'].append(links[0])
    calendar = parse_calendar(client.get(links[0]), term, links[0])
    info['missing'] = [label for key, label in [('lectures', 'Vorlesungszeit'), ('exam_registration', 'Prüfungsanmeldung'), ('exams', 'Prüfungszeitraum')] if not calendar.get(key)]
    if not calendar['breaks']:
        info['missing'].append('Vorlesungsfreie Zeiten')
    info['found'] = 3 - len([key for key in ('lectures', 'exam_registration', 'exams') if not calendar.get(key)]) + len(calendar['breaks'])
    info['status'] = ('partial' if info['missing'] else 'ready') if info['found'] else 'unavailable'
    if not info['found']:
        info['warnings'].append('Die Datei enthält keine eindeutig zuordenbaren Termine im gewählten Semester.')
    return {'report': info, 'calendar': calendar if info['found'] else None}


def import_handbook(data, kind):
    import pymupdf
    modules = {key: m for key, m in editor_catalog()['modules'].items() if (m['kind'] == 'elective') == (kind == 'fwpm')}
    info = report()
    matches, ambiguous = defaultdict(set), []
    with pymupdf.open(stream=data, filetype='pdf') as doc:
        if doc.is_encrypted or doc.page_count > 1500:
            raise ValueError('PDF geschützt oder zu umfangreich.')
        titles = {key: {norm(m['title']), norm(m['short_title'] + m['title'])} for key, m in modules.items()}
        candidates = [(title, page) for _, title, page in doc.get_toc() if 1 <= page <= len(doc)]
        # No printed TOC page offsets are guessed. Only actual PDF bookmarks or
        # exact standalone headings on content pages are used.
        for page in doc:
            text = page.get_text()
            if re.search(r'Inhaltsverzeichnis|Modulliste|Table of Contents|Modulübersicht|FWPM\s*\n.*IW', text, re.I) or len(re.findall(r'\.{3,}\s*\d+', text)) > 2:
                continue
            for line in text.splitlines()[:14]:
                candidates.append((re.sub(r'^(?:Modul(?:name)?|Module)\s*:\s*', '', line.strip(), flags=re.I), page.number + 1))
        for title, page in candidates:
            for key, aliases in titles.items():
                if norm(title) in aliases:
                    matches[key].add(page)
        patches = {}
        for key, pages in matches.items():
            # Repeated FWPM slot descriptions use the same actual course. Keep
            # the earliest exact heading; all duplicate positions are reported.
            start = min(pages)
            if len(pages) > 1: ambiguous.append(f"{modules[key]['short_title']}: PDF-Seiten {', '.join(map(str, sorted(pages)))}; erste Fundstelle vorgeschlagen")
            patches[key] = {'handbook_kind': kind, 'handbook_pages': {'start': start}, 'handbook_excerpt': doc[start - 1].get_text()[:8000]}
    info['found'] = len(patches)
    info['missing'] = [m['short_title'] for key, m in modules.items() if key not in patches]
    info['warnings'] = ambiguous
    info['warnings'].append('PDF-Version und Zuordnung zum Semester prüfen. Seiten sind PDF-Positionen; ECTS und Zulassungsregeln werden nicht verändert.')
    info['status'] = ('partial' if info['missing'] or ambiguous else 'ready') if patches else 'unavailable'
    if not patches: info['warnings'].append('Keine eindeutigen Modulüberschriften / PDF-Lesezeichen erkannt. Seiten können manuell ergänzt werden; ein bloßes Inhaltsverzeichnis genügt nicht.')
    return {'report': info, 'modules': patches}
