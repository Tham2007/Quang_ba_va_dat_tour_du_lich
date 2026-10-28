"""Delta Travel demo application assembly.

Choose `uvicorn api.app:app` for the educational SQLite/Postgres demo.
Choose `uvicorn api.tham_sqlserver_app:app` for the read-only SQL Server adapter.
They deliberately use different schemas; never point the demo ORM at Tham's DB.
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from api.core import ENV, db_session, fail
from api.models import Base, engine, Tour
from api.seed import seed_demo
from api.routes import auth, tours, bookings, admin, assistant

@asynccontextmanager
async def lifespan(app):
    if ENV == 'production':
        if engine.dialect.name == 'sqlite':
            raise RuntimeError('Production requires PostgreSQL + audited migrations.')
        if os.getenv('DEMO_SEED') == '1':
            raise RuntimeError('DEMO_SEED must never run in production.')
        if os.getenv('AUTO_CREATE_SCHEMA') == '1':
            raise RuntimeError('Production requires reviewed schema migrations.')
    elif os.getenv('AUTO_CREATE_SCHEMA','1') == '1':
        Base.metadata.create_all(engine)
        if os.getenv('DEMO_SEED','1') == '1':
            seed_demo()
    yield


app = FastAPI(title='Delta Travel 2.0 API', version='2.0.0', lifespan=lifespan,
                 docs_url=None if ENV=='production' else '/docs',
                 redoc_url=None if ENV=='production' else '/redoc')

@app.middleware('http')
async def safe_headers(request:Request,call_next):
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='strict-origin-when-cross-origin'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Permissions-Policy']='camera=(), microphone=(), geolocation=()'
    if request.url.path not in ('/docs','/redoc'):
        response.headers['Content-Security-Policy']=(
            "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' https://raw.githubusercontent.com data:; "
        "connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'")
    return response


@app.exception_handler(IntegrityError)
def integrity_error(request, exc):
    return JSONResponse(status_code=409, content={'detail':'Dữ liệu trùng hoặc không hợp lệ.'})

@app.get('/api/v1/health/ready')
def ready(db:Session=Depends(db_session)):
    db.execute(select(func.count()).select_from(Tour)).scalar_one()
    return {'status':'ok','db':'connected'}


# Register business routes explicitly before the catch-all API guard/static mount.
for module in (auth, tours, bookings, admin, assistant):
    app.include_router(module.router)

@app.api_route('/api/v1/{unknown_path:path}',methods=['GET','POST','PUT','PATCH','DELETE'],include_in_schema=False)
def unknown_api(unknown_path:str):
    fail(404,'API endpoint không tồn tại.')


@app.get('/favicon.ico',include_in_schema=False)
def favicon_compat():
    # Browsers may request the classic ICO URL even when the page uses SVG.
    return RedirectResponse('/favicon.svg',status_code=307)


FRONTEND=Path(__file__).resolve().parents[1]/'frontend'
app.mount('/',StaticFiles(directory=str(FRONTEND),html=True),name='frontend')
