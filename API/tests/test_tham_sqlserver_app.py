"""Mock-contract tests only. No real SQL Server connection is claimed."""
from datetime import datetime
from decimal import Decimal

from fastapi.testclient import TestClient
import pytest

from api.tham_sqlserver_app import app, get_reader, _integer_vnd, _positive_id


class FakeReader:
    def __init__(self):
        self.last_sql = None
        self.last_params = None
        self.records = [
            {"MaTour": 7, "TenTour": "Đà Nẵng", "TenDanhMuc": "Miền Trung",
             "HinhAnhDaiDien": "/a.jpg", "MoTaChiTiet": "Mô tả",
             "LichTrinhTongQuan": "3 ngày", "GiaKhuyenNghi": Decimal("2500000.00")}
        ]
        self.gallery = [
            {"MaHinhAnh": 9, "MaTour": 7, "DuongDanAnh": "/g/1.jpg", "GhiChu": "Ảnh 1"}
        ]
        self.itinerary = [
            {"MaLichTrinh": 8, "MaTour": 7, "NgayThu": 1,
             "TieuDeNgay": "Ngày 1", "NoiDungChiTiet": "Đi biển", "BuaAn": "Sáng"}
        ]
        self.articles = [
            {"MaBaiViet": 4, "TieuDe": "Hội An", "Slug": "hoi-an",
             "TomTat": "Bài viết", "HinhAnhDaiDien": "/post.jpg",
             "NgayTao": datetime(2026, 10, 25, 12, 0), "NoiDung": "<b>Nội dung</b>"}
        ]
        self.departures = [
            {"MaChuyen": 42, "MaTour": 7, "NgayKhoiHanh": datetime(2027, 1, 1, 9),
             "NgayKetThuc": datetime(2027, 1, 3, 9),
             "GiaThucTe": Decimal("2600000.00"), "SoChoToiDa": 10,
             "SoChoDaDat": 8, "TrangThaiChuyen": "Mở bán"}
        ]

    def rows(self, sql, parameters=None):
        self.last_sql, self.last_params = sql, parameters
        if "INFORMATION_SCHEMA.TABLES" in sql:
            from api.tham_sqlserver_app import REQUIRED_TABLES
            return [{"table_name": table} for table in REQUIRED_TABLES]
        if "FROM dbo.DANHMUC" in sql:
            return [{"id": 1, "name": "Miền Trung", "description": None}]
        if "FROM dbo.HINHANH_TOUR" in sql:
            return self.gallery
        if "FROM dbo.LICH_TRINH_DETAIL" in sql:
            return self.itinerary
        if "FROM dbo.BAIVIET_QUANGBA" in sql:
            if parameters and parameters.get("article_id") not in (None, 4):
                return []
            return self.articles
        if "FROM dbo.CHUYENKHOIHANH" in sql:
            return self.departures
        if "SELECT MaTour FROM dbo.TOUR" in sql:
            return [{"MaTour": 7}] if parameters["tour_id"] == 7 else []
        if "FROM dbo.TOUR" in sql:
            return self.records if parameters is None or parameters.get("tour_id", 7) == 7 else []
        raise AssertionError(sql)


@pytest.fixture
def setup():
    fake = FakeReader()
    app.dependency_overrides[get_reader] = lambda: fake
    try:
        with TestClient(app) as client:
            yield client, fake
    finally:
        app.dependency_overrides.clear()


def test_health_and_categories(setup):
    client, _ = setup
    assert client.get("/api/v1/health/ready").json()["tablesChecked"] == 12
    assert client.get("/api/v1/categories").json()[0]["name"] == "Miền Trung"


def test_catalog_bound_parameters_and_no_invented_discount(setup):
    client, fake = setup
    response = client.get("/api/v1/tours?q=Đà Nẵng&category=Miền Trung&max_price=3000000")
    assert response.status_code == 200
    tour = response.json()[0]
    assert tour["id"] == "7" and tour["price"] == 2500000
    assert tour["originalPrice"] == 2500000 and not tour["isFlashSale"]
    assert tour["duration"] is None
    assert "Đà Nẵng" not in fake.last_sql
    assert fake.last_params["pattern"] == "%Đà Nẵng%"


def test_search_escapes_wildcards_and_unsupported_filters(setup):
    client, fake = setup
    assert client.get("/api/v1/tours?q=%25_%5B").status_code == 200
    assert fake.last_params["pattern"] == "%[%][_][[]%"
    assert client.get("/api/v1/tours?region=north").status_code == 422
    assert client.get("/api/v1/tours?flash=true").status_code == 422


def test_tour_detail_and_schedules(setup):
    client, _ = setup
    assert client.get("/api/v1/tours/7").json()["title"] == "Đà Nẵng"
    assert client.get("/api/v1/tours/nope").status_code == 404
    schedule = client.get("/api/v1/tours/7/schedules").json()[0]
    assert schedule["availableSeats"] == 2 and schedule["unitPrice"] == 2600000
    assert schedule["departureTimeZone"] == "unspecified"
    assert not schedule["departureAt"].endswith("Z")


def test_quote_server_price_and_no_fake_paid(setup):
    client, fake = setup
    response = client.post("/api/v1/bookings/quote", json={"schedule_id": "42", "adults": 2})
    assert response.status_code == 200
    assert response.json()["totalPrice"] == 5200000
    assert response.json()["quoteOnly"] is True
    fake.departures[0]["SoChoDaDat"] = 9
    assert client.post("/api/v1/bookings/quote", json={"schedule_id": "42", "adults": 2}).status_code == 409
    assert client.post("/api/v1/bookings/quote", json={
        "schedule_id": "42", "adults": 1, "children": 1
    }).status_code == 409


def test_writes_stay_disabled_and_no_fake_auth(setup):
    client, _ = setup
    assert client.post("/api/v1/bookings", json={}).status_code == 503
    assert client.post("/api/v1/admin/bookings/1/confirm-payment", json={}).status_code == 503
    assert client.post("/api/v1/auth/register", json={}).status_code == 404


def test_money_and_identifier_validation():
    assert _integer_vnd(Decimal("1000000.00")) == 1000000
    for value in [Decimal("100.25"), Decimal("-1"), float("nan"), "bad"]:
        with pytest.raises(Exception):
            _integer_vnd(value)
    for value in ["-2", "nan", "0", "3;DROP TABLE dbo.TOUR", "１", "9" * 10000]:
        with pytest.raises(Exception):
            _positive_id(value)


def test_stock_inconsistency_returns_service_error(setup):
    client, fake = setup
    fake.departures[0]["SoChoDaDat"] = 11
    assert client.get("/api/v1/tours/7/schedules").status_code == 503


def test_gallery_and_itinerary_use_12_table_schema(setup):
    client, fake = setup
    images = client.get("/api/v1/tours/7/gallery")
    assert images.status_code == 200
    assert images.json() == [{"id": "9", "tourId": "7", "url": "/g/1.jpg", "caption": "Ảnh 1"}]
    assert "dbo.HINHANH_TOUR" in fake.last_sql
    itinerary = client.get("/api/v1/tours/7/itinerary")
    assert itinerary.status_code == 200
    assert itinerary.json()[0]["day"] == 1
    assert "dbo.LICH_TRINH_DETAIL" in fake.last_sql


def test_articles_untrusted_html_and_only_published(setup):
    client, fake = setup
    listing = client.get("/api/v1/articles")
    assert listing.status_code == 200
    assert "TrangThai=1" in fake.last_sql
    assert "contentHtmlUntrusted" not in listing.json()[0]
    detail = client.get("/api/v1/articles/4")
    assert detail.status_code == 200
    assert detail.json()["contentHtmlUntrusted"] == "<b>Nội dung</b>"
    assert client.get("/api/v1/articles/5").status_code == 404
    assert client.get("/api/v1/articles/nope").status_code == 404


def test_hidden_or_unknown_tours_not_exposed(setup):
    client, _ = setup
    assert client.get("/api/v1/tours/13/gallery").status_code == 404
    assert client.get("/api/v1/tours/13/itinerary").status_code == 404
    assert client.get("/api/v1/tours/13/schedules").status_code == 404
