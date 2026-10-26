"""Read-only SQL Server verification. Run from API/: python -m scripts.check_tham_sqlserver.
Never print credentials or driver exception messages.
"""
from __future__ import annotations

import json
import sys
from typing import Mapping

from sqlalchemy import text
from api.tham_sqlserver_app import _engine, _integer_vnd, REQUIRED_TABLES

REQUIRED_COLUMNS: Mapping[str, frozenset[str]] = {
    "NGUOIDUNG": frozenset(["MaNguoiDung", "HoTen", "Email", "SoDienThoai", "MatKhau", "TrangThai"]),
    "DANHMUC": frozenset(["MaDanhMuc", "TenDanhMuc"]),
    "TOUR": frozenset(["MaTour", "MaDanhMuc", "TenTour", "GiaKhuyenNghi", "HinhAnhDaiDien", "TrangThai"]),
    "HINHANH_TOUR": frozenset(["MaHinhAnh", "MaTour", "DuongDanAnh"]),
    "LICH_TRINH_DETAIL": frozenset(["MaLichTrinh", "MaTour", "NgayThu", "TieuDeNgay", "NoiDungChiTiet"]),
    "CHUYENKHOIHANH": frozenset(["MaChuyen", "MaTour", "NgayKhoiHanh", "NgayKetThuc", "GiaThucTe", "SoChoToiDa", "SoChoDaDat", "TrangThaiChuyen"]),
    "DATTOUR": frozenset(["MaDatTour", "MaKhachHang", "MaChuyen", "SoLuongKhach", "TongTien", "TrangThaiDat", "TrangThaiThanhToan"]),
    "CHITIET_HANHKHACH": frozenset(["MaHanhKhach", "MaDatTour", "HoTen"]),
    "THANHTOAN": frozenset(["MaThanhToan", "MaDatTour", "PhuongThuc", "SoTien", "MaGiaoDich"]),
    "DANHGIA": frozenset(["MaDanhGia", "MaDatTour", "SoSao", "TrangThaiHienThi"]),
    "BAIVIET_QUANGBA": frozenset(["MaBaiViet", "TieuDe", "NoiDung", "TrangThai"]),
    "AUDITLOG": frozenset(["MaLog", "HanhDong", "ThoiGian"]),
}


def inspect_columns(rows: list[dict]) -> dict:
    """Pure metadata test; can be unit-tested without a database."""
    names: dict[str, set[str]] = {}
    for row in rows:
        table, column = str(row["TABLE_NAME"]).upper(), str(row["COLUMN_NAME"]).upper()
        names.setdefault(table, set()).add(column)
    missing_tables = sorted(REQUIRED_TABLES - names.keys())
    missing_columns = {
        table: sorted(col for col in columns if col.upper() not in names.get(table, set()))
        for table, columns in REQUIRED_COLUMNS.items()
    }
    missing_columns = {key: value for key, value in missing_columns.items() if value and key not in missing_tables}
    return {
        "tables_found": len(REQUIRED_TABLES - set(missing_tables)),
        "tables_required": len(REQUIRED_TABLES),
        "missing_tables": missing_tables,
        "missing_columns": missing_columns,
        "schema_ok": not missing_tables and not missing_columns,
        "role_persistence_in_12_table_design": "VAITRO" in names.get("NGUOIDUNG", set()),
        "booking_idempotency_column_present": "IDEMPOTENCY_KEY" in names.get("DATTOUR", set()),
        "hold_expiry_column_present": "EXPIRES_AT" in names.get("DATTOUR", set()),
    }


def check_live(engine) -> dict:
    """Execute read-only queries only; no DDL, inserts, migrations or seed."""
    with engine.connect() as conn:
        columns = [dict(row) for row in conn.execute(text(
            "SELECT c.TABLE_NAME, c.COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS AS c "
            "JOIN INFORMATION_SCHEMA.TABLES AS t "
            "ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME "
            "WHERE c.TABLE_SCHEMA='dbo' AND t.TABLE_TYPE='BASE TABLE' "
            "ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION"
        )).mappings()]
        result = inspect_columns(columns)
        if not result["schema_ok"]:
            result["catalog_read_ok"] = False
            result["status"] = "SCHEMA_INCOMPLETE"
            return result
        catalog = [dict(row) for row in conn.execute(text(
            "SELECT TOP (1) t.MaTour, t.TenTour, c.GiaThucTe "
            "FROM dbo.TOUR t LEFT JOIN dbo.CHUYENKHOIHANH c ON c.MaTour=t.MaTour "
            "WHERE t.TrangThai=1 ORDER BY t.MaTour, c.MaChuyen"
        )).mappings()]
        if catalog and catalog[0]["GiaThucTe"] is not None:
            _integer_vnd(catalog[0]["GiaThucTe"])
        result["catalog_read_ok"] = True
        result["sample_available"] = bool(catalog)
        result["status"] = "READ_ONLY_OK"
        return result


def main() -> int:
    try:
        result = check_live(_engine())
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["status"] == "READ_ONLY_OK" else 2
    except Exception as error:
        # The raw exception may expose DB hostname, driver parameters and secrets.
        print(json.dumps({
            "status": "NOT_CONNECTED",
            "reason": "Kiểm tra URL, ODBC 18, mạng, SQL Server, account SELECT-only và TLS.",
            "error_class": type(error).__name__,
        }, ensure_ascii=False))
        return 3


if __name__ == "__main__":
    sys.exit(main())
