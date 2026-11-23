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

    def test_operator_delivery_test_contains_no_grades_or_verification_code(self):
        config={'SMTP_HOST':'smtp.test.invalid','SMTP_FROM':'sender@example.test','SMTP_SECURITY':'ssl','SMTP_PORT':'465'}
        with patch.dict(os.environ,config,clear=True),patch('smtplib.SMTP_SSL') as constructor:
            email.send_test('synthetic@oth-regensburg.de')
            message=constructor.return_value.__enter__.return_value.send_message.call_args.args[0]
            self.assertIn('kein Konto angelegt',message.get_content())
            self.assertIsNotNone(message['Date']);self.assertIsNotNone(message['Message-ID'])
            self.assertEqual(message['To'],'synthetic@oth-regensburg.de')
            with self.assertRaises(email.MailUnavailable):email.send_test('outside@example.test')
