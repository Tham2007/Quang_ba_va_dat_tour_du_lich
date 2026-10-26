"""Ensure the SQLite/Postgres demo ORM cannot mutate Tham's 12-table SQL Server."""
import pytest
from api.models import make_engine


@pytest.mark.parametrize("url", [
    "mssql+pyodbc://example:masked@example.invalid/TourDuLichDB",
    "mssql://example.invalid/TourDuLichDB",
])
def test_legacy_model_refuses_mssql_before_engine_creation(url):
    with pytest.raises(RuntimeError, match="Legacy ORM cannot use Tham SQL Server"):
        make_engine(url)
