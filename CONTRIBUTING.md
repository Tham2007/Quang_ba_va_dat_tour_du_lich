# Hướng dẫn làm việc nhóm Delta Travel

## Luồng góp mã

1. Đồng bộ `main`, tạo branch ngắn theo định dạng `feature/<ten>-<chuc-nang>` hoặc `fix/<chuc-nang>`.
2. Chỉ sửa phần code chịu trách nhiệm; nếu đổi database contract thì trao đổi với Thắm + Mạnh + An trước.
3. Tự chạy test liên quan, cập nhật README/contract nếu đổi HTTP/API.
4. Push branch, tạo Pull Request vào `main`; liên kết GitHub Issue.
5. CI xanh + có review của người phụ trách → merge; xóa nhánh sau khi merge (không xóa `main`).

## Quy ước thư mục

| Đường dẫn | Người phụ trách | Ghi chú |
|---|---|---|
| `API/api/`, `API/tests/` | Mạnh | Phần backend, security, API và regression |
| `database/` | Thắm | ERD, database T-SQL, migration, integrity |
| `Frontend/` | An | Ứng dụng frontend chính thức |
| CI/tests/UAT | Đăng phối hợp Mạnh/Phúc | QA độc lập, bug reproduction |
| `.github/workflows/`, deploy | Phúc | CI/CD, hosting, secrets |
| `docs/` | Cả nhóm; Mạnh điều phối | SRS, ADR, traceability, báo cáo |

## Chạy kiểm thử demo

```powershell
cd API
py -3 -m pip install -r requirements.txt pytest httpx
py -3 -m pytest -q tests/test_api.py tests/test_legacy_schema_guard.py tests/test_static_assets.py
py -3 -m pytest -q tests/test_tham_sqlserver_app.py tests/test_tham_sqlserver_checker.py
py -3 -m scripts.check_static_assets
```

Đừng dùng `API/api/app.py` (ORM demo SQLite) để truy cập `database/` SQL Server của Thắm; thay đổi trực tiếp `DATABASE_URL=mssql...` sẽ bị từ chối để tránh làm sai schema. Cầu nối SQL Server chỉ đọc ở `API/api/tham_sqlserver_app.py`.

## Khuôn mẫu Pull Request ngắn

```markdown
### Chức năng / Issue
Sửa gì, cho ai, liên quan #?

### Cách thử
Lệnh test, kết quả, screenshot/log và URL staging (nếu có).

### DB/API contract
Có đổi schema/endpoint không? Nếu có link ADR và reviewer.

### Rủi ro / chưa xong
Phần nào cần người khác bàn giao và tiêu chí mới được DONE.
```

Không commit thông tin cá nhân thật, mật khẩu, token, file .env, URL DB có user/pass, khóa thanh toán hoặc file font/assets không có quyền sử dụng. Kiểm thử payment bằng dữ liệu tổng hợp, không bật giao dịch thật khi nhóm chưa nghiệm thu.

**GitHub Issues:** https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/issues
