"""Private, structured transcript results. Uploaded documents are never retained."""
import hashlib
import json
import threading
from fastapi import APIRouter,Depends,File,HTTPException,Query,UploadFile,Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from app.db import get_db
from app.models import Import,UserImport,User,Achievement
from app.services.auth_service import import_owner,require_student
from app.services.privacy import consent_required
from app.services.privacy_storage import erase_import
from app.services.security import rate_limit
from app.services import pdf_service,module_structure_service
from app.services.leistungen_import import ExportError,import_groups,stored_payload,VERSION
from app.utils.text_utils import slugify

router=APIRouter(dependencies=[Depends(import_owner)])
_parsers=threading.BoundedSemaphore(2)


def _parse(data):
    if not _parsers.acquire(blocking=False):raise HTTPException(429,'Die Verarbeitung ist gerade ausgelastet. Bitte gleich erneut versuchen.')
    try:return pdf_service.parse_student_pdf(data)
    finally:_parsers.release()


@router.get('/imports')
def list_imports(db:Session=Depends(get_db),user:User=Depends(require_student)):
    items=db.query(Import).join(UserImport,UserImport.import_id==Import.id).filter(UserImport.user_id==user.id).order_by(Import.created_at.desc()).all()
    return [{'id':i.id,'created_at':i.created_at.isoformat() if i.created_at else None,'source':i.source,'parser_version':i.parser_version,'degree_program_raw':i.degree_program_raw,'degree_program_key':i.degree_program_key,'overall_grade':i.overall_grade,'overall_credits':i.overall_credits,'status':i.status,'error_message':None,'stats_total_rows':i.stats_total_rows,'stats_saved_rows':i.stats_saved_rows} for i in items]


@router.post('/imports/upload')
async def import_pdf(request:Request,file:UploadFile=File(...),force:bool=Query(False),user:User=Depends(consent_required),db:Session=Depends(get_db)):
    rate_limit(request,'pdf',8,300,key=user.id)
    try:data=await file.read(pdf_service.MAX_PDF_SIZE_BYTES+1)
    finally:await file.close()
    try:
        pdf_service.validate_pdf_upload(filename=file.filename,content_type=file.content_type,data=data)
        parsed=await run_in_threadpool(_parse,data)
    except (pdf_service.PdfValidationError,pdf_service.PdfProcessingError) as error:
        raise HTTPException(400,detail={'message':error.safe_message,'code':getattr(error,'code','invalid_pdf'),'status':'validation_failed'})
    except ExportError as error:
        raise HTTPException(422,detail={'message':str(error),'code':error.code,'status':'invalid_export'})
    # The fingerprint is account-scoped; another student's upload is never reused.
    digest=hashlib.sha256(f'{user.id}:'.encode()+hashlib.sha256(data).digest()).hexdigest()
    del data
    existing=db.query(Import).join(UserImport).filter(Import.pdf_sha256==digest,UserImport.user_id==user.id).first()
    if existing and not force:return {'import_id':existing.id,'deduplicated':True}
    item=existing or Import(pdf_sha256=digest)
    item.source='hisinone_leistungen';item.parser_version=VERSION
    item.parsed_modules_json=json.dumps(parsed,ensure_ascii=False)
    item.raw_text=None;item.raw_lines_json=None
    item.degree_program_raw='Wirtschaftsinformatik';item.degree_program_key='wi'
    item.overall_grade=parsed['overall_grade'];item.overall_credits=parsed['overall_credits']
    item.status='success';item.error_message=None
    item.stats_total_rows=parsed['report']['attempt_count'];item.stats_saved_rows=len(parsed['groups'])
    db.add(item)
    try:
        db.flush()
        if not existing:db.add(UserImport(user_id=user.id,import_id=item.id))
        db.commit()
    except IntegrityError:
        db.rollback()
        same=db.query(Import).join(UserImport).filter(Import.pdf_sha256==digest,UserImport.user_id==user.id).first()
        if not same:raise HTTPException(409,'Der Import wurde gleichzeitig verändert. Bitte erneut versuchen.')
        return {'import_id':same.id,'deduplicated':True}
    return {'import_id':item.id,'deduplicated':bool(existing),'overall_grade':item.overall_grade,'overall_credits':item.overall_credits}


@router.delete('/imports/{import_id}')
def delete_import(import_id:int,db:Session=Depends(get_db),user:User=Depends(require_student)):
    if not erase_import(db,user.id,import_id):raise HTTPException(404,'Import not found')
    db.commit()
    return {'deleted':True}


@router.get('/imports/{import_id}/raw-lines')
@router.get('/imports/{import_id}/debug/module-structure')
@router.get('/imports/{import_id}/requirements')
@router.get('/imports/{import_id}/match')
def retired_raw_api(import_id:int):
    raise HTTPException(410,'Diese alte Diagnose-Schnittstelle ist deaktiviert. Es wird kein PDF-Volltext gespeichert.')


@router.post('/imports/{import_id}/parse')
def parsed_already(import_id:int,db:Session=Depends(get_db)):
    item=db.get(Import,import_id)
    if not item:raise HTTPException(404,'Import not found')
    return {'saved':len(import_groups(item)),'note':'Der Import enthält bereits strukturierte Ergebnisse. Die PDF wird nicht gespeichert.'}


@router.get('/imports/{import_id}/summary')
def summary(import_id:int,db:Session=Depends(get_db)):
    item=db.get(Import,import_id)
    if not item:raise HTTPException(404,'Import not found')
    return {'import_id':import_id,'official':{'overall_grade':item.overall_grade,'overall_credits':item.overall_credits}}


@router.get('/imports/{import_id}/module-groups')
def groups(import_id:int,limit:int=Query(80,ge=1,le=500),db:Session=Depends(get_db)):
    item=db.get(Import,import_id)
    if not item:raise HTTPException(404,'Import not found')
    return {'import_id':import_id,'groups':import_groups(item)[:limit]}


@router.get('/imports/{import_id}/evaluation')
def evaluation(import_id:int,limit:int=Query(200,ge=1,le=500),db:Session=Depends(get_db)):
    item=db.get(Import,import_id)
    if not item:raise HTTPException(404,'Import not found')
    return {'import_id':import_id,'evaluation':module_structure_service.aggregate_groups(import_groups(item)[:limit],degree_program_key=item.degree_program_key)}


@router.get('/imports/{import_id}/achievements')
def achievements(import_id:int,db:Session=Depends(get_db)):
    item=db.get(Import,import_id)
    payload=stored_payload(item) if item else None
    if payload:
        return [{'id':n,'import_id':import_id,'module_name_raw':g['requirement_title'],'module_name_norm':slugify(g['requirement_title']),'ects':g['requirement_meta']['ects'],'grade_weight':None,'grade_value':float(g['requirement_meta']['grade_val']) if g['requirement_meta']['grade_val'] is not None else None,'grade_text':None,'passed':g['passed'],'status_raw':g['requirement_meta']['status_raw'],'attempt':None} for n,g in enumerate(payload['groups'],1)]
    rows=db.query(Achievement).filter(Achievement.import_id==import_id).order_by(Achievement.id).all()
    return [{key:getattr(row,key) for key in ('id','import_id','module_name_raw','module_name_norm','ects','grade_weight','grade_value','grade_text','passed','status_raw')}|{'attempt':None if item and item.source=='pdf_upload' and item.parser_version in ('0.1.0','0.2.0') and row.attempt==1 else row.attempt} for row in rows]
