# Delta Travel: Backend ASP.NET Core 10 + Microsoft SQL Server

> **Frontend chuẩn của nhóm là bản mới nhất do Lê Văn An phát triển**, lưu tại `Frontend/` (main), được publish ở https://delta-travel-group6-kthp-demo.onrender.com. Dịch vụ ASP.NET này **chỉ là backend độc lập**. Khi người dùng mở đường dẫn gốc ASP.NET, server chuyển về frontend của An. Không thay thế, không chỉnh sửa HTML/CSS/JS của An. API ASP.NET còn cần tích hợp có kiểm thử với frontend và kết nối SQL Server, chưa được tuyên bố đã đặt tour thực tế.

Hệ thống độc lập để trình diễn luồng từ giao diện HTML đến ASP.NET Core, ghi trực tiếp vào SQL Server, không dùng localStorage làm nguồn dữ liệu nghiệp vụ. Dùng đúng 12 bảng trong `DATABASE_SCHEMA.md` của repo nhóm `Tham2007/Quang_ba_va_dat_tour_du_lich`, **không có script thay đổi schema**.

## Bảo mật và trạng thái

- Dùng `Microsoft.Data.SqlClient`, query tham số, password PBKDF2 của `PasswordHasher`, cookie HttpOnly + Secure + SameSite Strict, CSRF header.
- `GET /api/v1/health/ready` kiểm tra có kết nối và có đủ 12 bảng. Khởi động không tự tạo, xóa hoặc migrate bảng nào.
- Đăng ký, đăng nhập, đăng xuất, phiên người dùng, danh sách tour, lịch khởi hành, báo giá server-side.
- Đặt tour nguyên tử trong giao dịch `Serializable` + `UPDLOCK,HOLDLOCK`, giá tiền do server quyết định, ghi hành khách và AuditLog cùng transaction; hủy an toàn chỉ với đơn chưa thanh toán và trước 72 giờ, hoàn ghế một lần.
- `GET /api/v1/updates/schedules/{tourId}` SSE gửi cập nhật khi số chỗ trống thay đổi, đọc SQL Server theo nhịp 5 giây. Không phải WebSocket hay database push thực sự.
- Không có cổng thanh toán thật, không tự xác nhận giao dịch, không tự tạo quyền admin, không chạy stored procedures phá hủy, không chèn credential vào mã.

## Cách chạy

Cài **.NET SDK 10** (Windows/Linux/macOS), và bảo đảm máy có quyền kết nối tới SQL Server. Mở terminal tại thư mục này.

```powershell
$env:SQLSERVER_CONNECTION_STRING = "Server=tcp:YOUR_SQL_HOST,1433;Database=YOUR_DATABASE;User Id=YOUR_USER;Password=YOUR_SECRET;Encrypt=True;TrustServerCertificate=False;Connection Timeout=10;"
dotnet restore
dotnet run
```

Khi phát triển local, dùng URL HTTPS do ASP.NET cung cấp hoặc cấu hình dev HTTPS certificate. Gửi chứng chỉ tự ký tới trình duyệt là thao tác riêng, không tắt mã hóa TLS của kết nối SQL Server để làm cho lỗi biến mất. Trên Render triển khai bằng Dockerfile, đặt `SQLSERVER_CONNECTION_STRING` bằng dashboard secret, bật `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true`, mount persistent volume nếu bật path `DATA_PROTECTION_KEYS_PATH`.

### API

| Method | Route | Ý nghĩa |
|---|---|---|
| GET | `/api/v1/health/live` | Liveness, không bảo đảm database |
| GET | `/api/v1/health/ready` | Kết nối SQL Server, kiểm tra 12 tên bảng |
| GET | `/api/v1/auth/csrf` | Nhận CSRF header token |
| POST | `/api/v1/auth/register` | Tạo tài khoản |
| POST | `/api/v1/auth/login` | Đăng nhập |
| POST | `/api/v1/auth/logout` | Đăng xuất |
| GET | `/api/v1/auth/me` | Phiên hiện tại |
| GET | `/api/v1/tours` | Danh sách tour |
| GET | `/api/v1/tours/{tourId}/schedules` | Lịch, giá, chỗ |
| POST | `/api/v1/bookings/quote` | Báo giá ở máy chủ |
| POST | `/api/v1/bookings` | Đặt tour trong SQL transaction, cần đăng nhập |
| GET | `/api/v1/bookings/me` | Chỉ xem đơn của tài khoản hiện tại |
| POST | `/api/v1/bookings/{bookingId}/cancel` | Hủy an toàn, cần đăng nhập |
| GET | `/api/v1/updates/schedules/{tourId}` | SSE chỗ trống mới |

Website cùng origin nằm ở `/`. Để chạy sau reverse proxy, đảm bảo HTTPS bên ngoài, cookie Secure và hỗ trợ SSE streaming. Lưu ý: dù đã cấu hình connection string, cần chạy test thực tế trên SQL Server trước khi tuyên bố production ready.

## Những điểm chưa được phép tuyên bố đã đạt

1. Không có chứng cứ compile/test ASP.NET tự động trong môi trường tạo bộ mã này vì không có .NET SDK. CI và kiểm thử tích hợp SQL Server thật vẫn bắt buộc.
2. Không có lưu idempotency key bền vững vì schema được khóa đúng 12 bảng và không có cột phù hợp. Double-click từ UI đã chặn cơ bản nhưng **không nên coi là chống tạo trùng tuyệt đối**.
3. Các tài khoản cũ dùng hash khác PBKDF2 phải có phương án nâng cấp mật khẩu được duyệt, không bỏ qua xác thực.
4. Chưa có kết nối VNPay/MoMo/ZaloPay thật, xác nhận thanh toán, hoàn tiền, tác vụ gửi email, quản trị vận hành và retention/session key trên filesystem đã được kiểm chứng.
5. Không được kết nối vào database của hệ thống demo khác, sử dụng token bí mật đã rò rỉ, hoặc chạy script `DROP TABLE` chỉ để web chạy.

Tham khảo `docs/ACCEPTANCE.md` để diễn tập và nhận biết đầy đủ các gate trước khi demo.