"""Truthful public processing information and production readiness checks."""
import os
from datetime import datetime, timezone
from fastapi import Depends, HTTPException
from app.services.auth_service import require_student

VERSION='2026-11-16'

def retention_days():return max(1,min(365,int(os.getenv('DATA_RETENTION_DAYS','90'))))

def notice():
    fields={key:os.getenv(env,'').strip() for key,env in {
        'controller':'PRIVACY_CONTROLLER','contact':'PRIVACY_CONTACT','address':'PRIVACY_ADDRESS',
        'hosting_provider':'PRIVACY_HOSTING_PROVIDER','hosting_country':'PRIVACY_HOSTING_COUNTRY',
        'supervisory_authority':'PRIVACY_AUTHORITY','backup_policy':'PRIVACY_BACKUP_POLICY',
    }.items()}
    ready=all(fields.values()) and os.getenv('PRIVACY_REVIEWED')=='true'
    return {'version':VERSION,'ready':ready,'retention_days':retention_days(),**fields}

def assert_production_ready():
    from app.services.security import production,allowed_origins
    if not production():return
    if not notice()['ready']:raise RuntimeError('Public testing requires completed and reviewed privacy configuration.')
    if os.getenv('COOKIE_SECURE')!='true' or not allowed_origins() or any(not v.startswith('https://') for v in allowed_origins()):
        raise RuntimeError('Production requires Secure cookies and explicit HTTPS APP_ORIGINS.')

def consent_required(user=Depends(require_student)):
    if user.privacy_version!=VERSION:
        raise HTTPException(428,'Bitte zuerst die aktuelle Datenschutzinformation bestätigen.')
    return user

def accept(user):
    user.privacy_version=VERSION
    user.privacy_accepted_at=datetime.now(timezone.utc)
