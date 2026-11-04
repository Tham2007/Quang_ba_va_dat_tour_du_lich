"""Verify MVC modules are real and public HTTP handlers stay registered."""
from pathlib import Path
from api.app import app
from api.models import (
    Base,
    User,
    Tour,
    Booking,
    TourCostItem,
    ItineraryItem,
)
from api.schemas import Signup, TourCreate, BookingInput
from api.core import me, db_session


def test_models_and_schemas_preserve_metadata():
    assert User.__module__ == "api.models.user"
    assert Tour.__module__ == "api.models.tour"
    assert Booking.__module__ == "api.models.booking"
    assert Signup.__module__ == "api.schemas.auth_schema"
    assert TourCreate.__module__ == "api.schemas.tour_schema"
    assert BookingInput.__module__ == "api.schemas.booking_schema"
    assert TourCostItem.__module__ == "api.models.tour_detail"
    assert ItineraryItem.__module__ == "api.models.tour_detail"
    assert len(Base.metadata.tables) == 9


def test_registered_handlers_are_controllers():
    endpoints = [r.endpoint for r in app.routes if getattr(r, "path", "").startswith("/api/v1/") and hasattr(r, "endpoint")]
    for controller in ("auth", "tour", "booking", "admin", "assistant"):
        assert any(e.__module__ == f"api.controllers.{controller}_controller" for e in endpoints)


def test_routes_contain_no_business_handlers():
    base = Path(__file__).resolve().parents[1] / "api" / "routes"
    for name in ("auth", "tours", "bookings", "admin", "assistant"):
        source = (base / f"{name}.py").read_text(encoding="utf-8")
        assert "add_api_route(" in source
        assert "def " not in source


def test_dependencies_import():
    assert callable(me) and callable(db_session)
