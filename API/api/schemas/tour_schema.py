"""Domain-scoped Pydantic contracts."""

from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


def _validate_images(images: list[str] | None) -> list[str] | None:
    if images is None:
        return None
    clean = []
    for image in images:
        value = image.strip()
        if not value:
            continue
        if len(value) > 1200 or not (
            value.startswith(("https://", "http://", "/", "assets/"))
            and not value.startswith("//")
        ):
            raise ValueError("Ảnh phải là URL HTTP(S) hoặc đường dẫn ảnh tương đối.")
        clean.append(value)
    if len(set(clean)) != len(clean):
        raise ValueError("Danh sách ảnh không được chứa đường dẫn trùng.")
    return clean


class TourPatch(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    price: int | None = Field(default=None, ge=1, le=2_000_000_000)
    original_price: int | None = Field(default=None, ge=1, le=2_000_000_000)
    description: str | None = Field(default=None, max_length=6000)
    active: bool | None = None
    flash_sale: bool | None = None
    images: list[str] | None = Field(default=None, max_length=12)

    @field_validator("images")
    @classmethod
    def valid_images(cls, value):
        return _validate_images(value)


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

    @model_validator(mode="after")
    def images_override_cover(self):
        if self.images is not None and self.image:
            raise ValueError("Chỉ gửi image hoặc images, không gửi đồng thời.")
        return self


class TourSearch(BaseModel):
    q: str = Field(default="", max_length=100)
    region: Literal["all", "north", "central", "south"] = "all"
    destination: str = Field(default="", max_length=100)
    departure_location: str = Field(default="", max_length=100)
    departure_date: date | None = None
    min_price: int | None = Field(default=None, ge=0, le=2_000_000_000)
    max_price: int | None = Field(default=None, ge=0, le=2_000_000_000)
    duration: str = Field(default="", max_length=30)
    transport: str = Field(default="", max_length=80)
    tour_type: Literal["domestic", "international"] | None = None
    audience: Literal["family", "couple", "friends"] | None = None
    availability: Literal["available", "sold_out"] | None = None
    sort_by: Literal[
        "relevance", "price_asc", "price_desc", "newest", "departure_soonest"
    ] = "relevance"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=12, ge=1, le=100)


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
