# ADR-001: DBMS, giao dịch giữ chỗ và quyền truy cập

**Status:** PROPOSED / PENDING TEAM APPROVAL, **không phải quyết định cuối cùng**. Ngày 26/10/2026.

## Căn cứ được xác minh

1. `database/` trên `main` có T-SQL **Microsoft SQL Server**: `USE master`, `GO`, `IDENTITY`, `GETDATE()`, stored procedures và triggers.
2. `API/api/models.py` hiện tạo các bảng kiểu khác (`users`, `bookings`, ...), dùng SQLite demo và đề xuất PostgreSQL. Không tương thích 12 bảng SQL Server của Thắm.
3. `API/api/tham_sqlserver_app.py` là ứng dụng **độc lập, chỉ đọc SQL Server**, đã test giả lập, chưa live SQL Server.
4. Chưa có xác minh Thắm đã deploy một SQL Server chạy thật hay chưa. Render Delta Travel hiện trỏ repos cũ, Render Postgres không thay thế SQL Server.

## Quyết định cần cả nhóm/thầy xác nhận

**Phương án A (đề xuất nếu giữ mã database Thắm):** SQL Server 2019+ cho DB chính, FastAPI SQLAlchemy + pyodbc để kết nối, migrations SQL Server không phá dữ liệu, kiểm thử giao dịch trên SQL Server.

**Phương án B (nếu thầy bắt buộc PostgreSQL):** Thiết kế chuyển T-SQL sang PostgreSQL và migrate/test đầy đủ, không chạy tập .sql hiện tại trên Postgres, sửa stored procedures/triggers/ORM tương ứng.

**Không được** dùng đồng thời hai nguồn dữ liệu độc lập cho đơn hoặc coi SQLite demo là DB chính thức.

## Quy tắc giữ chỗ cần duyệt

- Khi tạo đơn, chỉ một transaction có quyền giữ chỗ; khi thanh toán, **không cộng số chỗ lần nữa**.
- Tạo đơn phải lưu giá snapshot server và danh sách hành khách, có idempotency key và hold expiry.
- Đơn quá hạn/cancel phải hoàn ghế đúng một lần; status machine và chính sách hoàn tiền cần được mô tả.
- Cần kiểm thử 20 yêu cầu đồng thời tranh một ghế, 1 thành công, không oversell.
- Không cho người dùng tự xác nhận `PAID`; nhân viên kế toán xác minh độc lập, chống dùng lại `MaGiaoDich`, kiểm tra tiền và lịch sử audit.
- `NGUOIDUNG` cần role persistence hoặc bảng quyền và server-issued authentication, không tin role do frontend gửi.

## Lệnh SQL nguy hiểm cần tránh

`database/01_schema/01_create_database.sql` và `database/full_database_deploy.sql` chứa **DROP DATABASE**. Không chạy chúng trên DB thật hoặc DB có dữ liệu cần giữ. Chỉ dùng môi trường test rỗng và có backup hoặc migration non-destructive đã review.

## Chữ ký / trạng thái

- [ ] Thắm xác nhận engine + ERD/data dictionary/quan hệ.
- [ ] Mạnh duyệt API/schema/booking invariant.
- [ ] An duyệt dữ liệu UI và luồng booking.
- [ ] Đăng duyệt tiêu chí kiểm thử concurrency/security.
- [ ] Phúc xác nhận môi trường DB test, backup/rollback.
- [ ] Đối chiếu với đề bài và quy định của giảng viên.

**Chưa được đánh dấu Approved nếu các ô trên chưa xác nhận.**
