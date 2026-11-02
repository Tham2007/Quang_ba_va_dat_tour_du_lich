"""Run live integration against an EPHEMERAL SQL Server 2022 CI container.

NEVER run this script against a team, staging, development or production DB.
The disposable SQL Server container is created by ci-sqlserver-real.yml.
"""
from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus

import pymssql
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from api import tham_sqlserver_app as bridge
from scripts.check_tham_sqlserver import check_live

ROOT = Path(__file__).resolve().parents[2]
DB_NAME = "TourDuLichDB"


def demand_isolated_environment() -> tuple[str, str]:
    if os.environ.get("DELTA_SQLSERVER_EPHEMERAL") != "1":
        raise RuntimeError("REFUSED: ephemeral CI guard not set")
    host = os.environ.get("CI_SQLSERVER_HOST", "")
    if host not in ("127.0.0.1", "localhost"):
        raise RuntimeError("REFUSED: only loopback SQL Server allowed")
    password = os.environ.get("CI_SQLSERVER_SA_PASSWORD", "")
    if len(password) < 16:
        raise RuntimeError("REFUSED: no disposable SQL Server password")
    return host, password


def connect_until_ready(host: str, password: str):
    for _ in range(80):
        try:
            return pymssql.connect(
                server=host, user="sa", password=password, database="master",
                login_timeout=3, timeout=10, autocommit=True
            )
        except pymssql.Error:
            time.sleep(2)
    raise RuntimeError("Ephemeral SQL Server did not become ready")


def sql_batches(text: str):
    for batch in re.split(r"^\s*GO\s*(?:--[^\n]*)?$", text, flags=re.I | re.M):
        if batch.strip():
            yield batch


def execute_script(conn, path: Path):
    script = path.read_text(encoding="utf-8-sig")
    for i, batch in enumerate(sql_batches(script), 1):
        try:
            with conn.cursor() as cursor:
                cursor.execute(batch)
                while cursor.nextset():
                    pass
        except pymssql.Error as exc:
            # No connection string or password is written to logs.
            safe_reason = str(exc).replace(os.environ.get("CI_SQLSERVER_SA_PASSWORD", ""), "[REDACTED]")
            raise RuntimeError(
                f"{path.name}, T-SQL batch {i} failed: {type(exc).__name__}: {safe_reason[:450]}"
            ) from None
    print(f"PASS: executed {path.name}")


def assert_http(client, path, expected=200, method="get", payload=None):
    resp = getattr(client, method)(path, json=payload) if method == "post" else client.get(path)
    if resp.status_code != expected:
        raise AssertionError(f"{method.upper()} {path}: expected {expected}, got {resp.status_code}")
    return resp.json() if expected == 200 else None


def main():
    host, password = demand_isolated_environment()
    conn = connect_until_ready(host, password)
    with conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM sys.databases WHERE name=%s", (DB_NAME,)
            )
            if cursor.fetchone()[0] != 0:
                raise RuntimeError("REFUSED: test DB already exists; never overwrite")
            cursor.execute("CREATE DATABASE TourDuLichDB")
        print("PASS: created clean, disposable SQL Server database")

        scripts = ROOT / "database" / "database"
        for path in (
            scripts / "01_schema/02_create_tables_3nf.sql",
            scripts / "02_constraints/01_foreign_keys_and_checks.sql",
            # Seed script disables and re-enables booking trigger, so it must exist.
            scripts / "04_programmability/01_triggers_booking_inventory.sql",
            scripts / "05_seed_data/01_sample_data_realistic.sql",
        ):
            execute_script(conn, path)

        engine = create_engine(
            f"mssql+pymssql://sa:{quote_plus(password)}@{host}:1433/{DB_NAME}",
            pool_pre_ping=True,
        )
        try:
            result = check_live(engine)
            if result.get("status") != "READ_ONLY_OK":
                raise AssertionError(
                    "Live SQL Server schema verification unsuccessful: "
                    + str({k: v for k, v in result.items() if k in ("status", "missing_tables", "missing_columns")})
                )
            print("PASS: READ_ONLY_OK, 12 real SQL Server tables")
            # The backend SQL queries are executed through a real SQLAlchemy
            # SQL Server engine, not the FakeReader used by unit tests.
            bridge._engine = lambda: engine
            with TestClient(bridge.app) as client:
                health = assert_http(client, "/api/v1/health/ready")
                if health.get("status") != "ok":
                    raise AssertionError("Health did not report ready")
                categories = assert_http(client, "/api/v1/categories")
                tours = assert_http(client, "/api/v1/tours")
                if len(categories) < 1 or len(tours) < 1:
                    raise AssertionError("Live seed catalog is empty")
                ident = tours[0]["id"]
                assert_http(client, "/api/v1/tours/" + ident)
                assert_http(client, "/api/v1/tours/" + ident + "/gallery")
                assert_http(client, "/api/v1/tours/" + ident + "/itinerary")
                schedules = assert_http(client, "/api/v1/tours/" + ident + "/schedules")
                if schedules:
                    open_schedule = next((s for s in schedules if s["active"]), None)
                    if open_schedule:
                        quote = assert_http(
                            client, "/api/v1/bookings/quote", method="post",
                            payload={"schedule_id": open_schedule["id"], "adults": 1},
                        )
                        if quote["unitPrice"] <= 0 or quote["quoteOnly"] is not True:
                            raise AssertionError("Live quote result invalid")
                assert_http(client, "/api/v1/articles")
                # No fake bookable writes or payment to SQL Server.
                assert client.post("/api/v1/bookings").status_code == 503
                assert client.post("/api/v1/admin/bookings/1/confirm-payment").status_code == 503
                print(
                    f"PASS: real SQL Server FastAPI HTTP queries; "
                    f"categories={len(categories)}, tours={len(tours)}, "
                    f"schedules={len(schedules)}, booking writes deliberately blocked"
                )
        finally:
            engine.dispose()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # CI errors are safe to paste in an issue and carry no credentials.
        print(f"FAIL: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
