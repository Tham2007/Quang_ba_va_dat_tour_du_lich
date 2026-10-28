# FastAPI của Mạnh — README cho nhóm

**Lưu ý:** đây là backend demo học phần (SQLite local), chưa phải hệ thống đã tích hợp database SQL Server của Thắm. Đã chia module để nhóm dễ đọc; không tự thay thế frontend chính thức của An.

## Đọc mã theo đường đi HTTP

```text
api/app.py                 FastAPI app, middlewares, router mounts, static UI
api/routes/auth.py         đăng ký, đăng nhập, session, CSRF, hồ sơ, yêu thích
api/routes/tours.py        danh sách/chi tiết tour và lịch khởi hành
api/routes/bookings.py     báo giá, đặt/huỷ và xem đơn
api/routes/admin.py        quản trị tour, lịch, thanh toán thủ công, audit
api/routes/assistant.py    trợ lý FAQ theo quy tắc
api/schemas.py             định nghĩa request/validation
api/core.py                dependencies auth, role, session, helper
api/logic.py               giá, ghế, expire, serializer
api/models.py              ORM demo SQLite/Postgres (không phải DB Thắm)
api/security.py            hash mật khẩu, token, rate limit
api/tham_sqlserver_app.py  ứng dụng độc lập, đọc SQL Server 12 bảng
```

Không viết thêm toàn bộ logic vào `api/app.py`. Route mới vào đúng `api/routes/<module>.py`, input mới vào `api/schemas.py`. Khi đổi API contract phải báo An và Đăng.

## Chạy trên Windows PowerShell

```powershell
cd API
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt pytest httpx
.\.venv\Scripts\python.exe -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

Mở `http://127.0.0.1:8000/` hoặc `http://127.0.0.1:8000/docs`. **Giao diện tại `API/frontend/` là UI demo backend**, không phải source gốc An.

## Chạy kiểm thử (terminal khác, thư mục API)

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_api.py tests/test_legacy_schema_guard.py tests/test_static_assets.py
.\.venv\Scripts\python.exe -m pytest -q tests/test_tham_sqlserver_app.py tests/test_tham_sqlserver_checker.py
.\.venv\Scripts\python.exe -m scripts.check_static_assets
```

CI chạy qua `.github/workflows/ci-backend-regression.yml` và `.github/workflows/ci-tham-sqlserver-bridge.yml`. Mock xanh không chứng minh server SQL Server của Thắm đã chạy; tham khảo `docs/SQLSERVER_LIVE_VERIFICATION_RUNBOOK.md`.

## Tích hợp tiếp với Thắm/An/Đăng/Phúc

- **Thắm:** duyệt ERD, T-SQL 12 bảng, role, giữ chỗ, migration an toàn và database test.
- **Mạnh:** sau DB thật, tích hợp auth/booking/payment với schema đã chốt.
- **An:** đưa source frontend chính thức vào `Frontend/` qua PR và gọi endpoint đã nghiệm thu.
- **Đăng:** test UAT/E2E, 401/403, static 404, concurrency và quyền user.
- **Phúc:** CI/staging sử dụng **đúng repo nhóm** và SQL Server test, bảo mật secrets.

**Release:** không commit .env, credentials, file db hay quyền Admin trên frontend; không chạy SQL chứa DROP DATABASE trên dữ liệu thật; không coi 'đã merge' là 'đã kết nối FE–BE–DB'.
