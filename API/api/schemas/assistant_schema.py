"""Domain-scoped Pydantic contracts."""

from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict


class AssistantMessage(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
