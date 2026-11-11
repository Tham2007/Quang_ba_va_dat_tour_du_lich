# BÁO CÁO BACKEND ASP.NET CORE, NHÓM 6

**Ngày chuẩn bị:** 10/11/2026. **Buổi bảo vệ dự kiến:** 11/11/2026.  
**Repository:** https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich  
**PR:** https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/pull/30

## I. Kiến trúc

Người dùng (trình duyệt HTML/JS) ↔ API ASP.NET Core 10 (C#) ↔ Microsoft SQL Server của đồ án (SmarterASP.NET). Toàn bộ thao tác đặt tour phải chạy trên máy chủ. Không dùng localStorage của trình duyệt làm cơ sở dữ liệu giao dịch. Cấu trúc SQL Server gồm 12 bảng nghiệp vụ được giữ nguyên; không phát hành lệnh sửa schema.

## II. Chức năng đã lập trình trong PR

- Tài khoản: đăng ký, đăng nhập bằng mật khẩu PBKDF2, phiên cookie HttpOnly, SameSite Strict, CSRF, giới hạn tốc độ thử đăng nhập.
- Danh mục tour và lịch khởi hành: truy vấn SQL Server có tham số; danh sách giá và chỗ trống lấy từ database.
- Đặt tour: server tự tính giá, transaction SERIALIZABLE, khóa row bằng UPDLOCK/HOLDLOCK để tránh hai request cùng đặt vượt sức chứa, ghi đồng thời DATTOUR, CHITIET_HANHKHACH, AUDITLOG; lỗi làm rollback.
- Hủy đơn: chỉ khách sở hữu đơn mới được phép thao tác; các đơn chưa thanh toán hợp lệ được hoàn chỗ đúng một lần.
- Gần thời gian thực: SSE gửi số chỗ thay đổi tới trình duyệt, với chu kỳ kiểm tra database khoảng 5 giây.
- Health checks: liveness tách biệt readiness; khi thiếu DB hoặc schema không khớp thì readiness trả HTTP 503.

## III. Bằng chứng kiểm tra

- GitHub Actions đã PASS **.NET restore, build, publish**, sử dụng .NET 10.
- Docker build đã PASS sau khi sửa lỗi đưa thư mục `obj` từ máy host vào image.
- Container HTTP smoke test đã PASS: `/api/v1/health/live` trả 200; `/api/v1/health/ready` trả 503 khi không có connection string.
- Script kiểm tra tĩnh và cú pháp JavaScript đã PASS.
- Các kết quả trên **không chứng minh đã kiểm thử kết nối hoặc ghi dữ liệu trên SQL Server thật**.

## IV. Trạng thái còn phải hoàn tất trước khi công bố cho khách thật

1. Thiết lập `SQLSERVER_CONNECTION_STRING` dưới dạng hosting secret, xác minh TLS, kết nối và quyền bảng tại đúng database `db_ad0b71_dattour`. Không chia sẻ mật khẩu qua code/repo/chat.
2. Backup và chạy E2E tạo đơn/hủy/đồng thời/SSE trên môi trường kiểm thử được cho phép; kiểm tra số chỗ trước và sau trong SQL.
3. Triển khai lên domain HTTPS và kiểm tra khả năng truy cập thực tế từ bên ngoài.
4. Kết nối giao diện thiết kế của An với API ASP.NET, thay luồng localStorage và các trạng thái thanh toán giả.
5. Bổ sung tích hợp cổng thanh toán thật và đối soát, idempotency key lưu bền vững, cơ chế timeout/hoàn tiền nếu rubric yêu cầu. Không tự xác nhận thành công một khoản tiền chỉ dựa trên redirect hoặc nút bấm của người dùng.

## V. Kịch bản trình bày trước giảng viên

**Bước 1:** Giới thiệu API ASP.NET Core và CSDL SQL Server 12 bảng, xác nhận không sửa schema.  
**Bước 2:** Mở trang demo, tải danh sách tour/lịch từ API.  
**Bước 3:** Đăng ký/đăng nhập, tạo đơn cho 2 khách, sau đó đối chiếu đơn trên database (chỉ khi SQL Server live đã xác minh).  
**Bước 4:** Đặt cùng chuyến trên cửa sổ khác để chứng minh cập nhật SSE, thử hủy để kiểm tra ghế được trả đúng một lần.  
**Bước 5:** Cho xem GitHub Actions: restore/build/publish/Docker/HTTP smoke. Trình bày rõ các gate chưa đạt, không nói production-ready khi chưa kiểm thử DB.