"""Explicit server-operator account changes. Never exposed through HTTP."""
import os
import hashlib
import secrets

from app.db import SessionLocal
from app.models import User, LoginSession, EmailVerification, PasswordReset
from app.services.auth_service import hash_password
from app.services.institutional_email import allowed, configured_admin, valid_mailbox


class AdministrationError(Exception):
    pass


def mailbox(value):
    email=value.strip().lower()
    if not valid_mailbox(email):raise AdministrationError('A valid email address is required.')
    return email


def revoke_sessions(db,user):
    db.query(PasswordReset).filter((PasswordReset.user_id==user.id)|(PasswordReset.email_hash==hashlib.sha256(user.email.encode()).hexdigest())).delete(synchronize_session=False)
    db.query(LoginSession).filter_by(user_id=user.id).delete(synchronize_session=False)
    db.query(EmailVerification).filter((EmailVerification.user_id==user.id)|(EmailVerification.email==user.email)).delete(synchronize_session=False)


def provision_admin(value,*,adopt_existing=False,reset_password=False):
    email=mailbox(value)
    if not configured_admin(email):
        raise AdministrationError('The address must exactly match ADMIN_EMAIL in the server configuration.')
    password=os.getenv('ADMIN_PASSWORD','')
    if not 12<=len(password)<=200:
        raise AdministrationError('ADMIN_PASSWORD must contain 12 to 200 characters. Set it in the private server environment.')
    with SessionLocal() as db:
        user=db.query(User).filter_by(email=email).first()
        if user and user.role=='admin' and not reset_password:
            return 'Administrator already exists; the existing password and email verification were preserved.'
        if user and user.role!='admin' and not adopt_existing:
            raise AdministrationError('This address belongs to a study account. Use --adopt-existing only if this specific account should become an administrator; its study data will be preserved.')
        if user is None:
            user=User(id=secrets.randbelow(2**52-1)+1,email=email,name='Administrator')
            db.add(user)
        else:revoke_sessions(db,user)
        user.role='admin'
        user.password_hash=hash_password(password)
        user.email_verified_at=None
        db.commit()
    return 'Administrator provisioned using ADMIN_PASSWORD. Email confirmation is required at the next login. Password values were not displayed.'


def grant_staff_admin(value):
    email=mailbox(value)
    if not allowed(email) or email.rsplit('@',1)[1]!='oth-regensburg.de':
        raise AdministrationError('Delegated administrators must use the exact staff domain @oth-regensburg.de, without st.')
    with SessionLocal() as db:
        user=db.query(User).filter_by(email=email).first()
        if not user or not user.email_verified_at:
            raise AdministrationError('The staff account must register and confirm its own email address first.')
        if user.role=='admin':return 'This staff account is already an administrator.'
        revoke_sessions(db,user)
        user.role='admin'
        db.commit()
    return 'Staff administrator granted. Existing sessions were revoked; the account password and study data were preserved.'


def revoke_admin(value):
    email=mailbox(value)
    if configured_admin(email):
        raise AdministrationError('Change ADMIN_EMAIL first before revoking the configured bootstrap administrator.')
    with SessionLocal() as db:
        user=db.query(User).filter_by(email=email).first()
        if not user:raise AdministrationError('Account not found.')
        if user.role!='admin':return 'This account has no administrator role.'
        revoke_sessions(db,user)
        user.role='student'
        db.commit()
    return 'Administrator role revoked and existing sessions invalidated.'
