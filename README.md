# Delta Travel — Website quảng bá & đặt tour du lịch Việt Nam

> **Đồ án Công nghệ phần mềm · Nhóm 6 · 2026**  
> Mã nguồn tổ chức theo phần việc, kiểm thử bằng GitHub Actions, phát triển theo Pull Request.

## Tổng quan

Hệ thống giới thiệu tour trong nước, lịch khởi hành, quản lý tài khoản và đặt tour. Dự án đang ở **giai đoạn tích hợp**, chưa được xác nhận có thể đặt tour/thanh toán thật và **không phục vụ giao dịch thương mại**.

| Thành phần | Đường dẫn | Hiện trạng |
|---|---|---|
| FastAPI demo của Mạnh | [`API/api/`](API/api/) | Backend chạy với SQLite demo; đã tách thành các module auth/tours/bookings/admin/assistant |
| Giao diện demo đi kèm backend | [`API/frontend/`](API/frontend/) | Giao diện thử API, **không phải** frontend An bàn giao |
| API đọc SQL Server 12 bảng | [`API/api/tham_sqlserver_app.py`](API/api/tham_sqlserver_app.py) | Ứng dụng độc lập, **read-only**, có kiểm thử giả lập; chưa xác minh kết nối DB thật |
| Frontend của An | [`Frontend/`](Frontend/) | Chờ An nộp mã chính thức cùng hướng dẫn chạy |
| Thiết kế database của Thắm | [`database/`](database/) | Script **Microsoft SQL Server/T-SQL**, không phải PostgreSQL; cần duyệt ERD và chạy thử trên DB thật |
| Yêu cầu và quyết định | [`docs/`](docs/) | SRS, 20 use cases, API contract, ADR đang chờ thống nhất |

### Cấu trúc dự án

```text
.
├── .github/workflows/              # CI: demo FastAPI + mock SQL Server
├── API/
│   ├── api/
│   │   ├── app.py                  # Lắp ráp ứng dụng demo và mount UI
│   │   ├── core.py                 # Session, CSRF, phân quyền, shared utilities
│   │   ├── schemas.py              # Pydantic request validation
│   │   ├── logic.py                # Quy tắc tính giá/tồn chỗ và response mapping
│   │   ├── models.py               # ORM demo (KHÔNG dùng cho SQL Server của Thắm)
│   │   ├── security.py             # Mật khẩu, token, rate limiting
│   │   ├── routes/
│   │   │   ├── auth.py             # Đăng nhập, hồ sơ, yêu thích
│   │   │   ├── tours.py            # Tour và lịch khởi hành
│   │   │   ├── bookings.py         # Báo giá, tạo/xem/hủy đơn
│   │   │   ├── admin.py            # Các API quản trị
│   │   │   └── assistant.py        # Hỏi đáp tour theo quy tắc
│   │   └── tham_sqlserver_app.py   # Adapter SQL Server đọc-only, tách biệt
│   ├── frontend/                   # UI thử nghiệm do backend phục vụ
│   ├── scripts/                    # Check schema và static assets
│   ├── tests/                      # Backend regression/mock contracts
│   └── docs/                       # Hướng dẫn API, test, release gates
├── Frontend/                       # An: frontend chính thức
├── database/                       # Thắm: thiết kế và script database
└── docs/                           # SRS, ADR, phân công và truy vết
```

## Chạy nhanh backend demo

Yêu cầu Python **3.11+**. Mở terminal tại thư mục `API/`:

```powershell
cd API
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt pytest httpx
.\.venv\Scripts\python.exe -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

Mở `http://127.0.0.1:8000/` để xem giao diện demo, hoặc `http://127.0.0.1:8000/docs` để thử API. **Không** nhấp mở `index.html` bằng `file://`; cookie/session và API phải cùng máy chủ.

```powershell
# Từ thư mục API:
.\.venv\Scripts\python.exe -m pytest -q tests/test_api.py tests/test_legacy_schema_guard.py tests/test_static_assets.py
.\.venv\Scripts\python.exe -m pytest -q tests/test_tham_sqlserver_app.py tests/test_tham_sqlserver_checker.py
.\.venv\Scripts\python.exe -m scripts.check_static_assets
```

Giữ `DELTA_ENV=development` với SQLite demo. **Không** dùng backend này cho thanh toán thật hoặc trỏ `DATABASE_URL` sang database SQL Server của Thắm: hai schema khác nhau và mã đã chặn tình huống đó.

## Kiểm tra database SQL Server của Thắm

API độc lập `api.tham_sqlserver_app` hỗ trợ đọc danh mục, tour, lịch trình, ảnh, bài viết và báo giá; tạo đơn và xác nhận thanh toán **cố ý trả 503** cho đến khi nghiệp vụ/schema được duyệt. Mọi kết quả CI của adapter này hiện là **mock**, không phải bằng chứng đã kết nối database thật.

Xem [hướng dẫn kiểm chứng database](API/docs/SQLSERVER_LIVE_VERIFICATION_RUNBOOK.md). Tài khoản kiểm thử phải **chỉ có quyền SELECT**, credentials để trong biến môi trường, không commit hoặc gửi vào nhóm chat. Không chạy các script chứa `DROP DATABASE` trên database có dữ liệu.

## Quy trình nhóm

1. **Thắm:** chốt phát biểu bài toán/ERD, loại DBMS, migration và test dữ liệu.
2. **Mạnh:** review API contract, tích hợp FastAPI theo schema đã chốt, auth/booking/payment an toàn.
3. **An:** đưa frontend thật vào `Frontend/`, tích hợp API và bàn giao ảnh/test.
4. **Đăng:** test cases, E2E, bảo mật, đồng thời và UAT.
5. **Phúc:** CI/CD, SQL Server test/staging, HTTPS, backup, deploy.

Xem [GitHub Issues](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/issues) để nhận việc. Mỗi thay đổi đi theo **nhánh riêng → Pull Request → CI → review → merge vào `main`**. Không xóa/sửa mã của thành viên khác nếu chưa review.

Tài liệu chi tiết: [Kiến trúc & phân luồng nguồn mã](docs/ARCHITECTURE.md), [Quy trình đóng góp](CONTRIBUTING.md), [SRS bản thảo](docs/requirements/SRS_REVIEW_20261026.md), [ADR DBMS chưa chốt](docs/decisions/ADR_001_DBMS_AND_BOOKING_PENDING.md).

**Trạng thái nghiệm thu:** chỉ báo DONE khi có ứng dụng chạy trên schema DB thật, test bảo mật/đặt chỗ, URL staging và bằng chứng QA. Một PR merge hoặc CI SQLite xanh chưa chứng minh FE–BE–DB đã tích hợp thành công.
