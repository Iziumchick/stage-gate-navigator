"""Only semester presentation data may be changed through administration."""
import re
from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.academic.programs.wi_program import WI_BSC_2023_PROGRAM
from app.services.elective_catalog import fwpm_ids
from app.services.semester_courses import actual_courses


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


def valid_url(value):
    if value and not (value.startswith(('https://', 'http://')) or re.fullmatch(r'/api/programs/wi/handbooks/[a-f0-9]{64}\.pdf', value) or value == '/api/programs/wi/handbook'):
        raise ValueError('Bitte eine vollständige http(s)-Adresse eingeben.')
    return value


class Pages(StrictModel):
    start: int = Field(ge=1)
    end: int | None = Field(default=None, ge=1)

    @model_validator(mode='after')
    def ordered(self):
        if self.end is not None and self.end < self.start:
            raise ValueError('Die letzte PDF-Seite darf nicht vor der ersten liegen.')
        return self


class Handbook(StrictModel):
    url: str | None = Field(default=None, max_length=2000)
    label: str = Field(default='Modulhandbuch', max_length=200)
    _url = field_validator('url')(valid_url)


class Meeting(StrictModel):
    weekday: int = Field(ge=1, le=7)
    start: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    end: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    room: str = Field(default='', max_length=200)
    group: str = Field(default='', max_length=100)
    teachers: list[str] = Field(default_factory=list, max_length=20)
    teacher_codes: list[str] = Field(default_factory=list, max_length=20)
    recurrence: Literal['weekly', 'unconfirmed'] = 'weekly'
    recurrence_note: str = Field(default='',max_length=500)
    dates: list[str] = Field(default_factory=list,max_length=200)

    @field_validator('dates')
    @classmethod
    def exact_dates(cls, values):
        for value in values:
            if date.fromisoformat(value).isoformat()!=value:raise ValueError('Ungültiges Termindatum.')
        return sorted(set(values))
    source_code: str = Field(default='',max_length=40)
    source_color: str = Field(default='',max_length=40)
    source_url: str = Field(default='',max_length=2000)
    source_group: str = Field(default='',max_length=80)
    source_teacher_codes: list[str] = Field(default_factory=list,max_length=20)
    teaching_type: Literal['lecture','exercise','tutorial','seminar','practical_or_seminar','unknown'] = 'unknown'
    type_source: Literal['directory','color','unknown'] = 'unknown'
    room_candidates: list[str] = Field(default_factory=list,max_length=20)
    room_assignment: Literal['source','unresolved'] = 'source'
    shared_with: list[str] = Field(default_factory=list,max_length=10)
    _source_url = field_validator('source_url')(valid_url)

    @model_validator(mode='after')
    def ordered(self):
        if self.end <= self.start:
            raise ValueError('Das Ende muss nach dem Beginn liegen.')
        return self


class DateRange(StrictModel):
    label: str = Field(default='', max_length=200)
    start: date
    end: date

    @model_validator(mode='after')
    def ordered(self):
        if self.end < self.start:
            raise ValueError('Das Enddatum darf nicht vor dem Beginn liegen.')
        return self


class SemesterCalendar(StrictModel):
    lectures: DateRange | None = None
    breaks: list[DateRange] = Field(default_factory=list, max_length=50)
    exam_registration: DateRange | None = None
    exams: DateRange | None = None
    source_url: str = Field(default='', max_length=2000)
    checked_on: date | None = None
    _url = field_validator('source_url')(valid_url)


class Course(StrictModel):
    offered: bool | None = None
    source_term: str | None = None
    elo: str = Field(default='', max_length=2000)
    webuntis: str = Field(default='', max_length=2000)
    schedule: str = Field(default='', max_length=20000)
    room: str = Field(default='', max_length=22000)
    handbook_pages: Pages | None = None
    meetings: list[Meeting] = Field(default_factory=list, max_length=100)
    handbook_kind: Literal['core', 'fwpm'] = 'core'
    handbook_excerpt: str = Field(default='', max_length=8000)
    handbook_edition: Literal['wi_bsc_2012', 'wi_bsc_2023', 'wi_bsc_2026'] = 'wi_bsc_2023'
    handbook_references: dict[Literal['wi_bsc_2012', 'wi_bsc_2023', 'wi_bsc_2026'], Pages | None] = Field(default_factory=dict)
    _urls = field_validator('elo', 'webuntis')(valid_url)

    @model_validator(mode='after')
    def summarize_meetings(self):
        if self.meetings:
            days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
            self.schedule = '; '.join(f'{days[m.weekday - 1]} {m.start}–{m.end}' + (f' ({m.group})' if m.group else '') for m in self.meetings)
            self.room = '; '.join(dict.fromkeys(m.room for m in self.meetings if m.room))
        return self


class ImportReport(StrictModel):
    status: Literal['ready', 'partial', 'unavailable', 'error']
    fetched_at: str
    source_urls: list[str] = Field(default_factory=list, max_length=10)
    found: int = 0
    missing: list[str] = Field(default_factory=list, max_length=200)
    warnings: list[str] = Field(default_factory=list, max_length=100)
    unmatched: list[str] = Field(default_factory=list, max_length=300)


class FwpmOffering(StrictModel):
    id: str = Field(pattern=r'^wi\.fwpm\.[a-z0-9_.-]{1,80}$')
    title: str = Field(min_length=1,max_length=250)
    short_title: str = Field(min_length=1,max_length=40)
    ects: Literal[5] = 5
    description_pdf: str | None = Field(default=None,max_length=2000)

    @field_validator('ects',mode='before')
    @classmethod
    def fixed_ects(cls,value):
        if value is None: return 5
        if value != 5: raise ValueError('FWPM-Teilmodule haben 5 ECTS.')
        return 5

    @field_validator('description_pdf')
    @classmethod
    def pdf_link(cls,value):
        if value and not re.fullmatch(r'/api/programs/wi/handbooks/[a-f0-9]{64}\.pdf',value):
            raise ValueError('Bitte ein Beschreibungs-PDF hochladen.')
        return value
    slots: list[Literal['wi.req.fwpm1','wi.req.fwpm2','wi.req.fwpm3']] = Field(default_factory=list,max_length=3)
    offered: bool = True
    confirmed: bool = False
    source_term: str | None = Field(default=None,max_length=40)
    source_url: str = Field(default='',max_length=2000)
    pages: Pages | None = None
    description: str = Field(default='',max_length=8000)
    _url = field_validator('source_url')(valid_url)

    @model_validator(mode='after')
    def complete(self):
        self.title=self.title.strip(); self.short_title=self.short_title.strip()
        if not self.title or not self.short_title: raise ValueError('Titel und Kurzbezeichnung fehlen.')
        self.slots=sorted(set(self.slots))
        if any(s in self.slots for s in ('wi.req.fwpm2','wi.req.fwpm3')):
            self.slots=sorted(set(self.slots+['wi.req.fwpm2','wi.req.fwpm3']))
        if self.confirmed and self.offered and (self.ects is None or not self.slots):
            raise ValueError('Vor Bestätigung bitte ECTS und FWPM-Zuordnung angeben.')
        return self


class Preparation(StrictModel):
    core_documents: list[str] = Field(default_factory=list, max_length=3)
    fwpm_document: str | None = None
    confirmed: bool = False
    fwpm_courses: list[FwpmOffering] | None = Field(default=None,max_length=150)

    @model_validator(mode='after')
    def unique_courses(self):
        from app.services.fwpm_semester import code_key
        rows=self.fwpm_courses or []
        if len({r.id for r in rows})!=len(rows) or len({code_key(r.short_title) for r in rows})!=len(rows):
            raise ValueError('FWPM-ID und Kurzbezeichnung müssen im Semester eindeutig sein.')
        if any(not code_key(r.short_title) for r in rows): raise ValueError('Kurzbezeichnung enthält kein erkennbares Kürzel.')
        return self


class Semester(StrictModel):
    status: Literal['draft', 'published'] = 'draft'
    handbook: Handbook = Field(default_factory=Handbook)
    fwpm_handbook: Handbook = Field(default_factory=lambda: Handbook(label='Modulhandbuch FWPM'))
    core_handbooks: dict[Literal['wi_bsc_2012', 'wi_bsc_2023', 'wi_bsc_2026'], Handbook] = Field(default_factory=dict)
    preparation: Preparation | None = None
    modules: dict[str, Course] = Field(default_factory=dict, max_length=200)
    calendar: SemesterCalendar = Field(default_factory=SemesterCalendar)
    imports: dict[Literal['dates', 'schedule', 'core_handbook', 'fwpm_handbook'], ImportReport] = Field(default_factory=dict)


class Catalog(StrictModel):
    program_id: Literal['wi_bsc_2023']
    revision: str
    semesters: dict[str, Semester] = Field(default_factory=dict, max_length=100)

    @model_validator(mode='after')
    def check_modules_and_terms(self):
        known = {r.id for r in WI_BSC_2023_PROGRAM.requirements if r.stage_id != 'gate'} | fwpm_ids() | set(actual_courses())
        for term, semester in self.semesters.items():
            semester_known = set(known)
            if semester.preparation:
                from app.services.handbook_catalog import semester_catalog, read_document
                selected=semester.preparation.model_dump()
                for digest in selected['core_documents']:
                    if read_document(digest)['kind']!='core': raise ValueError('Pflicht-Modulhandbuch erwartet.')
                if selected['fwpm_document'] and read_document(selected['fwpm_document'])['kind']!='fwpm':
                    raise ValueError('FWPM-Modulhandbuch erwartet.')
                semester_known.update(semester_catalog(selected,term)['courses'])
                semester_known.update(r['id'] for r in selected.get('fwpm_courses') or [])
                if semester.status=='published' and not selected['confirmed']:
                    raise ValueError('Die Modulhandbuch-Auswahl bitte zuerst bestätigen.')
            if not re.fullmatch(r'(SoSe 20\d{2}|WiSe 20\d{2}/\d{2})', term):
                raise ValueError('Semesterformat: SoSe 2027 oder WiSe 2026/27')
            if term.startswith('WiSe') and int(term[-2:]) != (int(term[5:9]) + 1) % 100:
                raise ValueError('Ungültiges Wintersemester')
            if not set(semester.modules).issubset(semester_known):
                raise ValueError('Unbekanntes Modul; Studienprogramme werden im Code verwaltet.')
            if any(course.source_term is not None and course.source_term != term for course in semester.modules.values()):
                raise ValueError('Stundenplandaten gehören zu einem anderen Semester.')
            if semester.status == 'published' and any(course.offered is None for course in semester.modules.values()):
                raise ValueError('Vor Veröffentlichung bitte das Semesterangebot aller erfassten Kurse prüfen.')
            year = int(term[5:9])
            first, last = (date(year, 10, 1), date(year + 1, 3, 14)) if term.startswith('WiSe') else (date(year, 3, 15), date(year, 9, 30))
            ranges = [semester.calendar.lectures, semester.calendar.exam_registration, semester.calendar.exams, *semester.calendar.breaks]
            for span in ranges:
                if span and not (first <= span.start <= span.end <= last):
                    raise ValueError(f'Termine müssen innerhalb von {term} liegen.')
        return self
