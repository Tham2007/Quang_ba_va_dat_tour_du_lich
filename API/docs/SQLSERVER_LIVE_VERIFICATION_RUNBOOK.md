# Chạy kiểm chứng kết nối SQL Server 12 bảng của Thắm

**Mục tiêu:** kiểm tra SQL Server thật **không ghi/xóa/chỉnh DB**. Bộ kiểm thử mô phỏng CI xanh **không thay thế** bước này.

## 1. Điều kiện cần

- Thắm xác nhận SQL Server là engine chính, schema 12 bảng đã được triển khai trên database **test riêng**. Không chạy `DROP DATABASE` trên DB có dữ liệu.
- Máy kiểm thử có Python 3.11+, Microsoft ODBC Driver 18 for SQL Server, truy cập mạng/TLS tới host SQL Server.
- Tạo tài khoản SQL Server **chỉ có quyền SELECT** cho schema `dbo`, không dùng `sa`/DBA. Không gửi mật khẩu trong GitHub, Zalo, issue, ảnh terminal hoặc log CI.
- Schema phải có `NGUOIDUNG`, `DANHMUC`, `TOUR`, `HINHANH_TOUR`, `LICH_TRINH_DETAIL`, `CHUYENKHOIHANH`, `DATTOUR`, `CHITIET_HANHKHACH`, `THANHTOAN`, `DANHGIA`, `BAIVIET_QUANGBA`, `AUDITLOG`. File kiểm tra so cả các cột phục vụ API.

## 2. Chạy bằng Windows PowerShell (từ thư mục gốc repository)

```powershell
cd API
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt pyodbc pytest httpx
# Cài Microsoft ODBC Driver 18 trước nếu chưa có.
# Điền URL dev/test vào MÔI TRƯỜNG CỦA MÁY, không ghi vào source hay chat.
$env:THAM_SQLSERVER_URL='mssql+pyodbc://USER:PASSWORD@HOST:1433/TourDuLichDB?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no'
.\.venv\Scripts\python.exe -m scripts.check_tham_sqlserver
```

Giá trị mẫu cần thay bằng thông tin DB test hợp lệ, URL-encode ký tự đặc biệt trong USER/PASSWORD. Cần cấu hình certificate TLS SQL Server được tin cậy; không dùng `TrustServerCertificate=yes` ở production.

Kết quả `status: READ_ONLY_OK` **chỉ xác minh kết nối, các cột cần đọc và khả năng đọc tour**, không xác nhận đăng nhập, đặt/hủy, thanh toán hay concurrent booking. `SCHEMA_INCOMPLETE` nêu bảng/cột còn thiếu; `NOT_CONNECTED` nghĩa là phải sửa môi trường/cấu hình/driver trước.

Không chụp ảnh biến môi trường chứa credentials. Chỉ gửi lên nhóm JSON output **đã kiểm tra không có bí mật** từ `check_tham_sqlserver`.

## 3. Chạy dịch vụ chỉ đọc và kiểm tra API

```powershell
.\.venv\Scripts\python.exe -m uvicorn api.tham_sqlserver_app:app --host 127.0.0.1 --port 8010
```

Trên chính máy đó, truy cập `http://127.0.0.1:8010/api/v1/health/ready` và `http://127.0.0.1:8010/docs`; kiểm tra `GET /api/v1/categories`, `GET /api/v1/tours`, tour gallery/itinerary/schedules. Chọn chuyến thật rồi `POST /api/v1/bookings/quote` để đối chiếu giá server. **Không thử API tạo đơn/thanh toán**, chúng cố ý trả 503.

## 4. Hai nhóm kiểm thử độc lập

**Mock, chạy được khi chưa có DB**:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_tham_sqlserver_app.py tests/test_tham_sqlserver_checker.py
```

**Thật, cần môi trường của Thắm**: script trên + lưu mã commit đang test, kết quả 12 bảng/cột, HTTP responses và số tour thực sự nhìn thấy (không lấy thông tin cá nhân).

## 5. Khi nào tính xong việc T17?

T17 **chưa Done** khi chỉ có mock CI. T17 chỉ xong khi dữ liệu T-SQL schema đã được duyệt, `check_tham_sqlserver` đạt `READ_ONLY_OK`, chạy API thật với đúng `THAM_SQLSERVER_URL`, các UC còn lại (auth, booking, payment) đã tích hợp an toàn, test Postgres/SQL Server theo quyết định ADR, PR và evidence được review. Cần Đăng test phân quyền, concurrency, trạng thái đơn; Phúc xác nhận staging.

Không trộn `DATABASE_URL` legacy ORM với `THAM_SQLSERVER_URL`: ORM cũ phải từ chối SQL Server schema khác.
