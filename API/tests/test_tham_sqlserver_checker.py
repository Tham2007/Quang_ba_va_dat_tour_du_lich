"""Pure schema-contract tests; no external SQL Server required."""
from api.tham_sqlserver_app import REQUIRED_TABLES
from scripts.check_tham_sqlserver import REQUIRED_COLUMNS, inspect_columns


def all_rows():
    return [{"TABLE_NAME": table, "COLUMN_NAME": column}
            for table, columns in REQUIRED_COLUMNS.items() for column in columns]


def test_schema_has_required_12_tables_and_columns():
    report = inspect_columns(all_rows())
    assert report["schema_ok"]
    assert report["tables_required"] == 12 == len(REQUIRED_TABLES)
    assert not report["role_persistence_in_12_table_design"]
    assert not report["booking_idempotency_column_present"]


def test_missing_table_detected():
    report = inspect_columns([r for r in all_rows() if r["TABLE_NAME"] != "DATTOUR"])
    assert not report["schema_ok"]
    assert report["missing_tables"] == ["DATTOUR"]
    assert "DATTOUR" not in report["missing_columns"]


def test_missing_column_detected():
    report = inspect_columns([r for r in all_rows() if not (
        r["TABLE_NAME"] == "CHUYENKHOIHANH" and r["COLUMN_NAME"] == "SoChoDaDat"
    )])
    assert report["missing_columns"]["CHUYENKHOIHANH"] == ["SoChoDaDat"]


def test_metadata_match_is_case_insensitive():
    rows = [{"TABLE_NAME": r["TABLE_NAME"].lower(), "COLUMN_NAME": r["COLUMN_NAME"].lower()}
            for r in all_rows()]
    assert inspect_columns(rows)["schema_ok"]


def test_schema_extensions_flagged_when_present():
    rows = all_rows() + [
        {"TABLE_NAME": "NGUOIDUNG", "COLUMN_NAME": "VaiTro"},
        {"TABLE_NAME": "DATTOUR", "COLUMN_NAME": "Idempotency_Key"},
        {"TABLE_NAME": "DATTOUR", "COLUMN_NAME": "Expires_At"},
    ]
    report = inspect_columns(rows)
    assert report["role_persistence_in_12_table_design"]
    assert report["booking_idempotency_column_present"]
    assert report["hold_expiry_column_present"]
