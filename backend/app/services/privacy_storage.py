"""Student data lifecycle: minimal results, ownership, erasure and retention."""
import copy
import hashlib
import json
from datetime import datetime,timedelta,timezone
from sqlalchemy import or_
from app.models import Achievement,Import,LoginSession,User,UserImport,EmailVerification,PasswordReset
from app.services.leistungen_import import import_groups


def erase_import(db,user_id,import_id):
    link=db.get(UserImport,(user_id,import_id))
    if not link:return False
    db.delete(link);db.flush()
    if not db.query(UserImport).filter(UserImport.import_id==import_id).first():
        db.query(Achievement).filter(Achievement.import_id==import_id).delete(synchronize_session=False)
        item=db.get(Import,import_id)
        if item:db.delete(item)
    return True


def erase_user(db,user):
    db.query(PasswordReset).filter((PasswordReset.user_id==user.id)|(PasswordReset.email_hash==hashlib.sha256(user.email.encode()).hexdigest())).delete(synchronize_session=False)
    db.query(EmailVerification).filter((EmailVerification.user_id==user.id)|(EmailVerification.email==user.email)).delete(synchronize_session=False)
    for link in db.query(UserImport).filter(UserImport.user_id==user.id).all():erase_import(db,user.id,link.import_id)
    db.query(LoginSession).filter(LoginSession.user_id==user.id).delete(synchronize_session=False)
    db.delete(user)


def minimize_existing(db):
    """Preserve parsed module evidence, never a second copy of a PDF's text."""
    changed=False
    for item in db.query(Import).filter(or_(Import.raw_text.isnot(None),Import.raw_lines_json.isnot(None))).all():
        if not item.parsed_modules_json:
            try:groups=import_groups(item)
            except (ValueError,TypeError,KeyError):groups=[]
            item.parsed_modules_json=json.dumps({'format':'legacy_module_groups','groups':groups},ensure_ascii=False)
        item.raw_text=None;item.raw_lines_json=None;changed=True
    # Imports without an owner have no continuing purpose.
    for item in db.query(Import).filter(~Import.id.in_(db.query(UserImport.import_id))).all():
        db.query(Achievement).filter(Achievement.import_id==item.id).delete(synchronize_session=False)
        db.delete(item);changed=True
    db.flush()
    # Older versions shared one result record across students. Separate ownership
    # now, so deletion/re-import for one student cannot affect another student.
    for item in db.query(Import).all():
        links=db.query(UserImport).filter(UserImport.import_id==item.id).order_by(UserImport.user_id).all()
        for link in links[1:]:
            fields={column.name:copy.deepcopy(getattr(item,column.name)) for column in Import.__table__.columns if column.name not in ('id','pdf_sha256','raw_text','raw_lines_json')}
            clone=Import(**fields,pdf_sha256=hashlib.sha256(f'{link.user_id}:{item.pdf_sha256}'.encode()).hexdigest())
            db.add(clone);db.flush()
            db.add(UserImport(user_id=link.user_id,import_id=clone.id));db.delete(link);changed=True
    db.commit()
    return changed


def expire_inactive(db,days):
    cutoff=datetime.now(timezone.utc)-timedelta(days=days)
    users=db.query(User).filter(User.role=='student',User.last_active_at<cutoff).all()
    for user in users:erase_user(db,user)
    db.query(LoginSession).filter(LoginSession.expires_at<datetime.now(timezone.utc).timestamp()).delete(synchronize_session=False)
    db.query(EmailVerification).filter(EmailVerification.expires_at<=datetime.now(timezone.utc).timestamp()).delete(synchronize_session=False)
    db.query(PasswordReset).filter(PasswordReset.expires_at<=datetime.now(timezone.utc).timestamp()).delete(synchronize_session=False)
    db.commit()
    return len(users)


def compact_after_scrub(engine):
    if engine.dialect.name!='sqlite':return
    connection=engine.raw_connection()
    try:
        connection.commit();connection.execute('PRAGMA wal_checkpoint(TRUNCATE)');connection.execute('VACUUM');connection.commit()
    finally:connection.close()
