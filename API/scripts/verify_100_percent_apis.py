"""Comprehensive 100% API Verification Suite for Delta Travel 2.0.
Exercises all registered FastAPI endpoints and frontend bindings.
"""

import sys
import os
import uuid
import random
from datetime import datetime, timedelta, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure API directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from api.app import app
from api.models import SessionLocal, User, Tour, Schedule
from api.security import hash_password

results = []

def record(endpoint: str, method: str, passed: bool, note: str = "", res=None):
    err_detail = ""
    if not passed and res is not None:
        try:
            err_detail = f" [HTTP {res.status_code}: {res.text[:120]}]"
        except Exception:
            pass
    full_note = f"{note}{err_detail}"
    results.append({
        "endpoint": endpoint,
        "method": method,
        "passed": passed,
        "note": full_note
    })
    status = "[PASS]" if passed else "[FAIL]"
    print(f"  {status} {method:<6} {endpoint:<50} {full_note}")

def rand_vn_phone():
    return f"09{random.randint(10000000, 99999999)}"

def run_tests():
    print("=" * 84)
    print("DELTA TRAVEL 2.0 - KIỂM TRA TOÀN DIỆN 100% CÁC ENDPOINT API & KẾT NỐI FRONTEND")
    print("=" * 84)

    with TestClient(app) as client:
        def csrf_headers(extra=None):
            h = {}
            c = client.cookies.get("delta_csrf", "")
            if c:
                h["X-CSRF-Token"] = c
            if extra:
                h.update(extra)
            return h

        # 1. Health & Database
        print("\n--- 1. Health Check & Database Connectivity ---")
        res = client.get("/api/v1/health/ready")
        record("/api/v1/health/ready", "GET", res.status_code == 200 and res.json().get("status") == "ok", f"Status: {res.status_code}")

        # 2. Frontend & Static Assets
        print("\n--- 2. Frontend Static & Page Routes ---")
        res_idx = client.get("/")
        record("/", "GET", res_idx.status_code == 200 and "Delta Travel" in res_idx.text, "Index page loaded")

        res_adm = client.get("/admin.html")
        record("/admin.html", "GET", res_adm.status_code == 200 and "modal-dialog-scrollable" in res_adm.text, "Admin page with scrollable modal")

        res_adm_rd = client.get("/admin", follow_redirects=False)
        record("/admin", "GET", res_adm_rd.status_code in (301, 302, 307) and "admin.html" in res_adm_rd.headers.get("location", ""), "Redirects to /admin.html")

        res_fav_ico = client.get("/favicon.ico", follow_redirects=False)
        record("/favicon.ico", "GET", res_fav_ico.status_code in (301, 302, 307), "Redirects to /favicon.svg")

        res_fav_svg = client.get("/favicon.svg")
        record("/favicon.svg", "GET", res_fav_svg.status_code == 200, "Favicon SVG servable")

        res_live = client.get("/an-live/")
        record("/an-live/", "GET", res_live.status_code == 200, "An-live route servable")

        res_api_js = client.get("/assets/js/services/api.js")
        record("/assets/js/services/api.js", "GET", res_api_js.status_code == 200 and "DeltaAPI" in res_api_js.text, "Frontend API service module loaded")

        # 3. Auth Flow
        print("\n--- 3. Authentication & Account Management ---")
        rand_id = uuid.uuid4().hex[:6]
        test_email = f"customer_{rand_id}@deltatravel.vn"
        test_pass = "DeltaPass123@"
        test_phone = rand_vn_phone()
        
        # Register
        reg_payload = {
            "full_name": "Khách Hàng Kiểm Thử",
            "email": test_email,
            "password": test_pass,
            "phone": test_phone
        }
        res_reg = client.post("/api/v1/auth/register", json=reg_payload)
        record("/api/v1/auth/register", "POST", res_reg.status_code == 201, f"Registered: {test_email}")

        # Login with email
        login_payload = {"email": test_email, "password": test_pass}
        res_login = client.post("/api/v1/auth/login", json=login_payload)
        record("/api/v1/auth/login", "POST", res_login.status_code == 200, "Login via email")

        # Me
        res_me = client.get("/api/v1/auth/me")
        record("/api/v1/auth/me", "GET", res_me.status_code == 200 and res_me.json().get("email") == test_email, f"Logged-in as {test_email}")

        # Session
        res_sess = client.get("/api/v1/auth/session")
        record("/api/v1/auth/session", "GET", res_sess.status_code == 200 and res_sess.json().get("authenticated") is True, "Session valid")

        # Update Profile
        new_phone = rand_vn_phone()
        res_prof = client.patch("/api/v1/auth/profile", json={"full_name": "Khách Hàng Vip", "phone": new_phone}, headers=csrf_headers())
        record("/api/v1/auth/profile", "PATCH", res_prof.status_code == 200 and res_prof.json().get("fullName") == "Khách Hàng Vip", "Profile updated")

        # Change Password
        new_pass = "NewSecretPass456@"
        res_cp = client.post("/api/v1/auth/change-password", json={"old_password": test_pass, "new_password": new_pass}, headers=csrf_headers())
        record("/api/v1/auth/change-password", "POST", res_cp.status_code == 200, "Password changed")

        # Login with phone and new password
        res_phone_login = client.post("/api/v1/auth/login", json={"username": new_phone, "password": new_pass})
        record("/api/v1/auth/login (by phone)", "POST", res_phone_login.status_code == 200, "Login via phone identifier")

        # Logout
        res_logout = client.post("/api/v1/auth/logout", headers=csrf_headers())
        record("/api/v1/auth/logout", "POST", res_logout.status_code == 200, "Logout successful")

        # Re-login for downstream customer actions
        client.post("/api/v1/auth/login", json={"email": test_email, "password": new_pass})

        # 4. Tours Catalog
        print("\n--- 4. Tours & Schedules Catalog ---")
        res_tours = client.get("/api/v1/tours")
        record("/api/v1/tours", "GET", res_tours.status_code == 200 and len(res_tours.json()) > 0, f"Returned {len(res_tours.json())} tours")

        tours_data = res_tours.json()
        target_tour = tours_data[0]
        tour_id = target_tour["id"]

        res_tour_one = client.get(f"/api/v1/tours/{tour_id}")
        record(f"/api/v1/tours/{{tour_id}}", "GET", res_tour_one.status_code == 200 and res_tour_one.json()["id"] == tour_id, f"Detail of {tour_id}")

        res_schedules = client.get(f"/api/v1/tours/{tour_id}/schedules")
        record(f"/api/v1/tours/{{tour_id}}/schedules", "GET", res_schedules.status_code == 200 and len(res_schedules.json()) > 0, f"Schedules for {tour_id}")
        schedule_id = res_schedules.json()[0]["id"]

        # 5. Favorites
        print("\n--- 5. Customer Favorites ---")
        res_fav_add = client.post(f"/api/v1/favorites/{tour_id}", headers=csrf_headers())
        record(f"/api/v1/favorites/{{tour_id}}", "POST", res_fav_add.status_code == 200, f"Added tour {tour_id} to favorites")

        res_fav_list = client.get("/api/v1/favorites")
        favs = res_fav_list.json() if isinstance(res_fav_list.json(), list) else res_fav_list.json().get("favorites", [])
        record("/api/v1/favorites", "GET", res_fav_list.status_code == 200 and tour_id in favs, "Favorites listed")

        res_fav_del = client.delete(f"/api/v1/favorites/{tour_id}", headers=csrf_headers())
        record(f"/api/v1/favorites/{{tour_id}}", "DELETE", res_fav_del.status_code == 200, f"Removed tour {tour_id} from favorites")

        # 6. Bookings & Payments Flow
        print("\n--- 6. Bookings & Payment Processing ---")
        # Quote
        quote_payload = {
            "schedule_id": schedule_id,
            "adults": 2,
            "children": 1,
            "infants": 0
        }
        res_quote = client.post("/api/v1/bookings/quote", json=quote_payload)
        quote_price = res_quote.json().get("totalPrice", 0) if res_quote.status_code == 200 else 0
        record("/api/v1/bookings/quote", "POST", res_quote.status_code == 200 and quote_price > 0, f"Quote: {quote_price:,} VND")

        # Ensure test schedule has plenty of capacity
        with SessionLocal.begin() as db:
            s_obj = db.get(Schedule, schedule_id)
            if s_obj:
                s_obj.reserved_seats = 0
                s_obj.total_seats = 100

        # Create Booking
        book_create_payload = {
            "schedule_id": schedule_id,
            "adults": 2,
            "children": 1,
            "infants": 0,
            "customer_name": "Nguyễn Văn A",
            "customer_phone": new_phone,
            "customer_email": test_email,
            "note": "Đặt tour gia đình"
        }
        idem_key_1 = str(uuid.uuid4())
        res_booking = client.post("/api/v1/bookings", json=book_create_payload, headers=csrf_headers({"Idempotency-Key": idem_key_1}))
        booking_data = res_booking.json() if res_booking.status_code == 201 else {}
        booking_id = booking_data.get("id")
        record("/api/v1/bookings", "POST", res_booking.status_code == 201 and booking_id is not None, f"Booking created: {booking_id}", res=res_booking)

        # List user bookings
        res_my_bookings = client.get("/api/v1/bookings")
        record("/api/v1/bookings", "GET", res_my_bookings.status_code == 200 and any(b["id"] == booking_id for b in res_my_bookings.json()), "Customer bookings listed", res=res_my_bookings)

        # Get single booking
        res_one_booking = client.get(f"/api/v1/bookings/{booking_id}")
        record(f"/api/v1/bookings/{{booking_id}}", "GET", res_one_booking.status_code == 200 and res_one_booking.json().get("id") == booking_id, "Booking detail verified", res=res_one_booking)

        # Pay booking (customer submit evidence)
        customer_ref = f"UNC_VCB_{uuid.uuid4().hex[:8].upper()}"
        res_pay = client.post(f"/api/v1/bookings/{booking_id}/pay", json={"reference": customer_ref}, headers=csrf_headers())
        record(f"/api/v1/bookings/{{booking_id}}/pay", "POST", res_pay.status_code == 200 and res_pay.json().get("status") in ("PAID", "CONFIRMED", "PENDING_PAYMENT"), f"Payment submitted: {res_pay.json().get('status')}", res=res_pay)

        # Create second booking to test cancel
        idem_key_2 = str(uuid.uuid4())
        res_booking_2 = client.post("/api/v1/bookings", json=book_create_payload, headers=csrf_headers({"Idempotency-Key": idem_key_2}))
        booking_2_id = res_booking_2.json().get("id") if res_booking_2.status_code == 201 else None
        if booking_2_id:
            res_cancel = client.post(f"/api/v1/bookings/{booking_2_id}/cancel", json={"reason": "Khách bận việc đột xuất"}, headers=csrf_headers())
            record(f"/api/v1/bookings/{{booking_id}}/cancel", "POST", res_cancel.status_code == 200 and res_cancel.json().get("status") == "CANCELLED", f"Booking {booking_2_id} cancelled", res=res_cancel)
        else:
            record("/api/v1/bookings/{booking_id}/cancel", "POST", False, "Could not create secondary booking to cancel", res=res_booking_2)

        # 7. Admin Workflow
        print("\n--- 7. Admin Management Endpoints ---")
        # Ensure admin account exists with known credentials
        admin_email = "admin@deltatravel.vn"
        admin_pass = "delta123"
        with SessionLocal.begin() as db:
            adm = db.query(User).filter(User.email == admin_email).first()
            if not adm:
                adm = User(
                    id=str(uuid.uuid4()),
                    full_name="Admin Delta Travel",
                    email=admin_email,
                    password_hash=hash_password(admin_pass),
                    role="ADMIN",
                    phone="0911223344"
                )
                db.add(adm)
            else:
                adm.role = "ADMIN"
                adm.password_hash = hash_password(admin_pass)

        # Admin login
        client.post("/api/v1/auth/logout", headers=csrf_headers())
        res_admin_login = client.post("/api/v1/auth/login", json={"email": admin_email, "password": admin_pass})
        record("/api/v1/auth/login (Admin)", "POST", res_admin_login.status_code == 200, "Admin authenticated")

        # Admin Metrics
        res_metrics = client.get("/api/v1/admin/metrics")
        record("/api/v1/admin/metrics", "GET", res_metrics.status_code == 200 and "tours" in res_metrics.json(), "Metrics calculated")

        # Admin Dashboard
        res_dash = client.get("/api/v1/admin/dashboard")
        record("/api/v1/admin/dashboard", "GET", res_dash.status_code == 200 and "bookings" in res_dash.json(), "Dashboard alias verified")

        # Admin Audit
        res_audit = client.get("/api/v1/admin/audit")
        record("/api/v1/admin/audit", "GET", res_audit.status_code == 200 and isinstance(res_audit.json(), list), f"Audit trail entries: {len(res_audit.json())}")

        # Admin Tours list
        res_adm_tours = client.get("/api/v1/admin/tours")
        record("/api/v1/admin/tours", "GET", res_adm_tours.status_code == 200 and len(res_adm_tours.json()) > 0, "Admin tour inventory list")

        # Admin Create Tour (pattern ^DL-[A-Z0-9]{2,20}$)
        new_tour_id = f"DL-QN{random.randint(10, 99)}"
        tour_create_payload = {
            "id": new_tour_id,
            "title": "Tour Khám Phá Quy Nhơn - Kỳ Co - Eo Gió 3N2Đ",
            "slug": f"tour-quy-nhon-ky-co-{random.randint(100, 999)}",
            "region": "central",
            "duration": "3N2Đ",
            "price": 3290000,
            "original_price": 4190000,
            "departure": "TP. Hồ Chí Minh",
            "transport": "Máy bay & Ô tô du lịch",
            "description": "Tour trọn gói chuẩn Delta Travel",
            "image": "https://raw.githubusercontent.com/Anniehatani/deltatrdelt2.0/main/assets/images/halong.png",
            "flash_sale": False
        }
        res_adm_create_tour = client.post("/api/v1/admin/tours", json=tour_create_payload, headers=csrf_headers())
        record("/api/v1/admin/tours", "POST", res_adm_create_tour.status_code == 201, f"Tour created: {new_tour_id}")

        # Admin Patch Tour
        res_adm_patch_tour = client.patch(f"/api/v1/admin/tours/{new_tour_id}", json={"price": 3190000, "flash_sale": True}, headers=csrf_headers())
        record(f"/api/v1/admin/tours/{{tour_id}}", "PATCH", res_adm_patch_tour.status_code == 200 and res_adm_patch_tour.json().get("price") == 3190000, f"Tour {new_tour_id} updated")

        # Admin Schedules List
        res_adm_schedules = client.get("/api/v1/admin/schedules")
        record("/api/v1/admin/schedules", "GET", res_adm_schedules.status_code == 200, f"Total schedules: {len(res_adm_schedules.json())}")

        # Admin Create Schedule
        sched_date = (datetime.now(timezone.utc) + timedelta(days=20)).isoformat()
        sched_create_payload = {
            "tour_id": new_tour_id,
            "departure_at": sched_date,
            "total_seats": 25
        }
        res_adm_create_sched = client.post("/api/v1/admin/schedules", json=sched_create_payload, headers=csrf_headers())
        new_sched_id = res_adm_create_sched.json().get("id") if res_adm_create_sched.status_code == 201 else None
        record("/api/v1/admin/schedules", "POST", res_adm_create_sched.status_code == 201 and new_sched_id is not None, f"Schedule created: {new_sched_id}")

        # Admin Patch Schedule
        if new_sched_id:
            res_adm_patch_sched = client.patch(f"/api/v1/admin/schedules/{new_sched_id}", json={"total_seats": 30}, headers=csrf_headers())
            record(f"/api/v1/admin/schedules/{{schedule_id}}", "PATCH", res_adm_patch_sched.status_code == 200 and res_adm_patch_sched.json().get("totalSeats") == 30, f"Schedule {new_sched_id} seats patched")
        else:
            record("/api/v1/admin/schedules/{schedule_id}", "PATCH", False, "Missing schedule id")

        # Admin Bookings List
        res_adm_bookings = client.get("/api/v1/admin/bookings")
        record("/api/v1/admin/bookings", "GET", res_adm_bookings.status_code == 200 and len(res_adm_bookings.json()) > 0, "Admin view all customer bookings")

        # Admin Confirm Payment on a pending booking
        idem_key_3 = str(uuid.uuid4())
        # Switch back to customer briefly or create via quote
        res_booking_3 = client.post("/api/v1/bookings", json=book_create_payload, headers=csrf_headers({"Idempotency-Key": idem_key_3}))
        booking_3_id = res_booking_3.json().get("id") if res_booking_3.status_code == 201 else booking_id

        admin_ref = f"UNC_VCB_{random.randint(10000000, 99999999)}"
        res_adm_confirm_pay = client.post(
            f"/api/v1/admin/bookings/{booking_3_id}/confirm-payment",
            json={"reference": admin_ref},
            headers=csrf_headers()
        )
        record(
            f"/api/v1/admin/bookings/{{booking_id}}/confirm-payment",
            "POST",
            res_adm_confirm_pay.status_code == 200 and res_adm_confirm_pay.json().get("status") == "PAID",
            f"Payment confirmed by admin for booking {booking_3_id}",
            res=res_adm_confirm_pay
        )

        # Admin Delete Tour (cleanup created test tour)
        res_adm_del_tour = client.delete(f"/api/v1/admin/tours/{new_tour_id}", headers=csrf_headers())
        record(f"/api/v1/admin/tours/{{tour_id}}", "DELETE", res_adm_del_tour.status_code == 200, f"Tour {new_tour_id} deactivated/deleted")

        # 8. Assistant Chatbot
        print("\n--- 8. AI Assistant Chatbot ---")
        chat_payload = {"message": "Xin chào, hãy tư vấn cho tôi tour Đà Nẵng"}
        res_chat = client.post("/api/v1/assistant/chat", json=chat_payload)
        record("/api/v1/assistant/chat", "POST", res_chat.status_code == 200 and "answer" in res_chat.json(), f"AI Answer: {res_chat.json().get('answer', '')[:40]}...")

        # 9. Catch-all Guard
        print("\n--- 9. Unknown API Security Catch-all Guard ---")
        res_unknown = client.get("/api/v1/non-existent-route-for-testing")
        record("/api/v1/{unknown_path}", "GET", res_unknown.status_code == 404 and "detail" in res_unknown.json(), "404 catch-all guard working")

    # Summary
    print("\n" + "=" * 84)
    print("KẾT QUẢ TỔNG HỢP KIỂM THỬ")
    print("=" * 84)
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed
    pct = (passed / total) * 100

    print(f"Tổng số API/Route đã kiểm tra: {total}")
    print(f"Số lượng ĐẠT (PASS):            {passed}")
    print(f"Số lượng LỖI (FAIL):           {failed}")
    print(f"TỶ LỆ THÀNH CÔNG:              {pct:.1f}%")
    print("=" * 84)

    if failed == 0:
        print(">>> 100% TẤT CẢ CÁC API & TRANG GIAO DIỆN FRONTEND ĐÃ ĐƯỢC KẾT NỐI VÀ HOẠT ĐỘNG HOÀN HẢO! <<<")
    else:
        print(f">>> CÓ {failed} ENDPOINT CHƯA ĐẠT! <<<")

    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
