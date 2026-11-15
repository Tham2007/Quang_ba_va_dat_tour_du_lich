"""Synthetic end-to-end booking against *our own* public staging FastAPI service.

This intentionally inserts a disposable test account and one pending booking,
then cancels that booking immediately. No real customers, bank transactions,
external websites or admin credentials. Not a persistence-after-redeploy test.
Must be explicitly enabled by DELTA_LIVE_STAGING_WRITE_TEST=1.
"""
import os
import secrets
import uuid

import requests

BASE = "https://delta-travel-group6-real-api-staging.onrender.com/api/v1"
ORIGIN = "https://delta-travel-group6-real-api-staging.onrender.com"


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def call(session, method, url, **options):
    response = session.request(method, url, timeout=50, **options)
    return response


def main():
    check(os.environ.get("DELTA_LIVE_STAGING_WRITE_TEST") == "1",
          "Refusing to write to live staging without explicit CI opt-in")
    s = requests.Session()

    # The live Render service must have deployed the exact checkout adapter.
    adapter = call(s, "GET", ORIGIN + "/assets/js/services/api.js")
    check(adapter.status_code == 200, "Frontend API client not publicly accessible")
    check("Whitelist only server-accepted fields" in adapter.text,
          "Render has not yet deployed the corrected booking adapter")

    health = call(s, "GET", BASE + "/health/ready")
    check(health.status_code == 200, "Public backend not ready")
    engine = health.json().get("storageEngine", "unknown")
    print("LIVE_STORAGE_ENGINE", engine, flush=True)

    ticket = uuid.uuid4().hex[:15]
    email = f"ci-checkout-{ticket}@example.test"
    phone = "091" + str(secrets.randbelow(10_000_000)).zfill(7)
    password = "CiOnly!" + secrets.token_urlsafe(32)
    registered = call(s, "POST", BASE + "/auth/register", json={
        "full_name": "Synthetic CI Booking Test",
        "email": email,
        "phone": phone,
        "password": password,
    })
    check(registered.status_code == 201,
          f"Live registration failed: HTTP {registered.status_code}")
    me = call(s, "GET", BASE + "/auth/me")
    check(me.status_code == 200 and me.json().get("email") == email,
          "Registered session was not authenticated")

    schedules = call(s, "GET", BASE + "/tours/DL-HL01/schedules")
    check(schedules.status_code == 200, "Real schedule API not available")
    active = [
        x for x in schedules.json()
        if x.get("availableSeats", 0) >= 1 and x.get("active", True)
    ]
    check(active, "No available future tour schedule")
    schedule = active[0]

    quote = call(s, "POST", BASE + "/bookings/quote", json={
        "schedule_id": schedule["id"], "adults": 1, "children": 0, "infants": 0
    })
    check(quote.status_code == 200, f"Quote failed HTTP {quote.status_code}")
    csrf = s.cookies.get("delta_csrf")
    check(bool(csrf), "CSRF cookie missing after successful registration")
    headers = {"X-CSRF-Token": csrf, "Idempotency-Key": str(uuid.uuid4())}
    order = call(s, "POST", BASE + "/bookings", headers=headers, json={
        "schedule_id": schedule["id"],
        "adults": 1, "children": 0, "infants": 0,
        "customer_name": "Synthetic CI Booking Test", "customer_phone": phone,
        "customer_email": email,
        "note": "Automated student project integration check, no payment"
    })
    check(order.status_code == 201,
          f"Live create booking rejected HTTP {order.status_code}, code={order.text[:110]}")
    booking = order.json()
    check(booking.get("status") == "PENDING_PAYMENT" and booking.get("paid") is False,
          "Created booking must not claim payment")
    check(booking.get("id"), "Booking has no saved identifier")
    print("PASS: live registration/auth/quote/booking persisted by public FastAPI")

    listed = call(s, "GET", BASE + "/bookings")
    check(listed.status_code == 200, "Can't read own stored bookings")
    check(any(x.get("id") == booking["id"] for x in listed.json()),
          "Booking not persisted to server storage")
    outsider = requests.Session()
    other = call(outsider, "GET", BASE + "/bookings/" + booking["id"])
    check(other.status_code == 401, "Anonymous user could read private booking")
    print("PASS: authenticated booking retrieval and anonymous IDOR guard")

    # Cancel to return seats to inventory; leave no open test booking.
    csrf = s.cookies.get("delta_csrf")
    cancelled = call(s, "POST", BASE + "/bookings/" + booking["id"] + "/cancel",
                     headers={"X-CSRF-Token": csrf}, json={})
    check(cancelled.status_code == 200,
          f"Live cancellation failed HTTP {cancelled.status_code}")
    check(cancelled.json().get("status") == "CANCELLED",
          "Server did not persist cancellation")
    after = call(s, "GET", BASE + "/bookings/" + booking["id"])
    check(after.status_code == 200 and after.json().get("status") == "CANCELLED",
          "Cancelled booking status not persisted")
    print("PASS: live cancellation and persisted cancelled state")
    print("NOTE: Current Render storage engine is " + engine +
          "; only PostgreSQL with verified migrations meets durability gate.")
    print("NOTE: This test does not prove actual commercial payment processing.")


if __name__ == "__main__":
    main()
