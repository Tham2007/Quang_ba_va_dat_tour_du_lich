"""Delta Travel demo application assembly.
Choose `uvicorn api.app:app` for the educational SQLite/Postgres demo.
Choose `uvicorn api.tham_sqlserver_app:app` for the read-only SQL Server adapter.
They deliberately use different schemas; never point the demo ORM at Tham's DB.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from api.core import ENV, db_session, fail
from api.models import Base, engine, Tour
from api.seed import seed_demo
from api.routes import auth, tours, bookings, admin, assistant
from api.core.sqlite_schema import migrate_booking_identity


@asynccontextmanager
async def lifespan(app):
    if ENV == "production":
        if engine.dialect.name == "sqlite":
            raise RuntimeError("Production requires PostgreSQL + audited migrations.")
        if os.getenv("DEMO_SEED") == "1":
            raise RuntimeError("DEMO_SEED must never run in production.")
        if os.getenv("AUTO_CREATE_SCHEMA") == "1":
            raise RuntimeError("Production requires reviewed schema migrations.")
    elif ENV == "staging" and engine.dialect.name == "postgresql":
        # The staging DB is disposable and must be explicitly opted in.
        # Production migrations remain an audited manual release step.
        if os.getenv("STAGING_AUTO_MIGRATE") != "1":
            raise RuntimeError("PostgreSQL staging requires STAGING_AUTO_MIGRATE=1")
        from alembic import command
        from alembic.config import Config

        migration_file = (
            Path(__file__).resolve().parents[2] / "database/database/alembic.ini"
        )
        cfg = Config(str(migration_file))
        command.upgrade(cfg, "head")
        if os.getenv("DEMO_SEED") == "1":
            seed_demo()
    elif os.getenv("AUTO_CREATE_SCHEMA", "1") == "1":
        Base.metadata.create_all(engine)
        migrate_booking_identity(engine)
        if os.getenv("DEMO_SEED", "1") == "1":
            seed_demo()
    yield


app = FastAPI(
    title="Delta Travel 2.0 API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None if ENV == "production" else "/docs",
    redoc_url=None if ENV == "production" else "/redoc",
)


app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def safe_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.path not in ("/docs", "/redoc"):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; "
            "img-src 'self' https: data: blob: http:; "
            "connect-src 'self' https: http:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
        )
    return response


@app.exception_handler(IntegrityError)
def integrity_error(request, exc):
    return JSONResponse(
        status_code=409, content={"detail": "Dữ liệu trùng hoặc không hợp lệ."}
    )


@app.get("/api/v1/health/ready")
def ready(db: Session = Depends(db_session)):
    db.execute(select(func.count()).select_from(Tour)).scalar_one()
    return {"status": "ok", "db": "connected"}


# Register business routes explicitly before the catch-all API guard/static mount.
for module in (auth, tours, bookings, admin, assistant):
    app.include_router(module.router)


@app.api_route(
    "/api/v1/{unknown_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
def unknown_api(unknown_path: str):
    fail(404, "API endpoint không tồn tại.")


# Serve the official frontend from the repository Frontend directory
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "Frontend"
THREE_D_DIR = Path(__file__).resolve().parents[2] / "3D Image data"

if THREE_D_DIR.is_dir():
    app.mount("/3d-frames", StaticFiles(directory=str(THREE_D_DIR)), name="three-d-frames")
    app.mount("/3D Image data", StaticFiles(directory=str(THREE_D_DIR)), name="three-d-data")

@app.get("/favicon.ico", include_in_schema=False)
def favicon_compat():
    return RedirectResponse("/favicon.svg", status_code=307)


@app.get("/admin", include_in_schema=False)
def admin_redirect():
    return RedirectResponse("/admin.html", status_code=307)


if not FRONTEND_DIR.is_dir():
    raise RuntimeError(f"Frontend directory not found at {FRONTEND_DIR}")

frontend_app = StaticFiles(directory=str(FRONTEND_DIR), html=True)
app.mount("/an-live", frontend_app, name="an-frontend")
app.mount("/", frontend_app, name="frontend")
