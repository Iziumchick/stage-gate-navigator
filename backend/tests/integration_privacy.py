"""End-to-end privacy/security checks using synthetic PDFs and a disposable DB."""
import os,json,tempfile,threading,time,socket,http.cookiejar,urllib.request,urllib.error,unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import patch

directory=tempfile.TemporaryDirectory()
os.environ['DATABASE_URL']='sqlite:///'+directory.name+'/privacy.db'
from app.main import app
from app.db import SessionLocal,engine
from app.models import Import,User,UserImport,LoginSession
from app.services.auth_service import hash_password
from app.services.privacy_storage import minimize_existing,expire_inactive,compact_after_scrub
from app.services.pdf_service import parse_student_pdf,PdfProcessingError
from leistungen_pdf_fixture import pdf_export
import pymupdf,uvicorn

class PrivacyTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  sock=socket.socket();sock.bind(('127.0.0.1',0));cls.base=f'http://127.0.0.1:{sock.getsockname()[1]}'
  cls.server=uvicorn.Server(uvicorn.Config(app,log_level='critical'));cls.thread=threading.Thread(target=cls.server.run,kwargs={'sockets':[sock]},daemon=True);cls.thread.start()
  for _ in range(100):
   if cls.server.started:break
   time.sleep(.05)
  assert cls.server.started
 @classmethod
 def tearDownClass(cls):cls.server.should_exit=True;cls.thread.join(5)
 def call(self,client,path,body=None,method=None,headers=None,status=200):
  h={'X-Requested-With':'StudyNavigator',**(headers or {})}
  if isinstance(body,dict):body=json.dumps(body).encode();h['Content-Type']='application/json'
  request=urllib.request.Request(self.base+path,data=body,method=method,headers=h)
  try:
   response=client.open(request);payload=response.read();self.assertEqual(response.status,status);return json.loads(payload),response
  except urllib.error.HTTPError as error:
   payload=error.read();self.assertEqual(error.code,status,payload.decode());return (json.loads(payload) if error.headers.get_content_type()=='application/json' else payload.decode()),error
 def user(self,suffix):
  client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  account,_=self.call(client,'/auth/register',{'email':suffix+'@example.test','name':suffix,'password':'a-long-test-password','privacy_accepted':True})
  return client,account
 def upload(self,client,data,filename='results.pdf',status=200):
  boundary='privacy-boundary';body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: application/pdf\r\n\r\n'.encode()+data+f'\r\n--{boundary}--\r\n'.encode())
  return self.call(client,'/imports/upload',body,headers={'Content-Type':f'multipart/form-data; boundary={boundary}'},status=status)[0]
 def test_results_are_minimal_private_and_independently_erasable(self):
  a,ua=self.user('privacy-a');b,ub=self.user('privacy-b')
  with pymupdf.open(stream=pdf_export(),filetype='pdf') as doc:
   doc[0].insert_text((10,10),'PRIVATE_HEADER_NAME_AND_ID_12345');data=doc.tobytes()
  first=self.upload(a,data)['import_id'];self.assertEqual(self.upload(a,data)['import_id'],first)
  second=self.upload(b,data)['import_id'];self.assertNotEqual(first,second)
  self.call(b,f'/imports/{first}/dashboard',status=404)
  self.call(b,f'/imports/{first}',method='DELETE',status=404)
  self.call(a,f'/imports/{first}/raw-lines',status=410)
  export,_=self.call(a,'/account/export');self.assertEqual(export['account']['email'],ua['email']);self.assertEqual(len(export['imports']),1)
  self.assertNotIn('PRIVATE_HEADER',json.dumps(export))
  with SessionLocal() as db:
   for key in (first,second):
    item=db.get(Import,key);self.assertIsNone(item.raw_text);self.assertIsNone(item.raw_lines_json);self.assertNotIn('PRIVATE_HEADER',item.parsed_modules_json)
  self.call(a,f'/imports/{first}',method='DELETE')
  self.call(b,f'/imports/{second}/dashboard')
  self.call(a,'/account/delete',{'password':'wrong-password'},status=403)
  self.call(a,'/account/delete',{'password':'a-long-test-password'})
  self.call(a,'/auth/me',status=401)
  with SessionLocal() as db:
   self.assertIsNone(db.get(User,ua['id']));self.assertFalse(db.query(LoginSession).filter_by(user_id=ua['id']).count());self.assertIsNotNone(db.get(Import,second))
 def test_consent_withdrawal_and_request_protection(self):
  client,user=self.user('privacy-controls');self.upload(client,pdf_export())
  self.call(client,'/account/results',method='DELETE')
  items,_=self.call(client,'/imports');self.assertEqual(items,[])
  with SessionLocal() as db:self.assertIsNone(db.get(User,user['id']).privacy_version)
  self.upload(client,pdf_export(),status=428)
  _,blocked=self.call(client,'/account/consent',{'accepted':True},headers={'Origin':'https://untrusted.example'},status=403)
  self.assertIn('noindex',blocked.headers.get('X-Robots-Tag',''))
  self.call(client,'/account/consent',{'accepted':True})
  self.call(client,'/auth/register',{'email':'invalid','name':'x','password':'DO_NOT_ECHO_THIS_PASSWORD','privacy_accepted':True},status=422)
  data,response=self.call(client,'/auth/register',{'email':'redaction@example.test','name':'x','password':'SECRET'},status=422)
  self.assertNotIn('SECRET',json.dumps(data));self.assertEqual(response.headers.get('X-Content-Type-Options'),'nosniff')
  for path in ('/privacy','/health'):
   _,public=self.call(client,path)
   self.assertEqual(public.headers.get('X-Robots-Tag'),'noindex, nofollow, nosnippet')
  self.call(client,'/health',headers={'Host':'untrusted.example'},status=400)
  self.call(client,'/account/consent',b'',headers={'Content-Type':'application/json','Content-Length':str(12*1024*1024+1)},status=413)
 def test_pdf_validation_rejects_active_encrypted_wrong_and_excessive_documents(self):
  client,_=self.user('privacy-invalid')
  self.upload(client,b'%PDF-1.7\nnot a document',status=422)
  self.upload(client,b'<html>not pdf</html>',status=400)
  self.upload(client,pdf_export(),filename='results.exe',status=400)
  with pymupdf.open(stream=pdf_export(),filetype='pdf') as doc:
   encrypted=doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256,owner_pw='owner',user_pw='password')
  self.upload(client,encrypted,status=422)
  with pymupdf.open(stream=pdf_export(),filetype='pdf') as doc:
   xref=doc.get_new_xref();doc.update_object(xref,'<< /S /JavaScript /JS (app.alert("test")) >>');doc.xref_set_key(doc.pdf_catalog(),'OpenAction',f'{xref} 0 R');active=doc.tobytes()
  self.upload(client,active,status=422)
  with pymupdf.open() as doc:
   for _ in range(81):doc.new_page()
   excessive=doc.tobytes()
  self.upload(client,excessive,status=422)
  self.assertEqual(self.call(client,'/imports')[0],[])
  with patch('subprocess.run',side_effect=__import__('subprocess').TimeoutExpired('parser',20)):
   self.assertRaises(PdfProcessingError,parse_student_pdf,pdf_export())
 def test_retention_and_old_raw_text_migration(self):
  _,user=self.user('privacy-old')
  with SessionLocal() as db:
   item=Import(source='pdf_upload',parser_version='0.2.0',pdf_sha256='f'*64,raw_text='ERASE_LEGACY_RAW_MARKER',raw_lines_json='[]',status='success');db.add(item);db.flush();db.add(UserImport(user_id=user['id'],import_id=item.id));db.commit()
   self.assertTrue(minimize_existing(db));self.assertIsNone(db.get(Import,item.id).raw_text)
   db.get(User,user['id']).last_active_at=datetime.now(timezone.utc)-timedelta(days=91);db.commit();self.assertGreaterEqual(expire_inactive(db,90),1)
   self.assertIsNone(db.get(User,user['id']))
  compact_after_scrub(engine)
  with open(directory.name+'/privacy.db','rb') as file:self.assertNotIn(b'ERASE_LEGACY_RAW_MARKER',file.read())
 def test_legacy_shared_import_is_split_before_independent_deletion(self):
  a,ua=self.user('legacy-shared-a');b,ub=self.user('legacy-shared-b')
  with SessionLocal() as db:
   shared=Import(source='pdf_upload',parser_version='0.2.0',pdf_sha256='c'*64,raw_text='OLD_HEADER',raw_lines_json='[]',status='success',overall_credits=0)
   orphan=Import(source='pdf_upload',parser_version='0.2.0',pdf_sha256='d'*64,raw_text='ORPHAN_HEADER',status='success')
   db.add_all([shared,orphan]);db.flush()
   db.add_all([UserImport(user_id=ua['id'],import_id=shared.id),UserImport(user_id=ub['id'],import_id=shared.id)]);db.commit()
   self.assertTrue(minimize_existing(db));self.assertIsNone(db.query(Import).filter_by(pdf_sha256='d'*64).first())
   links=db.query(UserImport).filter(UserImport.user_id.in_([ua['id'],ub['id']])).all()
   self.assertEqual(len({link.import_id for link in links}),2)
   self.assertTrue(all(db.get(Import,link.import_id).raw_text is None for link in links))
  self.call(a,'/account/delete',{'password':'a-long-test-password'})
  export,_=self.call(b,'/account/export');self.assertEqual(len(export['imports']),1);self.assertEqual(export['imports'][0]['ects'],0)
