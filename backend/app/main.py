import asyncio
import logging
from contextlib import suppress,asynccontextmanager
from fastapi import FastAPI,Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from urllib.parse import urlparse
from app.db import SessionLocal,engine
from app.services.auth_service import bootstrap_admin
from app.services.privacy import assert_production_ready,retention_days
from app.services.privacy_storage import minimize_existing,expire_inactive,compact_after_scrub
from app.services.security import BodyLimitMiddleware,allowed_origins,production
from app.routers import account,auth,catalog,dashboard,imports

async def maintenance():
    while True:
        await asyncio.sleep(86400)
        try:await asyncio.to_thread(clean_expired)
        except Exception:
            logging.getLogger(__name__).error('Scheduled data retention failed; operator intervention required.')

def clean_expired():
    with SessionLocal() as db:expire_inactive(db,retention_days())

@asynccontextmanager
async def lifespan(app):
    assert_production_ready()
    with SessionLocal() as db:changed=minimize_existing(db)
    if changed:compact_after_scrub(engine)
    clean_expired();bootstrap_admin()
    task=asyncio.create_task(maintenance())
    try:yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):await task

app=FastAPI(title='Study Navigator',version='0.4.0',docs_url=None if production() else '/docs',redoc_url=None,openapi_url=None if production() else '/openapi.json',lifespan=lifespan)
for router in (auth.router,account.router,imports.router,dashboard.router,catalog.router):app.include_router(router)
app.add_middleware(BodyLimitMiddleware)
app.add_middleware(TrustedHostMiddleware,allowed_hosts=list({urlparse(o).hostname for o in allowed_origins()}|{'localhost','127.0.0.1','backend','testserver'}|({'host.docker.internal'} if not production() else set())))

@app.get('/health')
def health():return {'status':'ok'}

@app.exception_handler(RequestValidationError)
async def validation_error(request,error):
    # Pydantic's default includes the submitted value, potentially a password.
    return JSONResponse({'detail':[{'loc':e['loc'],'msg':e['msg'],'type':e['type']} for e in error.errors()]},status_code=422)

@app.middleware('http')
async def protect_requests(request:Request,call_next):
    if request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('origin')
        if request.headers.get('x-requested-with')!='StudyNavigator' or (origin and origin.rstrip('/') not in allowed_origins()):
            return JSONResponse({'detail':'Ungültige Anfrage.'},status_code=403)
    response=await call_next(request)
    for key,value in {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()'}.items():response.headers[key]=value
    return response
