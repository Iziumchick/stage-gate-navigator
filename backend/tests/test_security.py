import asyncio
import os
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from app.services.security import BodyLimitMiddleware, rate_limit
from app.services.privacy import assert_production_ready


class SecurityTests(unittest.TestCase):
    def test_chunked_oversized_body_never_reaches_application(self):
        async def exercise(chunks, limit):
            called, sent = [], []
            messages = iter({'type': 'http.request', 'body': value, 'more_body': index < len(chunks)-1} for index, value in enumerate(chunks))
            async def receive(): return next(messages)
            async def send(message): sent.append(message)
            async def app(scope, receive, send): called.append((await receive())['body'])
            await BodyLimitMiddleware(app, limit)({'type':'http', 'headers':[]}, receive, send)
            return called, sent
        called, sent = asyncio.run(exercise([b'abc', b'def'], 5))
        self.assertEqual(called, [])
        self.assertEqual(sent[0]['status'], 413)
        self.assertEqual(asyncio.run(exercise([b'ab', b'cd'], 5))[0], [b'abcd'])

    def test_production_requires_real_reviewed_information_and_https(self):
        with patch.dict(os.environ, {'APP_ENV':'production'}, clear=True):
            self.assertRaises(RuntimeError, assert_production_ready)
            fields = ['CONTROLLER','CONTACT','ADDRESS','HOSTING_PROVIDER','HOSTING_COUNTRY','AUTHORITY','BACKUP_POLICY','LOG_POLICY','MAIL_PROVIDER','MAIL_RETENTION']
            os.environ.update({f'PRIVACY_{key}':'Synthetic configuration only' for key in fields})
            os.environ.update(PRIVACY_REVIEWED='true', COOKIE_SECURE='true', APP_ORIGINS='http://test.invalid')
            self.assertRaises(RuntimeError, assert_production_ready)
            os.environ['APP_ORIGINS']='https://test.invalid'
            self.assertRaises(RuntimeError, assert_production_ready)
            os.environ.update(SMTP_HOST='smtp.test.invalid',SMTP_FROM='sender@example.test',SMTP_SECURITY='starttls')
            assert_production_ready()

    def test_rate_limit_is_per_identity(self):
        rate_limit(None, 'unit-limit', limit=1, key='synthetic-a')
        with self.assertRaises(HTTPException) as raised:
            rate_limit(None, 'unit-limit', limit=1, key='synthetic-a')
        self.assertEqual(raised.exception.status_code, 429)
        rate_limit(None, 'unit-limit', limit=1, key='synthetic-b')
