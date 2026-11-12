"""Authenticated SQL Server booking controller for the 12-table Delta Travel schema.

Enabled only with THAM_BOOKING_WRITES_ENABLED=1 and a reviewed non-destructive
migration. Not a payment processor. Does not trust any browser-supplied user ID,
price, booking status, or seat count; existing SQL Server SPs/triggers own stock.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import html
import json
import os
import re
import secrets
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from collections import defaultdict, deque
from email.message import EmailMessage
from threading import Lock
from time import monotonic
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError, SQLAlchemyError

router = APIRouter()
_SESSION = "delta_session"
_CSRF = "delta_csrf"
_SECURE = os.getenv("DELTA_ENV") in ("staging", "production")

_RATE = defaultdict(deque)
_RATE_LOCK = Lock()


def _throttle(request: Request, scope: str, limit: int, window: int = 60):
    # Basic staging safeguard. A distributed rate limiter is required for
    # multiple Render instances and any publicly accessible production API.
    ip = request.client.host if request.client else "unknown"
    key = (scope, ip)
    timestamp = monotonic()
    with _RATE_LOCK:
        dq = _RATE[key]
        while dq and dq[0] <= timestamp - window:
            dq.popleft()
        if len(dq) >= limit:
            _fail(429, "Quá nhiều yêu cầu. Vui lòng thử lại sau.")
        dq.append(timestamp)



def _engine():
    # Import lazily so CI can substitute the isolated, disposable SQL Server engine.
    from api import tham_sqlserver_app
    return tham_sqlserver_app._engine()


def _fail(code: int, message: str):
    raise HTTPException(code, message)


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return "scrypt$" + base64.b64encode(salt).decode("ascii") + "$" + base64.b64encode(digest).decode("ascii")


def _password_matches(password: str, stored: str) -> bool:
    try:
        scheme, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=base64.b64decode(salt),
            n=2**14, r=8, p=1
        )
        return hmac.compare_digest(actual, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


def _user_view(row) -> dict:
    return {
        "id": str(row["MaNguoiDung"]),
        "fullName": row["HoTen"],
        "email": row["Email"],
        "phone": row["SoDienThoai"],
        "role": "CUSTOMER",  # This schema has no auditable ADMIN role.
    }


def _session_start(conn, response: Response, user_id: int):
    raw, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    conn.execute(text("""
        INSERT INTO dbo.API_PHIENDANGNHAP (TokenHash, MaNguoiDung, CsrfHash, HetHan)
        VALUES (:token, :user_id, :csrf, DATEADD(day, 7, SYSUTCDATETIME()))
    """), {"token": _hash(raw), "user_id": user_id, "csrf": _hash(csrf)})
    response.set_cookie(_SESSION, raw, max_age=7*86400, httponly=True,
                        secure=_SECURE, samesite="strict", path="/")
    response.set_cookie(_CSRF, csrf, max_age=7*86400, httponly=False,
                        secure=_SECURE, samesite="strict", path="/")


def _authenticated(request: Request) -> dict:
    raw = request.cookies.get(_SESSION, "")
    if len(raw) < 32:
        _fail(401, "Bạn cần đăng nhập bằng tài khoản SQL Server.")
    try:
        with _engine().connect() as conn:
            user = conn.execute(text("""
                SELECT u.MaNguoiDung, u.HoTen, u.Email, u.SoDienThoai, s.CsrfHash
                FROM dbo.API_PHIENDANGNHAP s
                JOIN dbo.NGUOIDUNG u ON u.MaNguoiDung = s.MaNguoiDung
                WHERE s.TokenHash = :token AND s.HetHan > SYSUTCDATETIME()
                    AND u.TrangThai = 1
            """), {"token": _hash(raw)}).mappings().first()
    except SQLAlchemyError:
        _fail(503, "Không thể xác nhận phiên SQL Server.")
    if not user:
        _fail(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        supplied = request.headers.get("X-CSRF-Token", "")
        cookie = request.cookies.get(_CSRF, "")
        if not cookie or not supplied or not hmac.compare_digest(cookie, supplied) or not hmac.compare_digest(_hash(supplied), user["CsrfHash"].strip()):
            _fail(403, "CSRF token không hợp lệ.")
    return dict(user)


def _optional_authenticated(request: Request) -> dict | None:
    raw = request.cookies.get(_SESSION, "")
    if len(raw) < 32:
        return None
    try:
        with _engine().connect() as conn:
            user = conn.execute(text("""
                SELECT u.MaNguoiDung, u.HoTen, u.Email, u.SoDienThoai
                FROM dbo.API_PHIENDANGNHAP s
                JOIN dbo.NGUOIDUNG u ON u.MaNguoiDung = s.MaNguoiDung
                WHERE s.TokenHash = :token AND s.HetHan > SYSUTCDATETIME()
                    AND u.TrangThai = 1
            """), {"token": _hash(raw)}).mappings().first()
        return dict(user) if user else None
    except SQLAlchemyError:
        return None


def _require_admin(user: Annotated[dict, Depends(_authenticated)]) -> dict:
    try:
        with _engine().connect() as conn:
            has_role = conn.execute(text(
                "SELECT CASE WHEN COL_LENGTH(N'dbo.NGUOIDUNG', N'VaiTro') IS NOT NULL THEN 1 ELSE 0 END"
            )).scalar()
            if not has_role:
                _fail(403, "Yêu cầu quyền quản trị ADMIN.")
            role = conn.execute(text(
                "SELECT VaiTro FROM dbo.NGUOIDUNG WHERE MaNguoiDung=:uid AND TrangThai=1"
            ), {"uid": int(user["MaNguoiDung"])}).scalar()
    except SQLAlchemyError:
        _fail(503, "Không thể xác minh quyền quản trị trên SQL Server.")
    if str(role or "").upper() != "ADMIN":
        _fail(403, "Chỉ tài khoản ADMIN mới được phép thực hiện thao tác này.")
    return user


def _has_voucher_schema(conn) -> bool:
    return bool(conn.execute(text(
        "SELECT CASE WHEN OBJECT_ID(N'dbo.AUDITLOG', N'U') IS NOT NULL THEN 1 ELSE 0 END"
    )).scalar())


def _safe_json_str_list(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    if not raw:
        return []
    try:
        parsed = json.loads(str(raw))
        return [str(x).strip() for x in parsed if str(x).strip()] if isinstance(parsed, list) else []
    except (ValueError, TypeError):
        return []


def _region_key_from_category(category_name: str | None) -> str:
    low = str(category_name or "").lower()
    if "trung" in low:
        return "central"
    if "nam" in low:
        return "south"
    return "north"


def _to_naive_utc(dt: datetime | str | None, is_end: bool = False) -> datetime:
    if isinstance(dt, datetime):
        return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt
    raw = str(dt or "").strip()
    if not raw:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    if len(raw) == 10 and re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        raw = f"{raw}T{'23:59:59' if is_end else '00:00:00'}"
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    parsed = datetime.fromisoformat(raw)
    return parsed.astimezone(timezone.utc).replace(tzinfo=None) if parsed.tzinfo else parsed


def _iso_z(dt: datetime | str | None) -> str | None:
    if not dt:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat() + "Z"


def _parse_voucher_log(row) -> dict | None:
    if not row:
        return None
    try:
        data = json.loads(row["DuLieuMoi"] or "{}")
    except (ValueError, TypeError):
        return None
    code = str(data.get("code") or row.get("DuLieuCu") or "").strip().upper()
    if not code:
        return None
    return {
        "maLog": int(row["MaLog"]),
        "raw": data,
        "code": code,
        "name": str(data.get("name") or ""),
        "description": str(data.get("description") or ""),
        "discountType": str(data.get("discountType") or "percent").lower(),
        "discountValue": float(data.get("discountValue") or 0),
        "maxDiscount": float(data["maxDiscount"]) if data.get("maxDiscount") is not None else None,
        "minOrderValue": float(data.get("minOrderValue") or 0),
        "scopeType": str(data.get("scopeType") or "all").lower(),
        "scopeRegions": _safe_json_str_list(data.get("scopeRegions")),
        "scopeTourIds": _safe_json_str_list(data.get("scopeTourIds")),
        "startAt": data.get("startAt"),
        "endAt": data.get("endAt"),
        "usageLimit": int(data.get("usageLimit") or 0),
        "usedCount": int(data.get("usedCount") or 0),
        "perUserLimit": int(data.get("perUserLimit") if data.get("perUserLimit") is not None else 1),
        "targetAudience": str(data.get("targetAudience") or "all").lower(),
        "active": bool(data.get("active", True)),
        "createdAt": data.get("createdAt") or _iso_z(row.get("ThoiGian")),
        "updatedAt": data.get("updatedAt") or _iso_z(row.get("ThoiGian")),
    }


def _voucher_dto(v: dict, stats: dict | None = None) -> dict:
    usage_limit = int(v["usageLimit"] or 0)
    used_count = int(v["usedCount"] or 0)
    remaining = max(0, usage_limit - used_count) if usage_limit > 0 else None
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start_dt = _to_naive_utc(v["startAt"], is_end=False) if v.get("startAt") else None
    end_dt = _to_naive_utc(v["endAt"], is_end=True) if v.get("endAt") else None
    if not v["active"]:
        lifecycle = "INACTIVE"
    elif start_dt and now < start_dt:
        lifecycle = "SCHEDULED"
    elif end_dt and now > end_dt:
        lifecycle = "EXPIRED"
    elif usage_limit > 0 and used_count >= usage_limit:
        lifecycle = "EXHAUSTED"
    else:
        lifecycle = "ACTIVE"

    dto = {
        "id": str(v["maLog"]),
        "code": v["code"],
        "name": v["name"],
        "description": v["description"],
        "discountType": v["discountType"],
        "discountValue": int(v["discountValue"]),
        "maxDiscount": int(v["maxDiscount"]) if v["maxDiscount"] is not None and v["maxDiscount"] > 0 else None,
        "minOrderValue": int(v["minOrderValue"]),
        "scopeType": v["scopeType"],
        "scopeRegions": v["scopeRegions"],
        "scopeTourIds": v["scopeTourIds"],
        "startAt": _iso_z(start_dt),
        "endAt": _iso_z(end_dt),
        "usageLimit": usage_limit,
        "usedCount": used_count,
        "remainingUses": remaining,
        "perUserLimit": int(v["perUserLimit"]),
        "targetAudience": v["targetAudience"],
        "active": bool(v["active"]),
        "lifecycleStatus": lifecycle,
        "createdAt": v.get("createdAt"),
        "updatedAt": v.get("updatedAt"),
    }
    if stats is not None:
        dto["stats"] = stats
    return dto


def _calc_voucher_discount(v: dict, subtotal: int) -> tuple[int, int]:
    safe_sub = max(0, int(subtotal))
    if v["discountType"] == "percent":
        pct = max(0.0, min(100.0, float(v["discountValue"])))
        discount = round(safe_sub * pct / 100.0)
        cap = int(v["maxDiscount"] or 0)
        if cap > 0:
            discount = min(discount, cap)
    else:
        discount = max(0, round(float(v["discountValue"])))
    discount = max(0, min(safe_sub, discount))
    return discount, max(0, safe_sub - discount)


def _list_voucher_uses(conn, norm_code: str | None = None) -> list[dict]:
    sql = "SELECT TOP 1000 MaLog, MaNguoiThucHien, DuLieuCu, DuLieuMoi, ThoiGian FROM dbo.AUDITLOG WHERE HanhDong=N'VOUCHER_USE'"
    params = {}
    if norm_code:
        sql += " AND UPPER(DuLieuCu)=:code"
        params["code"] = norm_code.upper()
    sql += " ORDER BY MaLog DESC"
    out = []
    for r in conn.execute(text(sql), params).mappings().all():
        try:
            p = json.loads(r["DuLieuMoi"] or "{}")
        except (ValueError, TypeError):
            p = {}
        out.append({
            "maLog": int(r["MaLog"]),
            "code": str(p.get("code") or r["DuLieuCu"] or "").upper(),
            "maDatTour": p.get("maDatTour"),
            "bookingExternalId": p.get("bookingExternalId"),
            "maNguoiDung": p.get("maNguoiDung") if p.get("maNguoiDung") is not None else r["MaNguoiThucHien"],
            "email": str(p.get("email") or "").strip().lower(),
            "phone": str(p.get("phone") or "").strip(),
            "discountAmount": int(Decimal(str(p.get("discountAmount") or 0))),
            "bookingTotal": int(Decimal(str(p.get("bookingTotal") or 0))),
            "status": str(p.get("status") or "ACTIVE").upper(),
            "createdAt": p.get("createdAt") or _iso_z(r.get("ThoiGian")),
        })
    return out


def _validate_voucher_in_conn(
    conn,
    *,
    code: str,
    tour_id: int,
    category_name: str | None,
    tour_title: str,
    subtotal: int,
    user: dict | None,
    customer_email: str = "",
    customer_phone: str = "",
) -> dict:
    norm = str(code or "").strip().upper()
    if not norm:
        return {"ok": False, "status": 422, "errorCode": "EMPTY_CODE", "detail": "Vui lòng nhập mã ưu đãi."}

    row = conn.execute(text("""
        SELECT TOP 1 MaLog, DuLieuCu, DuLieuMoi, ThoiGian
        FROM dbo.AUDITLOG
        WHERE HanhDong=N'VOUCHER_DEF' AND UPPER(DuLieuCu)=:code
        ORDER BY MaLog DESC
    """), {"code": norm}).mappings().first()
    v = _parse_voucher_log(row)
    if not v:
        return {"ok": False, "status": 422, "errorCode": "VOUCHER_NOT_FOUND", "detail": f'Mã ưu đãi "{norm}" không tồn tại.'}
    if not v["active"]:
        return {"ok": False, "status": 422, "errorCode": "VOUCHER_INACTIVE", "detail": f'Mã ưu đãi "{norm}" hiện đang tạm ngưng hoạt động.'}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start_dt = _to_naive_utc(v["startAt"], is_end=False) if v.get("startAt") else None
    end_dt = _to_naive_utc(v["endAt"], is_end=True) if v.get("endAt") else None
    if start_dt and now < start_dt:
        return {"ok": False, "status": 422, "errorCode": "VOUCHER_NOT_STARTED", "detail": f'Mã ưu đãi "{norm}" chưa đến thời gian áp dụng.'}
    if end_dt and now > end_dt:
        return {"ok": False, "status": 422, "errorCode": "VOUCHER_EXPIRED", "detail": f'Mã ưu đãi "{norm}" đã hết hạn sử dụng.'}

    if v["usageLimit"] > 0 and v["usedCount"] >= v["usageLimit"]:
        return {"ok": False, "status": 422, "errorCode": "VOUCHER_EXHAUSTED", "detail": f'Mã ưu đãi "{norm}" đã hết lượt sử dụng.'}

    if v["scopeType"] == "region":
        regions = [r.lower() for r in v["scopeRegions"]]
        if _region_key_from_category(category_name) not in regions:
            return {"ok": False, "status": 422, "errorCode": "VOUCHER_WRONG_SCOPE", "detail": f'Mã ưu đãi "{norm}" không áp dụng cho khu vực tour này.'}
    elif v["scopeType"] == "tours":
        allowed = {x.upper() for x in v["scopeTourIds"]}
        if str(tour_id).upper() not in allowed:
            return {"ok": False, "status": 422, "errorCode": "VOUCHER_WRONG_TOUR", "detail": f'Mã ưu đãi "{norm}" không áp dụng cho tour "{tour_title}".'}

    min_order = int(v["minOrderValue"] or 0)
    if min_order > 0 and subtotal < min_order:
        return {
            "ok": False,
            "status": 422,
            "errorCode": "VOUCHER_MIN_ORDER",
            "detail": f'Mã ưu đãi "{norm}" yêu cầu đơn tối thiểu {min_order:,} đ.',
        }

    uid = int(user["MaNguoiDung"]) if user else None
    eff_email = (customer_email or (user["Email"] if user else "") or "").strip().lower()
    eff_phone = (customer_phone or (user["SoDienThoai"] if user else "") or "").strip()

    if v["targetAudience"] == "logged_in" and not user:
        return {"ok": False, "status": 422, "errorCode": "VOUCHER_LOGIN_REQUIRED", "detail": f'Mã ưu đãi "{norm}" chỉ áp dụng cho khách hàng đã đăng nhập tài khoản.'}
    if v["targetAudience"] == "new_customer" and uid is not None:
        prior = conn.execute(text(
            "SELECT COUNT(*) FROM dbo.DATTOUR WHERE MaKhachHang=:uid AND TrangThaiDat <> N'Đã hủy'"
        ), {"uid": uid}).scalar() or 0
        if int(prior) > 0:
            return {"ok": False, "status": 422, "errorCode": "VOUCHER_NEW_CUSTOMER_ONLY", "detail": f'Mã ưu đãi "{norm}" chỉ dành cho khách hàng đặt tour lần đầu.'}

    per_user = int(v["perUserLimit"])
    if per_user > 0 and (uid is not None or eff_email or eff_phone):
        uses = _list_voucher_uses(conn, norm)
        user_used = sum(
            1 for u in uses
            if u["status"] == "ACTIVE" and (
                (uid is not None and u["maNguoiDung"] is not None and int(u["maNguoiDung"]) == uid)
                or (eff_email and u["email"] == eff_email)
                or (eff_phone and u["phone"] == eff_phone)
            )
        )
        if user_used >= per_user:
            return {"ok": False, "status": 422, "errorCode": "VOUCHER_USER_LIMIT_REACHED", "detail": f'Bạn đã sử dụng hết {per_user} lượt áp dụng mã ưu đãi "{norm}".'}

    discount, final_total = _calc_voucher_discount(v, subtotal)
    return {
        "ok": True,
        "voucher": _voucher_dto(v),
        "subtotalPrice": subtotal,
        "discountAmount": discount,
        "finalTotal": final_total,
    }


class Register(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=100)
    phone: str = Field(pattern=r"^0[35789][0-9]{8}$")
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Email không hợp lệ.")
        return value


class Login(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=100)
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class BookingBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schedule_id: str = Field(min_length=1, max_length=18)
    adults: int = Field(ge=1, le=20)
    children: int = Field(default=0, ge=0, le=0)
    infants: int = Field(default=0, ge=0, le=0)
    customer_name: str = Field(min_length=2, max_length=100)
    customer_phone: str = Field(pattern=r"^0[35789][0-9]{8}$")
    customer_email: str = Field(min_length=3, max_length=100)
    note: str = Field(default="", max_length=0)  # Not persisted by legacy 12-table SP.
    voucher_code: str | None = Field(default=None, max_length=32)

    @field_validator("schedule_id")
    @classmethod
    def schedule_digits(cls, value: str) -> str:
        if not value.isascii() or not value.isdecimal() or int(value) < 1:
            raise ValueError("Mã chuyến không hợp lệ.")
        return value

    @field_validator("customer_email")
    @classmethod
    def email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("voucher_code")
    @classmethod
    def norm_voucher_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().upper()
        return cleaned or None


def _fingerprint(body: BookingBody) -> str:
    payload = json.dumps(body.model_dump(), sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return _hash(payload)


def _booking_record(row) -> dict:
    amount = Decimal(str(row["TongTien"]))
    if amount != amount.to_integral_value():
        _fail(503, "Số tiền VND trong database không hợp lệ.")
    seats = int(row["SoLuongKhach"])
    discount = Decimal(str(row.get("VoucherDiscount") or 0))
    subtotal = Decimal(str(row["VoucherSubtotal"])) if row.get("VoucherSubtotal") is not None else (amount + discount)
    voucher_code = row.get("VoucherCode")
    paid = row["TrangThaiThanhToan"] in ("Đã cọc", "Đã thanh toán")
    states = {"Chờ xác nhận": "PENDING_PAYMENT", "Đã xác nhận": "CONFIRMED",
              "Đã hoàn thành": "COMPLETED", "Đã hủy": "CANCELLED"}
    return {
        "id": str(row["MaDatTour"]),
        "reference": "SQL-" + str(row["MaDatTour"]),
        "scheduleId": str(row["MaChuyen"]),
        "seats": seats,
        "subtotalPrice": int(subtotal),
        "discountAmount": int(discount),
        "voucherCode": voucher_code,
        "totalPrice": int(amount),
        "unitPrice": int(subtotal / seats) if seats else int(amount),
        "status": states.get(row["TrangThaiDat"], "UNKNOWN"),
        "paid": paid,
        "createdAt": row["NgayDat"].isoformat(timespec="seconds"),
        "storage": "sqlserver",
        "tourTitle": row["TenTour"],
    }


def _booking_select_sql(conn, table_hint: str = "") -> str:
    hint = f" {table_hint}" if table_hint else ""
    return f"""
    SELECT d.MaDatTour, d.MaKhachHang, d.MaChuyen, d.NgayDat, d.SoLuongKhach,
           d.TongTien, d.TrangThaiDat, d.TrangThaiThanhToan,
           c.NgayKhoiHanh, t.TenTour,
           CASE WHEN c.NgayKhoiHanh > DATEADD(hour,72,GETDATE()) THEN 1 ELSE 0 END AS ConHon72h,
           vuse.DuLieuCu AS VoucherCode,
           TRY_CAST(JSON_VALUE(CASE WHEN ISJSON(vuse.DuLieuMoi) = 1 THEN vuse.DuLieuMoi END, '$.subtotal') AS DECIMAL(18,2)) AS VoucherSubtotal,
           TRY_CAST(JSON_VALUE(CASE WHEN ISJSON(vuse.DuLieuMoi) = 1 THEN vuse.DuLieuMoi END, '$.discountAmount') AS DECIMAL(18,2)) AS VoucherDiscount
    FROM dbo.DATTOUR d{hint}
    JOIN dbo.CHUYENKHOIHANH c ON d.MaChuyen = c.MaChuyen
    JOIN dbo.TOUR t ON c.MaTour = t.MaTour
    OUTER APPLY (
        SELECT TOP 1 a.DuLieuCu, a.DuLieuMoi
        FROM dbo.AUDITLOG a
        WHERE a.HanhDong = N'VOUCHER_USE'
          AND ISJSON(a.DuLieuMoi) = 1
          AND TRY_CAST(JSON_VALUE(CASE WHEN ISJSON(a.DuLieuMoi) = 1 THEN a.DuLieuMoi END, '$.maDatTour') AS INT) = d.MaDatTour
        ORDER BY a.MaLog DESC
    ) vuse
    """


@router.post("/api/v1/auth/register", status_code=201)
def register(body: Register, request: Request, response: Response):
    # Registration is for synthetic staging accounts only.
    _throttle(request, "register", 5)
    try:
        with _engine().begin() as conn:
            row = conn.execute(text("""
                INSERT INTO dbo.NGUOIDUNG (HoTen, Email, SoDienThoai, MatKhau)
                OUTPUT INSERTED.MaNguoiDung, INSERTED.HoTen, INSERTED.Email, INSERTED.SoDienThoai
                VALUES (:name, :email, :phone, :password)
            """), {"name": body.full_name.strip(), "email": body.email, "phone": body.phone,
                    "password": _password_hash(body.password)}).mappings().one()
            _session_start(conn, response, int(row["MaNguoiDung"]))
            return _user_view(row)
    except IntegrityError:
        _fail(409, "Email đã được đăng ký.")
    except SQLAlchemyError:
        _fail(503, "Không thể đăng ký trên SQL Server.")


@router.post("/api/v1/auth/login")
def login(body: Login, request: Request, response: Response):
    _throttle(request, "login", 10)
    try:
        with _engine().begin() as conn:
            row = conn.execute(text("""
                SELECT MaNguoiDung, HoTen, Email, SoDienThoai, MatKhau, TrangThai
                FROM dbo.NGUOIDUNG WHERE Email = :email
            """), {"email": body.email}).mappings().first()
            if not row or not row["TrangThai"] or not _password_matches(body.password, row["MatKhau"]):
                _fail(401, "Thông tin đăng nhập không chính xác.")
            _session_start(conn, response, int(row["MaNguoiDung"]))
            return _user_view(row)
    except SQLAlchemyError:
        _fail(503, "Không thể đăng nhập SQL Server.")


@router.get("/api/v1/auth/me")
def whoami(user: Annotated[dict, Depends(_authenticated)]):
    return _user_view(user)


@router.get("/api/v1/auth/session")
def session_info(request: Request):
    try:
        user = _authenticated(request)
        return {"authenticated": True, "user": _user_view(user)}
    except HTTPException as exc:
        if exc.status_code == 401:
            return {"authenticated": False, "user": None}
        raise


@router.post("/api/v1/auth/logout")
def logout(request: Request, response: Response, user: Annotated[dict, Depends(_authenticated)]):
    raw = request.cookies[_SESSION]
    try:
        with _engine().begin() as conn:
            conn.execute(text("DELETE FROM dbo.API_PHIENDANGNHAP WHERE TokenHash=:token"),
                         {"token": _hash(raw)})
    except SQLAlchemyError:
        _fail(503, "Không thể đăng xuất.")
    response.delete_cookie(_SESSION, path="/", secure=_SECURE, samesite="strict")
    response.delete_cookie(_CSRF, path="/", secure=_SECURE, samesite="strict")
    return {"status": "logged_out"}


def _send_booking_email_smtp(
    record: dict,
    *,
    customer_name: str,
    customer_phone: str,
    customer_email: str,
    departure_at: Any = None,
) -> dict:
    to = (customer_email or "").strip()
    user = (os.getenv("DELTA_SMTP_USER") or os.getenv("SMTP_USER") or "").strip()
    pw = os.getenv("DELTA_SMTP_PASS") or os.getenv("SMTP_PASS") or ""
    raw_host = (os.getenv("DELTA_SMTP_HOST") or os.getenv("SMTP_HOST") or "").strip()
    host = raw_host or ("smtp.gmail.com" if user.lower().endswith("@gmail.com") else "")
    allow_no_auth = os.getenv("DELTA_SMTP_ALLOW_NO_AUTH") == "1"

    if not to or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", to):
        return {"sent": False, "configured": bool(host and (allow_no_auth or (user and pw))), "recipient": to, "reason": "INVALID_EMAIL"}
    if not host or (not allow_no_auth and (not user or not pw)):
        return {"sent": False, "configured": False, "recipient": to, "reason": "SMTP_NOT_CONFIGURED"}

    port = int(os.getenv("DELTA_SMTP_PORT") or os.getenv("SMTP_PORT") or "465")
    secure_env = os.getenv("DELTA_SMTP_SECURE") or os.getenv("SMTP_SECURE")
    use_ssl = (secure_env.lower() == "true") if secure_env is not None else (port == 465)
    sender = os.getenv("DELTA_SMTP_FROM") or (f"Delta Travel <{user}>" if user else "Delta Travel <no-reply@deltatravel.vn>")

    ref = record.get("reference") or record.get("id")
    tour_title = record.get("tourTitle") or "Tour Du Lịch Delta Travel"
    dep_str = departure_at.strftime("%d/%m/%Y") if hasattr(departure_at, "strftime") else str(departure_at or "Theo lịch đã chọn")
    subtotal = int(record.get("subtotalPrice") or record.get("totalPrice") or 0)
    discount = int(record.get("discountAmount") or 0)
    total = int(record.get("totalPrice") or 0)
    vcode = record.get("voucherCode")

    msg = EmailMessage()
    msg["Subject"] = f"[Delta Travel] Xác nhận thông tin đặt tour #{ref} - {tour_title}"
    msg["From"] = sender
    msg["To"] = to
    msg.set_content(
        f"Xin chào {customer_name},\n\n"
        f"Delta Travel xác nhận đã ghi nhận đơn đặt tour #{ref}:\n"
        f"- Hành trình: {tour_title}\n"
        f"- Ngày khởi hành: {dep_str}\n"
        f"- Số khách: {record.get('seats', 1)} khách\n"
        f"- Tiền tour ban đầu: {subtotal:,} đ\n"
        + (f"- Ưu đãi ({vcode}): -{discount:,} đ\n" if discount > 0 else "")
        + f"- Tổng tiền thanh toán: {total:,} đ\n\n"
        f"Cảm ơn Quý khách đã đặt tour cùng Delta Travel!"
    )
    disc_html = (
        f'<tr><td style="padding:8px 0;color:#15803d;">Giảm giá ({html.escape(str(vcode or ""))})</td>'
        f'<td style="padding:8px 0;text-align:right;font-weight:700;color:#15803d;">-{discount:,} đ</td></tr>'
        if discount > 0 else ""
    )
    msg.add_alternative(
        f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="margin-top:0;color:#0f172a;">Delta Travel - Xác nhận đặt tour #{html.escape(str(ref))}</h2>
        <p>Xin chào <strong>{html.escape(customer_name)}</strong>,</p>
        <p>Đơn đặt tour của Quý khách đã được ghi nhận trên hệ thống SQL Server:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#64748b;">Hành trình</td><td style="padding:6px 0;text-align:right;font-weight:600;">{html.escape(str(tour_title))}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Ngày khởi hành</td><td style="padding:6px 0;text-align:right;">{html.escape(dep_str)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Số khách</td><td style="padding:6px 0;text-align:right;">{int(record.get('seats', 1))} khách</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">SĐT liên hệ</td><td style="padding:6px 0;text-align:right;">{html.escape(customer_phone)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Tiền tour ban đầu</td><td style="padding:6px 0;text-align:right;">{subtotal:,} đ</td></tr>
          {disc_html}
          <tr><td style="padding:8px 0;border-top:2px solid #0f172a;font-weight:700;">Tổng thanh toán</td><td style="padding:8px 0;border-top:2px solid #0f172a;text-align:right;font-weight:800;color:#dc2626;">{total:,} đ</td></tr>
        </table>
        </div>""",
        subtype="html",
    )

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=6) as smtp:
                if user and pw:
                    smtp.login(user, pw)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=6) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                if user and pw:
                    smtp.login(user, pw)
                smtp.send_message(msg)
        return {"sent": True, "configured": True, "recipient": to}
    except Exception as exc:
        return {"sent": False, "configured": True, "recipient": to, "reason": "SEND_FAILED", "error": type(exc).__name__}


@router.post("/api/v1/bookings", status_code=201)
def create_booking(body: BookingBody, user: Annotated[dict, Depends(_authenticated)],
                   idempotency_key: Annotated[str, Header(alias="Idempotency-Key")]):
    try:
        key = str(uuid.UUID(idempotency_key))
    except (TypeError, ValueError):
        _fail(422, "Idempotency-Key phải là UUID.")
    if body.customer_email != user["Email"].lower():
        _fail(422, "Email đặt tour phải trùng tài khoản đăng nhập.")
    user_id, fingerprint = int(user["MaNguoiDung"]), _fingerprint(body)
    ident = int(body.schedule_id)
    created_record = None
    departure_dt = None
    try:
        with _engine().begin() as conn:
            conn.execute(text("""
                INSERT INTO dbo.API_YEUCAU_DATTOUR (MaNguoiDung, KhoaYeuCau, DauVanTay)
                VALUES (:uid, CONVERT(uniqueidentifier,:key), :fingerprint)
            """), {"uid": user_id, "key": key, "fingerprint": fingerprint})
            schedule = conn.execute(text("""
                SELECT c.MaChuyen, c.SoChoToiDa, c.SoChoDaDat, c.TrangThaiChuyen,
                       c.GiaThucTe, t.MaTour, t.TenTour, dm.TenDanhMuc
                FROM dbo.CHUYENKHOIHANH c WITH (UPDLOCK, HOLDLOCK)
                JOIN dbo.TOUR t ON c.MaTour=t.MaTour
                JOIN dbo.DANHMUC dm ON dm.MaDanhMuc=t.MaDanhMuc
                WHERE c.MaChuyen=:sid AND t.TrangThai=1
                  AND c.NgayKhoiHanh > DATEADD(hour,72,GETDATE())
            """), {"sid": ident}).mappings().first()
            if not schedule or schedule["TrangThaiChuyen"] != "Mở bán":
                _fail(409, "Chuyến khởi hành chưa mở bán hoặc không hợp lệ.")
            if schedule["SoChoToiDa"]-schedule["SoChoDaDat"] < body.adults:
                _fail(409, "Tour không còn đủ chỗ.")
            if body.voucher_code:
                if not _has_voucher_schema(conn):
                    _fail(422, "CSDL SQL Server chưa kích hoạt bảng mã ưu đãi.")
                vcheck = _validate_voucher_in_conn(
                    conn,
                    code=body.voucher_code,
                    tour_id=int(schedule["MaTour"]),
                    category_name=schedule["TenDanhMuc"],
                    tour_title=schedule["TenTour"],
                    subtotal=int(Decimal(str(schedule["GiaThucTe"]))) * body.adults,
                    user=user,
                    customer_email=body.customer_email,
                    customer_phone=body.customer_phone,
                )
                if not vcheck["ok"]:
                    _fail(409 if vcheck["errorCode"] == "VOUCHER_EXHAUSTED" else vcheck["status"], vcheck["detail"])
                result = conn.execute(text("""
                    DECLARE @new_id INT;
                    EXEC dbo.sp_TaoDonDatTour
                        @MaKhachHang=:uid, @MaChuyen=:sid, @SoLuongKhach=:seats,
                        @HoTenTruongDoan=:name, @SoDienThoai=:phone,
                        @MaDatTourMoi=@new_id OUTPUT,
                        @MaCodeUuDai=:voucher;
                """), {"uid": user_id, "sid": ident, "seats": body.adults,
                       "name": body.customer_name.strip(), "phone": body.customer_phone,
                       "voucher": body.voucher_code})
            else:
                result = conn.execute(text("""
                    DECLARE @new_id INT;
                    EXEC dbo.sp_TaoDonDatTour
                        @MaKhachHang=:uid, @MaChuyen=:sid, @SoLuongKhach=:seats,
                        @HoTenTruongDoan=:name, @SoDienThoai=:phone,
                        @MaDatTourMoi=@new_id OUTPUT;
                """), {"uid": user_id, "sid": ident, "seats": body.adults,
                       "name": body.customer_name.strip(), "phone": body.customer_phone})
            # Procedure returns a SELECT with MaDatTour and TongTienThanhToan.
            first = result.mappings().first()
            if not first or not first.get("MaDatTour"):
                raise RuntimeError("Stored procedure returned no booking ID")
            booking_id = int(first["MaDatTour"])
            conn.execute(text("""
                UPDATE dbo.API_YEUCAU_DATTOUR SET MaDatTour=:booking
                WHERE MaNguoiDung=:uid AND KhoaYeuCau=CONVERT(uniqueidentifier,:key)
            """), {"booking": booking_id, "uid": user_id, "key": key})
            select_sql = _booking_select_sql(conn)
            row = conn.execute(text(select_sql + " WHERE d.MaDatTour=:booking AND d.MaKhachHang=:uid"),
                               {"booking": booking_id, "uid": user_id}).mappings().one()
            created_record = _booking_record(row)
            departure_dt = row.get("NgayKhoiHanh")
    except IntegrityError:
        # The winner committed the idempotency row; the loser must replay it,
        # never create another booking after a duplicate-key race.
        try:
            with _engine().connect() as conn:
                prior = conn.execute(text("""
                    SELECT DauVanTay, MaDatTour FROM dbo.API_YEUCAU_DATTOUR
                    WHERE MaNguoiDung=:uid AND KhoaYeuCau=CONVERT(uniqueidentifier,:key)
                """), {"uid": user_id, "key": key}).mappings().first()
                if not prior or prior["DauVanTay"].strip() != fingerprint or prior["MaDatTour"] is None:
                    _fail(409, "Idempotency-Key đã sử dụng hoặc yêu cầu chưa hoàn tất.")
                select_sql = _booking_select_sql(conn)
                row = conn.execute(text(select_sql + " WHERE d.MaDatTour=:booking AND d.MaKhachHang=:uid"),
                                   {"booking": prior["MaDatTour"], "uid": user_id}).mappings().one()
                return _booking_record(row)
        except SQLAlchemyError:
            _fail(503, "Không thể kiểm tra yêu cầu đã gửi.")
    except DBAPIError as exc:
        orig = getattr(exc, "orig", exc)
        parts = [
            a.decode("utf-8", "replace") if isinstance(a, (bytes, bytearray)) else str(a)
            for a in (getattr(orig, "args", None) or (orig,))
        ]
        err_text = " ".join(parts)
        for marker in ("Mã ưu đãi", "Đơn hàng chưa đạt", "Bạn đã sử dụng hết"):
            idx = err_text.find(marker)
            if idx != -1:
                msg = err_text[idx:].splitlines()[0].split("DB-Lib")[0].strip().rstrip("\")'")
                status_code = 409 if "hết lượt" in msg else 422
                _fail(status_code, msg)
        _fail(503, "SQL Server không thể tạo đơn; không tự động thử lại bằng khóa mới.")
    except SQLAlchemyError:
        _fail(503, "SQL Server không thể tạo đơn; không tự động thử lại bằng khóa mới.")

    created_record["customerEmail"] = body.customer_email
    created_record["emailNotification"] = _send_booking_email_smtp(
        created_record,
        customer_name=body.customer_name.strip(),
        customer_phone=body.customer_phone,
        customer_email=body.customer_email,
        departure_at=departure_dt,
    )
    return created_record


@router.get("/api/v1/bookings")
def my_bookings(user: Annotated[dict, Depends(_authenticated)]):
    try:
        with _engine().connect() as conn:
            select_sql = _booking_select_sql(conn)
            rows = conn.execute(text(select_sql + """
                WHERE d.MaKhachHang=:uid ORDER BY d.NgayDat DESC, d.MaDatTour DESC
                OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY
            """), {"uid": int(user["MaNguoiDung"])}).mappings().all()
            return [_booking_record(row) for row in rows]
    except SQLAlchemyError:
        _fail(503, "Không thể lấy danh sách đơn.")


@router.get("/api/v1/bookings/{booking_id}")
def get_booking(booking_id: int, user: Annotated[dict, Depends(_authenticated)]):
    try:
        with _engine().connect() as conn:
            select_sql = _booking_select_sql(conn)
            row = conn.execute(text(select_sql + " WHERE d.MaDatTour=:booking AND d.MaKhachHang=:uid"),
                               {"booking": booking_id, "uid": int(user["MaNguoiDung"])}).mappings().first()
            if not row:
                _fail(404, "Không tìm thấy đơn.")
            return _booking_record(row)
    except SQLAlchemyError:
        _fail(503, "Không thể lấy đơn đặt tour.")


@router.post("/api/v1/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: int, user: Annotated[dict, Depends(_authenticated)]):
    uid = int(user["MaNguoiDung"])
    try:
        with _engine().begin() as conn:
            locked_sql = _booking_select_sql(conn, "WITH (UPDLOCK, HOLDLOCK)")
            row = conn.execute(text(locked_sql + """
                WHERE d.MaDatTour=:booking AND d.MaKhachHang=:uid
            """), {"booking": booking_id, "uid": uid}).mappings().first()
            if not row:
                _fail(404, "Không tìm thấy đơn.")
            if row["TrangThaiDat"] == "Đã hủy":
                return _booking_record(row)
            if row["TrangThaiDat"] != "Chờ xác nhận" or row["TrangThaiThanhToan"] != "Chưa thanh toán":
                _fail(409, "Không thể tự hủy đơn đã xác nhận hoặc thanh toán.")
            if not row["ConHon72h"]:
                _fail(409, "Đã quá hạn hủy trước 72 giờ.")
            conn.execute(text("""
                EXEC dbo.sp_HuyDonDatTour @MaDatTour=:booking, @MaNguoiYeuCau=:uid,
                    @LyDoHuy=:reason
            """), {"booking": booking_id, "uid": uid, "reason": "Khách tự hủy qua API"})
            updated = conn.execute(text(_booking_select_sql(conn) + " WHERE d.MaDatTour=:booking AND d.MaKhachHang=:uid"),
                                   {"booking": booking_id, "uid": uid}).mappings().one()
            return _booking_record(updated)
    except SQLAlchemyError:
        _fail(503, "SQL Server chưa hoàn tất thao tác hủy; hãy kiểm tra lại đơn.")


class VoucherValidateBody(BaseModel):
    model_config = ConfigDict(extra="allow")
    code: str | None = None
    voucher_code: str | None = None
    voucherCode: str | None = None
    tour_id: str | int | None = None
    tourId: str | int | None = None
    schedule_id: str | int | None = None
    scheduleId: str | int | None = None
    adults: int = Field(default=1, ge=1, le=20)
    customer_email: str | None = ""
    customerEmail: str | None = ""
    customer_phone: str | None = ""
    customerPhone: str | None = ""


@router.get("/api/v1/vouchers")
def list_public_vouchers(tour_id: str | None = None):
    try:
        with _engine().connect() as conn:
            if not _has_voucher_schema(conn):
                return []
            tour_row = None
            if tour_id and str(tour_id).isdigit():
                tour_row = conn.execute(text("""
                    SELECT t.MaTour, dm.TenDanhMuc
                    FROM dbo.TOUR t JOIN dbo.DANHMUC dm ON dm.MaDanhMuc=t.MaDanhMuc
                    WHERE t.MaTour=:tid AND t.TrangThai=1
                """), {"tid": int(tour_id)}).mappings().first()

            now = datetime.now(timezone.utc).replace(tzinfo=None)
            rows = conn.execute(text("""
                SELECT MaLog, DuLieuCu, DuLieuMoi, ThoiGian
                FROM dbo.AUDITLOG
                WHERE HanhDong=N'VOUCHER_DEF'
                ORDER BY MaLog DESC
            """)).mappings().all()
            out = []
            for r in rows:
                v = _parse_voucher_log(r)
                if not v or not v["active"]:
                    continue
                start_dt = _to_naive_utc(v["startAt"], is_end=False) if v.get("startAt") else None
                end_dt = _to_naive_utc(v["endAt"], is_end=True) if v.get("endAt") else None
                if start_dt and now < start_dt:
                    continue
                if end_dt and now > end_dt:
                    continue
                if v["usageLimit"] > 0 and v["usedCount"] >= v["usageLimit"]:
                    continue
                if tour_row:
                    if v["scopeType"] == "region":
                        if _region_key_from_category(tour_row["TenDanhMuc"]) not in [x.lower() for x in v["scopeRegions"]]:
                            continue
                    elif v["scopeType"] == "tours":
                        allowed = {x.upper() for x in v["scopeTourIds"]}
                        if str(tour_row["MaTour"]).upper() not in allowed:
                            continue
                out.append(_voucher_dto(v))
            return out
    except SQLAlchemyError:
        _fail(503, "Không thể tải danh sách mã ưu đãi từ SQL Server.")


@router.post("/api/v1/vouchers/validate")
def validate_voucher_sqlserver(body: VoucherValidateBody, request: Request):
    code = (body.code or body.voucher_code or body.voucherCode or "").strip()
    tid = body.tour_id or body.tourId
    sid = body.schedule_id or body.scheduleId
    user = _optional_authenticated(request)
    try:
        with _engine().connect() as conn:
            if not _has_voucher_schema(conn):
                _fail(503, "CSDL SQL Server chưa kích hoạt bảng AUDITLOG.")
            tour_row = None
            if sid and str(sid).isdigit():
                tour_row = conn.execute(text("""
                    SELECT t.MaTour, t.TenTour, dm.TenDanhMuc, c.GiaThucTe AS GiaApDung
                    FROM dbo.CHUYENKHOIHANH c
                    JOIN dbo.TOUR t ON t.MaTour=c.MaTour
                    JOIN dbo.DANHMUC dm ON dm.MaDanhMuc=t.MaDanhMuc
                    WHERE c.MaChuyen=:sid AND t.TrangThai=1
                """), {"sid": int(sid)}).mappings().first()
            if not tour_row and tid and str(tid).isdigit():
                tour_row = conn.execute(text("""
                    SELECT t.MaTour, t.TenTour, dm.TenDanhMuc,
                           COALESCE(MIN(c.GiaThucTe), t.GiaKhuyenNghi) AS GiaApDung
                    FROM dbo.TOUR t
                    JOIN dbo.DANHMUC dm ON dm.MaDanhMuc=t.MaDanhMuc
                    LEFT JOIN dbo.CHUYENKHOIHANH c ON c.MaTour=t.MaTour AND c.TrangThaiChuyen=N'Mở bán'
                    WHERE t.MaTour=:tid AND t.TrangThai=1
                    GROUP BY t.MaTour, t.TenTour, dm.TenDanhMuc, t.GiaKhuyenNghi
                """), {"tid": int(tid)}).mappings().first()
            if not tour_row:
                return Response(
                    content=json.dumps({"valid": False, "errorCode": "TOUR_NOT_FOUND", "detail": "Không tìm thấy tour để kiểm tra mã ưu đãi."}, ensure_ascii=False),
                    status_code=404,
                    media_type="application/json",
                )
            subtotal = int(Decimal(str(tour_row["GiaApDung"]))) * body.adults
            res = _validate_voucher_in_conn(
                conn,
                code=code,
                tour_id=int(tour_row["MaTour"]),
                category_name=tour_row["TenDanhMuc"],
                tour_title=tour_row["TenTour"],
                subtotal=subtotal,
                user=user,
                customer_email=body.customer_email or body.customerEmail or "",
                customer_phone=body.customer_phone or body.customerPhone or "",
            )
            if not res["ok"]:
                return Response(
                    content=json.dumps({
                        "valid": False,
                        "errorCode": res["errorCode"],
                        "detail": res["detail"],
                        "subtotalPrice": subtotal,
                        "discountAmount": 0,
                        "totalPrice": subtotal,
                    }, ensure_ascii=False),
                    status_code=res["status"],
                    media_type="application/json",
                )
            return {
                "valid": True,
                "voucher": res["voucher"],
                "subtotalPrice": res["subtotalPrice"],
                "discountAmount": res["discountAmount"],
                "totalPrice": res["finalTotal"],
                "message": f'Áp dụng thành công mã {res["voucher"]["code"]}: Giảm {res["discountAmount"]:,} đ',
            }
    except SQLAlchemyError:
        _fail(503, "Không thể kiểm tra mã ưu đãi trên SQL Server.")


class AdminVoucherBody(BaseModel):
    model_config = ConfigDict(extra="allow")
    code: str | None = None
    name: str | None = None
    description: str | None = None
    discountType: str | None = None
    discountValue: float | None = None
    maxDiscount: float | None = None
    minOrderValue: float | None = None
    scopeType: str | None = None
    scopeRegions: list[str] | None = None
    scopeTourIds: list[str] | None = None
    startAt: str | None = None
    endAt: str | None = None
    usageLimit: int | None = None
    perUserLimit: int | None = None
    targetAudience: str | None = None
    active: bool | None = None


def _build_ss_admin_stats(conn, voucher_code: str) -> dict:
    uses = _list_voucher_uses(conn, voucher_code)
    ma_dats = [int(u["maDatTour"]) for u in uses if u.get("maDatTour") is not None]
    booking_map = {}
    if ma_dats:
        rows = conn.execute(text(
            f"SELECT MaDatTour, TrangThaiDat, TongTien FROM dbo.DATTOUR WHERE MaDatTour IN ({','.join(str(x) for x in set(ma_dats))})"
        )).mappings().all()
        booking_map = {int(r["MaDatTour"]): r for r in rows}

    active_cnt = 0
    paid_cnt = 0
    discount_sum = 0
    revenue_sum = 0
    recent = []
    for u in uses:
        b = booking_map.get(int(u["maDatTour"])) if u.get("maDatTour") is not None else None
        b_status = b["TrangThaiDat"] if b else u["status"]
        b_total = int(Decimal(str(b["TongTien"]))) if b else u["bookingTotal"]
        if u["status"] == "ACTIVE" and b_status != "Đã hủy":
            active_cnt += 1
            discount_sum += u["discountAmount"]
            revenue_sum += b_total
            if b_status in ("Đã xác nhận", "Đã hoàn thành"):
                paid_cnt += 1
        if len(recent) < 10:
            recent.append({
                "bookingId": u["bookingExternalId"] or (str(u["maDatTour"]) if u["maDatTour"] is not None else str(u["maLog"])),
                "bookingRef": f'SQL-{u["maDatTour"]}' if u["maDatTour"] is not None else u["bookingExternalId"],
                "customerEmail": u["email"],
                "bookingStatus": b_status,
                "discountAmount": u["discountAmount"],
                "bookingTotal": b_total,
                "status": u["status"],
                "createdAt": u["createdAt"],
            })
    return {
        "activeRedemptions": active_cnt,
        "completedRedemptions": paid_cnt,
        "totalDiscountGranted": discount_sum,
        "totalRevenue": revenue_sum,
        "recentRedemptions": recent,
    }


@router.get("/api/v1/admin/vouchers")
def admin_list_vouchers(admin: Annotated[dict, Depends(_require_admin)]):
    try:
        with _engine().connect() as conn:
            if not _has_voucher_schema(conn):
                return []
            rows = conn.execute(text("""
                SELECT MaLog, DuLieuCu, DuLieuMoi, ThoiGian
                FROM dbo.AUDITLOG
                WHERE HanhDong=N'VOUCHER_DEF'
                ORDER BY MaLog DESC
            """)).mappings().all()
            result = []
            for r in rows:
                v = _parse_voucher_log(r)
                if v:
                    result.append(_voucher_dto(v, _build_ss_admin_stats(conn, v["code"])))
            return result
    except SQLAlchemyError:
        _fail(503, "Không thể tải danh sách mã ưu đãi quản trị.")


@router.post("/api/v1/admin/vouchers", status_code=201)
def admin_create_voucher(body: AdminVoucherBody, admin: Annotated[dict, Depends(_require_admin)]):
    code = re.sub(r"\s+", "", str(body.code or "")).upper()
    name = str(body.name or "").strip()
    if not code or not re.fullmatch(r"[A-Z0-9_-]{3,32}", code):
        _fail(422, "Mã ưu đãi phải gồm 3-32 ký tự chữ/số (A-Z, 0-9, -, _).")
    if not name:
        _fail(422, "Tên chương trình khuyến mãi không được để trống.")
    dtype = str(body.discountType or "percent").lower()
    if dtype not in ("percent", "fixed"):
        _fail(422, "Loại giảm giá phải là percent hoặc fixed.")
    dval = float(body.discountValue or 0)
    if dval <= 0 or (dtype == "percent" and dval > 100):
        _fail(422, "Giá trị giảm không hợp lệ.")
    scope = str(body.scopeType or "all").lower()
    if scope not in ("all", "region", "tours"):
        _fail(422, "Phạm vi áp dụng phải là all, region hoặc tours.")
    regions = [str(x).strip().lower() for x in (body.scopeRegions or []) if str(x).strip()]
    tours = [str(x).strip() for x in (body.scopeTourIds or []) if str(x).strip()]
    if scope == "region" and not regions:
        _fail(422, "Vui lòng chọn ít nhất 1 khu vực áp dụng.")
    if scope == "tours" and not tours:
        _fail(422, "Vui lòng chọn ít nhất 1 tour áp dụng.")
    audience = str(body.targetAudience or "all").lower()
    if audience not in ("all", "new_customer", "logged_in"):
        _fail(422, "Đối tượng áp dụng không hợp lệ.")
    start_dt = _to_naive_utc(body.startAt, is_end=False) if body.startAt else (datetime.now(timezone.utc) - timedelta(seconds=5)).replace(tzinfo=None)
    end_dt = _to_naive_utc(body.endAt, is_end=True) if body.endAt else (start_dt + timedelta(days=30))
    if end_dt < start_dt:
        _fail(422, "Thời gian kết thúc phải sau hoặc bằng thời gian bắt đầu.")

    now_iso = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    payload = {
        "code": code,
        "name": name,
        "description": str(body.description or "").strip(),
        "discountType": dtype,
        "discountValue": dval,
        "maxDiscount": body.maxDiscount if (dtype == "percent" and body.maxDiscount and body.maxDiscount > 0) else None,
        "minOrderValue": max(0.0, float(body.minOrderValue or 0)),
        "scopeType": scope,
        "scopeRegions": regions,
        "scopeTourIds": tours,
        "startAt": start_dt.isoformat() + "Z",
        "endAt": end_dt.isoformat() + "Z",
        "usageLimit": max(0, int(body.usageLimit if body.usageLimit is not None else 100)),
        "usedCount": 0,
        "perUserLimit": max(0, int(body.perUserLimit if body.perUserLimit is not None else 1)),
        "targetAudience": audience,
        "active": bool(body.active is None or body.active),
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    try:
        with _engine().begin() as conn:
            dup = conn.execute(text(
                "SELECT MaLog FROM dbo.AUDITLOG WHERE HanhDong=N'VOUCHER_DEF' AND UPPER(DuLieuCu)=:c"
            ), {"c": code}).scalar()
            if dup:
                _fail(409, f'Mã ưu đãi "{code}" đã tồn tại.')
            inserted = conn.execute(text("""
                INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
                OUTPUT INSERTED.*
                VALUES (:uid, N'VOUCHER_DEF', :code, :payload, GETDATE())
            """), {
                "uid": int(admin["MaNguoiDung"]),
                "code": code,
                "payload": json.dumps(payload, ensure_ascii=False),
            }).mappings().one()
            v = _parse_voucher_log(inserted)
            return _voucher_dto(v, _build_ss_admin_stats(conn, v["code"]))
    except HTTPException:
        raise
    except SQLAlchemyError:
        _fail(503, "Không thể tạo mã ưu đãi trên SQL Server.")


@router.patch("/api/v1/admin/vouchers/{voucher_id}")
def admin_update_voucher(voucher_id: str, body: AdminVoucherBody, admin: Annotated[dict, Depends(_require_admin)]):
    numeric_id = int(voucher_id) if voucher_id.isdigit() else -1
    try:
        with _engine().begin() as conn:
            row = conn.execute(text("""
                SELECT TOP 1 * FROM dbo.AUDITLOG
                WHERE HanhDong=N'VOUCHER_DEF' AND (MaLog=:vid OR UPPER(DuLieuCu)=:code)
                ORDER BY MaLog DESC
            """), {"vid": numeric_id, "code": voucher_id.strip().upper()}).mappings().first()
            v = _parse_voucher_log(row)
            if not v:
                _fail(404, "Không tìm thấy mã ưu đãi.")

            code = re.sub(r"\s+", "", str(body.code or v["code"])).upper()
            name = str(body.name if body.name is not None else v["name"]).strip()
            dtype = str(body.discountType or v["discountType"]).lower()
            dval = float(body.discountValue if body.discountValue is not None else v["discountValue"])
            if dval <= 0 or (dtype == "percent" and dval > 100):
                _fail(422, "Giá trị giảm không hợp lệ.")
            scope = str(body.scopeType or v["scopeType"]).lower()
            regions = [str(x).strip().lower() for x in (body.scopeRegions if body.scopeRegions is not None else v["scopeRegions"])]
            tours = [str(x).strip() for x in (body.scopeTourIds if body.scopeTourIds is not None else v["scopeTourIds"])]
            if scope == "region" and not regions:
                _fail(422, "Vui lòng chọn ít nhất 1 khu vực áp dụng.")
            if scope == "tours" and not tours:
                _fail(422, "Vui lòng chọn ít nhất 1 tour áp dụng.")
            start_dt = _to_naive_utc(body.startAt, is_end=False) if body.startAt else _to_naive_utc(v["startAt"], is_end=False)
            end_dt = _to_naive_utc(body.endAt, is_end=True) if body.endAt else _to_naive_utc(v["endAt"], is_end=True)
            if end_dt < start_dt:
                _fail(422, "Thời gian kết thúc phải sau hoặc bằng thời gian bắt đầu.")
            usage_lim = max(0, int(body.usageLimit if body.usageLimit is not None else v["usageLimit"]))
            if usage_lim > 0 and usage_lim < int(v["usedCount"]):
                _fail(422, f'Tổng lượt sử dụng không được nhỏ hơn số lượt đã dùng ({v["usedCount"]}).')

            updated_payload = {
                "code": code,
                "name": name,
                "description": str(body.description if body.description is not None else v["description"]).strip(),
                "discountType": dtype,
                "discountValue": dval,
                "maxDiscount": (body.maxDiscount if "maxDiscount" in body.model_fields_set else v["maxDiscount"]) if dtype == "percent" else None,
                "minOrderValue": max(0.0, float(body.minOrderValue if body.minOrderValue is not None else v["minOrderValue"])),
                "scopeType": scope,
                "scopeRegions": regions,
                "scopeTourIds": tours,
                "startAt": start_dt.isoformat() + "Z",
                "endAt": end_dt.isoformat() + "Z",
                "usageLimit": usage_lim,
                "usedCount": int(v["usedCount"]),
                "perUserLimit": max(0, int(body.perUserLimit if body.perUserLimit is not None else v["perUserLimit"])),
                "targetAudience": str(body.targetAudience or v["targetAudience"]).lower(),
                "active": bool(body.active if body.active is not None else v["active"]),
                "createdAt": v["createdAt"],
                "updatedAt": datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z",
            }
            updated = conn.execute(text("""
                UPDATE dbo.AUDITLOG
                SET DuLieuCu=:code, DuLieuMoi=:payload
                OUTPUT INSERTED.*
                WHERE MaLog=:vid AND HanhDong=N'VOUCHER_DEF'
            """), {
                "vid": v["maLog"],
                "code": code,
                "payload": json.dumps(updated_payload, ensure_ascii=False),
            }).mappings().one()
            uv = _parse_voucher_log(updated)
            return _voucher_dto(uv, _build_ss_admin_stats(conn, uv["code"]))
    except HTTPException:
        raise
    except SQLAlchemyError:
        _fail(503, "Không thể cập nhật mã ưu đãi trên SQL Server.")


@router.delete("/api/v1/admin/vouchers/{voucher_id}")
def admin_delete_voucher(voucher_id: str, admin: Annotated[dict, Depends(_require_admin)]):
    numeric_id = int(voucher_id) if voucher_id.isdigit() else -1
    try:
        with _engine().begin() as conn:
            deleted = conn.execute(text("""
                DELETE FROM dbo.AUDITLOG
                OUTPUT DELETED.MaLog, DELETED.DuLieuCu
                WHERE HanhDong=N'VOUCHER_DEF' AND (MaLog=:vid OR UPPER(DuLieuCu)=:code)
            """), {"vid": numeric_id, "code": voucher_id.strip().upper()}).mappings().first()
            if not deleted:
                _fail(404, "Không tìm thấy mã ưu đãi.")
            return {"status": "ok", "id": str(deleted["MaLog"]), "code": deleted["DuLieuCu"]}
    except HTTPException:
        raise
    except SQLAlchemyError:
        _fail(503, "Không thể xóa mã ưu đãi trên SQL Server.")


@router.post("/api/v1/admin/bookings/{booking_id}/confirm-payment")
def blocked_payment(booking_id: int):
    _fail(503, "Thanh toán cần đối soát ngân hàng và vai trò ADMIN đã được kiểm chứng; chưa hỗ trợ.")
