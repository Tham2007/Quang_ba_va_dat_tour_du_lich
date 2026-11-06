# Delta Travel — Website quảng bá & đặt tour du lịch Việt Nam

> **Đồ án Công nghệ phần mềm · Nhóm 6 · 2026**  
> Mã nguồn tổ chức theo phần việc, kiểm thử bằng GitHub Actions, phát triển theo Pull Request.

## Tổng quan

Hệ thống giới thiệu tour trong nước, lịch khởi hành, quản lý tài khoản và đặt tour. Dự án đang ở **giai đoạn tích hợp**, chưa được xác nhận có thể đặt tour/thanh toán thật và **không phục vụ giao dịch thương mại**.

| Thành phần | Đường dẫn | Hiện trạng |
|---|---|---|
| FastAPI demo của Mạnh | [`API/api/`](API/api/) | Backend SQLite/PostgreSQL demo, refactor MVC mở rộng với routes/controllers/services/repositories |
| Giao diện chính | [`Frontend/`](Frontend/) | Giao diện khách/admin chính thức, kết nối API cùng origin |
| API đọc SQL Server 12 bảng | [`API/api/tham_sqlserver_app.py`](API/api/tham_sqlserver_app.py) | **Đã thử với SQL Server 2022 thật trong CI ephemeral**; đọc dữ liệu OK, ghi qua HTTP API cố ý 503, chưa có SQL Server host bền vững |
| Frontend | [`Frontend/`](Frontend/) | Giao diện Vanilla JS chia controllers/models/services, được phục vụ tại `/` và `/an-live/` |
| Thiết kế database của Thắm | [`database/`](database/) | **12 bảng T-SQL chạy đạt trên SQL Server 2022 thật CI**; SP đặt/hủy, 20 người tranh 1 chỗ chỉ 1 thành công. Chưa host SQL Server lâu dài |
| Yêu cầu và quyết định | [`docs/`](docs/) | SRS, 20 use cases, API contract, ADR đang chờ thống nhất |

### Cấu trúc dự án theo MVC mở rộng

```text
.
├── .github/workflows/             # CI: SQLite, SQL Server, PostgreSQL, Chromium
├── API/
│   ├── api/
│   │   ├── app.py                 # Composition root, giữ nguyên uvicorn api.app:app
│   │   ├── routes/                # Khai báo URL và HTTP methods
│   │   ├── controllers/           # auth, tour, booking, admin, assistant
│   │   ├── services/              # Nghiệp vụ, giá, tồn chỗ, payment evidence
│   │   ├── repositories/          # Truy vấn ORM với SQLAlchemy Session
│   │   ├── models/                # ORM entities, Base chung
│   │   ├── schemas/               # Pydantic input contracts
│   │   ├── core/                  # security, session, config
│   │   ├── logic.py               # Compatibility import cho code cũ
│   │   ├── security.py            # Compatibility import cho code cũ
│   │   └── tham_sqlserver_app.py  # SQL Server 12 bảng, adapter chỉ đọc
│   ├── tests/                     # Regression và MVC architecture tests
│   └── scripts/
├── Frontend/                      # UI chính, cùng origin với FastAPI
│   ├── index.html
│   ├── admin.html
│   └── assets/
│       ├── css/
│       ├── images/
│       └── js/
│           ├── controllers/       # main, admin, auth, chatbot
│           ├── models/            # data
│           └── services/          # api, live-api-bridge
├── database/database/            # T-SQL 12 bảng + PostgreSQL Alembic demo
└── docs/                         # SRS, ADR, giải thích kiến trúc
```

**Quy ước MVC mở rộng:** `routes/` nhận URL/method, `controllers/` xử lý HTTP,
`services/` giữ nghiệp vụ, `repositories/` truy vấn dữ liệu, `models/` định
nghĩa ORM và `schemas/` kiểm tra request. `Frontend/` là phần giao diện;
`database/`, `tests/`, `scripts/`, `docs/` được giữ riêng vì
đó là migration, kiểm thử, vận hành và tài liệu — không phải MVC layer.
**Lưu ý:** cách tổ chức này không đồng nghĩa mọi thành phần đã dùng chung SQL
Server. `api.app` vẫn chạy DB SQLite/PostgreSQL theo schema demo. Adapter SQL
Server riêng hiện chỉ đọc, API ghi booking trả 503. Xem
[giải thích các tầng MVC](API/docs/MVC_REFACTOR_20261103.md).

## Hướng dẫn khởi chạy hệ thống

### Cách 1: Khởi chạy bằng Node.js (Khuyên dùng - Tiện lợi & Nhanh chóng)
Yêu cầu đã cài đặt **Node.js** (phiên bản 18+ hoặc mới nhất).
1. **Khởi động 1 chạm:** Nhấp đúp vào tệp [`run.bat`](run.bat) ở thư mục gốc. Hệ thống sẽ tự động cài thư viện cần thiết (`npm install`) và khởi động server.
2. **Khởi động bằng dòng lệnh (Terminal / PowerShell):**
   ```bash
   npm install
   npm run dev
   ```
   *(Lệnh `npm run dev` kích hoạt chế độ watch tự động reload server ngay khi chỉnh sửa file).*
3. **Kiểm thử tự động hệ thống Node.js:**
   ```bash
   npm test
   ```
* Hệ thống sẽ mở tại:
  - **Trang chủ đặt tour trực tuyến:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
  - **Cổng quản trị Admin:** [http://127.0.0.1:8000/admin.html](http://127.0.0.1:8000/admin.html) *(Tài khoản máy chủ: `admin@deltatravel.vn` / `delta123`; đăng nhập nhanh thành viên nhóm: mật khẩu `password123`)*

---

### Cách 2: Khởi chạy bằng Python FastAPI
Yêu cầu Python **3.11+**. Nhấp đúp file [`run_python.bat`](run_python.bat) hoặc mở terminal tại thư mục `API/`:

```powershell
cd API
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt pytest httpx
.\.venv\Scripts\python.exe -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

Mở `http://127.0.0.1:8000/` hoặc `http://127.0.0.1:8000/an-live/` để xem giao diện, và `http://127.0.0.1:8000/docs` để thử Swagger. **Không** nhấp mở `index.html` bằng `file://`; cookie/session và API phải cùng máy chủ.

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
