"""The upload timestamp upgrade preserves a database from the previous release."""
import os
import subprocess
import sys
import tempfile
import unittest


class DatabaseUpgradeTests(unittest.TestCase):
    def test_existing_account_and_results_survive_the_upload_timestamp_upgrade(self):
        script='''
import os
from sqlalchemy import create_engine,text
from sqlalchemy.orm import Session
from app.models import Base,User,Import,UserImport
legacy=create_engine(os.environ['DATABASE_URL'])
Base.metadata.create_all(legacy)
with Session(legacy) as db:
    user=User(email='legacy@example.test',name='Synthetic legacy student',password_hash='preserved-hash',role='student')
    item=Import(source='synthetic',parser_version='old',pdf_sha256='legacy-fingerprint',overall_credits=195)
    db.add_all([user,item]);db.flush()
    uid,iid=user.id,item.id
    db.add(UserImport(user_id=uid,import_id=iid));db.commit()
with legacy.begin() as connection:connection.execute(text('ALTER TABLE imports DROP COLUMN last_uploaded_at'))
legacy.dispose()
from app.db import SessionLocal
with SessionLocal() as db:
    assert db.get(User,uid).password_hash=='preserved-hash'
    assert db.get(Import,iid).overall_credits==195
    assert db.get(Import,iid).last_uploaded_at is None
    assert db.get(UserImport,(uid,iid)) is not None
'''
        with tempfile.TemporaryDirectory() as directory:
            result=subprocess.run([sys.executable,'-c',script],env={**os.environ,'DATABASE_URL':'sqlite:///'+directory+'/legacy.db'},capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stderr)
