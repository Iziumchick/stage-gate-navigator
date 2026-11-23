import os
import unittest
from unittest.mock import patch
from app.services import institutional_email as email


class InstitutionalMailTests(unittest.TestCase):
    def test_domain_policy_is_exact(self):
        for address in ('person@st.oth-regensburg.de','person@oth-regensburg.de','PERSON@OTH-REGENSBURG.DE'):
            self.assertTrue(email.allowed(address))
        for address in ('person@oth-regensburg.de.attacker.test','person@sub.oth-regensburg.de','@oth-regensburg.de','a@@oth-regensburg.de','a\n@oth-regensburg.de','a,b@oth-regensburg.de','a(comment)@oth-regensburg.de'):
            self.assertFalse(email.allowed(address))

    def test_mail_transport_requires_tls_and_sanitizes_failures(self):
        config={'SMTP_HOST':'smtp.test.invalid','SMTP_FROM':'sender@example.test','SMTP_PORT':'587','SMTP_SECURITY':'starttls','SMTP_USER':'synthetic-user','SMTP_PASSWORD':'synthetic-secret'}
        with patch.dict(os.environ,config,clear=True),patch('smtplib.SMTP') as constructor:
            smtp=constructor.return_value.__enter__.return_value
            email.send_verification('synthetic@oth-regensburg.de','123456')
            smtp.starttls.assert_called_once();smtp.login.assert_called_once_with('synthetic-user','synthetic-secret')
            message=smtp.send_message.call_args.args[0]
            self.assertIn('123456',message.get_content());self.assertIn('kein offizieller Dienst',message.get_content())
            constructor.side_effect=OSError('private transport configuration')
            with self.assertRaises(email.MailUnavailable) as raised:email.send_verification('synthetic@oth-regensburg.de','123456')
            self.assertNotIn('private',str(raised.exception))
        with patch.dict(os.environ,{**config,'SMTP_SECURITY':'none'},clear=True):self.assertRaises(email.MailUnavailable,email.smtp_config)

    def test_production_enforces_verification_even_if_local_flag_is_false(self):
        with patch.dict(os.environ,{'APP_ENV':'production','REQUIRE_INSTITUTIONAL_EMAIL':'false'},clear=True):self.assertTrue(email.required())

    def test_private_operator_exception_requires_exact_address_and_admin_role(self):
        with patch.dict(os.environ,{'ADMIN_EMAIL':'owner@example.test'},clear=True):
            self.assertFalse(email.allowed('owner@example.test'))
            self.assertTrue(email.account_allowed('owner@example.test','admin'))
            for address,role in [('owner@example.test','student'),('other@example.test','admin'),('owner@example.test.attacker.test','admin'),('Owner <owner@example.test>','admin')]:
                self.assertFalse(email.account_allowed(address,role))
            self.assertTrue(email.account_allowed('staff@oth-regensburg.de','student'))

    def test_configured_operator_mailbox_is_validated(self):
        config={'APP_ENV':'production','SMTP_HOST':'smtp.test.invalid','SMTP_FROM':'sender@example.test','ADMIN_EMAIL':'owner@example.test'}
        with patch.dict(os.environ,config,clear=True):email.assert_ready()
        for invalid in ('not-an-email','Owner <owner@example.test>','owner@bad..test','a\n@other.test'):
            with patch.dict(os.environ,{**config,'ADMIN_EMAIL':invalid},clear=True):
                self.assertRaises(RuntimeError,email.assert_ready)

    def test_operator_delivery_test_contains_no_grades_or_verification_code(self):
        config={'SMTP_HOST':'smtp.test.invalid','SMTP_FROM':'sender@example.test','SMTP_SECURITY':'ssl','SMTP_PORT':'465'}
        with patch.dict(os.environ,config,clear=True),patch('smtplib.SMTP_SSL') as constructor:
            email.send_test('synthetic@oth-regensburg.de')
            message=constructor.return_value.__enter__.return_value.send_message.call_args.args[0]
            self.assertIn('kein Konto angelegt',message.get_content())
            self.assertIsNotNone(message['Date']);self.assertIsNotNone(message['Message-ID'])
            self.assertEqual(message['To'],'synthetic@oth-regensburg.de')
            with self.assertRaises(email.MailUnavailable):email.send_test('outside@example.test')
        with patch.dict(os.environ,{**config,'ADMIN_EMAIL':'owner@example.test'},clear=True),patch('smtplib.SMTP_SSL') as constructor:
            email.send_test('owner@example.test')
            self.assertEqual(constructor.return_value.__enter__.return_value.send_message.call_args.args[0]['To'],'owner@example.test')
