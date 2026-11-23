import contextlib
import io
import os
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from app.operations import main
from app.services.institutional_email import MailUnavailable


class OperationsTests(unittest.TestCase):
    def run_command(self,args):
        output=io.StringIO()
        with contextlib.redirect_stdout(output),contextlib.redirect_stderr(output):code=main(args)
        return code,output.getvalue()

    def test_configuration_check_does_not_send_mail_or_expose_credentials(self):
        with patch.dict(os.environ,{'SMTP_PASSWORD':'PRIVATE_TEST_SECRET'},clear=True),patch('app.operations.send_test') as send:
            code,output=self.run_command(['check'])
            self.assertEqual(code,1);self.assertNotIn('PRIVATE_TEST_SECRET',output)
            self.assertIn('controller',output);self.assertIn('APP_ENV',output);send.assert_not_called()

    def test_mail_acceptance_is_not_claimed_as_delivery(self):
        with patch('app.operations.send_test') as send:
            code,output=self.run_command(['smtp-test','--to','synthetic@oth-regensburg.de'])
            self.assertEqual(code,0);send.assert_called_once_with('synthetic@oth-regensburg.de')
            self.assertIn('does not prove inbox delivery',output)

    def test_mail_failure_is_sanitized(self):
        with patch('app.operations.send_test',side_effect=MailUnavailable('SECRET_PROVIDER_RESPONSE')):
            code,output=self.run_command(['smtp-test','--to','synthetic@oth-regensburg.de'])
            self.assertEqual(code,1);self.assertNotIn('SECRET_PROVIDER_RESPONSE',output)

    def test_configuration_check_never_opens_or_creates_a_database(self):
        with tempfile.TemporaryDirectory() as folder:
            path=folder+'/must-not-exist.db'
            result=subprocess.run([sys.executable,'-m','app.operations','check'],env={**os.environ,'DATABASE_URL':'sqlite:///'+path},capture_output=True,text=True)
            self.assertEqual(result.returncode,1)
            self.assertIn('Public information',result.stdout)
            self.assertFalse(os.path.exists(path))
