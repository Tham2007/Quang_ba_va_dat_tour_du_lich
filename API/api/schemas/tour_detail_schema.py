"""Validation contracts for private tour costing and public itinerary content."""

from datetime import time
from typing import Literal

from pydantic import BaseModel, Field, model_validator


CostCategory = Literal[
    "transport",
    "accommodation",
    "meal",
    "sightseeing",
    "activity",
    "guide",
    "insurance",
    "other",
]
ItineraryCategory = Literal[
    "transport", "meal", "accommodation", "activity", "team_building", "note"
]


class TourCostInput(BaseModel):
    category: CostCategory
    name: str = Field(min_length=2, max_length=150)
    notes: str = Field(default="", max_length=2000)
    amount_per_person: int = Field(ge=0, le=2_000_000_000)


class ItineraryInput(BaseModel):
    day_number: int = Field(ge=1, le=365)
    sequence: int = Field(ge=1, le=100)
    category: ItineraryCategory
    title: str = Field(min_length=2, max_length=180)
    description: str = Field(default="", max_length=4000)
    location: str = Field(default="", max_length=180)
    start_time: time | None = None


class TourDetailsReplace(BaseModel):
    price: int = Field(ge=1, le=2_000_000_000)
    cost_items: list[TourCostInput] = Field(default_factory=list, max_length=100)
    itinerary: list[ItineraryInput] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def validate_tour_pricing_and_itinerary(self):
        base_cost = sum(item.amount_per_person for item in self.cost_items)
        if self.price <= base_cost:
            raise ValueError("Giá bán phải cao hơn tổng giá gốc.")
        slots = [(item.day_number, item.sequence) for item in self.itinerary]
        if len(slots) != len(set(slots)):
            raise ValueError("Mỗi hoạt động trong ngày cần có thứ tự riêng.")
        return self
