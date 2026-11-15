"""Domain-scoped Pydantic contracts."""

from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
from ._validators import email_ok


class BookingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schedule_id: str = Field(min_length=1, max_length=36)
    adults: int = Field(ge=1, le=20)
    children: int = Field(ge=0, le=20)
    infants: int = Field(ge=0, le=20)
    customer_name: str = Field(min_length=2, max_length=120)
    customer_phone: str = Field(pattern=r"^0[35789][0-9]{8}$")
    customer_email: str
    customer_identity: str = Field(pattern=r"^[0-9]{12}$")
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


class PaymentEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reference: str = Field(min_length=8, max_length=250)

    @field_validator("reference")
    @classmethod
    def normalize_reference(cls, value: str):
        value = value.strip()
        if len(value) < 8:
            raise ValueError("Mã đối soát phải có ít nhất 8 ký tự.")
        return value
