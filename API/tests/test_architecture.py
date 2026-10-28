"""Guard the modular API layout and unchanged public demo contract."""
from pathlib import Path

from api.app import app


def test_app_is_only_composition_not_monolith():
    path = Path(__file__).resolve().parents[1] / "api" / "app.py"
    source = path.read_text(encoding="utf-8")
    assert len(source.splitlines()) < 140
    assert "app.include_router(module.router)" in source
    assert "app.mount(" in source


def test_public_routes_still_registered_after_refactor():
    paths = app.openapi()["paths"]
    required = {
        ("/api/v1/health/ready", "get"),
        ("/api/v1/auth/register", "post"),
        ("/api/v1/auth/login", "post"),
        ("/api/v1/auth/session", "get"),
        ("/api/v1/auth/me", "get"),
        ("/api/v1/auth/logout", "post"),
        ("/api/v1/auth/profile", "patch"),
        ("/api/v1/auth/change-password", "post"),
        ("/api/v1/favorites", "get"),
        ("/api/v1/favorites/{tour_id}", "post"),
        ("/api/v1/favorites/{tour_id}", "delete"),
        ("/api/v1/tours", "get"),
        ("/api/v1/tours/{tour_id}", "get"),
        ("/api/v1/tours/{tour_id}/schedules", "get"),
        ("/api/v1/bookings/quote", "post"),
        ("/api/v1/bookings", "post"),
        ("/api/v1/bookings", "get"),
        ("/api/v1/bookings/{booking_id}", "get"),
        ("/api/v1/bookings/{booking_id}/cancel", "post"),
        ("/api/v1/admin/tours", "get"),
        ("/api/v1/admin/tours", "post"),
        ("/api/v1/admin/tours/{tour_id}", "patch"),
        ("/api/v1/admin/schedules", "get"),
        ("/api/v1/admin/schedules", "post"),
        ("/api/v1/admin/schedules/{schedule_id}", "patch"),
        ("/api/v1/admin/bookings", "get"),
        ("/api/v1/admin/bookings/{booking_id}/confirm-payment", "post"),
        ("/api/v1/admin/metrics", "get"),
        ("/api/v1/admin/audit", "get"),
        ("/api/v1/assistant/chat", "post"),
    }
    actual = {(path, method) for path, methods in paths.items() for method in methods}
    assert required <= actual, sorted(required - actual)


def test_no_duplicate_http_routes():
    registry = []
    for route in app.routes:
        if route.path.startswith("/api/v1/") and hasattr(route, "methods"):
            registry.extend((route.path, method) for method in route.methods)
    assert len(registry) == len(set(registry))
