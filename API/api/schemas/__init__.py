"""Stable Pydantic contract imports for existing FastAPI controllers."""

from .auth_schema import Signup, Login, ProfilePatch, ChangePassword
from .tour_schema import TourPatch, TourCreate, ScheduleCreate, SchedulePatch
from .booking_schema import BookingInput, QuoteInput, PaymentEvidence
from .assistant_schema import AssistantMessage

__all__ = [
    "Signup",
    "Login",
    "ProfilePatch",
    "ChangePassword",
    "TourPatch",
    "TourCreate",
    "ScheduleCreate",
    "SchedulePatch",
    "BookingInput",
    "QuoteInput",
    "PaymentEvidence",
    "AssistantMessage",
]
