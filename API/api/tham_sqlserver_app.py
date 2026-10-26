"""Read-only FastAPI compatibility gateway for Tham's SQL Server 12-table schema.

Not a replacement for the existing FastAPI booking/auth backend.
No database creation or write operations are executed.
"""
from __future__ import annotations

import os
from datetime import datetime
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

app = FastAPI(title="Delta Travel | Thắm SQL Server Catalog (read-only)", version="0.1.0")
REQUIRED_TABLES = frozenset({
    "NGUOIDUNG", "DANHMUC", "TOUR", "CHUYENKHOIHANH", "DATTOUR",
    "HINHANH_TOUR", "LICH_TRINH_DETAIL", "CHITIET_HANHKHACH",
    "THANHTOAN", "DANHGIA", "BAIVIET_QUANGBA", "AUDITLOG"
})


@lru_cache(maxsize=1)
def _engine():
    url = os.environ.get("THAM_SQLSERVER_URL", "")
    if not url.startswith("mssql+pyodbc://"):
        raise RuntimeError("THAM_SQLSERVER_URL must use mssql+pyodbc; other SQL dialects are incompatible")
    if os.environ.get("DELTA_ENV") == "production" and any(
        flag in url.lower()
        for flag in ("trustservercertificate=yes", "trustservercertificate=true",
                     "encrypt=no", "encrypt=false", "encrypt=optional")
    ):
        raise RuntimeError("SQL Server TLS certificate verification must be enabled in production")
    return create_engine(url, pool_pre_ping=True, pool_recycle=1800, connect_args={"timeout": 10})


class SqlServerReader:
    """Executes only fixed SELECT statements with bound parameters."""
    def rows(self, sql: str, parameters: dict | None = None) -> list[dict]:
        try:
            with _engine().connect() as conn:
                return [dict(row) for row in conn.execute(text(sql), parameters or {}).mappings().all()]
        except (RuntimeError, SQLAlchemyError):
            raise HTTPException(503, "SQL Server chưa sẵn sàng; xem cấu hình máy chủ.") from None


def get_reader() -> SqlServerReader:
    return SqlServerReader()


def _integer_vnd(amount) -> int:
    try:
        value = Decimal(str(amount))
    except (InvalidOperation, ValueError):
        raise HTTPException(503, "Giá tiền trong database không hợp lệ.") from None
    if not value.is_finite() or value < 0 or value != value.to_integral_value():
        raise HTTPException(503, "Giá tiền trong database không phải số VND nguyên hợp lệ.")
    return int(value)


def _positive_id(raw: str) -> int:
    if len(raw) > 18 or not raw.isascii() or not raw.isdecimal() or int(raw) < 1:
        raise HTTPException(404, "Không tìm thấy bản ghi.")
    return int(raw)


def _iso_without_assumed_timezone(value):
    # Thắm's SQL Server script uses DATETIME / GETDATE(), not UTC-aware stamps.
    return value.isoformat(timespec="seconds") if isinstance(value, datetime) else str(value)


def _tour(row):
    price = _integer_vnd(row["GiaKhuyenNghi"])
    ident = str(row["MaTour"])
    return {"id": ident, "slug": "tour-" + ident, "title": row["TenTour"],
            "region": row["TenDanhMuc"], "category": row["TenDanhMuc"],
            "duration": None, "departure": None, "transport": None,
            "image": row["HinhAnhDaiDien"], "description": row["MoTaChiTiet"] or "",
            "itinerarySummary": row["LichTrinhTongQuan"],
            "price": price, "originalPrice": price,
            "isFlashSale": False, "updatedAt": None}


@app.get("/api/v1/health/ready")
def health(reader: Annotated[SqlServerReader, Depends(get_reader)]):
    rows = reader.rows(
        "SELECT TABLE_NAME AS table_name FROM INFORMATION_SCHEMA.TABLES "
        "WHERE TABLE_SCHEMA='dbo' AND TABLE_TYPE='BASE TABLE'"
    )
    actual = {str(row["table_name"]).upper() for row in rows}
    missing = sorted(REQUIRED_TABLES - actual)
    if missing:
        raise HTTPException(503, {"status": "schema_incomplete", "missingTables": missing})
    return {"status": "ok", "database": "Tham SQL Server", "mode": "read_only", "tablesChecked": len(REQUIRED_TABLES)}


@app.get("/api/v1/categories")
def categories(reader: Annotated[SqlServerReader, Depends(get_reader)]):
    return reader.rows(
        "SELECT MaDanhMuc AS id, TenDanhMuc AS name, MoTa AS description "
        "FROM dbo.DANHMUC ORDER BY MaDanhMuc"
    )


@app.get("/api/v1/tours")
def tours(reader: Annotated[SqlServerReader, Depends(get_reader)],
          q: str = Query(default="", max_length=100),
          category: str = Query(default="", max_length=100),
          max_price: int | None = Query(default=None, ge=0),
          region: str = Query(default="", max_length=100),
          flash: bool = False):
    if region or flash:
        raise HTTPException(422, "Schema chưa có region/flashSale chuẩn hóa; cần duyệt mapping.")
    pattern = "%" + q.replace("[", "[[]").replace("%", "[%]").replace("_", "[_]") + "%" if q else None
    rows = reader.rows("""SELECT TOP (100) t.MaTour, t.TenTour, d.TenDanhMuc,
                              t.HinhAnhDaiDien, t.MoTaChiTiet, t.LichTrinhTongQuan, t.GiaKhuyenNghi
                       FROM dbo.TOUR AS t JOIN dbo.DANHMUC AS d ON t.MaDanhMuc=d.MaDanhMuc
                       WHERE t.TrangThai=1
                         AND (:pattern IS NULL OR t.TenTour LIKE :pattern OR d.TenDanhMuc LIKE :pattern)
                         AND (:category IS NULL OR d.TenDanhMuc=:category)
                         AND (:max_price IS NULL OR t.GiaKhuyenNghi<=:max_price)
                       ORDER BY t.MaTour""",
                       {"pattern": pattern, "category": category or None, "max_price": max_price})
    return [_tour(row) for row in rows]


@app.get("/api/v1/tours/{tour_id}")
def tour_detail(tour_id: str, reader: Annotated[SqlServerReader, Depends(get_reader)]):
    ident = _positive_id(tour_id)
    rows = reader.rows("""SELECT t.MaTour, t.TenTour, d.TenDanhMuc, t.HinhAnhDaiDien,
                                t.MoTaChiTiet, t.LichTrinhTongQuan, t.GiaKhuyenNghi
                         FROM dbo.TOUR t JOIN dbo.DANHMUC d ON d.MaDanhMuc=t.MaDanhMuc
                         WHERE t.TrangThai=1 AND t.MaTour=:tour_id""", {"tour_id": ident})
    if not rows:
        raise HTTPException(404, "Không tìm thấy tour.")
    return _tour(rows[0])


def _schedules(reader: SqlServerReader, tour_id: int | None = None, schedule_id: int | None = None):
    conditions = ["c.NgayKhoiHanh > GETDATE()", "t.TrangThai = 1"]
    params = {}
    if tour_id is not None:
        conditions.append("c.MaTour=:tour_id")
        params["tour_id"] = tour_id
    if schedule_id is not None:
        conditions.append("c.MaChuyen=:schedule_id")
        params["schedule_id"] = schedule_id
    return reader.rows("""SELECT c.MaChuyen, c.MaTour, c.NgayKhoiHanh, c.NgayKetThuc,
                                c.GiaThucTe, c.SoChoToiDa, c.SoChoDaDat, c.TrangThaiChuyen
                         FROM dbo.CHUYENKHOIHANH c JOIN dbo.TOUR t ON t.MaTour=c.MaTour
                         WHERE """ + " AND ".join(conditions) + " ORDER BY c.NgayKhoiHanh, c.MaChuyen", params)


def _schedule(row):
    total = int(row["SoChoToiDa"])
    occupied = int(row["SoChoDaDat"])
    if total < 1 or occupied < 0 or occupied > total:
        raise HTTPException(503, "Dữ liệu sức chứa không hợp lệ.")
    return {"id": str(row["MaChuyen"]), "tourId": str(row["MaTour"]),
            "departureAt": _iso_without_assumed_timezone(row["NgayKhoiHanh"]),
            "returnAt": _iso_without_assumed_timezone(row["NgayKetThuc"]),
            "departureTimeZone": "unspecified", "totalSeats": total,
            "availableSeats": total - occupied,
            "unitPrice": _integer_vnd(row["GiaThucTe"]),
            "active": row["TrangThaiChuyen"] == "Mở bán" and occupied < total}


@app.get("/api/v1/tours/{tour_id}/schedules")
def schedules(tour_id: str, reader: Annotated[SqlServerReader, Depends(get_reader)]):
    ident = _positive_id(tour_id)
    _ensure_visible_tour(reader, ident)
    return [_schedule(row) for row in _schedules(reader, tour_id=ident)]


def _ensure_visible_tour(reader: SqlServerReader, tour_id: int):
    rows = reader.rows(
        "SELECT MaTour FROM dbo.TOUR WHERE MaTour=:tour_id AND TrangThai=1",
        {"tour_id": tour_id},
    )
    if not rows:
        raise HTTPException(404, "Không tìm thấy tour.")


@app.get("/api/v1/tours/{tour_id}/gallery")
def tour_gallery(tour_id: str, reader: Annotated[SqlServerReader, Depends(get_reader)]):
    ident = _positive_id(tour_id)
    _ensure_visible_tour(reader, ident)
    rows = reader.rows("""SELECT img.MaHinhAnh, img.MaTour, img.DuongDanAnh, img.GhiChu
                         FROM dbo.HINHANH_TOUR AS img
                         WHERE img.MaTour=:tour_id
                         ORDER BY img.MaHinhAnh""", {"tour_id": ident})
    return [{"id": str(r["MaHinhAnh"]), "tourId": str(r["MaTour"]),
             "url": r["DuongDanAnh"], "caption": r["GhiChu"]}
            for r in rows]


@app.get("/api/v1/tours/{tour_id}/itinerary")
def tour_itinerary(tour_id: str, reader: Annotated[SqlServerReader, Depends(get_reader)]):
    ident = _positive_id(tour_id)
    _ensure_visible_tour(reader, ident)
    rows = reader.rows("""SELECT MaLichTrinh, MaTour, NgayThu, TieuDeNgay,
                                NoiDungChiTiet, BuaAn
                         FROM dbo.LICH_TRINH_DETAIL WHERE MaTour=:tour_id
                         ORDER BY NgayThu, MaLichTrinh""", {"tour_id": ident})
    return [{"id": str(r["MaLichTrinh"]), "tourId": str(r["MaTour"]),
             "day": int(r["NgayThu"]), "title": r["TieuDeNgay"],
             "description": r["NoiDungChiTiet"], "meals": r["BuaAn"]}
            for r in rows]


@app.get("/api/v1/articles")
def articles(reader: Annotated[SqlServerReader, Depends(get_reader)]):
    rows = reader.rows("""SELECT TOP (100) MaBaiViet, TieuDe, Slug, TomTat,
                                  HinhAnhDaiDien, NgayTao
                         FROM dbo.BAIVIET_QUANGBA WHERE TrangThai=1
                         ORDER BY NgayTao DESC, MaBaiViet DESC""")
    return [{"id": str(r["MaBaiViet"]), "title": r["TieuDe"],
             "slug": r["Slug"], "summary": r["TomTat"],
             "image": r["HinhAnhDaiDien"],
             "createdAt": _iso_without_assumed_timezone(r["NgayTao"])} for r in rows]


@app.get("/api/v1/articles/{article_id}")
def article_detail(article_id: str, reader: Annotated[SqlServerReader, Depends(get_reader)]):
    ident = _positive_id(article_id)
    rows = reader.rows("""SELECT MaBaiViet, TieuDe, Slug, TomTat, NoiDung,
                                HinhAnhDaiDien, NgayTao
                         FROM dbo.BAIVIET_QUANGBA
                         WHERE TrangThai=1 AND MaBaiViet=:article_id""",
                       {"article_id": ident})
    if not rows:
        raise HTTPException(404, "Không tìm thấy bài viết.")
    r = rows[0]
    return {"id": str(r["MaBaiViet"]), "title": r["TieuDe"], "slug": r["Slug"],
            "summary": r["TomTat"], "contentHtmlUntrusted": r["NoiDung"],
            "image": r["HinhAnhDaiDien"],
            "createdAt": _iso_without_assumed_timezone(r["NgayTao"])}


class QuoteInput(BaseModel):
    schedule_id: str
    adults: int = Field(ge=1, le=20)
    children: int = Field(default=0, ge=0)
    infants: int = Field(default=0, ge=0)

    @field_validator("schedule_id")
    @classmethod
    def positive_id(cls, v):
        if len(v) > 18 or not v.isascii() or not v.isdecimal() or int(v) < 1:
            raise ValueError("schedule_id phải là số nguyên dương")
        return v


@app.post("/api/v1/bookings/quote")
def booking_quote(body: QuoteInput, reader: Annotated[SqlServerReader, Depends(get_reader)]):
    if body.children or body.infants:
        raise HTTPException(409, "Chính sách giá trẻ em và em bé chưa được duyệt.")
    rows = _schedules(reader, schedule_id=int(body.schedule_id))
    if not rows:
        raise HTTPException(404, "Không tìm thấy lịch khởi hành.")
    schedule = _schedule(rows[0])
    if not schedule["active"] or schedule["availableSeats"] < body.adults:
        raise HTTPException(409, "Chuyến đi không mở bán hoặc không đủ chỗ.")
    return {"scheduleId": schedule["id"], "tourId": schedule["tourId"],
            "seats": body.adults, "availableSeats": schedule["availableSeats"],
            "unitPrice": schedule["unitPrice"], "totalPrice": schedule["unitPrice"] * body.adults,
            "currency": "VND", "pricingRules": {"childPercent": None, "infantPercent": None},
            "addonsSupported": False, "vouchersSupported": False, "quoteOnly": True}


@app.post("/api/v1/bookings")
@app.post("/api/v1/admin/bookings/{booking_id}/confirm-payment")
def blocked_writes():
    raise HTTPException(503, "Chức năng ghi đơn/thanh toán chưa được duyệt và tích hợp an toàn.")
