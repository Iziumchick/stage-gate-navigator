"""Real HTTP mailbox-verification flow; synthetic accounts and mocked SMTP only."""
import hashlib
import contextlib
import io
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
from unittest.mock import patch

folder=tempfile.TemporaryDirectory()
os.environ.update(DATABASE_URL='sqlite:///'+folder.name+'/auth.db',REQUIRE_INSTITUTIONAL_EMAIL='true',SMTP_HOST='smtp.test.invalid',SMTP_FROM='navigator@example.test')
from app.main import app
from app.db import SessionLocal
from app.models import User,EmailVerification,LoginSession,Import,UserImport
from app.services.auth_service import hash_password,bootstrap_admin
from app.services.institutional_email import MailUnavailable
import uvicorn


class InstitutionalEmailTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mail=patch('app.services.institutional_email.send_verification').start()
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
        self.client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self,path,body=None,status=200,method=None):
        headers={'X-Requested-With':'StudyNavigator'}
        if body is not None:body=json.dumps(body).encode();headers['Content-Type']='application/json'
        request=urllib.request.Request(self.base+path,data=body,headers=headers,method=method)
        try:response=self.client.open(request)
        except urllib.error.HTTPError as error:response=error
        value=json.load(response);self.assertEqual(response.code,status,value)
        return value,response

    def register(self,email,status=200):
        return self.call('/auth/register',{'email':email,'name':'Synthetic participant','password':'synthetic-password-123','privacy_accepted':True},status)[0]

    def code(self):return self.mail.call_args.args[1]

    def verify(self,challenge,code=None,status=200):
        return self.call('/auth/email/verify',{'ticket':challenge['ticket'],'code':code or self.code()},status)

    def operation(self,args,status=0):
        from app.operations import main
        output=io.StringIO()
        with contextlib.redirect_stdout(output),contextlib.redirect_stderr(output):result=main(args)
        self.assertEqual(result,status,output.getvalue())
        return output.getvalue()

    def test_private_operator_is_provisioned_explicitly_and_must_prove_mailbox(self):
        config={'ADMIN_EMAIL':'private-owner@example.test','ADMIN_PASSWORD':'private-owner-password-123'}
        with patch.dict(os.environ,config):
            self.register(config['ADMIN_EMAIL'],status=403)
            output=self.operation(['provision-admin','--email',config['ADMIN_EMAIL']])
            self.assertNotIn(config['ADMIN_PASSWORD'],output)
            self.operation(['provision-admin','--email','other@example.test'],status=1)
            with SessionLocal() as db:
                owner=db.query(User).filter_by(email=config['ADMIN_EMAIL']).one()
                self.assertIsNone(owner.email_verified_at)
                db.add(User(email='unlisted-admin@example.test',name='Unlisted',role='admin',password_hash=hash_password('unlisted-password-123')));db.commit()
            self.call('/auth/login',{'email':'unlisted-admin@example.test','password':'unlisted-password-123'},status=403)
            self.assertFalse(self.mail.called)
            challenge,_=self.call('/auth/login',{'email':config['ADMIN_EMAIL'],'password':config['ADMIN_PASSWORD']})
            self.call('/programs/wi/catalog',status=401)
            with SessionLocal() as db:
                db.query(EmailVerification).filter_by(email=challenge['email']).update({'created_at':time.time()-61});db.commit()
            newer,_=self.call('/auth/email/resend',{'ticket':challenge['ticket']})
            user,_=self.verify(newer)
            self.assertEqual(user['role'],'admin');self.assertTrue(user['email_verified'])
            self.call('/programs/wi/catalog')
            self.call('/account/export',status=403)
        self.call('/auth/me',status=401)  # removing the exact exception revokes access

    def test_staff_role_changes_require_verified_exact_staff_domain_and_invalidate_sessions(self):
        from app.services.auth_service import verify_password
        staff='delegated-staff@oth-regensburg.de'
        challenge=self.register(staff)
        self.operation(['grant-admin','--email',staff],status=1)
        self.verify(challenge)
        with SessionLocal() as db:before=db.query(User).filter_by(email=staff).one().password_hash
        for invalid in ('student@st.oth-regensburg.de','unconfirmed@oth-regensburg.de','other@example.test','staff@sub.oth-regensburg.de'):
            self.operation(['grant-admin','--email',invalid],status=1)
        self.operation(['grant-admin','--email',staff])
        self.call('/auth/me',status=401)
        user,_=self.call('/auth/login',{'email':staff,'password':'synthetic-password-123'})
        self.assertEqual(user['role'],'admin');self.call('/programs/wi/catalog')
        with SessionLocal() as db:
            current=db.query(User).filter_by(email=staff).one()
            self.assertEqual(current.password_hash,before)
            self.assertTrue(verify_password('synthetic-password-123',current.password_hash))
        self.operation(['revoke-admin','--email',staff])
        self.call('/auth/me',status=401)
        user,_=self.call('/auth/login',{'email':staff,'password':'synthetic-password-123'})
        self.assertEqual(user['role'],'student');self.call('/programs/wi/catalog',status=403)

    def test_explicit_adoption_preserves_study_data_and_does_not_change_other_accounts(self):
        owner='adopted-owner@example.test'
        with SessionLocal() as db:
            existing=User(email=owner,name='Existing owner',role='student',password_hash=hash_password('old-owner-password-123'))
            db.add(existing);db.flush();owner_id=existing.id
            item=Import(source='synthetic',parser_version='test',pdf_sha256='adoption-synthetic-fingerprint')
            db.add(item);db.flush();import_id=item.id
            db.add(UserImport(user_id=owner_id,import_id=import_id))
            student=User(email='preserved-student@st.oth-regensburg.de',name='Student',role='student',password_hash=hash_password('student-password-123'))
            db.add(student);db.commit();student_id=student.id
        config={'ADMIN_EMAIL':owner,'ADMIN_PASSWORD':'new-owner-password-123'}
        with patch.dict(os.environ,config):
            with self.assertLogs('app.services.auth_service',level='ERROR'):bootstrap_admin()
            self.call('/auth/login',{'email':owner,'password':'old-owner-password-123'},status=403)
            self.assertFalse(self.mail.called)
            self.operation(['provision-admin','--email',owner],status=1)
            self.operation(['provision-admin','--email',owner,'--adopt-existing'])
            self.operation(['revoke-admin','--email',owner],status=1)
            self.call('/auth/login',{'email':owner,'password':'old-owner-password-123'},status=401)
            challenge,_=self.call('/auth/login',{'email':owner,'password':config['ADMIN_PASSWORD']})
            self.verify(challenge)
            self.operation(['provision-admin','--email',owner])  # idempotent: no password/proof reset
            self.call('/auth/me')
            self.operation(['provision-admin','--email',owner,'--reset-password'])
            self.call('/auth/me',status=401)
            with SessionLocal() as db:
                self.assertIsNotNone(db.get(UserImport,(owner_id,import_id)))
                self.assertIsNotNone(db.get(Import,import_id))
                self.assertEqual(db.get(User,student_id).role,'student')
                self.assertEqual(db.get(User,owner_id).name,'Existing owner')
                self.assertIsNone(db.get(User,owner_id).email_verified_at)

    def test_exact_domains_and_unverified_access_are_enforced_server_side(self):
        self.call('/auth/register',{'email':'self-grant@oth-regensburg.de','name':'Self grant','password':'synthetic-password-123','privacy_accepted':True,'role':'admin'},status=422)
        for email in ['outside@example.test','a@st.oth-regensburg.de.attacker.test','a@eviloth-regensburg.de','a@sub.oth-regensburg.de','a@оth-regensburg.de']:
            self.register(email,status=403)
        self.assertFalse(self.mail.called)
        self.call('/programs/wi/examples/first',status=401)
        self.call('/programs/wi/dashboard',status=401)
        self.call('/programs/wi/handbook',status=401)
        challenge=self.register('pending@st.oth-regensburg.de')
        self.assertTrue(challenge['verification_required']);self.assertNotIn('code',challenge)
        self.call('/auth/me',status=401);self.call('/imports',status=401)
        with SessionLocal() as db:
            self.assertIsNone(db.query(User).filter_by(email=challenge['email']).first())
            record=db.get(EmailVerification,hashlib.sha256(challenge['ticket'].encode()).hexdigest())
            self.assertNotIn('synthetic-password-123',record.pending_registration_json)
            self.assertNotEqual(record.code_hash,self.code());self.assertNotEqual(record.ticket_hash,challenge['ticket'])

    def test_guest_examples_are_isolated_from_private_access_and_live_catalog(self):
        with SessionLocal() as db:
            before=(db.query(User).count(),db.query(LoginSession).count(),db.query(EmailVerification).count())
        with patch('app.services.dashboard_service.published_semesters',side_effect=AssertionError('Live semester data must remain private')),patch('app.services.catalog_service.published_semesters',side_effect=AssertionError('Live catalog must remain private')):
            from app.services.public_demo import demo_dashboard,SCENARIOS
            demo_dashboard.cache_clear()
            for scenario in SCENARIOS:
                value,response=self.call('/demo/wi/examples/'+scenario)
                self.assertTrue(value['demo']);self.assertEqual(value['example_scenario'],scenario)
                self.assertIsNone(value['import_id']);self.assertIsNone(response.headers.get('Set-Cookie'))
                self.assertNotIn('/api/programs/wi/handbook',json.dumps(value))
                for stage in value['stages']:
                    for module in stage['modules']:
                        for item in [module,*module.get('course_options',[])]:
                            details=item['details']
                            from app.services.public_demo import example_description
                            self.assertEqual(details['description'],example_description(item['title']))
                            for key in ('handbook','reference_handbook','description_pdf'):self.assertNotIn(key,details)
                self.assertTrue(any(m.get('course_options') for s in value['stages'] for m in s['modules']))
        self.assertFalse(self.mail.called)
        with SessionLocal() as db:
            self.assertEqual(before,(db.query(User).count(),db.query(LoginSession).count(),db.query(EmailVerification).count()))
        for path in ('/auth/me','/imports','/account/export','/programs/wi/dashboard','/programs/wi/examples/first','/programs/wi/handbook','/imports/1/dashboard'):
            self.call(path,status=401)

    def test_guest_demo_only_exposes_five_fixed_read_only_scenarios(self):
        for scenario in ('third','practice-seminar','repeat-review','unknown'):
            self.call('/demo/wi/examples/'+scenario,status=404)
        self.call('/demo/wi/examples/first',{},status=405)
        value,_=self.call('/demo/wi/examples/first?start_term=SoSe%202021&term=SoSe%202029&import_id=1')
        self.assertEqual(value['example_start_term'],'WiSe 2026/27')
        self.assertEqual(value['example_term'],'WiSe 2026/27')

    def test_staff_domain_does_not_grant_admin_and_codes_are_single_use(self):
        challenge=self.register('faculty@oth-regensburg.de');code=self.code()
        user,response=self.verify(challenge)
        self.assertEqual(user['role'],'student');self.assertTrue(user['email_verified'])
        self.assertIn('HttpOnly',response.headers['Set-Cookie']);self.assertIn('SameSite=strict',response.headers['Set-Cookie'])
        self.verify(challenge,code,status=400)
        self.call('/programs/wi/examples/first')
        self.call('/programs/wi/catalog',status=403)
        self.call('/auth/logout',{},method='POST')
        login,_=self.call('/auth/login',{'email':challenge['email'],'password':'synthetic-password-123'})
        self.assertEqual(login['id'],user['id']);self.assertNotIn('ticket',login)
        export,_=self.call('/account/export');self.assertIsNotNone(export['account']['email_verified_at'])
        self.call('/account/delete',{'password':'synthetic-password-123'})
        with SessionLocal() as db:
            self.assertIsNone(db.get(User,user['id']));self.assertEqual(db.query(EmailVerification).filter_by(email=challenge['email']).count(),0)

    def test_attempt_limit_expiration_and_resend_invalidate_old_codes(self):
        exhausted=self.register('attempts@st.oth-regensburg.de');correct=self.code();wrong='000000' if correct!='000000' else '111111'
        for _ in range(5):self.verify(exhausted,wrong,status=400)
        self.verify(exhausted,correct,status=400)
        challenge=self.register('resend@st.oth-regensburg.de');old_code=self.code()
        self.call('/auth/email/resend',{'ticket':challenge['ticket']},status=429)
        with SessionLocal() as db:
            db.query(EmailVerification).filter_by(email=challenge['email']).update({'created_at':time.time()-61});db.commit()
        newer,_=self.call('/auth/email/resend',{'ticket':challenge['ticket']})
        self.assertNotEqual(newer['ticket'],challenge['ticket']);self.verify(challenge,old_code,status=400)
        self.verify(newer)
        expired=self.register('expired@oth-regensburg.de');code=self.code()
        with SessionLocal() as db:
            db.query(EmailVerification).filter_by(email=expired['email']).update({'expires_at':time.time()-1});db.commit()
        self.verify(expired,code,status=400)

    def test_existing_sessions_cannot_bypass_new_verification_requirement(self):
        with patch.dict(os.environ,{'REQUIRE_INSTITUTIONAL_EMAIL':'false'}):
            user=self.register('legacy@oth-regensburg.de');self.call('/auth/me')
        self.call('/auth/me',status=401);self.call('/account/export',status=401)
        challenge,_=self.call('/auth/login',{'email':'legacy@oth-regensburg.de','password':'synthetic-password-123'})
        confirmed,_=self.verify(challenge);self.assertEqual(confirmed['id'],user['id'])
        with SessionLocal() as db:self.assertEqual(db.query(LoginSession).filter_by(user_id=user['id']).count(),1)

    def test_mail_failures_do_not_activate_accounts_or_expose_provider_details(self):
        self.mail.side_effect=MailUnavailable('PRIVATE_PROVIDER_DETAILS')
        result=self.register('failure@oth-regensburg.de',status=503)
        self.assertNotIn('PRIVATE_PROVIDER_DETAILS',json.dumps(result))
        with SessionLocal() as db:
            self.assertEqual(db.query(User).filter_by(email='failure@oth-regensburg.de').count(),0)
            self.assertEqual(db.query(EmailVerification).filter_by(email='failure@oth-regensburg.de').count(),0)
        self.mail.side_effect=None
        with patch.dict(os.environ,{'SMTP_HOST':''}):
            self.register('no-smtp@oth-regensburg.de',status=503)

    def test_pre_registered_pending_address_is_not_owned_until_mail_proof(self):
        first=self.register('reclaim@st.oth-regensburg.de')
        with SessionLocal() as db:
            db.query(EmailVerification).filter_by(email=first['email']).update({'created_at':time.time()-61});db.commit()
        second,_=self.call('/auth/register',{'email':first['email'],'name':'Actual mailbox owner','password':'new-owner-password-123','privacy_accepted':True})
        owner,_=self.verify(second)
        self.assertEqual(owner['name'],'Actual mailbox owner')
        self.call('/auth/logout',{},method='POST')
        self.call('/auth/login',{'email':first['email'],'password':'synthetic-password-123'},status=401)
        self.call('/auth/login',{'email':first['email'],'password':'new-owner-password-123'})

    def test_explicit_administrator_keeps_role_only_after_mail_confirmation(self):
        with SessionLocal() as db:
            db.add(User(email='administrator@oth-regensburg.de',name='Synthetic admin',role='admin',password_hash=hash_password('synthetic-admin-password')));db.commit()
        self.call('/auth/login',{'email':'administrator@oth-regensburg.de','password':'wrong-password'},status=401)
        self.assertFalse(self.mail.called)
        challenge,_=self.call('/auth/login',{'email':'administrator@oth-regensburg.de','password':'synthetic-admin-password'})
        self.call('/programs/wi/catalog',status=401)
        user,_=self.verify(challenge);self.assertEqual(user['role'],'admin')
        self.call('/programs/wi/catalog')
