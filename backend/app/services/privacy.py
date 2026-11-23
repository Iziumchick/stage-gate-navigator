"""Consent enforcement for processing personal student results."""
from datetime import datetime, timezone
from fastapi import Depends, HTTPException
from app.services.auth_service import require_student
from app.services.privacy_config import VERSION,retention_days,notice,assert_production_ready

def consent_required(user=Depends(require_student)):
    if user.privacy_version!=VERSION:
        raise HTTPException(428,'Bitte zuerst die aktuelle Datenschutzinformation bestätigen.')
    return user

def accept(user):
    user.privacy_version=VERSION
    user.privacy_accepted_at=datetime.now(timezone.utc)
