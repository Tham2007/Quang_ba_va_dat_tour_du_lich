"""API input contracts and validation; does not touch persistence."""

import re
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict


def email_ok(v):
    v = v.strip().lower()
    if len(v) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", v):
        raise ValueError("Email không hợp lệ")
    return v


class Signup(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str
    phone: str = Field(pattern=r"^0[35789][0-9]{8}$")
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, v):
        return email_ok(v)

    @field_validator("full_name")
    @classmethod
    def valid_name(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Họ tên phải có ít nhất 2 ký tự.")
        return v


class Login(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, v):
        return email_ok(v)


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, pattern=r"^0[35789][0-9]{8}$")


class ChangePassword(BaseModel):
    old_password: str
    new_password: str = Field(min_length=12, max_length=128)


class BookingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schedule_id: str = Field(min_length=1, max_length=36)
    adults: int = Field(ge=1, le=20)
    children: int = Field(ge=0, le=20)
    infants: int = Field(ge=0, le=20)
    customer_name: str = Field(min_length=2, max_length=120)
    customer_phone: str = Field(pattern=r"^0[35789][0-9]{8}$")
    customer_email: str
    note: str = Field(default="", max_length=500)

    @field_validator("customer_email")
    @classmethod
    def valid_email(cls, v):
        return email_ok(v)

    @field_validator("customer_name")
    @classmethod
    def valid_customer(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Tên khách không hợp lệ.")
        return v.strip()

    @field_validator("infants")
    @classmethod
    def non_neg(cls, v):
        return v


class QuoteInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schedule_id: str
    adults: int = Field(ge=1, le=20)
    children: int = Field(ge=0, le=20)
    infants: int = Field(ge=0, le=20)


class TourPatch(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    price: int | None = Field(default=None, ge=1, le=2_000_000_000)
    original_price: int | None = Field(default=None, ge=1, le=2_000_000_000)
    description: str | None = Field(default=None, max_length=6000)
    active: bool | None = None
    flash_sale: bool | None = None


class TourCreate(TourPatch):
    id: str = Field(pattern=r"^DL-[A-Z0-9]{2,20}$")
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=3, max_length=255)
    price: int = Field(ge=1, le=2_000_000_000)
    original_price: int = Field(ge=1, le=2_000_000_000)
    region: str = Field(pattern=r"^(north|central|south)$")
    duration: str = Field(min_length=3, max_length=30)
    departure: str = Field(min_length=2, max_length=255)
    transport: str = Field(min_length=2, max_length=255)
    image: str = Field(default="", max_length=1200)


class ScheduleCreate(BaseModel):
    tour_id: str
    departure_at: datetime
    total_seats: int = Field(ge=1, le=10000)

    @field_validator("departure_at")
    @classmethod
    def tz_required(cls, v):
        if v.tzinfo is None:
            raise ValueError("departure_at must have UTC offset")
        return v


class SchedulePatch(BaseModel):
    total_seats: int | None = Field(default=None, ge=1, le=10000)
    active: bool | None = None


class PaymentEvidence(BaseModel):
    reference: str = Field(min_length=8, max_length=250)


class AssistantMessage(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
