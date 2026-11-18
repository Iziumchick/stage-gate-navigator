"""Role-protected editing of semester data; curriculum and rules are immutable."""
import hashlib
import json
import os
import re
import threading
from pathlib import Path
from tempfile import NamedTemporaryFile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from app.services.auth_service import require_admin
from app.services.catalog_schema import Catalog, Preparation
from app.services.handbook_catalog import reference_document, document_summary, semester_catalog, read_document, stored_path
from app.services.catalog_service import catalog_path, editor_catalog, revision, published_semesters
from app.services.catalog_schema import StrictModel
from app.services.semester_import import term_info, import_dates, import_schedule, report

router = APIRouter()
_write_lock = threading.Lock()


class SourceImportRequest(StrictModel):
    term: str
    preparation: Preparation | None = None


@router.post('/admin/programs/wi/import/{kind}', dependencies=[Depends(require_admin)])
def preview_source_import(kind: str, value: SourceImportRequest):
    try:
        term_info(value.term)
    except ValueError as error:
        raise HTTPException(422, str(error))
    if kind not in ('dates', 'schedule'):
        raise HTTPException(404, 'Unbekannte Quelle.')
    try:
        course_catalog=semester_catalog(value.preparation.model_dump(),value.term)['courses'] if value.preparation else None
        result = import_dates(value.term) if kind == 'dates' else import_schedule(value.term, modules_override=course_catalog)
        return {**result, 'term': value.term}
    except Exception:
        info = report('error')
        info['warnings'] = ['Quelle nicht erreichbar oder Format geändert. Vorhandene Daten bleiben erhalten. Bitte später erneut versuchen.']
        return {'term': value.term, 'report': info, 'modules': {}, 'calendar': None}


class PreparationRequest(StrictModel):
    term: str
    preparation: Preparation


@router.post('/admin/programs/wi/prepare', dependencies=[Depends(require_admin)])
def prepare_semester(value: PreparationRequest):
    try:
        term_info(value.term)
        selection=value.preparation.model_dump()
        if not selection['core_documents']:
            from app.services.handbook_catalog import bundled_documents
            core=[d for d in bundled_documents() if d['kind']=='core']
            selection['core_documents']=[max(core,key=lambda d:d['edition_id'])['digest']]
        books=[read_document(d) for d in selection['core_documents']]
        if any(d['kind']!='core' for d in books): raise ValueError('Pflicht-Modulhandbuch erwartet.')
        catalog=semester_catalog(selection,value.term)
        core_books={d['edition_id']:{'url':d['url'],'label':f"Modulhandbuch · {d['term']} · Stand {d['created_on'] or 'unbekannt'}"} for d in books}
        fwpm=read_document(selection['fwpm_document']) if selection['fwpm_document'] else None
        if fwpm and fwpm['kind']!='fwpm': raise ValueError('FWPM-Modulhandbuch erwartet.')
        modules={}
        for key,c in catalog['courses'].items():
            modules[key]={'offered':True,'handbook_kind':'fwpm' if c['kind']=='elective' else 'core',
                          'handbook_pages':c['pages'], 'handbook_edition':c['edition_id'] or 'wi_bsc_2023',
                          'handbook_references':{e:r['pages'] for e,r in c['references'].items()},'handbook_excerpt':c['description']}
        return {'term':value.term,'catalog':catalog,'modules':modules,'core_handbooks':core_books,
                'handbook':core_books.get('wi_bsc_2023',{'url':None,'label':'Modulhandbuch'}),
                'fwpm_handbook':{'url':fwpm['url'],'label':f"FWPM · {fwpm['term']} · Stand {fwpm['created_on'] or 'unbekannt'}"} if fwpm and fwpm['term']==value.term else {'url':None,'label':'FWPM: aktuelle Quelle fehlt'}}
    except ValueError as error:
        raise HTTPException(422,str(error))


def atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary.write(data)
        temporary_path = temporary.name
    try:
        os.replace(temporary_path, path)
    finally:
        if os.path.exists(temporary_path):
            os.unlink(temporary_path)


@router.get('/programs/wi/catalog', dependencies=[Depends(require_admin)])
def read_catalog():
    return editor_catalog()


@router.put('/admin/programs/wi/catalog', dependencies=[Depends(require_admin)])
def update_catalog(value: Catalog):
    with _write_lock:
        if value.revision != revision():
            raise HTTPException(409, 'Der Katalog wurde inzwischen geändert. Bitte neu laden.')
        saved = catalog_path()
        if saved.exists() and 'semesters' not in json.loads(saved.read_text()):
            atomic_write(saved.with_suffix('.legacy.json'), saved.read_bytes())
        data = value.model_dump(mode='json')
        published = published_semesters()
        for term, semester in data['semesters'].items():
            if semester['status'] == 'published':
                published[term] = semester
        data['published_semesters'] = published
        atomic_write(saved, (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode())
        return {'saved': True, 'revision': revision()}


@router.post('/admin/programs/wi/fwpm-proposal', dependencies=[Depends(require_admin)])
def fwpm_proposal(value: PreparationRequest, copy_from: str | None = None):
    try:
        term_info(value.term)
        from app.services.fwpm_semester import default_proposal, copy_proposal, automatic_proposal
        if copy_from:
            term_info(copy_from)
            if copy_from.startswith('SoSe') != value.term.startswith('SoSe'):
                raise ValueError('Bitte ein Semester derselben Jahreszeit auswählen.')
            if term_info(copy_from)[2]>=term_info(value.term)[2]: raise ValueError('Nur aus einem früheren Semester kopieren.')
            previous=editor_catalog()['semesters'].get(copy_from,{})
            rows=(previous.get('preparation') or {}).get('fwpm_courses')
            if rows is None: rows=default_proposal(copy_from)
            rows=copy_proposal(rows,copy_from)
        else:
            rows,source=automatic_proposal(value.term,editor_catalog()['semesters'])
            return {'term':value.term,'courses':rows,'source_term':source}
        return {'term':value.term,'courses':rows,'source_term':copy_from}
    except ValueError as error: raise HTTPException(422,str(error))


@router.post('/admin/programs/wi/fwpm-description', dependencies=[Depends(require_admin)])
def fwpm_description(file: UploadFile = File(...)):
    data=file.file.read(10*1024*1024+1); file.file.close()
    if len(data)>10*1024*1024 or not data.startswith(b'%PDF-'):
        raise HTTPException(400,'Bitte eine PDF bis 10 MB auswählen.')
    try:
        import pymupdf
        with pymupdf.open(stream=data,filetype='pdf') as document:
            if document.is_encrypted or not len(document) or len(document)>1500:
                raise ValueError('PDF geschützt oder zu umfangreich.')
    except Exception:
        raise HTTPException(422,'Bitte eine lesbare, ungeschützte PDF auswählen.')
    digest=hashlib.sha256(data).hexdigest()
    atomic_write(catalog_path().parent/'handbooks'/(digest+'.pdf'),data)
    return {'url':f'/api/programs/wi/handbooks/{digest}.pdf'}


@router.post('/admin/programs/wi/fwpm-pdf', dependencies=[Depends(require_admin)])
def fwpm_pdf(term: str, file: UploadFile = File(...)):
    data=file.file.read(10*1024*1024+1); file.file.close()
    if len(data)>10*1024*1024 or not data.startswith(b'%PDF-'): raise HTTPException(400,'Bitte eine PDF bis 10 MB auswählen.')
    try:
        term_info(term)
        from app.services.fwpm_semester import parse_fwpm_proposal
        document,rows=parse_fwpm_proposal(data,term)
        atomic_write(catalog_path().parent/'handbooks'/(document['digest']+'.pdf'),data)
        return {'term':term,'document':document_summary(document),'courses':rows}
    except (ValueError,RuntimeError) as error: raise HTTPException(422,str(error))


@router.post('/admin/programs/wi/handbook', dependencies=[Depends(require_admin)])
def upload_handbook(file: UploadFile = File(...), kind: str | None = None, extract_catalog: bool = False, reference_only: bool = False):
    data = file.file.read(10 * 1024 * 1024 + 1)
    file.file.close()
    if len(data) > 10 * 1024 * 1024 or not data.startswith(b'%PDF-'):
        raise HTTPException(400, 'Bitte eine PDF bis 10 MB auswählen.')
    digest = hashlib.sha256(data).hexdigest()
    result = {}
    if extract_catalog or reference_only:
        if kind not in ('core','fwpm'): raise HTTPException(422,'Modulhandbuch-Typ fehlt.')
        try:
            document=reference_document(data,kind)
        except (ValueError,RuntimeError) as error:
            raise HTTPException(422,str(error))
        atomic_write(catalog_path().parent / 'handbooks' / f'{digest}.pdf', data)
        return {'document':document_summary(document)}
    if kind is not None:
        if kind not in ('core', 'fwpm'):
            raise HTTPException(422, 'Unbekannter Modulhandbuch-Typ.')
        try:
            import pymupdf
            with pymupdf.open(stream=data, filetype='pdf') as document:
                if document.is_encrypted or not len(document) or len(document) > 1500:
                    raise ValueError('PDF geschützt oder zu umfangreich.')
                cover = document[0].get_text()
            edition = ('wi_bsc_2026' if '31.03.2026' in cover else 'wi_bsc_2012' if '2012' in cover
                       else 'wi_bsc_2023' if '2023' in cover else None)
            info = report('ready')
            info['found'] = 1
            info['warnings'] = ['Nur PDF ersetzt. Disziplinen, Zuordnungen, ECTS und Regeln bleiben unverändert. PDF-Seiten bitte neu prüfen.']
            if kind == 'core' and not edition:
                raise HTTPException(422, 'SPO auf der Titelseite nicht erkannt. Bitte ein Modulhandbuch der unterstützten SPO 2012, 2023 oder 2026 wählen.')
            created = re.search(r'erstellt\s+am\s+(\d{2}\.\d{2}\.\d{4})', cover, re.I)
            label = (file.filename or 'Modulhandbuch') + (f' · Stand {created[1]}' if created else '')
            result = {'report': info, 'modules': {}, 'edition_id': edition if kind == 'core' else None,
                      'label': label[:200]}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(400, 'PDF konnte nicht gelesen werden. Bitte eine ungeschützte PDF-Datei auswählen.')
    atomic_write(catalog_path().parent / 'handbooks' / f'{digest}.pdf', data)
    url = f'/api/programs/wi/handbooks/{digest}.pdf'
    if result:
        result['report']['source_urls'] = [url]
    return {**result, 'url': url}


@router.get('/programs/wi/handbooks/{filename}')
def read_versioned_handbook(filename: str):
    if not re.fullmatch(r'[a-f0-9]{64}\.pdf', filename):
        raise HTTPException(404, 'Modulhandbuch nicht gefunden.')
    try:
        path = stored_path(filename[:-4])
    except ValueError:
        raise HTTPException(404, 'Modulhandbuch nicht gefunden.')
    return FileResponse(path, media_type='application/pdf')


@router.get('/programs/wi/handbook')
def read_legacy_handbook():
    path = catalog_path().with_name('wi_handbook.pdf')
    if not path.exists():
        raise HTTPException(404, 'Modulhandbuch noch nicht hochgeladen.')
    return FileResponse(path, media_type='application/pdf')
