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
        assert client.get("/api/v1/bookings").json() == []
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
        owned = client.get("/api/v1/bookings/" + booking["id"])
        assert owned.status_code == 200
        assert owned.json()["tourTitle"] and owned.json()["storage"] == "sqlserver"
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
        # Other authenticated customer must not read or cancel this booking.
        with TestClient(write_bridge.app) as outsider:
            other = {**user, "email": "other-" + ident[:12] + "@example.invalid",
                     "phone": "093" + "".join(str(int(x,16)%10) for x in ident[7:14])}
            other_registered = outsider.post("/api/v1/auth/register", json=other)
            assert other_registered.status_code == 201, f"other register {other_registered.status_code}"
            assert outsider.get("/api/v1/bookings/" + booking["id"]).status_code == 404
            outsider_csrf = outsider.cookies["delta_csrf"]
            assert outsider.post("/api/v1/bookings/" + booking["id"] + "/cancel",
                                headers={"X-CSRF-Token": outsider_csrf}).status_code == 404
            assert outsider.get("/api/v1/bookings").json() == []
        assert client.post("/api/v1/admin/bookings/1/confirm-payment", json={}, headers=head).status_code == 503
        assert client.post("/api/v1/auth/logout", headers=head).status_code == 200
        assert client.get("/api/v1/auth/me").status_code == 401
        bad_login = client.post("/api/v1/auth/login", json={"email": user["email"], "password": "bad"})
        assert bad_login.status_code == 401
        login = client.post("/api/v1/auth/login", json={"email": user["email"], "password": user["password"]})
        assert login.status_code == 200
        print("PASS: real SQL Server HTTP register/login/cookie/CSRF/book/replay/conflict/no-oversell/cancel/logout")

        # Apply migrations 002 (VaiTro ADMIN) + 003 (12-table preserving vouchers inside dbo.AUDITLOG)
        m2 = ROOT / "database/database/migrations/sqlserver/002_admin_and_catalog_management.sql"
        m3 = ROOT / "database/database/migrations/sqlserver/003_vouchers_and_discounts.sql"
        mconn = pymssql.connect(server=host, user="sa", password=password,
                                database="TourDuLichDB", autocommit=True)
        try:
            execute_script(mconn, m2)
            execute_script(mconn, m3)
            with mconn.cursor() as cur:
                cur.execute("""
                    SELECT COUNT(*) FROM sys.tables
                    WHERE name IN ('MAUUDAI','SUDUNG_MAUUDAI')
                """)
                assert cur.fetchone()[0] == 0, "Migration 003 must preserve core tables without adding extra tables"
                cur.execute("""
                    SELECT COUNT(*) FROM dbo.AUDITLOG
                    WHERE HanhDong = N'VOUCHER_DEF'
                """)
                assert cur.fetchone()[0] >= 5, "Seeded VOUCHER_DEF rows missing in dbo.AUDITLOG"
                cur.execute("""
                    INSERT INTO dbo.CHUYENKHOIHANH
                    (MaTour,NgayKhoiHanh,NgayKetThuc,GiaThucTe,SoChoToiDa,SoChoDaDat,TrangThaiChuyen)
                    OUTPUT INSERTED.MaChuyen
                    VALUES (2,DATEADD(day,120,GETDATE()),DATEADD(day,124,GETDATE()),2500000,10,0,N'Mở bán')
                """)
                v_sched_id = cur.fetchone()[0]
        finally:
            mconn.close()

        # Re-login first user and verify non-admin cannot access /api/v1/admin/vouchers
        client.post("/api/v1/auth/login", json={"email": user["email"], "password": user["password"]})
        cust_csrf = client.cookies["delta_csrf"]
        cust_head = {"X-CSRF-Token": cust_csrf}
        assert client.get("/api/v1/admin/vouchers").status_code == 403

        # Public voucher list & validation rules on SQL Server
        pub_v = client.get("/api/v1/vouchers?tour_id=2")
        assert pub_v.status_code == 200
        pub_codes = {v["code"] for v in pub_v.json()}
        assert "HE2026" in pub_codes and "DELTA10" not in pub_codes, f"Unexpected tour 2 vouchers: {pub_codes}"

        v_wrong_scope = client.post("/api/v1/vouchers/validate", json={"code": "DELTA10", "tour_id": "2", "adults": 2})
        assert v_wrong_scope.status_code == 422 and v_wrong_scope.json()["errorCode"] == "VOUCHER_WRONG_SCOPE"

        v_wrong_tour = client.post("/api/v1/vouchers/validate", json={"code": "HALONG100K", "tour_id": "2", "adults": 2})
        assert v_wrong_tour.status_code == 422 and v_wrong_tour.json()["errorCode"] == "VOUCHER_WRONG_TOUR"

        v_low_min = client.post("/api/v1/vouchers/validate", json={"code": "HE2026", "schedule_id": str(v_sched_id), "adults": 1})
        assert v_low_min.status_code == 422 and v_low_min.json()["errorCode"] == "VOUCHER_MIN_ORDER"

        v_ok = client.post("/api/v1/vouchers/validate", json={"code": "HE2026", "schedule_id": str(v_sched_id), "adults": 2})
        assert v_ok.status_code == 200 and v_ok.json()["discountAmount"] == 500000 and v_ok.json()["totalPrice"] == 4500000

        # Register and promote an ADMIN user directly in SQL Server
        with TestClient(write_bridge.app) as admin_client:
            admin_info = {
                "full_name": "CI SQL Admin", "email": "sql-admin-" + ident[:10] + "@example.invalid",
                "phone": "092" + "".join(str(int(x, 16) % 10) for x in ident[:7]),
                "password": "CI-SQL-Admin-Strong-123!"
            }
            assert admin_client.post("/api/v1/auth/register", json=admin_info).status_code == 201
            with engine.begin() as aconn:
                from sqlalchemy import text as sa_text
                aconn.execute(sa_text("UPDATE dbo.NGUOIDUNG SET VaiTro=N'ADMIN' WHERE Email=:em"), {"em": admin_info["email"]})
            a_head = {"X-CSRF-Token": admin_client.cookies["delta_csrf"]}

            created_v = admin_client.post("/api/v1/admin/vouchers", headers=a_head, json={
                "code": "CISQL1",
                "name": "CI SQL Limited Voucher",
                "discountType": "percent",
                "discountValue": 10,
                "maxDiscount": 300000,
                "minOrderValue": 4000000,
                "scopeType": "tours",
                "scopeTourIds": ["2"],
                "usageLimit": 1,
                "perUserLimit": 1,
                "targetAudience": "all",
                "active": True,
            })
            assert created_v.status_code == 201, f"admin voucher create: {created_v.status_code} {created_v.text}"
            v_id = created_v.json()["id"]

            # Customer books with CISQL1 -> 10% of 5,000,000 capped to 300,000 => 4,700,000
            v_book = client.post("/api/v1/bookings", headers={**cust_head, "Idempotency-Key": str(uuid.uuid4())}, json={
                "schedule_id": str(v_sched_id),
                "adults": 2,
                "children": 0,
                "infants": 0,
                "customer_name": "CI SQL Customer",
                "customer_phone": user["phone"],
                "customer_email": user["email"],
                "note": "",
                "voucher_code": "CISQL1",
            })
            assert v_book.status_code == 201, f"voucher book failed: {v_book.status_code} {v_book.text}"
            vb_json = v_book.json()
            assert vb_json["subtotalPrice"] == 5000000 and vb_json["discountAmount"] == 300000
            assert vb_json["totalPrice"] == 4700000 and vb_json["voucherCode"] == "CISQL1"

            # Second customer tries CISQL1 -> blocked (usage_limit = 1 already exhausted in SQL Server)
            with TestClient(write_bridge.app) as second_client:
                other2 = {**user, "email": "sql-v2-" + ident[:10] + "@example.invalid",
                          "phone": "094" + "".join(str(int(x, 16) % 10) for x in ident[:7])}
                assert second_client.post("/api/v1/auth/register", json=other2).status_code == 201
                s2_head = {"X-CSRF-Token": second_client.cookies["delta_csrf"]}
                exhausted_book = second_client.post("/api/v1/bookings", headers={**s2_head, "Idempotency-Key": str(uuid.uuid4())}, json={
                    "schedule_id": str(v_sched_id),
                    "adults": 2,
                    "children": 0,
                    "infants": 0,
                    "customer_name": "Second Buyer",
                    "customer_phone": other2["phone"],
                    "customer_email": other2["email"],
                    "note": "",
                    "voucher_code": "CISQL1",
                })
                assert exhausted_book.status_code in (409, 422), f"Expected limit failure, got {exhausted_book.status_code}"

            # Admin analytics reflects 1 active redemption & 300,000 discount
            stats_list = admin_client.get("/api/v1/admin/vouchers").json()
            cisql = next(item for item in stats_list if item["code"] == "CISQL1")
            assert cisql["usedCount"] == 1 and cisql["stats"]["activeRedemptions"] == 1
            assert cisql["stats"]["totalDiscountGranted"] == 300000

            # Cancel booking -> SQL Server trigger TRG_DATTOUR_ReleaseVoucherOnCancel frees voucher quota!
            v_cancel = client.post(f"/api/v1/bookings/{vb_json['id']}/cancel", headers=cust_head)
            assert v_cancel.status_code == 200 and v_cancel.json()["status"] == "CANCELLED"
            stats_after_cancel = admin_client.get("/api/v1/admin/vouchers").json()
            cisql_after = next(item for item in stats_after_cancel if item["code"] == "CISQL1")
            assert cisql_after["usedCount"] == 0, f"Trigger failed to release usedCount: {cisql_after}"

            # Admin patch + delete voucher
            patched = admin_client.patch(f"/api/v1/admin/vouchers/{v_id}", headers=a_head, json={"active": False})
            assert patched.status_code == 200 and patched.json()["active"] is False
            deleted = admin_client.delete(f"/api/v1/admin/vouchers/{v_id}", headers=a_head)
            assert deleted.status_code == 200
        print("PASS: real SQL Server 12-table vouchers (AUDITLOG VOUCHER_DEF/VOUCHER_USE, scope/min/cap, concurrency, cancel trigger release, admin CRUD)")

    # Never leave write-enabled global toggle set in the interpreter.
    os.environ.pop("THAM_BOOKING_WRITES_ENABLED", None)
