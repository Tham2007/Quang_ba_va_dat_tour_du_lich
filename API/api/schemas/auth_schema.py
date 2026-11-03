"""Domain-scoped Pydantic contracts."""
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
from ._validators import email_ok

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
