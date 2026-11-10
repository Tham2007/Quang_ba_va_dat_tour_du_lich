"""Real ASP.NET Core API -> disposable Microsoft SQL Server end-to-end tests.

SAFEGUARD: refuses to run unless SQL Server is on loopback and the explicit
ephemeral CI flag is set. NEVER point this script to SmarterASP or any shared DB.
No credentials are printed or committed for live databases.
"""
from __future__ import annotations
import os
import re
import subprocess
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pymssql
import requests

ROOT = Path(__file__).resolve().parents[2]
BASE = "http://127.0.0.1:10000/api/v1"
SCHEMA_DIR = ROOT / "database" / "database"
DB = "TourDuLichDB"
PSWD = os.environ.get("CI_SQLSERVER_SA_PASSWORD", "")


def checked_environment():
    if (os.getenv("DELTA_SQLSERVER_EPHEMERAL") != "1":
        raise RuntimeError("REFUSED: DELTA_SQLSERVER_EPHEMERAL must be 1")
    if os.getenv("CI_SQLSERVER_HOST") not in ("127.0.0.1", "localhost"):
        raise RuntimeError("REFUSED: disposable SQL Server must be on loopback")
    if len(PSWD) < 16:
        raise RuntimeError("REFUSED: missing disposable CI-only password")


def connect(database="master"):
    return pymssql.connect(server="127.0.0.1", port="1433", user="sa",
                           password=PSWD, database=database, timeout=20,
                           login_timeout=3, autocommit=True)


def boot_database():
    conn = None
    for _ in range(80):
        try:
            conn = connect()
            break
        except pymssql.Error:
            time.sleep(2)
    if conn is None:
        raise AssertionError("Disposable SQL Server not ready")
    with conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM sys.databases WHERE name=%s", (DB,))
            assert cur.fetchone()[0] == 0, "Refuse to overwrite non-empty SQL database"
            cur.execute("CREATE DATABASE TourDuLichDB")
        for name in (
            "01_schema/02_create_tables_3nf.sql",
            "02_constraints/01_foreign_keys_and_checks.sql",
            "04_programmability/01_triggers_booking_inventory.sql",
            "05_seed_data/01_sample_data_realistic.sql",
        ):
            sql = (SCHEMA_DIR / name).read_text(encoding="utf-8-sig")
            batches = re.split(r"^\\s*GO\\s*(?:--[^\\n]*)?$", sql, flags=re.I | re.M)
            for batch in batches:
                if batch.strip():
                    with conn.cursor() as cur:
                        cur.execute(batch)
                        while cur.nextset():
                            pass
            print("SQL_SCHEMA_LOADED:", name)


def new_schedule(conn, capacity, label):
    with conn.cursor() as cur:
        cur.execute("""DECLARE @id int;
INSERT dbo.CHUYENKHOIHANH(MaTour,NgayKhoiHanh,NgayKetThuc,GiaThucTe,SoChoToiDa,SoChoDaDat,TrangThaiChuyen)
VALUES ((SELECT TOP (1) MaTour FROM dbo.TOUR ORDER BY MaTour),
 DATEADD(DAY,90,GETDATE()),DATEADD(DAY,94,GETDATE()),1500000,@capacity,0,N'Mở bán');
SELECT CAST(SCOPE_IDENTITY() AS int);""", {"capacity": capacity})
        row = cur.fetchone()
        assert row and isinstance(row[0], int), f"Schedule insert failed: {label}"
        return row[0]


def seats(conn, schedule):
    with conn.cursor() as cur:
        cur.execute("SELECT SoChoDaDat,SoChoToiDa FROM dbo.CHUYENKHOIHANH WHERE MaChuyen=%s", (schedule,))
        return tuple(cur.fetchone())


def post(session, endpoint, csrf, body, expect):
    r = session.post(BASE + endpoint, json=body, headers={"X-CSRF-Token": csrf}, timeout=25)
    assert r.status_code == expect, f"POST {endpoint}: got HTTP {r.status_code}, expected {expect}, body={r.text[:250]}"
    return r.json()


def account():
    session = requests.Session()
    token = session.get(BASE + "/auth/csrf", timeout=20).json()["csrfToken"]
    email = f"ci-{uuid.uuid4().hex[:14]}@example.test"
    post(session, "/auth/register", token,
         {"fullName": "Khach kiem thu CI", "email": email,
          "phone": "0912345678", "password": "TestOnly-Password-12345!"}, 201)
    mine = session.get(BASE + "/auth/me", timeout=20)
    assert mine.status_code == 200 and mine.json().get("id"), "Session auth failed"
    return session, token


def main():
    checked_environment()
    boot_database()
    env = os.environ.copy()
    env.update({
        "SQLSERVER_CONNECTION_STRING":
            f"Server=127.0.0.1,1433;Database={DB};User Id=sa;Password={PSWD};"
            "Encrypt=True;TrustServerCertificate=True;Connection Timeout=10",
        "ASPNETCORE_ENVIRONMENT": "Development",
        "ASPNETCORE_URLS": "http://127.0.0.1:10000",
    })
    # Child stdout is not echoed: no accidental credential logging to CI output.
    with open("/tmp/aspnet-e2e.log", "w", encoding="utf-8") as app_log:
        proc = subprocess.Popen(["dotnet", "run", "--no-build", "-c", "Release",
                                 "--project", str(ROOT / "AspNetBackend" / "DeltaTravel.AspNet.csproj")],
                                env=env, stdout=app_log, stderr=subprocess.STDOUT)
        try:
            for _ in range(90):
                if proc.poll() is not None:
                    raise AssertionError("ASP.NET process exited before readiness")
                try:
                    ready = requests.get(BASE + "/health/ready", timeout=3)
                    if ready.status_code == 200:
                        data = ready.json()
                        assert data.get("schemaTablesFound") == 12
                        assert data.get("inventoryTriggersEnabled") == 2
                        break
                    if ready.status_code == 503:
                        raise AssertionError("Schema/trigger readiness failed: " + ready.text[:400])
                except requests.ConnectionError:
                    pass
                time.sleep(1)
            else:
                raise AssertionError("ASP.NET server did not become ready")
            print("PASS: ASP.NET /ready 200 on real ephemeral SQL Server 12 tables / 2 triggers")

            with connect(DB) as conn:
                first = new_schedule(conn, 4, "create-cancel")
                user, csrf = account()
                data = requests.get(BASE + "/tours", timeout=20).json()
                assert data["items"], "No tours returned from SQL Server"
                quote = post(user, "/bookings/quote", csrf, {"scheduleId": first, "quantity": 2}, 200)
                assert quote["amount"] == 3000000, "Server-side quote incorrect"
                order = post(user, "/bookings", csrf,
                             {"scheduleId": first, "quantity": 2,
                              "travellers": ["Khach A", "Khach B"]}, 201)
                booking = order["id"]
                assert seats(conn, first) == (2, 4), "Booking double-counted seats"
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) FROM dbo.CHITIET_HANHKHACH WHERE MaDatTour=%s", (booking,))
                    assert cur.fetchone()[0] == 2, "Passenger rows not persisted"
                    cur.execute("SELECT COUNT(*) FROM dbo.AUDITLOG WHERE HanhDong=N'DAT_TOUR_THANH_CONG'")
                    assert cur.fetchone()[0] >= 1, "SQL audit trigger not executed"
                print("PASS: register, auth, quote, booking, exactly +2 seats, 2 passengers and audit")

                outsider, outsider_csrf = account()
                assert outsider.get(BASE + "/bookings/me", timeout=10).json()["items"] == []
                outsider_cancel = post(outsider, f"/bookings/{booking}/cancel", outsider_csrf, {}, 404)
                assert outsider_cancel["error"] == "BOOKING_NOT_FOUND", "Unauthorized cancellation response"
                assert seats(conn, first) == (2, 4), "Another account changed inventory"
                print("PASS: user cannot see/cancel another user's booking")

                post(user, f"/bookings/{booking}/cancel", csrf, {}, 200)
                assert seats(conn, first) == (0, 4), "Cancellation did not return exactly 2 seats"
                repeat = post(user, f"/bookings/{booking}/cancel", csrf, {}, 200)
                assert repeat.get("alreadyCancelled") is True
                assert seats(conn, first) == (0, 4), "Second cancellation returned seats again"
                print("PASS: cancel once, idempotent repeat, exactly -2 seats")

                last = new_schedule(conn, 1, "concurrent-last-seat")
                # Reuse the two isolated authenticated browser sessions for a real race.
                def compete(pair):
                    session, token = pair
                    return session.post(BASE + "/bookings", timeout=25,
                        headers={"X-CSRF-Token": token},
                        json={"scheduleId": last, "quantity": 1, "travellers": ["Khach CI"]}).status_code
                with ThreadPoolExecutor(max_workers=2) as pool:
                    results = sorted(pool.map(compete, [(user, csrf), (outsider, outsider_csrf)]))
                assert results == [201, 409], f"Expected one winner and one sold out, got {results}"
                assert seats(conn, last) == (1, 1), "Concurrent booking oversold"
                print("PASS: concurrent last-seat; exactly one 201, one 409, 1/1 seats")
                assert requests.post(BASE + "/bookings", json={}, timeout=10).status_code in (400, 401)
                print("PASS: unauthenticated booking refused")
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=10)


if __name__ == "__main__":
    main()
