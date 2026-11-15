# DELTA TRAVEL NHÓM 6 | RUNBOOK CHỐT BẢO VỆ 16/11/2026

> Trưởng nhóm: Mạnh. Bản này là kiểm kê có kiểm chứng, KHÔNG tự tuyên bố production 100%.

## 1. Các URL đã chạy thực tế

- Trang chính thức giao diện của An, cùng origin với API: https://delta-travel-group6-real-api-staging.onrender.com/
- URL nhóm từng chia sẻ: https://delta-travel-group6-kthp-demo.onrender.com/ . Bản static chuyển sang site trên bằng JavaScript; trang này tự thân KHÔNG có backend.
- API health: https://delta-travel-group6-real-api-staging.onrender.com/api/v1/health/ready
- API danh sách tour: https://delta-travel-group6-real-api-staging.onrender.com/api/v1/tours
- Quản trị: https://delta-travel-group6-real-api-staging.onrender.com/admin.html
- ASP.NET Core MVC staging: https://delta-travel-group6-aspnet-sqlserver.onrender.com/mvc/tours . Đây là hệ thống độc lập, không phải backend đang phục vụ trang chính thức.

## 2. Bằng chứng đã PASS

- Public HTTPS read-only: https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/43656842436 (public HTTP PASS, nhưng durable-data FAIL).
- **Public HTTPS real write**: https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/43657555478 . Account tổng hợp tự tạo, đăng nhập, báo giá, ghi một đơn vào database đang vận hành, truy xuất, chặn IDOR, hủy; không dùng mật khẩu nhóm, không thu tiền thật.
- Chromium E2E trên đúng `booking.html`: https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/43657250304 . Dữ liệu ghi ở SQLite CI dùng một lần, không phải production.
- PostgreSQL 16 integration CI: https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/43657138532 . PostgreSQL dùng riêng trong CI, không phải Render đang dùng.
- ASP.NET Core MVC + SQL Server 2022 trigger E2E CI: https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/42954894161 (PR #30, staging).

## 3. Blocker P0: PostgreSQL bền vững ở website công khai

`/api/v1/health/ready` trong live CI ngày 15/11 báo `storageEngine: sqlite`. Đây là SQLite trên instance Render free, có thể mất dữ liệu khi redeploy hoặc restart. Do đó **chưa được xác nhận phù hợp để nhận khách thật**.

Cần thao tác bảo mật của người có quyền Render (KHÔNG gửi thông tin kết nối cho ChatGPT/nhóm chat):
1. Vào Render Dashboard, mở PostgreSQL `delta-travel-group6-kthp-postgres-test` (ID `dpg-dbk4dpgu01pc739150dg-a`), xác minh trạng thái Available, lấy **Internal Database URL** trong phần Connections và giữ kín. PostgreSQL free **hết hạn ngày 02/12/2026**, nên đây vẫn chỉ là giải pháp cho buổi demo; hệ thống vận hành lâu dài phải nâng cấp hoặc dùng gói lưu trữ không hết hạn.
2. Mở dịch vụ Render `delta-travel-group6-real-api-staging` (ID `srv-dbk4hq49v7es73bmdgvg`) > **Environment**. Tại đây nhập biến `DATABASE_URL` bằng Internal Database URL, và các giá trị không nhạy cảm: `DELTA_ENV=staging`, `STAGING_AUTO_MIGRATE=1`, `AUTO_CREATE_SCHEMA=0`, `DEMO_SEED=1`. **Không đưa URL kết nối vào GitHub, issue, chat hoặc báo cáo.**
3. Để Render redeploy, kiểm tra `/api/v1/health/ready` trả `status:ok`, `storageEngine:postgresql`. Mọi mốc thời gian, số tiền, 12 bảng SQL Server của Thắm không tự động nhập vào Postgres; PostgreSQL là database mô hình FastAPI khác, cần thuyết minh trung thực.
4. Chạy lại Workflow `Public release smoke and persistence gate`, yêu cầu cả hai jobs PASS. Chạy lại `Real public Render booking E2E (synthetic staging data)`, sau đó restart/redeploy và xác nhận đơn hủy vừa tạo vẫn còn trong DB; lúc đó mới có bằng chứng độ bền sau redeploy.
5. Backup và nâng cấp PG free trước **02/12/2026** nếu muốn duy trì dữ liệu lâu dài.

LƯU Ý: Đừng chỉnh `DELTA_ENV=production` khi còn SQLite hoặc `DEMO_SEED=1`; backend sẽ chủ động từ chối khởi động.

## 4. Blocker P0: Admin thật, không dùng mật khẩu mặc định

Danh sách do An gửi là danh sách mong muốn, **không phải bằng chứng tài khoản ADMIN đã tồn tại trong backend**. Mật khẩu cũ yếu và bị lộ qua chat; không dùng để demo internet. Đặc biệt, không thể tự ghi `role:ADMIN` vào localStorage để có quyền quản trị; backend phải xác thực từ DB.

Sau khi nối PostgreSQL, quản trị viên sở hữu DB chạy từ máy đáng tin cậy:
```bash
export DATABASE_URL='[DAN_URL_POSTGRES_NOI_BO_RIENG_TU]'
export DELTA_ADMIN_PROVISION_ACK='I_CONTROL_THIS_DATABASE'
python API/scripts/provision_admin.py --email EMAIL_THAT --name "HO_TEN" --phone SO_DIEN_THOAI
```
Nhập mật khẩu ngẫu nhiên mới (ít nhất 16 ký tự) khi chương trình hỏi, **không truyền trên command line**. Nếu account đã tồn tại, thêm `--reset-existing` để đổi mật khẩu và thu hồi session cũ. Lặp lại cho từng người; phải có email và số điện thoại do người đó xác nhận, không tự bịa. Kiểm tra API `/auth/me` trả role `ADMIN` sau đăng nhập, và `/admin/metrics` trả HTTP 200.

## 5. Blocker P0: tiền thật và SQL Server

- Thanh toán QR, xác nhận chuyển khoản SePay/MB Bank, email OTP và webhook cổng thanh toán **chưa có chuỗi sự kiện độc lập xác minh**. Nút và QR thật đã bị tắt để tránh khách chuyển tiền vào tài khoản cá nhân. Trạng thái `PAID` không được tự đặt từ khách.
- PR #30 MVC trên ASP.NET với Microsoft SQL Server là **một service staging riêng**, đã vượt kiểm thử SQL Server dùng một lần, nhưng chưa nối DB SmarterASP vào service chính. Không gọi đó là database production của website.
- Thắm cần đổi SQL password bị lộ lịch sử Git, cấu hình lại Render Environment (không gửi secret), kiểm tra backup, schema và trigger trước khi test ghi dữ liệu.
- Website hiện hành FastAPI + SQLite/PostgreSQL và ASP.NET MVC/SQL Server staging là **hai stack khác nhau**. Trong báo cáo không nhập nhằng.

## 6. Trình tự demo sáng 16/11

1. Mở URL website cùng origin với backend (phần 1) ở cửa sổ ẩn danh; mở một tour và chọn lịch khởi hành thực sự có chỗ.
2. Đăng ký khách thử với email `@example.test` riêng và mật khẩu đủ mạnh. Không dùng tài khoản quản trị cũ đã lộ.
3. Đặt 1 chỗ, kiểm tra đơn `PENDING_PAYMENT` được server trả về; đọc trang lịch sử đặt tour. Không cần chuyển tiền thật.
4. Kiểm tra người dùng chưa đăng nhập bị 401 khi truy cập đơn; hủy đơn và xem trạng thái `CANCELLED`, kiểm tra số chỗ được hoàn.
5. Trình bày ERD/3NF, Use Case, 7 Activity, Class MVC, chạy CI bằng bằng chứng ở phần 2. Giải thích khác biệt CI SQL vs cloud SQL.
6. Nếu PostgreSQL chưa nối, **nói rõ đây là demo trực tuyến với SQLite tạm**, không tuyên bố lưu bền vững. Nếu thầy yêu cầu test giữ dữ liệu qua restart, dừng ở kết luận chưa đạt.

## 7. Điểm dừng nghiệm thu

Chỉ công bố hệ thống đủ điều kiện vận hành công khai lâu dài khi: kết nối PostgreSQL bền vững đã kiểm chứng; backup/restore chạy; 6 tài khoản admin được tạo và đổi mật khẩu qua backend; frontend/backend integration PASS trên Render; không có thanh toán thật chưa xác thực; chính sách dữ liệu và an toàn đã được rà; có phân tích bảo mật ngoài smoke CI. Không có bất kỳ kết quả test nào bảo đảm tuyệt đối không lỗi.
