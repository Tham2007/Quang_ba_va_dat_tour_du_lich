"""Authenticated SQL Server booking controller for the 12-table Delta Travel schema.

Enabled only with THAM_BOOKING_WRITES_ENABLED=1 and a reviewed non-destructive
migration. Not a payment processor. Does not trust any browser-supplied user ID,
price, booking status, or seat count; existing SQL Server SPs/triggers own stock.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError, SQLAlchemyError

router = APIRouter()
_SESSION = "delta_sql_session"
_CSRF = "delta_sql_csrf"
_SECURE = os.getenv("DELTA_ENV") in ("staging", "production")


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
        if not re.fullmatch(r"[^\\s@]+@[^\\s@]+\\.[^\\s@]+", value):
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


def _fingerprint(body: BookingBody) -> str:
    payload = json.dumps(body.model_dump(), sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return _hash(payload)


def _booking_record(row) -> dict:
    amount = Decimal(str(row["TongTien"]))
    if amount != amount.to_integral_value():
        _fail(503, "Số tiền VND trong database không hợp lệ.")
    seats = int(row["SoLuongKhach"])
    paid = row["TrangThaiThanhToan"] != "Chưa thanh toán"
    states = {"Chờ xác nhận": "PENDING_PAYMENT", "Đã xác nhận": "CONFIRMED",
              "Đã hoàn thành": "COMPLETED", "Đã hủy": "CANCELLED"}
    return {
        "id": str(row["MaDatTour"]),
        "reference": "SQL-" + str(row["MaDatTour"]),
        "scheduleId": str(row["MaChuyen"]),
        "seats": seats,
        "totalPrice": int(amount),
        "unitPrice": int(amount / seats),
        "status": states.get(row["TrangThaiDat"], "UNKNOWN"),
        "paid": paid,
        "createdAt": row["NgayDat"].isoformat(timespec="seconds"),
        "storage": "sqlserver",
    }


_BOOKING_SELECT = """
    SELECT d.MaDatTour, d.MaKhachHang, d.MaChuyen, d.NgayDat, d.SoLuongKhach,
           d.TongTien, d.TrangThaiDat, d.TrangThaiThanhToan,
           c.NgayKhoiHanh,
           CASE WHEN c.NgayKhoiHanh > DATEADD(hour,72,GETDATE()) THEN 1 ELSE 0 END AS ConHon72h
    FROM dbo.DATTOUR d
    JOIN dbo.CHUYENKHOIHANH c ON d.MaChuyen = c.MaChuyen
"""


@router.post("/api/v1/auth/register", status_code=201)
def register(body: Register, request: Request, response: Response):
    # Registration is for synthetic staging accounts only.
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
    try:
        with _engine().begin() as conn:
            conn.execute(text("""
                INSERT INTO dbo.API_YEUCAU_DATTOUR (MaNguoiDung, KhoaYeuCau, DauVanTay)
                VALUES (:uid, CONVERT(uniqueidentifier,:key), :fingerprint)
            """), {"uid": user_id, "key": key, "fingerprint": fingerprint})
            schedule = conn.execute(text("""
                SELECT c.MaChuyen, c.SoChoToiDa, c.SoChoDaDat, c.TrangThaiChuyen
                FROM dbo.CHUYENKHOIHANH c WITH (UPDLOCK, HOLDLOCK)
                JOIN dbo.TOUR t ON c.MaTour=t.MaTour
                WHERE c.MaChuyen=:sid AND t.TrangThai=1
                  AND c.NgayKhoiHanh > DATEADD(hour,72,GETDATE())
            """), {"sid": ident}).mappings().first()
            if not schedule or schedule["TrangThaiChuyen"] != "Mở bán":
                _fail(409, "Chuyến khởi hành chưa mở bán hoặc không hợp lệ.")
            if schedule["SoChoToiDa"]-schedule["SoChoDaDat"] < body.adults:
                _fail(409, "Tour không còn đủ chỗ.")
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
            row = conn.execute(text(_BOOKING_SELECT + " WHERE d.MaDatTour=:booking AND d.MaKhachHang=:uid"),
                               {"booking": booking_id, "uid": user_id}).mappings().one()
            return _booking_record(row)
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
                row = conn.execute(text(_BOOKING_SELECT + " WHERE d.MaDatTour=:booking AND d.MaKhachHang=:uid"),
                                   {"booking": prior["MaDatTour"], "uid": user_id}).mappings().one()
                return _booking_record(row)
        except SQLAlchemyError:
            _fail(503, "Không thể kiểm tra yêu cầu đã gửi.")
    except SQLAlchemyError:
        _fail(503, "SQL Server không thể tạo đơn; không tự động thử lại bằng khóa mới.")


@router.get("/api/v1/bookings")
def my_bookings(user: Annotated[dict, Depends(_authenticated)]):
    try:
        with _engine().connect() as conn:
            rows = conn.execute(text(_BOOKING_SELECT + """
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
            row = conn.execute(text(_BOOKING_SELECT + " WHERE d.MaDatTour=:booking AND d.MaKhachHang=:uid"),
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
            row = conn.execute(text(_BOOKING_SELECT.replace("FROM dbo.DATTOUR d", "FROM dbo.DATTOUR d WITH (UPDLOCK, HOLDLOCK)") + """
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
            updated = conn.execute(text(_BOOKING_SELECT + " WHERE d.MaDatTour=:booking AND d.MaKhachHang=:uid"),
                                   {"booking": booking_id, "uid": uid}).mappings().one()
            return _booking_record(updated)
    except SQLAlchemyError:
        _fail(503, "SQL Server chưa hoàn tất thao tác hủy; hãy kiểm tra lại đơn.")


@router.post("/api/v1/admin/bookings/{booking_id}/confirm-payment")
def blocked_payment(booking_id: int):
    _fail(503, "Thanh toán cần đối soát ngân hàng và vai trò ADMIN đã được kiểm chứng; chưa hỗ trợ.")
