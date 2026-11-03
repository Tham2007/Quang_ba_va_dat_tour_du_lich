"""Domain-scoped Pydantic contracts."""
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict

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
