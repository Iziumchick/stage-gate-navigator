"""Password authentication with revocable server-side sessions."""
import hashlib
import hmac
import os
import secrets
import time
from datetime import timezone
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db import get_db, SessionLocal
from app.models import LoginSession, User, UserImport, utcnow

COOKIE = 'study_session'


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, maxmem=64*1024*1024)
    return f'scrypt${salt.hex()}${digest.hex()}'


def verify_password(password: str, value: str) -> bool:
    try:
        algorithm, salt, expected = value.split('$')
        if algorithm!='scrypt' or len(salt)!=32 or len(expected)!=128:return False
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, maxmem=64*1024*1024)
        return hmac.compare_digest(actual.hex(), expected)
    except (ValueError, TypeError):
        return False


def public_user(user: User) -> dict:
    return {'id': user.id, 'email': user.email, 'name': user.name, 'role': user.role,'privacy_version':user.privacy_version}


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE, '')
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest()) if token else None
    user = db.get(User, session.user_id) if session and session.expires_at > time.time() else None
    if not user:
        raise HTTPException(401, 'Bitte anmelden.')
    if user.last_active_at is None or time.time()-user.last_active_at.replace(tzinfo=timezone.utc).timestamp()>86400:
        user.last_active_at=utcnow();db.commit()
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != 'admin':
        raise HTTPException(403, 'Nur für Administratoren.')
    return user


def require_student(user: User = Depends(current_user)) -> User:
    if user.role != 'student':
        raise HTTPException(403, 'Nur für Studierende.')
    return user


def import_owner(request: Request, user: User = Depends(require_student), db: Session = Depends(get_db)):
    import_id = request.path_params.get('import_id')
    if import_id is not None and not db.get(UserImport, (user.id, int(import_id))):
        raise HTTPException(404, 'Import not found')


def bootstrap_admin():
    email = os.environ.get('ADMIN_EMAIL', '').strip().lower()
    password = os.environ.get('ADMIN_PASSWORD', '')
    if not email or not password:
        return
    if len(password) < 12:
        raise RuntimeError('ADMIN_PASSWORD must contain at least 12 characters')
    with SessionLocal() as db:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            if existing.role != 'admin':
                raise RuntimeError('Configured administrator email belongs to a student')
            return
        db.add(User(id=secrets.randbelow(2**52-1)+1,email=email, name='Administrator', role='admin', password_hash=hash_password(password)))
        db.commit()
