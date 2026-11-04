# FastAPI backend — hướng dẫn cấu trúc cho nhóm

Backend demo dùng MVC mở rộng để tách giao tiếp HTTP, nghiệp vụ và truy cập dữ
liệu. Luồng request:

```text
api/routes -> api/controllers -> api/services -> api/repositories -> api/models
                       \-> api/schemas (kiểm tra input/output)
```

## Trách nhiệm từng thư mục

| Thư mục / module | Trách nhiệm |
|---|---|
| `api/app.py` | Composition root: tạo FastAPI app, đăng ký router và mount giao diện |
| `api/routes/` | Khai báo path, HTTP method và controller handler; không truy vấn DB |
| `api/controllers/` | Nhận dependency/request, gọi service và trả kết quả HTTP |
| `api/services/` | Quy tắc nghiệp vụ, giao dịch, giá, tồn chỗ, quyền và mapping |
| `api/repositories/` | Truy vấn/ghi SQLAlchemy; không quyết định nghiệp vụ HTTP |
| `api/models/` | ORM entities và metadata dùng chung |
| `api/schemas/` | Pydantic contracts, parse và validate dữ liệu đầu vào |
| `api/core/` | Cấu hình, session, authentication, CSRF và tiện ích dùng chung |
| `../Frontend/` | Giao diện khách/admin (View), được FastAPI phục vụ cùng origin |
| `tests/` | API regression, contract, architecture và database tests |
| `scripts/` | Công cụ vận hành/kiểm tra thủ công |
| `docs/` | Tài liệu kỹ thuật của API |

`../database/` lưu
migrations PostgreSQL và các script SQL Server tham khảo. Không chuyển tests,
scripts, migration hay docs vào thư mục MVC của ứng dụng.

## Quy tắc khi thêm chức năng

1. Thêm/đổi entity trong `api/models/` và migration Alembic tương ứng.
2. Thêm contract trong `api/schemas/`.
3. Viết query trong `api/repositories/`.
4. Đặt quy tắc và transaction trong `api/services/`.
5. Controller gọi service; route chỉ đăng ký endpoint.
6. Thêm regression test trong `tests/` và cập nhật docs liên quan.

Không thêm SQL hoặc quy tắc nghiệp vụ vào `api/app.py` hay file route. Không
trỏ ORM SQLite/PostgreSQL vào schema SQL Server của Thắm. Adapter
`api.tham_sqlserver_app` là ứng dụng riêng, hiện chỉ đọc.

## Chạy trên Windows PowerShell

```powershell
cd API
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt pytest httpx
.\.venv\Scripts\python.exe -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

Chạy regression:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests
```

Khi đổi API contract, phối hợp với frontend và cập nhật tài liệu API trước khi
merge.
