"""Smoke-test real staging over HTTPS, using synthetic test data only.

This intentionally NEVER sends bank evidence or touches real accounts.
"""
from __future__ import annotations

import os
import uuid
import httpx

BASE = "https://delta-travel-group6-real-api-staging.onrender.com"


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    if os.getenv("DELTA_STAGING_SMOKE") != "1":
        raise RuntimeError("Refusing network-write smoke without explicit CI opt-in")
    with httpx.Client(base_url=BASE, timeout=45.0, follow_redirects=True) as c:
        r = c.get("/api/v1/health/ready")
        check(r.status_code == 200, f"ready HTTP {r.status_code}")
        check(r.json().get("status") == "ok", "DB not reachable")
        print("PASS staging GET health 200, DB reachable")

        for route in ["/", "/assets/app.js", "/assets/styles.css"]:
            r = c.get(route)
            check(r.status_code == 200, f"{route} HTTP {r.status_code}")
        page = c.get("/").text
        check("DELTA" in page.upper(), "wrong frontend")
        check("Staging:" in page, "Staging banner not deployed")
        print("PASS frontend HTML + JS + CSS from FastAPI")

        # An's original design is now served by the SAME HTTPS origin as
        # the real backend; a dedicated panel, not the legacy localStorage
        # buttons, invokes server-authenticated API endpoints.
        for route in [
            "/an-live/", "/an-live/admin.html",
            "/an-live/assets/js/live-api-bridge.js",
        ]:
            response = c.get(route)
            check(response.status_code == 200, f"{route} HTTP {response.status_code}")
        an_html = c.get("/an-live/").text
        check("live-api-bridge.js" in an_html, "An frontend lacks the real API integration")
        check("credentials:" in c.get("/an-live/assets/js/live-api-bridge.js").text,
              "Expected same-origin credential-aware HTTP client")
        print("PASS live Render serves An UI, Admin HTML and authenticated API bridge on one origin")

        r = c.get("/api/v1/tours")
        check(r.status_code == 200, f"tour list HTTP {r.status_code}")
        tours = r.json()
        check(len(tours) >= 1, "no seeded tours")
        check(tours[0]["price"] > 0, "price from DB invalid")
        check(c.get("/api/v1/auth/me").status_code == 401, "anonymous user should be 401")
        print(f"PASS database catalog: {len(tours)} tours; anonymous auth 401")

        ident = uuid.uuid4().hex
        phone = "09" + "".join(str(int(ch, 16) % 10) for ch in ident[:8])
        user = {
            "full_name": "KTHP Test Synthetic",
            "email": "kthp-" + ident[:16] + "@example.invalid",
            "phone": phone,
            "password": "UniqueTestPassword1!-" + ident,
        }
        r = c.post("/api/v1/auth/register", json=user)
        check(r.status_code == 201, f"register HTTP {r.status_code}: {r.text[:220]}")
        check("delta_session" in c.cookies and "delta_csrf" in c.cookies, "missing session/CSRF cookies")
        cookies = r.headers.get_list("set-cookie")
        check(any("delta_session=" in h and "secure" in h.lower() for h in cookies), "session cookie must be Secure on HTTPS staging")
        check(r.json().get("role") == "CUSTOMER", "self-register must not become admin")
        check(c.get("/api/v1/auth/me").status_code == 200, "session did not authenticate")
        csrf = c.cookies["delta_csrf"]
        headers = {"X-CSRF-Token": csrf}
        print("PASS HTTPS registration, Secure cookies, session, role=CUSTOMER")

        schedules = c.get("/api/v1/tours/" + tours[0]["id"] + "/schedules")
        check(schedules.status_code == 200, f"schedules HTTP {schedules.status_code}")
        allowed = next((x for x in schedules.json() if x["availableSeats"] > 0), None)
        check(bool(allowed), "no seats in synthetic staging")
        seats_before = allowed["availableSeats"]
        body = {
            "schedule_id": allowed["id"],
            "adults": 1,
            "children": 0,
            "infants": 0,
            "customer_name": "KTHP Test Synthetic",
            "customer_phone": phone,
            "customer_email": user["email"],
            "note": "Synthetic CI test - no payment or real traveler",
        }
        quote = c.post("/api/v1/bookings/quote", json={
            "schedule_id": allowed["id"],
            "adults": 1, "children": 0, "infants": 0
        })
        check(quote.status_code == 200, f"quote HTTP {quote.status_code}")
        check(quote.json()["totalPrice"] > 0, "server pricing failed")
        token = str(uuid.uuid4())
        bad = c.post("/api/v1/bookings", json=body, headers={"Idempotency-Key": token})
        check(bad.status_code == 403, "booking without CSRF must be 403")
        good = c.post("/api/v1/bookings", json=body, headers={**headers, "Idempotency-Key": token})
        check(good.status_code == 201, f"create booking HTTP {good.status_code}: {good.text[:220]}")
        order = good.json()
        check(order["status"] == "PENDING_PAYMENT" and not order["paid"], "must NOT auto-PAID")
        replay = c.post("/api/v1/bookings", json=body, headers={**headers, "Idempotency-Key": token})
        check(replay.status_code == 201 and replay.json()["id"] == order["id"], "booking retry not idempotent")
        existing = c.get("/api/v1/bookings")
        check(existing.status_code == 200 and any(x["id"] == order["id"] for x in existing.json()), "booking was not stored")
        now = c.get("/api/v1/tours/" + tours[0]["id"] + "/schedules")
        held = next(x for x in now.json() if x["id"] == allowed["id"])
        check(held["availableSeats"] == seats_before - 1, "one booking must reserve one seat")
        print("PASS live server: quote + CSRF + idempotent booking + SQL inventory decremented")

        cancel = c.post("/api/v1/bookings/" + order["id"] + "/cancel", json={}, headers=headers)
        check(cancel.status_code == 200, f"cancel HTTP {cancel.status_code}: {cancel.text[:200]}")
        restored = next(x for x in c.get("/api/v1/tours/" + tours[0]["id"] + "/schedules").json() if x["id"] == allowed["id"])
        check(restored["availableSeats"] == seats_before, "cancel must restore seat")
        check(c.get("/api/v1/admin/metrics").status_code == 403, "customers must not access admin")
        print("PASS live server: cancel restores seat; admin protected 403")

        r = c.post("/api/v1/auth/logout", json={}, headers=headers)
        check(r.status_code == 200, f"logout HTTP {r.status_code}")
        check(c.get("/api/v1/auth/me").status_code == 401, "logout did not revoke session")
        print("PASS live HTTPS browser/API/SQLite demo DB register-login-book-cancel-logout")
        print("NOTE: SQLite demo is ephemeral; this is not permanent PostgreSQL or Tham's SQL Server.")


if __name__ == "__main__":
    main()
