# Kiến trúc và sơ đồ mã nguồn Delta Travel

Cập nhật 28/10/2026. Tài liệu này mô tả **mã có thật trong repo** và trách nhiệm từng thư mục; không coi phần tích hợp chưa được xác minh là đã xong.

## 1. Ba thành phần độc lập cần phân biệt

### A. Demo FastAPI có xác thực — `API/api/app.py`

```text
Browser → API/frontend/ → app.py
                            ├─ routes/auth.py      → core.py     → models.py (SQLite demo)
                            ├─ routes/tours.py     → logic.py    → models.py (SQLite demo)
                            ├─ routes/bookings.py  → logic.py    → models.py (SQLite demo)
                            ├─ routes/admin.py     → core.py     → models.py (SQLite demo)
                            └─ routes/assistant.py              → models.py (SQLite demo)
```

Trong `API/api/`:
- **`app.py`** chỉ làm composition root: lifespan, security headers, error handler, routes, static mount. Không đặt nghiệp vụ mới vào đây.
- **`routes/`** là lớp HTTP; giữ request/response, DB transaction và authorization. Một endpoint thuộc đúng một router. Tạo route mới theo module liên quan.
- **`schemas.py`** chỉ mô tả input/validation Pydantic; không mở kết nối DB.
- **`core.py`** giữ session, CSRF, admin dependency, định dạng thời gian, audit, config demo.
- **`logic.py`** giữ phép tính giá, tồn chỗ, expire và serializer dùng chung; tránh tạo lại code này trong từng router.
- **`models.py`** là SQLAlchemy ORM demo với bảng tên `users,tours,schedules,bookings,...`. Không dùng nó để migrate SQL Server 12 bảng.
- **`security.py`** mật khẩu/token/rate limits; `seed.py` dữ liệu giả local.

Startup demo từ `API/`:
```powershell
py -3 -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

### B. Adapter đọc SQL Server Thắm — `API/api/tham_sqlserver_app.py`

```text
FastAPI read-only → SQLAlchemy text/bound params → pyodbc → SQL Server `TourDuLichDB`
```

Đây là **ứng dụng riêng**, không import `models.py` demo; chỉ gọi `SELECT` vào `dbo.TOUR`, `dbo.CHUYENKHOIHANH`, `dbo.DANHMUC`, `dbo.HINHANH_TOUR`, `dbo.LICH_TRINH_DETAIL`... Không ghép truy vấn SQL từ input tự do. `POST /api/v1/bookings` và thao tác payment trả 503 có chủ đích.

Chạy từ `API/`:
```powershell
py -3 -m uvicorn api.tham_sqlserver_app:app --host 127.0.0.1 --port 8010
```

Phải có `THAM_SQLSERVER_URL` tới DB test và tài khoản chỉ SELECT; xem [runbook](../API/docs/SQLSERVER_LIVE_VERIFICATION_RUNBOOK.md). `DATABASE_URL` của demo không thay cho `THAM_SQLSERVER_URL`.

### C. Frontend chính thức của An — `Frontend/`

Chỉ An mới xác nhận đúng commit/source frontend chính thức. Hiện trên repo chưa có ứng dụng hoàn chỉnh trong `Frontend/`; giao diện thử nghiệm của backend ở `API/frontend/` **không tự thay thế phần An**.

Frontend không được tin dữ liệu `PAID`, giá hoặc tồn chỗ tự tính từ localStorage. Cần API backend đã kết nối DB thật, cookie/CSRF/origin thống nhất, thông báo lỗi rõ ràng và sanitize HTML không tin cậy.

## 2. Database và quy tắc nghiệp vụ

`database/` hiện chứa SQL Server/T-SQL từ Thắm, với 12 bảng theo phân tích. Có trigger, stored procedure, báo cáo và seed; **không phải các migration PostgreSQL chạy được**.

Trước tích hợp booking cần chốt:
1. Engine DBMS chính thức và ERD đã duyệt.
2. Auth/role persistence, favorites/contact theo UC.
3. Ghế giữ một lần khi tạo đơn; thanh toán không cộng ghế thêm lần nữa.
4. Retry/idempotency, hạn giữ chỗ, hủy/expire, khóa/transaction.
5. Payment confirmation phải so khớp mã giao dịch unique, số tiền và quyền nhân viên.

Một số SQL tạo DB có `DROP DATABASE`, **không được chạy trên dữ liệu thật**. Chỉ triển khai test riêng hoặc migration non-destructive có review.

## 3. Kiểm thử, CI và Definition of Done

`.github/workflows/ci-backend-regression.yml`: test FastAPI demo SQLite và static assets.  
`.github/workflows/ci-tham-sqlserver-bridge.yml`: test adapter SQL Server **bằng fake reader** và schema checker; chưa phải live database.

`API/scripts/check_tham_sqlserver.py` thực hiện kiểm tra kết nối/schema đọc-only trên instance test. Kết quả `READ_ONLY_OK` mới chứng minh cơ bản DB đọc được; vẫn phải test booking/auth/payment + FE E2E trên DB thật.

**Mốc DONE tích hợp**: ADR/SRS duyệt → migration DB test OK → live API health/query OK → backend auth/booking/payment có quyền và transaction OK → frontend An dùng API thật → Đăng test E2E/concurrency/security OK → Phúc CI/staging/backup/rollback OK.

## 4. Quy tắc dọn repo

- Không đẩy thêm UI demo vào `Frontend/` để giả frontend chính thức.
- Không đưa SQL chứa `DROP DATABASE` vào lệnh deploy tự động.
- Không lưu token/API key/secret, `.env`, database local, `node_modules`, `.venv` trên Git.
- Tài liệu phát biểu bài toán/SRS/ADR có trạng thái `DRAFT/PENDING` cho đến khi nhóm duyệt.
- Nếu dời tên file/path có thể làm hỏng CI/link/import, cần cập nhật tất cả references và regression tests trước merge.
- PR code phải có tiêu chí nghiệm thu và bằng chứng CI/QA, không nhận xét “100% sạch bug” khi chưa có test thực tế.
