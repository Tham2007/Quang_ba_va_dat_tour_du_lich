# Đối chiếu phân tích nghiệp vụ 12 bảng của Thắm | 26/10/2026

**Nguồn:** tài liệu `phan_tich_nghiep_vu_12_bang_txt.txt` do Thắm gửi; `database/` và `API/` trên nhánh `main`. Đây là tài liệu rà soát, KHÔNG phải xác nhận đã chạy SQL Server, cũng không thay thế ERD/SRS đã được nhóm duyệt.

## 1. Mô hình dữ liệu đã được mô tả

12 bảng theo phân tích: `NGUOIDUNG`, `DANHMUC`, `TOUR`, `HINHANH_TOUR`, `LICH_TRINH_DETAIL`, `CHUYENKHOIHANH`, `DATTOUR`, `CHITIET_HANHKHACH`, `THANHTOAN`, `DANHGIA`, `BAIVIET_QUANGBA`, `AUDITLOG`.

Các UC mới nhấn mạnh gallery và lịch trình theo ngày ở trang tour, nhiều hành khách theo đơn, đánh giá tối đa một lần/đơn, bài viết và phân quyền Admin/NhanVien/KhachHang. Cầu nối chỉ-đọc trong PR này áp dụng tên bảng/cột từ SQL script hiện có, không tự tạo bảng.

## 2. Điểm chặn nối API ghi dữ liệu

| Vấn đề | Đối chiếu có căn cứ | Việc cần Thắm + nhóm chốt |
|---|---|---|
| **SQL Server hay PostgreSQL** | SQL trên main dùng `USE master`, `GO`, `IDENTITY`, `GETDATE()` của SQL Server; nhóm từng nói PostgreSQL | Phải chọn engine; SQL không thể chạy chéo dialect bằng đổi URL. |
| **Vai trò người dùng** | UC-12 nêu Admin/NhanVien/KhachHang; bảng `NGUOIDUNG` lại không có `VaiTro`/bảng quyền | Bổ sung role persistence và quy tắc phân quyền an toàn. Không tin role do browser gửi. |
| **Yêu thích và tư vấn** | UC-07 và UC-04 yêu cầu lưu dữ liệu; 12 bảng không có bảng favorites/contact | Thiết kế bảng/nguồn lưu hoặc điều chỉnh phạm vi UC sau khi nhóm duyệt. |
| **Giữ chỗ bị tính hai lần** | UC-08/AC3 nói giữ ghế khi tạo đơn, UC-17/AC4 lại tăng chỗ lúc xác nhận thanh toán; trigger SQL hiện tăng `SoChoDaDat` ngay khi INSERT | Quyết định một cơ chế giữ/chốt chỗ và viết test đồng thời; không trừ ghế lần hai khi thu tiền. |
| **Hết hạn và retry** | `DATTOUR` không có hạn giữ ghế, idempotency key, snapshot đơn giá | Thiết kế chính sách TTL/hủy, chống đặt trùng và migration. |
| **Bảo mật thanh toán** | `sp_XacNhanThanhToanDonTour` chưa chống reuse `MaGiaoDich` hay so khớp số tiền/trạng thái; không chứng minh quyền kế toán | Thiết kế role, kiểm soát giao dịch, đối soát, test replay và refund. |
| **Giá và thời gian** | SQL Server `DECIMAL(18,2)`, `DATETIME GETDATE()`; backend cũ dùng VND integer và UTC-aware | Chốt chính sách làm tròn, giờ hệ thống, timezone. Bridge từ chối tiền lẻ và không thêm timezone giả. |
| **Nguy cơ mất dữ liệu** | Script `database/01_schema/01_create_database.sql` và `full_database_deploy.sql` có `DROP DATABASE` | TUYỆT ĐỐI không chạy trên DB có dữ liệu thật; làm migration không phá dữ liệu/test restore. |
| **Sai khác ORM** | API cũ có `users, sessions, tours, schedules, bookings, favorites` với ID chuỗi; Thắm có bảng tên khác và PK INT | Không tái sử dụng model cũ bằng cách chỉ đổi `DATABASE_URL`. |

**Các yêu cầu chưa có mã triển khai xác nhận:** khôi phục mật khẩu, thông báo email, tư vấn/yêu thích lưu server, đặt và hoàn tiền, quản trị phân vai, QA/E2E trên DB thật. Đừng tính chúng là Done.

## 3. API READ-ONLY đã chuẩn bị

Đây là **ứng dụng FastAPI độc lập** tại `API/api/tham_sqlserver_app.py`, chưa bật trong entrypoint chính:

- `GET /api/v1/health/ready` kiểm tra đủ tên 12 bảng trên SQL Server.
- `GET /api/v1/categories`; `GET /api/v1/tours`; `GET /api/v1/tours/{id}`.
- `GET /api/v1/tours/{id}/schedules`, `GET /api/v1/tours/{id}/gallery`, `GET /api/v1/tours/{id}/itinerary`.
- `GET /api/v1/articles`; `GET /api/v1/articles/{id}`.
- `POST /api/v1/bookings/quote`: chỉ báo giá người lớn từ `CHUYENKHOIHANH.GiaThucTe`, không giữ chỗ.
- `POST /api/v1/bookings` và `POST /api/v1/admin/bookings/{id}/confirm-payment` trả **503 có chủ ý**. Auth/payment/booking ghi phải qua review và test trước.

**Lưu ý frontend:** `BAIVIET_QUANGBA.NoiDung` có HTML; trường `contentHtmlUntrusted` phải sanitize khi hiển thị, không chèn trực tiếp `innerHTML`.

## 4. Cách chạy trên máy kiểm thử SQL Server

Cần Microsoft ODBC Driver 18, Python 3.11+, SQL Server instance đã **triển khai schema thật** và tài khoản đọc dữ liệu (không dùng quyền DBA để chạy app).

```powershell
cd API
py -3 -m pip install -r requirements.txt pyodbc
$env:THAM_SQLSERVER_URL='mssql+pyodbc://USER:PASSWORD@HOST:1433/TourDuLichDB?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no'
py -3 -m uvicorn api.tham_sqlserver_app:app --host 127.0.0.1 --port 8010
```

Dùng credentials test qua biến môi trường/secrets, không commit, không gửi lên Zalo. URL-encode thông tin đăng nhập chứa ký tự đặc biệt. Đừng mở cổng DB public cho tất cả địa chỉ. Cấu hình production cần certificate TLS đúng.

Kiểm tra thủ công: `http://127.0.0.1:8010/api/v1/health/ready`, `http://127.0.0.1:8010/docs`.

Mock tests:
```powershell
cd API
py -3 -m pip install pytest httpx
py -3 -m pytest -q tests/test_tham_sqlserver_app.py
```
**Mock test không chứng minh kết nối SQL Server thật.**

## 5. Phối hợp để đóng công việc

1. **Thắm:** chọn engine và chốt ERD, sửa role/favorites/consultation/giữ chỗ/migration; đưa log DB test và cách kết nối an toàn.
2. **Mạnh:** cập nhật API contract/ORM theo dữ liệu đã chốt, bảo mật và booking/payment server-side.
3. **An:** tích hợp các endpoint được xác minh với frontend thật; sanitize HTML bài viết.
4. **Đăng:** chạy E2E/security/concurrency ít nhất 20 request tranh 1 ghế trên database thật.
5. **Phúc:** CI cho DB integration, staging HTTPS, secret management, backup/restore và rollback.

**Trạng thái PR:** mới chỉ tạo cầu nối read-only và mock tests; chưa thể tuyên bố hệ thống tích hợp trọn vẹn, chưa chạy SQL Server thật, chưa deploy.
