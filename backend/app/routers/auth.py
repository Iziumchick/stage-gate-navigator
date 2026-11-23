import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete,update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import get_db
from app.services.security import rate_limit
from app.services.privacy import accept,VERSION
from app.services import institutional_email
from app.models import User, LoginSession,EmailVerification,utcnow
from app.services.auth_service import COOKIE, current_user, hash_password, verify_password, public_user

router = APIRouter(prefix='/auth')
_dummy_hash = hash_password(secrets.token_urlsafe(24))


class Credentials(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=200)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value):
        value = value.strip().lower()
        if len(value.split('@')) != 2 or not all(value.split('@')) or any(c.isspace() for c in value):
            raise ValueError('Bitte eine gültige E-Mail-Adresse eingeben.')
        return value


class Registration(Credentials):
    privacy_accepted: bool = False
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=12, max_length=200)

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, value):
        if not value.strip():
            raise ValueError('Name fehlt')
        return value.strip()


class VerificationTicket(BaseModel):
    model_config=ConfigDict(extra='forbid')
    ticket:str=Field(min_length=40,max_length=100)


class VerificationCode(VerificationTicket):
    code:str=Field(pattern=r'^[0-9]{6}$')


def check_domain(email,role='student'):
    if institutional_email.required() and not institutional_email.account_allowed(email,role):
        raise HTTPException(403,'Bitte eine Adresse mit @st.oth-regensburg.de oder @oth-regensburg.de verwenden.')


def check_challenge_account(db,item):
    # Resolve the current server-side role, never a client-supplied role.
    user=db.get(User,item.user_id) if item.user_id is not None else None
    if item.user_id is not None and (user is None or user.email!=item.email):
        raise verification_error()
    check_domain(item.email,user.role if user else 'student')


def verification_error():
    return HTTPException(400,'Der Code ist ungültig oder abgelaufen. Bitte erneut anmelden und einen neuen Code anfordern.')


def challenge_record(db,ticket):
    item=db.get(EmailVerification,hashlib.sha256(ticket.encode()).hexdigest())
    if not item:raise verification_error()
    if item.expires_at<=time.time():
        db.delete(item);db.commit();raise verification_error()
    return item


def begin_verification(request,db,email,user_id=None,pending=None):
    try:institutional_email.smtp_config()
    except institutional_email.MailUnavailable:
        raise HTTPException(503,'Die E-Mail-Bestätigung ist noch nicht eingerichtet. Bitte später erneut versuchen.') from None
    latest=db.query(EmailVerification).filter(EmailVerification.email==email).order_by(EmailVerification.created_at.desc()).first()
    now=time.time()
    if latest and now-latest.created_at<60:
        raise HTTPException(429,'Bitte eine Minute warten, bevor du einen neuen Code anforderst.',headers={'Retry-After':str(max(1,int(60-(now-latest.created_at))))})
    rate_limit(request,'email-send',5,3600,key=email)
    rate_limit(request,'email-global',30,60,key='mail-delivery')
    ticket=secrets.token_urlsafe(32)
    code=f'{secrets.randbelow(1_000_000):06d}'
    digest=hashlib.sha256(ticket.encode()).hexdigest()
    db.query(EmailVerification).filter((EmailVerification.email==email)|(EmailVerification.expires_at<=now)).delete(synchronize_session=False)
    db.add(EmailVerification(ticket_hash=digest,email=email,user_id=user_id,code_hash=hashlib.sha256(f'{ticket}:{code}'.encode()).hexdigest(),created_at=now,expires_at=now+600,attempts=0,pending_registration_json=json.dumps(pending) if pending else None))
    db.commit()
    try:institutional_email.send_verification(email,code)
    except institutional_email.MailUnavailable:
        db.query(EmailVerification).filter_by(ticket_hash=digest).delete(synchronize_session=False);db.commit()
        raise HTTPException(503,'Die Bestätigungs-E-Mail konnte nicht versendet werden. Bitte später erneut versuchen.') from None
    return {'verification_required':True,'ticket':ticket,'email':email,'expires_in':600,'resend_after':60}


@router.get('/options')
def options():
    return {'institutional_email_required':institutional_email.required(),'allowed_email_domains':list(institutional_email.ALLOWED_DOMAINS)}


def start_session(user: User, db: Session, response: Response):
    token = secrets.token_urlsafe(32)
    db.query(LoginSession).filter(LoginSession.expires_at < time.time()).delete()
    sessions=db.query(LoginSession).filter(LoginSession.user_id==user.id).order_by(LoginSession.expires_at.desc()).all()
    for stale in sessions[4:]:db.delete(stale)
    db.add(LoginSession(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id, expires_at=time.time() + 7*86400))
    db.commit()
    response.set_cookie(COOKIE, token, max_age=7*86400, httponly=True, samesite='strict', secure=os.environ.get('COOKIE_SECURE') == 'true', path='/')
    response.headers['Cache-Control'] = 'no-store'
    return public_user(user)


@router.post('/register')
def register(value: Registration, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(request,'auth',key=f'{request.client.host if request.client else "unknown"}:{value.email}')
    if not value.privacy_accepted:raise HTTPException(422,'Bitte die Datenschutzinformation lesen und der freiwilligen Verarbeitung zustimmen.')
    check_domain(value.email)
    if institutional_email.required():
        if db.query(User).filter_by(email=value.email).first():
            raise HTTPException(409,'Das Konto konnte nicht angelegt werden. Bitte mit deinen Zugangsdaten anmelden.')
        pending={'name':value.name,'password_hash':hash_password(value.password),'privacy_version':VERSION,'privacy_accepted_at':utcnow().isoformat()}
        return begin_verification(request,db,value.email,pending=pending)
    user = User(id=secrets.randbelow(2**52-1)+1,email=value.email, name=value.name, password_hash=hash_password(value.password), role='student')
    accept(user)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Diese E-Mail-Adresse ist bereits registriert.')
    return start_session(user, db, response)


@router.post('/login')
def login(value: Credentials, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(request,'auth',key=f'{request.client.host if request.client else "unknown"}:{value.email}')
    user = db.query(User).filter(User.email == value.email).first()
    correct = verify_password(value.password, user.password_hash if user else _dummy_hash)
    if not user or not correct:
        raise HTTPException(401, 'E-Mail-Adresse oder Passwort ist falsch.')
    check_domain(user.email,user.role)
    if institutional_email.required() and not user.email_verified_at:
        return begin_verification(request,db,user.email,user_id=user.id)
    return start_session(user, db, response)


@router.post('/email/verify')
def verify_email(value:VerificationCode,request:Request,response:Response,db:Session=Depends(get_db)):
    rate_limit(request,'email-code',20,900,key=value.ticket)
    item=challenge_record(db,value.ticket)
    check_challenge_account(db,item)
    if item.attempts>=5:raise verification_error()
    expected=hashlib.sha256(f'{value.ticket}:{value.code}'.encode()).hexdigest()
    if not hmac.compare_digest(item.code_hash,expected):
        db.execute(update(EmailVerification).where(EmailVerification.ticket_hash==item.ticket_hash).values(attempts=EmailVerification.attempts+1));db.commit()
        raise verification_error()
    email,user_id,pending_json=item.email,item.user_id,item.pending_registration_json
    # Atomic consumption: concurrent submissions cannot both use a ticket.
    consumed=db.execute(delete(EmailVerification).where(EmailVerification.ticket_hash==item.ticket_hash,EmailVerification.expires_at>time.time(),EmailVerification.attempts<5).execution_options(synchronize_session=False))
    if consumed.rowcount!=1:
        db.rollback();raise verification_error()
    if user_id is not None:
        user=db.get(User,user_id)
        if user is None or user.email!=email:
            db.rollback();raise verification_error()
    else:
        pending=json.loads(pending_json)
        user=User(id=secrets.randbelow(2**52-1)+1,email=email,name=pending['name'],password_hash=pending['password_hash'],role='student',privacy_version=pending['privacy_version'],privacy_accepted_at=datetime.fromisoformat(pending['privacy_accepted_at']))
        db.add(user)
    user.email_verified_at=utcnow()
    try:db.flush()
    except IntegrityError:
        db.rollback();raise HTTPException(409,'Das Konto wurde inzwischen angelegt. Bitte anmelden.') from None
    db.query(EmailVerification).filter_by(email=email).delete(synchronize_session=False)
    db.query(LoginSession).filter_by(user_id=user.id).delete(synchronize_session=False)
    return start_session(user,db,response)


@router.post('/email/resend')
def resend_email(value:VerificationTicket,request:Request,db:Session=Depends(get_db)):
    item=challenge_record(db,value.ticket)
    check_challenge_account(db,item)
    return begin_verification(request,db,item.email,user_id=item.user_id,pending=json.loads(item.pending_registration_json) if item.pending_registration_json else None)


@router.get('/me')
def me(response: Response, user: User = Depends(current_user)):
    response.headers['Cache-Control'] = 'no-store'
    return public_user(user)


@router.post('/logout')
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE, '')
    if token:
        db.query(LoginSession).filter(LoginSession.token_hash == hashlib.sha256(token.encode()).hexdigest()).delete()
        db.commit()
    response.delete_cookie(COOKIE, path='/')
    return {'ok': True}
