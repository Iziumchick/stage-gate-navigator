"""Real HTTP recovery with disposable SQLite and mocked transactional mail."""
import hashlib
import http.cookiejar
import json
import os
import socket
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from unittest.mock import patch

folder=tempfile.TemporaryDirectory()
os.environ.update(DATABASE_URL='sqlite:///'+folder.name+'/recovery.db',REQUIRE_INSTITUTIONAL_EMAIL='true',SMTP_HOST='smtp.test.invalid',SMTP_FROM='navigator@example.test')
from app.main import app
from app.db import SessionLocal
from app.models import User,PasswordReset,EmailVerification,LoginSession,Import,UserImport
from app.services.auth_service import hash_password,verify_password
from app.services.institutional_email import MailUnavailable
from app.services.privacy_storage import expire_inactive
from app.services.security import _buckets,_lock
import uvicorn


class PasswordRecoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mail=patch('app.services.institutional_email.send_password_reset').start()
        cls.changed=patch('app.services.institutional_email.send_password_changed').start()
        cls.verification=patch('app.services.institutional_email.send_verification').start()
        sock=socket.socket();sock.bind(('127.0.0.1',0));cls.base=f'http://127.0.0.1:{sock.getsockname()[1]}'
        cls.server=uvicorn.Server(uvicorn.Config(app,log_level='critical'))
        cls.thread=threading.Thread(target=cls.server.run,kwargs={'sockets':[sock]},daemon=True);cls.thread.start()
        for _ in range(100):
            if cls.server.started:break
            time.sleep(.05)
        assert cls.server.started

    @classmethod
    def tearDownClass(cls):
        cls.server.should_exit=True;cls.thread.join(5);patch.stopall()

    def setUp(self):
        self.mail.reset_mock();self.mail.side_effect=None
        self.changed.reset_mock();self.changed.side_effect=None
        self.verification.reset_mock()
        with _lock:_buckets.clear()
        self.client=self.new_client()
        self.email=hashlib.sha256(self._testMethodName.encode()).hexdigest()[:24]+'@st.oth-regensburg.de'

    def new_client(self):return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self,path,body=None,status=200,client=None,headers=None):
        h={'X-Requested-With':'StudyNavigator',**(headers or {})}
        if body is not None:body=json.dumps(body).encode();h['Content-Type']='application/json'
        request=urllib.request.Request(self.base+path,data=body,headers=h)
        try:response=(client or self.client).open(request)
        except urllib.error.HTTPError as error:response=error
        value=json.load(response);self.assertEqual(response.code,status,value)
        return value,response

    def account(self,email=None,role='student',verified=False):
        with SessionLocal() as db:
            user=User(email=email or self.email,name='Synthetic participant',role=role,password_hash=hash_password('old-password-123'),privacy_version='2026-11-21',privacy_accepted_at=datetime.now(timezone.utc),email_verified_at=datetime.now(timezone.utc) if verified else None)
            db.add(user);db.commit();return user.id

    def begin(self,email=None,status=200):
        return self.call('/auth/password/reset/request',{'email':email or self.email},status)[0]

    def wait_mail(self):
        for _ in range(100):
            if self.mail.called:return self.mail.call_args.args[1]
            time.sleep(.01)
        self.fail('Expected recovery email was not sent')

    def confirm(self,item,code,password='new-password-123',status=200):
        return self.call('/auth/password/reset/confirm',{'ticket':item['ticket'],'code':code,'new_password':password},status)

    def age(self,item):
        with SessionLocal() as db:
            db.get(PasswordReset,hashlib.sha256(item['ticket'].encode()).hexdigest()).created_at=time.time()-61;db.commit()

    def test_legacy_recovery_preserves_identity_results_and_consent_and_revokes_sessions(self):
        uid=self.account()
        with SessionLocal() as db:
            original=db.get(User,uid);consent=original.privacy_accepted_at
            item=Import(source='synthetic',parser_version='test',pdf_sha256='recovery-synthetic-fingerprint',overall_credits=55)
            db.add(item);db.flush();iid=item.id
            db.add(UserImport(user_id=uid,import_id=iid))
            db.add(LoginSession(token_hash=hashlib.sha256(b'old-session').hexdigest(),user_id=uid,expires_at=time.time()+600))
            db.add(EmailVerification(ticket_hash='v'*64,email=self.email,user_id=uid,code_hash='c'*64,created_at=time.time(),expires_at=time.time()+600,attempts=0));db.commit()
        challenge=self.begin();code=self.wait_mail()
        self.assertNotIn(code,json.dumps(challenge));self.assertFalse(self.changed.called)
        with SessionLocal() as db:
            record=db.get(PasswordReset,hashlib.sha256(challenge['ticket'].encode()).hexdigest())
            self.assertNotEqual(record.code_hash,code);self.assertNotEqual(record.ticket_hash,challenge['ticket'])
            self.assertTrue(verify_password('old-password-123',db.get(User,uid).password_hash))
        result,response=self.confirm(challenge,code)
        self.assertTrue(result['reset']);self.assertIn('Max-Age=0',response.headers['Set-Cookie'])
        self.call('/auth/me',status=401)  # recovery never logs in automatically
        self.confirm(challenge,code,status=400)
        self.call('/auth/login',{'email':self.email,'password':'old-password-123'},status=401)
        user,_=self.call('/auth/login',{'email':self.email,'password':'new-password-123'})
        self.assertEqual(user['id'],uid);self.assertEqual(user['role'],'student');self.assertTrue(user['email_verified'])
        with SessionLocal() as db:
            self.assertEqual(db.get(Import,iid).overall_credits,55);self.assertIsNotNone(db.get(UserImport,(uid,iid)))
            self.assertEqual(db.get(User,uid).privacy_accepted_at,consent)
            self.assertIsNone(db.get(LoginSession,hashlib.sha256(b'old-session').hexdigest()))
            self.assertEqual(db.query(PasswordReset).filter_by(user_id=uid).count(),0)
            self.assertEqual(db.query(EmailVerification).filter_by(user_id=uid).count(),0)
        for _ in range(100):
            if self.changed.called:break
            time.sleep(.01)
        self.changed.assert_called_once_with(self.email)

    def test_unknown_and_disallowed_addresses_have_identical_responses_and_cooldowns(self):
        self.account();known=self.begin();self.wait_mail()
        unknown=self.begin('unknown@st.oth-regensburg.de')
        self.account('unlisted@example.test',role='admin')
        blocked=self.begin('unlisted@example.test')
        for item in (known,unknown,blocked):
            self.assertEqual(set(item),set(known));self.assertEqual(item['message'],known['message'])
            self.assertEqual(item['expires_in'],600)
            self.begin(item['email'],status=429)
        time.sleep(.05);self.mail.assert_called_once()
        for item in (unknown,blocked):self.confirm(item,'123456',status=400)
        with SessionLocal() as db:self.assertIsNone(db.query(User).filter_by(email=unknown['email']).first())

    def test_bad_codes_are_limited_and_expired_codes_cannot_change_password(self):
        uid=self.account();challenge=self.begin();code=self.wait_mail();wrong='000000' if code!='000000' else '111111'
        for _ in range(5):self.confirm(challenge,wrong,status=400)
        self.confirm(challenge,code,status=400)
        self.age(challenge);self.mail.reset_mock();newer=self.begin();new_code=self.wait_mail()
        with SessionLocal() as db:
            db.get(PasswordReset,hashlib.sha256(newer['ticket'].encode()).hexdigest()).expires_at=time.time()-1;db.commit()
        self.confirm(newer,new_code,status=400)
        with SessionLocal() as db:self.assertTrue(verify_password('old-password-123',db.get(User,uid).password_hash))

    def test_resending_replaces_only_recovery_code_and_never_uses_login_code(self):
        self.account()
        login,_=self.call('/auth/login',{'email':self.email,'password':'old-password-123'})
        login_code=self.verification.call_args.args[1]
        first=self.begin();old_code=self.wait_mail();self.age(first)
        self.mail.reset_mock();second=self.begin();code=self.wait_mail()
        self.assertNotEqual(first['ticket'],second['ticket'])
        self.confirm(first,old_code,status=400)
        self.confirm(login,login_code,status=400)
        self.call('/auth/email/verify',{'ticket':second['ticket'],'code':code},status=400)
        self.confirm(second,code)
        self.call('/auth/email/verify',{'ticket':login['ticket'],'code':login_code},status=400)

    def test_admin_recovery_preserves_role_and_exact_private_exception(self):
        email='private-reset-owner@example.test';uid=self.account(email,role='admin')
        with patch.dict(os.environ,{'ADMIN_EMAIL':email}):
            challenge=self.begin(email);code=self.wait_mail();self.confirm(challenge,code)
            user,_=self.call('/auth/login',{'email':email,'password':'new-password-123'})
            self.assertEqual(user['id'],uid);self.assertEqual(user['role'],'admin')
            self.call('/programs/wi/catalog')
            self.mail.reset_mock()
            newer=self.begin(email);self.wait_mail()
            from app.services.administration import revoke_sessions
            with SessionLocal() as db:revoke_sessions(db,db.get(User,uid));db.commit()
            self.confirm(newer,self.mail.call_args.args[1],status=400)

    def test_changed_password_or_removed_admin_exception_invalidates_pending_recovery(self):
        uid=self.account();challenge=self.begin();code=self.wait_mail()
        with SessionLocal() as db:db.get(User,uid).password_hash=hash_password('changed-elsewhere-123');db.commit()
        self.confirm(challenge,code,status=400)
        email='removed-reset-owner@example.test';self.account(email,role='admin')
        self.mail.reset_mock()
        with patch.dict(os.environ,{'ADMIN_EMAIL':email}):challenge=self.begin(email);code=self.wait_mail()
        self.confirm(challenge,code,status=400)

    def test_validation_csrf_and_transport_failure_never_expose_or_change_passwords(self):
        uid=self.account();self.mail.side_effect=MailUnavailable('PRIVATE_PROVIDER_DETAILS')
        challenge=self.begin();code=self.wait_mail();time.sleep(.05)
        self.assertNotIn('PRIVATE_PROVIDER_DETAILS',json.dumps(challenge))
        with SessionLocal() as db:self.assertTrue(verify_password('old-password-123',db.get(User,uid).password_hash))
        result,_=self.confirm(challenge,code,password='SECRET',status=422)
        self.assertNotIn('SECRET',json.dumps(result))
        self.call('/auth/password/reset/confirm',{'ticket':challenge['ticket'],'code':code,'new_password':'new-password-123','role':'admin'},status=422)
        self.call('/auth/password/reset/request',{'email':self.email},status=403,headers={'Origin':'https://attacker.test'})
        with patch.dict(os.environ,{'SMTP_HOST':''}):self.begin('unknown-transport@oth-regensburg.de',status=503)

    def test_deletion_and_retention_remove_recovery_records_without_orphans(self):
        uid=self.account(verified=True);challenge=self.begin();code=self.wait_mail()
        self.call('/auth/login',{'email':self.email,'password':'old-password-123'})
        self.call('/account/delete',{'password':'old-password-123'})
        self.confirm(challenge,code,status=400)
        old=self.account('expired-account@st.oth-regensburg.de');self.mail.reset_mock();pending=self.begin('expired-account@st.oth-regensburg.de');self.wait_mail()
        unknown=self.begin('expired-unknown@oth-regensburg.de')
        with SessionLocal() as db:
            db.get(User,old).last_active_at=datetime.now(timezone.utc)-timedelta(days=91)
            db.get(PasswordReset,hashlib.sha256(unknown['ticket'].encode()).hexdigest()).expires_at=time.time()-1
            db.commit();expire_inactive(db,90)
            self.assertIsNone(db.get(User,uid));self.assertIsNone(db.get(User,old))
            for item in (pending,unknown):self.assertIsNone(db.get(PasswordReset,hashlib.sha256(item['ticket'].encode()).hexdigest()))

    def test_request_rate_is_bounded_even_with_many_different_addresses(self):
        for number in range(10):self.begin(f'limit-{number}@oth-regensburg.de')
        self.begin('limit-last@oth-regensburg.de',status=429)

    def test_concurrent_submissions_consume_a_code_only_once(self):
        self.account();challenge=self.begin();code=self.wait_mail()
        def submit():
            body=json.dumps({'ticket':challenge['ticket'],'code':code,'new_password':'concurrent-password-123'}).encode()
            request=urllib.request.Request(self.base+'/auth/password/reset/confirm',data=body,headers={'X-Requested-With':'StudyNavigator','Content-Type':'application/json'})
            try:response=self.new_client().open(request)
            except urllib.error.HTTPError as error:response=error
            response.read();return response.code
        with ThreadPoolExecutor(max_workers=2) as pool:codes=list(pool.map(lambda _:submit(),range(2)))
        self.assertEqual(sorted(codes),[200,400])
