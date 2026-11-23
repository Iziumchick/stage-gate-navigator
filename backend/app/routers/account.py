"""Explicit student access, correction and erasure controls."""
from fastapi import APIRouter,Depends,HTTPException,Response,Request
from pydantic import BaseModel,Field,ConfigDict
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Import,UserImport,User
from app.services.auth_service import COOKIE,require_student,verify_password,public_user
from app.services.security import rate_limit
from app.services.privacy import accept,notice
from app.services.privacy_storage import erase_import,erase_user
from app.services.leistungen_import import import_groups

router=APIRouter()

class Confirmation(BaseModel):
    model_config=ConfigDict(extra='forbid')
    password:str=Field(min_length=1,max_length=200)

class Consent(BaseModel):
    accepted:bool

@router.get('/privacy')
def privacy():return notice()

@router.post('/account/consent')
def consent(value:Consent,user:User=Depends(require_student),db:Session=Depends(get_db)):
    if not value.accepted:raise HTTPException(422,'Eine aktive Bestätigung ist erforderlich.')
    accept(user);db.commit()
    return public_user(user)

@router.get('/account/export')
def export(user:User=Depends(require_student),db:Session=Depends(get_db)):
    items=db.query(Import).join(UserImport).filter(UserImport.user_id==user.id).all()
    return {'account':{'name':user.name,'email':user.email,'email_verified_at':user.email_verified_at.isoformat() if user.email_verified_at else None,'last_active_at':user.last_active_at.isoformat() if user.last_active_at else None,'privacy_version':user.privacy_version,'privacy_accepted_at':user.privacy_accepted_at.isoformat() if user.privacy_accepted_at else None},'imports':[{'id':i.id,'created_at':i.created_at.isoformat() if i.created_at else None,'program':i.degree_program_raw,'source':i.source,'parser_version':i.parser_version,'grade':i.overall_grade,'ects':i.overall_credits,'groups':import_groups(i)} for i in items]}

@router.delete('/account/results')
def clear_results(user:User=Depends(require_student),db:Session=Depends(get_db)):
    for link in db.query(UserImport).filter(UserImport.user_id==user.id).all():erase_import(db,user.id,link.import_id)
    user.privacy_version=None;user.privacy_accepted_at=None
    db.commit()
    return {'deleted':True}

@router.post('/account/delete')
def delete(value:Confirmation,request:Request,response:Response,user:User=Depends(require_student),db:Session=Depends(get_db)):
    rate_limit(request,'erase',5,900,key=user.id)
    if not verify_password(value.password,user.password_hash):raise HTTPException(403,'Das Passwort ist nicht korrekt.')
    erase_user(db,user);db.commit();response.delete_cookie(COOKIE,path='/')
    return {'deleted':True}
