import hashlib
import os
import secrets
import time
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import get_db
from app.services.security import rate_limit
from app.services.privacy import accept
from app.models import User, LoginSession
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
    return start_session(user, db, response)


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
