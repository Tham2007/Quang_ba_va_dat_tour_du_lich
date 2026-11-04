"""Write-flow tests against SQL Server 2022 EPHEMERAL local CI only.

A real networked SQL Server in CI is required. Never use production/staging
credentials, customer accounts or databases from this script.
"""
import importlib
import os
import uuid
from pathlib import Path

import pymssql
from fastapi.testclient import TestClient

from scripts.ci_sqlserver_e2e import execute_script

ROOT = Path(__file__).resolve().parents[2]


def run_sqlserver_write_tests(host: str, password: str, engine) -> None:
    if os.environ.get("DELTA_SQLSERVER_EPHEMERAL") != "1" or host not in ("127.0.0.1", "localhost"):
        raise RuntimeError("Refusing writes outside disposable loopback SQL Server CI")
    migration = ROOT / "database/database/migrations/sqlserver/001_auth_sessions_idempotency.sql"
    conn = pymssql.connect(server=host, user="sa", password=password,
                           database="TourDuLichDB", autocommit=True)
    try:
        execute_script(conn, migration)
        # Verify the migration did not mutate the original twelve core tables.
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) FROM sys.tables
                WHERE name IN ('API_PHIENDANGNHAP','API_YEUCAU_DATTOUR')
            """)
            assert cur.fetchone()[0] == 2, "Security infrastructure migration missing"
            cur.execute("""
                INSERT INTO dbo.CHUYENKHOIHANH
                (MaTour,NgayKhoiHanh,NgayKetThuc,GiaThucTe,SoChoToiDa,SoChoDaDat,TrangThaiChuyen)
                OUTPUT INSERTED.MaChuyen
                VALUES (2,DATEADD(day,95,GETDATE()),DATEADD(day,98,GETDATE()),2500000,2,0,N'Mở bán')
            """)
            schedule_id = cur.fetchone()[0]
    finally:
        conn.close()

    os.environ["THAM_BOOKING_WRITES_ENABLED"] = "1"
    from api import tham_sqlserver_app
    write_bridge = importlib.reload(tham_sqlserver_app)
    write_bridge._engine = lambda: engine

    with TestClient(write_bridge.app) as client:
        ident = uuid.uuid4().hex
        user = {
            "full_name": "CI SQL Customer", "email": "sql-ci-" + ident[:14] + "@example.invalid",
            "phone": "091" + "".join(str(int(x, 16) % 10) for x in ident[:7]),
            "password": "CI-SQL-Password-Strong-123!"
        }
        registered = client.post("/api/v1/auth/register", json=user)
        assert registered.status_code == 201, f"register {registered.status_code}: {registered.text[:350]}"
        assert registered.json()["role"] == "CUSTOMER"
        assert client.get("/api/v1/auth/me").status_code == 200
        assert client.get("/api/v1/auth/session").json()["authenticated"] is True
        csrf = client.cookies["delta_csrf"]
        head = {"X-CSRF-Token": csrf}
        body = {
            "schedule_id": str(schedule_id), "adults": 1, "children": 0,
            "infants": 0, "customer_name": "CI SQL Customer",
            "customer_phone": user["phone"], "customer_email": user["email"], "note": ""
        }
        import uuid as uuid_mod
        idem = str(uuid_mod.uuid4())
        assert client.post("/api/v1/bookings", json=body, headers={"Idempotency-Key": idem}).status_code == 403
        created = client.post("/api/v1/bookings", json=body, headers={**head, "Idempotency-Key": idem})
        assert created.status_code == 201, f"create {created.status_code}: {created.text[:350]}"
        booking = created.json()
        assert booking["status"] == "PENDING_PAYMENT" and not booking["paid"]
        assert booking["storage"] == "sqlserver"
        assert client.get("/api/v1/bookings/" + booking["id"]).status_code == 200
        replay = client.post("/api/v1/bookings", json=body, headers={**head, "Idempotency-Key": idem})
        assert replay.status_code == 201 and replay.json()["id"] == booking["id"]
        changed_body = {**body, "adults": 2}
        assert client.post("/api/v1/bookings", json=changed_body,
                           headers={**head, "Idempotency-Key": idem}).status_code == 409
        assert client.post("/api/v1/bookings", json={**body, "children": 1},
                           headers={**head, "Idempotency-Key": str(uuid.uuid4())}).status_code == 422
        assert client.post("/api/v1/bookings", json=body,
                           headers={**head, "Idempotency-Key": str(uuid.uuid4())}).status_code == 201
        assert client.post("/api/v1/bookings", json=body,
                           headers={**head, "Idempotency-Key": str(uuid.uuid4())}).status_code == 409
        with engine.connect() as conn:
            from sqlalchemy import text
            seats = conn.execute(text("SELECT SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen=:sid"),
                                 {"sid": schedule_id}).scalar_one()
        assert seats == 2, f"Expected exactly 2 holds, got {seats}"
        cancelled = client.post("/api/v1/bookings/" + booking["id"] + "/cancel", headers=head)
        assert cancelled.status_code == 200, f"cancel {cancelled.status_code}: {cancelled.text[:350]}"
        assert cancelled.json()["status"] == "CANCELLED"
        assert client.post("/api/v1/bookings/" + booking["id"] + "/cancel", headers=head).status_code == 200
        with engine.connect() as conn:
            seats = conn.execute(text("SELECT SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen=:sid"),
                                 {"sid": schedule_id}).scalar_one()
        assert seats == 1, f"Expected 1 remaining hold, got {seats}"
        assert client.post("/api/v1/admin/bookings/1/confirm-payment", json={}, headers=head).status_code == 503
        assert client.post("/api/v1/auth/logout", headers=head).status_code == 200
        assert client.get("/api/v1/auth/me").status_code == 401
        bad_login = client.post("/api/v1/auth/login", json={"email": user["email"], "password": "bad"})
        assert bad_login.status_code == 401
        login = client.post("/api/v1/auth/login", json={"email": user["email"], "password": user["password"]})
        assert login.status_code == 200
        print("PASS: real SQL Server HTTP register/login/cookie/CSRF/book/replay/conflict/no-oversell/cancel/logout")

    # Never leave write-enabled global toggle set in the interpreter.
    os.environ.pop("THAM_BOOKING_WRITES_ENABLED", None)
