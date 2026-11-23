"""Small, bounded security controls shared by authentication and uploads."""
import hashlib
import os
import threading
import time
from collections import OrderedDict
from fastapi import HTTPException, Request

_lock=threading.Lock()
_buckets=OrderedDict()
ROBOTS_POLICY='noindex, nofollow, nosnippet'

def rate_limit(request:Request,scope='auth',limit=30,seconds=900,key=None):
    identity=key or (request.client.host if request.client else 'unknown')
    bucket=(scope,hashlib.sha256(str(identity).encode()).hexdigest())
    now=time.monotonic()
    with _lock:
        values=[t for t in _buckets.pop(bucket,[]) if t>now-seconds]
        if len(values)>=limit:
            _buckets[bucket]=values
            raise HTTPException(429,'Zu viele Versuche. Bitte später erneut versuchen.',headers={'Retry-After':str(seconds)})
        _buckets[bucket]=values+[now]
        while len(_buckets)>10000:_buckets.popitem(last=False)

def production():return os.getenv('APP_ENV','development')=='production'

def allowed_origins():
    return {v.strip().rstrip('/') for v in os.getenv('APP_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',') if v.strip()}

class BodyLimitMiddleware:
    """Bound the body before multipart/JSON parsers or endpoint code see it."""
    def __init__(self,app,max_bytes=12*1024*1024):self.app,self.max_bytes=app,max_bytes
    async def __call__(self,scope,receive,send):
        if scope['type']!='http':return await self.app(scope,receive,send)
        from starlette.responses import JSONResponse
        async def reject():
            await JSONResponse({'detail':'Die Anfrage ist zu groß (maximal 12 MB).'},status_code=413)(scope,receive,send)
        headers=dict(scope.get('headers',[]))
        try:
            if int(headers.get(b'content-length',b'0'))>self.max_bytes:return await reject()
        except ValueError:
            return await JSONResponse({'detail':'Ungültige Anfragelänge.'},status_code=400)(scope,receive,send)
        body=bytearray()
        while True:
            message=await receive()
            if message['type']=='http.disconnect':return
            body.extend(message.get('body',b''))
            if len(body)>self.max_bytes:return await reject()
            if not message.get('more_body',False):break
        delivered=False
        async def replay():
            nonlocal delivered
            if delivered:return await receive()
            delivered=True
            return {'type':'http.request','body':bytes(body),'more_body':False}
        return await self.app(scope,replay,send)
