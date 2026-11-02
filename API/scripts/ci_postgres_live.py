"""Exercise the real PostgreSQL service in GitHub Actions, not a mock DB."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from api.app import app
from api.models import engine, SessionLocal, Booking, User


def must(ok: bool, reason: str) -> None:
    if not ok:
        raise AssertionError(reason)


def main() -> None:
    must(engine.dialect.name == "postgresql", "Refusing to run on a non-PostgreSQL database")
    with TestClient(app, base_url="https://testserver") as c:
        tables = set(inspect(engine).get_table_names())
        expected = {
            "users", "sessions", "tours", "schedules", "bookings",
            "favorites", "audit_events", "alembic_version",
        }
        must(expected <= tables, f"Missing migrated tables: {expected - tables}")
        constraints = inspect(engine).get_unique_constraints("bookings")
        must(
            any(x["name"] == "uq_booking_payment_evidence" for x in constraints),
            "Alembic 0002 unique payment evidence migration did not run",
        )
        print("PASS PostgreSQL 16 migrations 0001+0002, 8 schema tables, payment unique constraint")
        r = c.get("/api/v1/health/ready")
        must(r.status_code == 200, f"Health HTTP {r.status_code}")
        tours = c.get("/api/v1/tours").json()
        must(len(tours) == 6, "Expected six synthetic tours after DB seed")
        print("PASS real PostgreSQL catalog and GET health")

        nonce = uuid.uuid4().hex
        account = {
            "full_name": "CI Synthetic Customer",
            "email": f"postgres-ci-{nonce}@example.invalid",
            "phone": "09" + "".join(str(int(x, 16) % 10) for x in nonce[:8]),
            "password": "CI_Safe_Password_1!" + nonce,
        }
        res = c.post("/api/v1/auth/register", json=account)
        must(res.status_code == 201, f"Register failed: {res.status_code}: {res.text[:120]}")
        must(res.json()["role"] == "CUSTOMER", "Unauthorized role escalation")
        must("secure" in res.headers.get("set-cookie", "").lower(), "Staging requires secure session")
        csrf = c.cookies["delta_csrf"]
        headers = {"X-CSRF-Token": csrf}
        schedules = c.get("/api/v1/tours/" + tours[0]["id"] + "/schedules").json()
        schedule = next(x for x in schedules if x["availableSeats"] > 0)
        original = schedule["availableSeats"]
        quote = c.post("/api/v1/bookings/quote", json={"schedule_id": schedule["id"], "adults": 1, "children": 0, "infants": 0})
        must(quote.status_code == 200 and quote.json()["totalPrice"] > 0, "Quote failed")
        data = {
            "schedule_id": schedule["id"], "adults": 1, "children": 0, "infants": 0,
            "customer_name": account["full_name"], "customer_email": account["email"],
            "customer_phone": account["phone"], "note": "synthetic PostgreSQL CI",
        }
        token = str(uuid.uuid4())
        res = c.post("/api/v1/bookings", json=data, headers={**headers, "Idempotency-Key": token})
        must(res.status_code == 201, f"Book failed: {res.status_code}: {res.text[:200]}")
        order = res.json()
        must(order["status"] == "PENDING_PAYMENT" and not order["paid"], "No automatic PAID allowed")
        repeated = c.post("/api/v1/bookings", json=data, headers={**headers, "Idempotency-Key": token})
        must(repeated.status_code == 201 and repeated.json()["id"] == order["id"], "Non-idempotent retry")
        after = c.get("/api/v1/tours/" + tours[0]["id"] + "/schedules").json()
        must(next(x for x in after if x["id"] == schedule["id"])["availableSeats"] == original - 1, "Seat reservation incorrect")
        with SessionLocal() as db:
            stored = db.scalar(select(Booking).where(Booking.id == order["id"]))
            must(stored is not None and stored.user_id, "Database did not persist booking")
            account_row = db.scalar(select(User).where(User.email == account["email"]))
            must(account_row is not None, "Database did not persist user")
        must(c.get("/api/v1/admin/metrics").status_code == 403, "Customer can reach admin")
        cancel = c.post("/api/v1/bookings/" + order["id"] + "/cancel", json={}, headers=headers)
        must(cancel.status_code == 200, f"Cancel failed {cancel.status_code}")
        final = c.get("/api/v1/tours/" + tours[0]["id"] + "/schedules").json()
        must(next(x for x in final if x["id"] == schedule["id"])["availableSeats"] == original, "Seat not released")
        print("PASS actual PostgreSQL persistence, HTTPS cookies, RBAC, quote, book, idempotent retry and cancel")

    # The DB survives TestClient lifecycle boundaries, unlike Render ephemeral SQLite.
    with SessionLocal() as db:
        booking = db.get(Booking, order["id"])
        must(booking is not None and booking.status == "CANCELLED", "Database lost record after app shutdown")
    print("PASS booking persisted across application lifecycle")


if __name__ == "__main__":
    main()
