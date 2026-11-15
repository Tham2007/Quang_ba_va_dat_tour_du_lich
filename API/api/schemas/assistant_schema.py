"""Validated request schema for the real, domain-grounded travel assistant."""

from typing import Literal
from pydantic import BaseModel, Field


class AssistantHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=900)


class AssistantMessage(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[AssistantHistoryItem] = Field(default_factory=list, max_length=8)
    lang: Literal["vi", "en"] = "vi"
    currentTourId: str | None = Field(default=None, max_length=30)
