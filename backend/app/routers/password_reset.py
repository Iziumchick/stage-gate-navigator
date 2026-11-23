"""Mailbox-based recovery, isolated from registration and login challenges."""
import hashlib
import hmac
import logging
import secrets
import time

from fastapi import APIRouter,BackgroundTasks,Depends,HTTPException,Request,Response
from pydantic import Field
from sqlalchemy import delete,update
from sqlalchemy.orm import Session
from app.db import get_db,SessionLocal
from app.models import User,PasswordReset,EmailVerification,LoginSession,utcnow
from app.routers.auth import EmailAddress,VerificationCode
from app.services import institutional_email
from app.services.auth_service import COOKIE,hash_password
from app.services.security import rate_limit

router=APIRouter(prefix='/auth/password/reset')
MESSAGE='Falls für diese Adresse ein freigegebenes Konto besteht, erhältst du einen Code. Bitte auch den Spam-Ordner prüfen.'


class ResetConfirmation(VerificationCode):
    new_password:str=Field(min_length=12,max_length=200)


def digest(value):return hashlib.sha256(value.encode()).hexdigest()


def eligible(user):
    return user is not None and (not institutional_email.required() or institutional_email.account_allowed(user.email,user.role))


def invalid_code():
    return HTTPException(400,'Der Code ist ungültig oder abgelaufen. Bitte einen neuen Code anfordern.')


def send_code(ticket_hash,code):
    # Background delivery gives the same response path for known/unknown users.
    with SessionLocal() as db:
        item=db.get(PasswordReset,ticket_hash)
        if not item or item.expires_at<=time.time() or item.user_id is None:return
        user=db.get(User,item.user_id)
        if not eligible(user) or digest(user.email)!=item.email_hash or digest(user.password_hash)!=item.password_fingerprint:return
        email=user.email
    try:institutional_email.send_password_reset(email,code)
    except institutional_email.MailUnavailable:
        logging.getLogger(__name__).warning('Password recovery email delivery failed; no account was changed.')


def send_changed(email):
    try:institutional_email.send_password_changed(email)
    except institutional_email.MailUnavailable:
        logging.getLogger(__name__).warning('Password change notification delivery failed.')


@router.post('/request')
def request_reset(value:EmailAddress,request:Request,background:BackgroundTasks,db:Session=Depends(get_db)):
    rate_limit(request,'password-request',10,900)
    try:institutional_email.smtp_config()
    except institutional_email.MailUnavailable:
        raise HTTPException(503,'Die Passwort-Wiederherstellung ist derzeit nicht verfügbar. Bitte später erneut versuchen.') from None
    email_hash=digest(value.email)
    latest=db.query(PasswordReset).filter_by(email_hash=email_hash).order_by(PasswordReset.created_at.desc()).first()
    now=time.time()
    if latest and now-latest.created_at<60:
        raise HTTPException(429,'Bitte eine Minute warten, bevor du einen neuen Code anforderst.',headers={'Retry-After':str(max(1,int(60-(now-latest.created_at))))})
    # Share sending limits with registration/login; these apply to unknown mailboxes too.
    rate_limit(request,'email-send',5,3600,key=value.email)
    rate_limit(request,'email-global',30,60,key='mail-delivery')
    user=db.query(User).filter_by(email=value.email).first()
    if not eligible(user):user=None
    ticket=secrets.token_urlsafe(32)
    code=f'{secrets.randbelow(1_000_000):06d}'
    ticket_hash=digest(ticket)
    db.query(PasswordReset).filter((PasswordReset.email_hash==email_hash)|(PasswordReset.expires_at<=now)).delete(synchronize_session=False)
    db.add(PasswordReset(ticket_hash=ticket_hash,email_hash=email_hash,user_id=user.id if user else None,password_fingerprint=digest(user.password_hash) if user else None,code_hash=digest(f'{ticket}:{code}'),created_at=now,expires_at=now+600,attempts=0))
    db.commit()
    background.add_task(send_code,ticket_hash,code)
    return {'reset_required':True,'ticket':ticket,'email':value.email,'expires_in':600,'resend_after':60,'message':MESSAGE}


@router.post('/confirm')
def confirm_reset(value:ResetConfirmation,request:Request,response:Response,background:BackgroundTasks,db:Session=Depends(get_db)):
    rate_limit(request,'password-code-ip',30,900)
    rate_limit(request,'password-code',20,900,key=value.ticket)
    item=db.get(PasswordReset,digest(value.ticket))
    if not item:raise invalid_code()
    if item.expires_at<=time.time():
        db.delete(item);db.commit();raise invalid_code()
    if item.attempts>=5:raise invalid_code()
    if not hmac.compare_digest(item.code_hash,digest(f'{value.ticket}:{value.code}')):
        db.execute(update(PasswordReset).where(PasswordReset.ticket_hash==item.ticket_hash).values(attempts=PasswordReset.attempts+1));db.commit()
        raise invalid_code()
    user=db.get(User,item.user_id) if item.user_id is not None else None
    if not eligible(user) or digest(user.email)!=item.email_hash or not hmac.compare_digest(item.password_fingerprint or '',digest(user.password_hash)):
        db.delete(item);db.commit();raise invalid_code()
    old_hash=user.password_hash
    new_hash=hash_password(value.new_password)
    consumed=db.execute(delete(PasswordReset).where(PasswordReset.ticket_hash==item.ticket_hash,PasswordReset.expires_at>time.time(),PasswordReset.attempts<5).execution_options(synchronize_session=False))
    if consumed.rowcount!=1:
        db.rollback();raise invalid_code()
    changed=db.execute(update(User).where(User.id==user.id,User.password_hash==old_hash,User.email==user.email,User.role==user.role).values(password_hash=new_hash,email_verified_at=utcnow(),last_active_at=utcnow()).execution_options(synchronize_session=False))
    if changed.rowcount!=1:
        db.rollback();raise invalid_code()
    db.query(LoginSession).filter_by(user_id=user.id).delete(synchronize_session=False)
    db.query(EmailVerification).filter((EmailVerification.user_id==user.id)|(EmailVerification.email==user.email)).delete(synchronize_session=False)
    db.query(PasswordReset).filter((PasswordReset.user_id==user.id)|(PasswordReset.email_hash==digest(user.email))).delete(synchronize_session=False)
    db.commit()
    response.delete_cookie(COOKIE,path='/')
    background.add_task(send_changed,user.email)
    return {'reset':True}
