# Delta Travel — Website quảng bá & đặt tour du lịch Việt Nam

> **Đồ án Công nghệ phần mềm · Nhóm 6 · 2026**  
> Mã nguồn tổ chức theo phần việc, kiểm thử bằng GitHub Actions, phát triển theo Pull Request.

## Tổng quan

Hệ thống giới thiệu tour trong nước, lịch khởi hành, quản lý tài khoản và đặt tour. Dự án đang ở **giai đoạn tích hợp**, chưa được xác nhận có thể đặt tour/thanh toán thật và **không phục vụ giao dịch thương mại**.

| Thành phần | Đường dẫn | Hiện trạng |
|---|---|---|
| FastAPI demo của Mạnh | [`API/api/`](API/api/) | Backend chạy với SQLite demo; đã tách thành các module auth/tours/bookings/admin/assistant |
| Giao diện demo đi kèm backend | [`API/frontend/`](API/frontend/) | Giao diện thử API, **không phải** frontend An bàn giao |
| API đọc SQL Server 12 bảng | [`API/api/tham_sqlserver_app.py`](API/api/tham_sqlserver_app.py) | **Đã thử với SQL Server 2022 thật trong CI ephemeral**; đọc dữ liệu OK, ghi qua HTTP API cố ý 503, chưa có SQL Server host bền vững |
| Frontend của An | [`Frontend/`](Frontend/) | Giao diện gốc có **bảng API thật** ở `/an-live/` (đăng ký/đặt/hủy server-side); các nút giao diện cũ vẫn localStorage demo. Chromium E2E đạt |
| Thiết kế database của Thắm | [`database/`](database/) | **12 bảng T-SQL chạy đạt trên SQL Server 2022 thật CI**; SP đặt/hủy, 20 người tranh 1 chỗ chỉ 1 thành công. Chưa host SQL Server lâu dài |
| Yêu cầu và quyết định | [`docs/`](docs/) | SRS, 20 use cases, API contract, ADR đang chờ thống nhất |

### Cấu trúc dự án

```text
.
├── .github/workflows/              # CI: SQLite, SQL Server 2022, PostgreSQL 16, Chromium, real HTTPS
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
├── Frontend/                       # Giao diện demo An: index.html + admin.html + CSS/JS/assets
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

Mở `http://127.0.0.1:8000/` để xem giao diện API hoặc `http://127.0.0.1:8000/an-live/` để xem **giao diện An có bảng đăng ký/đặt tour qua API**, và `http://127.0.0.1:8000/docs` để thử Swagger. **Không** nhấp mở `index.html` bằng `file://`; cookie/session và API phải cùng máy chủ.

```powershell
# Từ thư mục API:
.\.venv\Scripts\python.exe -m pytest -q tests/test_api.py tests/test_legacy_schema_guard.py tests/test_static_assets.py
.\.venv\Scripts\python.exe -m pytest -q tests/test_tham_sqlserver_app.py tests/test_tham_sqlserver_checker.py
.\.venv\Scripts\python.exe -m scripts.check_static_assets
```

Giữ `DELTA_ENV=development` với SQLite demo. **Không** dùng backend này cho thanh toán thật hoặc trỏ `DATABASE_URL` sang database SQL Server của Thắm: hai schema khác nhau và mã đã chặn tình huống đó.

## Kiểm tra database SQL Server của Thắm

API độc lập `api.tham_sqlserver_app` hỗ trợ đọc danh mục, tour, lịch trình, ảnh, bài viết và báo giá; tạo đơn và xác nhận thanh toán **cố ý trả 503** cho đến khi nghiệp vụ/schema được duyệt. Adapter này **đã được test với Microsoft SQL Server 2022 thật** trong container CI (không phải chỉ mock); [run SQL Server đã đạt](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/41410461836). Container tự hủy sau khi test, **chưa** phải SQL Server đang chạy liên tục hay có kết nối từ Render.

Xem [hướng dẫn kiểm chứng database](API/docs/SQLSERVER_LIVE_VERIFICATION_RUNBOOK.md). Tài khoản kiểm thử phải **chỉ có quyền SELECT**, credentials để trong biến môi trường, không commit hoặc gửi vào nhóm chat. Không chạy các script chứa `DROP DATABASE` trên database có dữ liệu.

## 🚀 Hai địa chỉ triển khai cần phân biệt (02/11/2026)

| Link | Công dụng | Lưu trữ |
|---|---|---|
| [**An UI + bảng API thật**](https://delta-travel-group6-real-api-staging.onrender.com/an-live/) | **URL demo KTHP được đề nghị**: nút 🔒 cho đăng nhập, báo giá, đặt và hủy qua FastAPI, cùng origin cookie/CSRF | **SQLite tạm trên Render**; có thể mất dữ liệu khi redeploy |
| [FastAPI standalone](https://delta-travel-group6-real-api-staging.onrender.com/) | Trang backend và toàn bộ điều khiển API, SSR không dùng localStorage để đánh dấu thanh toán | SQLite tạm |
| [An static preview](https://delta-travel-group6-kthp-demo.onrender.com/) | Trình diễn giao diện thiết kế của An | **100% localStorage demo**, không phải API/database thật |
| [Swagger](https://delta-travel-group6-real-api-staging.onrender.com/docs) | Hợp đồng và thử API trên server staging | FastAPI |

**Minh chứng CI:** [Chromium An FE → FastAPI → DB](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/41418389453), [HTTPS vào Render thật](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/41419310106), [PostgreSQL 16 thật + Alembic](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/41415085871), [SQL Server 2022 thật 12 bảng/20 concurrent](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/41410461836).

**Để ra bản lưu trữ bền vững:** Thắm và Phúc chốt database chính. Phương án SQL Server 12 bảng cần host SQL Server chạy liên tục, secrets TLS/ODBC và adapter ghi đã được kiểm thử xác thực/CSRF/idempotency. PostgreSQL là **schema khác**, dù migration và booking đã test CI; chỉ dùng chính thức nếu nhóm phê duyệt. Database PostgreSQL trial trên Render đang có sẵn nhưng chưa được gắn secret `DATABASE_URL`; tuyệt đối không commit mật khẩu. Không mở thanh toán thật, không dùng CCCD thật.

## Quy trình nhóm

1. **Thắm:** chốt phát biểu bài toán/ERD, loại DBMS, migration và test dữ liệu.
2. **Mạnh:** review API contract, tích hợp FastAPI theo schema đã chốt, auth/booking/payment an toàn.
3. **An:** rà soát bản frontend đã import vào `Frontend/`, chuyển dữ liệu từ localStorage sang API/DB chính thức sau khi schema được chốt; đọc `Frontend/README.md`.
4. **Đăng:** test cases, E2E, bảo mật, đồng thời và UAT.
5. **Phúc:** CI/CD, SQL Server test/staging, HTTPS, backup, deploy.

Xem [GitHub Issues](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/issues) để nhận việc. Mỗi thay đổi đi theo **nhánh riêng → Pull Request → CI → review → merge vào `main`**. Không xóa/sửa mã của thành viên khác nếu chưa review.

Tài liệu chi tiết: [Kiến trúc & phân luồng nguồn mã](docs/ARCHITECTURE.md), [Quy trình đóng góp](CONTRIBUTING.md), [SRS bản thảo](docs/requirements/SRS_REVIEW_20261026.md), [ADR DBMS chưa chốt](docs/decisions/ADR_001_DBMS_AND_BOOKING_PENDING.md).

**Trạng thái nghiệm thu:** FastAPI + SQLite test có **luồng giao diện An (bảng API 🔒) → HTTPS FastAPI → DB demo thật**, Chromium và external HTTPS smoke đã PASS. Chưa thể đánh dấu DONE toàn hệ thống vì SQLite Render không bền vững, phần lớn nút cũ của An vẫn dùng localStorage và SQL Server 12 bảng của Thắm chưa là database live của Render. Một PR merge hoặc CI xanh không chứng minh FE–BE–SQL Server cuối cùng đã hoàn tất.
