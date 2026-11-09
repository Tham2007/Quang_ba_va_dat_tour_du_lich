#!/usr/bin/env python3
"""Non-mutating contract checks for the 12 original Delta Travel SQL Server tables."""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "database/database/01_schema/02_create_tables_3nf.sql"
DOC = ROOT / "DATABASE_SCHEMA.md"
AUDIT = ROOT / "database/database/scripts/sqlserver_schema_preflight_readonly.sql"
TABLES = (
    "NGUOIDUNG", "DANHMUC", "TOUR", "HINHANH_TOUR",
    "LICH_TRINH_DETAIL", "CHUYENKHOIHANH", "DATTOUR",
    "CHITIET_HANHKHACH", "THANHTOAN", "DANHGIA",
    "BAIVIET_QUANGBA", "AUDITLOG",
)
INFRA = ("API_PHIENDANGNHAP", "API_YEUCAU_DATTOUR", "API_TOUR_COST_ITEM")

def tables_from_baseline(source: str) -> list[str]:
    return re.findall(r"\bCREATE\s+TABLE\s+(?:dbo\.)?\[?([A-Z][A-Z0-9_]*)\]?",source,re.I)

def destructive_statements(source: str) -> list[str]:
    # Purely diagnostic; never execute SQL.
    return re.findall(r"\b(?:DROP\s+(?:TABLE|DATABASE)|TRUNCATE\s+TABLE|DELETE\s+FROM)\b", source,re.I)

def verify() -> dict:
    sql=BASELINE.read_text(encoding="utf-8-sig")
    doc=DOC.read_text(encoding="utf-8-sig")
    audit=AUDIT.read_text(encoding="utf-8-sig")
    names=[x.upper() for x in tables_from_baseline(sql)]
    assert len(names)==len(set(names)), "Duplicate business table definitions"
    assert set(names)==set(TABLES), "Business schema changed; reconcile ERD before deploy"
    documented=set(x.upper() for x in re.findall(r"^###\s+\d+\.\s+Bảng\s+`([^`]+)`",doc,re.M))
    assert documented==set(TABLES), "Published 12-table schema doc is out of sync"
    assert all(name in audit for name in TABLES+INFRA), "Read-only metadata audit incomplete"
    # Strip comment lines; only SELECT/metadata reads may exist in audit.
    live="\n".join(line for line in audit.splitlines() if not line.lstrip().startswith("--"))
    assert not destructive_statements(live), "Unsafe mutating verb in read-only audit"
    assert not re.search(r"\b(?:INSERT|UPDATE|ALTER|CREATE|MERGE|EXEC(?:UTE)?)\s+",live,re.I), "Unexpected write/exec in audit"
    return {
        "status": "STATIC_CONTRACT_OK_NOT_LIVE_VALIDATION",
        "business_tables":len(TABLES),
        "optional_infrastructure_tables":len(INFRA),
        "dangerous_legacy_schema_statements":len(destructive_statements(sql)),
        "legacy_schema_safe_to_rerun_on_production":False,
        "live_sql_server_verified":False
    }

if __name__ == "__main__":
    print(json.dumps(verify(),ensure_ascii=False,indent=2))
