"""Shared input validators."""

import re


def email_ok(v):
    v = v.strip().lower()
    if len(v) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", v):
        raise ValueError("Email không hợp lệ")
    return v
