# Checklist bảo vệ, ASP.NET Core + SQL Server

## Gate hệ thống
- [ ] `dotnet restore`, `dotnet build -c Release`, `dotnet publish -c Release` PASS trên máy có .NET 10.
- [ ] Docker build và chạy thành công.
- [ ] `/api/v1/health/live` trả 200, `/api/v1/health/ready` trả 200 khi và chỉ khi dùng đúng database dự án.
- [ ] `SQLSERVER_CONNECTION_STRING` lưu dưới hosting environment/secrets, không in trong log, không commit.
- [ ] Backup database trước khi chạy test ghi dữ liệu. Dùng tài khoản thử với quyền SQL tối thiểu.
- [ ] HTTPS, data-protection keys tồn tại sau restart; đăng nhập không bị lỗi tự nhiên qua lần deploy.

## Gate nghiệp vụ với dữ liệu giả
- [ ] Đăng ký khách mới, cookie đăng nhập nhận được, logout thành công.
- [ ] Cookie thiếu hoặc sai CSRF bị từ chối ghi dữ liệu.
- [ ] Tour và lịch đọc từ 12 bảng SQL Server đang có, không đọc localStorage/SQLite.
- [ ] Báo giá, tạo đơn 2 khách, bảng DATTOUR + CHITIET_HANHKHACH + AUDITLOG ghi đúng.
- [ ] 2 browser đặt đồng thời chỗ cuối: một nhận đơn, một nhận SOLD_OUT, tổng chỗ không vượt mức.
- [ ] Hủy đơn hợp lệ giảm SoChoDaDat đúng một lần, gọi hủy lần 2 không giảm tiếp.
- [ ] Khách A không xem/hủy được đơn khách B.
- [ ] SSE thay đổi số chỗ trên browser B sau khi browser A tạo/hủy đơn.
- [ ] Nếu mất SQL Server, API trả 503 rõ ràng, không giả thành công.
- [ ] Không có nút tự xác nhận thanh toán nếu chưa xác minh ngân hàng.

## Gate triển khai internet
- [ ] Dịch vụ Render/hosting có URL HTTPS thực tế kiểm tra được từ bên ngoài.
- [ ] Cấu hình network/firewall SmarterASP cho phép nguồn IP backend và SQL Server bắt buộc mã hóa.
- [ ] Kiểm thử trên Chrome/Edge + mobile, duyệt một đơn và xem dữ liệu được giữ sau refresh/restart.
- [ ] Báo cáo minh chứng được trích từ CI/log/test thật, không ghi 100% PASS nếu chưa chạy.

## Những câu trả lời kỹ thuật trước giảng viên
- Dữ liệu tour và đặt chỗ đến từ Microsoft SQL Server, không phải JSON giả ở browser.
- `UPDLOCK` giúp serialize chỉnh sửa ghế của cùng chuyến, transaction đảm bảo hoặc ghi đủ đơn và cập nhật kho, hoặc rollback.
- Tại sao máy chủ quyết định giá: không tin số tiền gửi từ trình duyệt.
- SSE truyền sự thay đổi tồn kho tới các trình duyệt khác; server vẫn truy vấn SQL định kỳ 5 giây, không phải push trực tiếp từ DB.
- Không cho phép khách tự gọi API đánh dấu đơn đã thanh toán.