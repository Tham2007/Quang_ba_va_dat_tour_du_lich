# BẢNG ĐỐI CHIẾU THÀNH PHẦN KIẾN TRÚC VỚI SOURCE CODE THỰC TẾ
## ĐỀ TÀI: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH – DELTA TRAVEL
### SƠ ĐỒ KIẾN TRÚC PHÂN TẦNG KẾT HỢP MÔ HÌNH MVC CỦA HỆ THỐNG DELTA TRAVEL

---

## 1. BẢNG ĐỐI CHIẾU CHI TIẾT TỪNG THÀNH PHẦN VỚI FILE SOURCE CODE

| STT | Thành phần trên sơ đồ MVC | File / Thư mục vật lý thực tế trong repository | Chức năng & Trách nhiệm thực tế trong hệ thống | Kết luận kiểm tra |
|:---:|:---|:---|:---|:---:|
| **I** | **TẦNG VIEW (FRONTEND TIER)** | | | |
| 1 | `index.html` (Home & Catalog View) | `Frontend/index.html` | Trang chủ: Banner 3D Hero, bộ lọc tour đa tiêu chí, lưới thẻ tour, modal lịch trình và modal đăng nhập/đăng ký. | **Chính xác 100% (Khớp code)** |
| 2 | `booking.html` (Checkout View) | `Frontend/booking.html` | Trang đặt tour: tóm tắt chuyến đi, form nhập danh sách hành khách, modal VietQR động và vùng upload bill. | **Chính xác 100% (Khớp code)** |
| 3 | `my-bookings.html` (My Bookings View) | `Frontend/my-bookings.html` | Trang quản lý đơn hàng của tôi: danh sách tour đã đặt, tra cứu vé điện tử, modal gửi yêu cầu đổi/hủy tour. | **Chính xác 100% (Khớp code)** |
| 4 | `admin.html` (Admin Dashboard View) | `Frontend/admin.html` | Cổng quản trị tập trung: thống kê KPI doanh thu, CRUD tour, duyệt đơn đặt tour, đối soát VietQR, xem AUDITLOG. | **Chính xác 100% (Khớp code)** |
| **II** | **TẦNG CLIENT CONTROLLER (FRONTEND)** | | | |
| 5 | `main.js` | `Frontend/assets/js/controllers/main.js` | Điều phối DOM trang chủ: bắt sự kiện lọc tour, render danh sách thẻ tour ra DOM, mở modal chi tiết, chuyển sang booking.html. | **Chính xác 100% (Khớp code)** |
| 6 | `auth.js` | `Frontend/assets/js/controllers/auth.js` | Điều phối xác thực client: bắt sự kiện submit form đăng ký/đăng nhập, lưu trữ session/cookie, cập nhật trạng thái Header. | **Chính xác 100% (Khớp code)** |
| 7 | `admin.js` | `Frontend/assets/js/controllers/admin.js` | Điều phối giao diện quản trị: xử lý thêm/sửa/xóa tour và đợt khởi hành, duyệt đơn đặt vé, gửi yêu cầu đối soát thanh toán. | **Chính xác 100% (Khớp code)** |
| 8 | `chatbot.js` | `Frontend/assets/js/controllers/chatbot.js` | Điều phối trợ lý AI ảo: mở/đóng khung chat, bắt sự kiện gửi tin nhắn và hiển thị phản hồi từ assistant endpoint. | **Chính xác 100% (Khớp code)** |
| **III** | **TẦNG CLIENT SERVICE & MODEL (FRONTEND)** | | | |
| 9 | `api.js` (API Gateway Client) | `Frontend/assets/js/services/api.js` | Lớp dịch vụ mạng gọi Fetch API: cấu hình Base URL `/api/v1/`, tự động đính kèm credentials cookie và bắt lỗi mạng. | **Chính xác 100% (Khớp code)** |
| 10 | `vietqr-service.js` | `Frontend/assets/js/services/vietqr-service.js` | Thuật toán tạo URL và chuỗi mã QR ngân hàng chuẩn NAPAS/VietQR động dựa trên mã booking và số tiền. | **Chính xác 100% (Khớp code)** |
| 11 | `ticket-invoice-service.js` | `Frontend/assets/js/services/ticket-invoice-service.js` | Dịch vụ xuất hóa đơn điện tử và vé tour điện tử cho khách hàng sau khi thanh toán thành công. | **Chính xác 100% (Khớp code)** |
| 12 | `data.js` & LocalStorage | `Frontend/assets/js/models/data.js` | Client Model: lưu trữ bộ nhớ đệm danh mục vùng miền, danh sách tour tĩnh và trạng thái phiên đăng nhập. | **Chính xác 100% (Khớp code)** |
| **IV** | **TẦNG API ROUTER (BACKEND FASTAPI)** | | | |
| 13 | `routes/auth.py` | `API/api/routes/auth.py` | Khai báo các endpoint xác thực: `/api/v1/auth/register`, `/login`, `/me`, `/logout`. Không chứa logic nghiệp vụ. | **Chính xác 100% (Khớp code)** |
| 14 | `routes/tours.py` | `API/api/routes/tours.py` | Khai báo các endpoint tra cứu tour: `/api/v1/tours`, `/tours/{id}`, `/tours/{id}/schedules`, `/tours/{id}/itinerary`. | **Chính xác 100% (Khớp code)** |
| 15 | `routes/bookings.py` | `API/api/routes/bookings.py` | Khai báo các endpoint đơn hàng: `/api/v1/bookings`, `/bookings/my`, `/bookings/{id}/cancel`, `/bookings/{id}/pay`. | **Chính xác 100% (Khớp code)** |
| 16 | `routes/admin.py` | `API/api/routes/admin.py` | Khai báo các endpoint quản trị: `/api/v1/admin/tours`, `/admin/bookings`, `/admin/reports`, `/admin/audit-logs`. | **Chính xác 100% (Khớp code)** |
| **V** | **TẦNG CONTROLLER (BACKEND FASTAPI)** | | | |
| 17 | `auth_controller.py` | `API/api/controllers/auth_controller.py` | HTTP boundary: tiếp nhận DTO đăng ký/đăng nhập, kiểm tra xác thực, gọi auth_service và cấp phát cookie JWT. | **Chính xác 100% (Khớp code)** |
| 18 | `tour_controller.py` | `API/api/controllers/tour_controller.py` | Tiếp nhận tham số lọc tour từ query params, gọi tour_service để lấy danh sách tour và chi tiết lịch trình. | **Chính xác 100% (Khớp code)** |
| 19 | `booking_controller.py` | `API/api/controllers/booking_controller.py` | Tiếp nhận đơn đặt tour, kiểm tra Idempotency Key, gọi booking_service kiểm tra sức chứa và trả về DTO đơn hàng. | **Chính xác 100% (Khớp code)** |
| 20 | `admin_controller.py` | `API/api/controllers/admin_controller.py` | Kiểm tra quyền Admin (`Depends(me)`), điều phối thêm/sửa/xóa tour, duyệt đơn đặt tour và tổng hợp báo cáo. | **Chính xác 100% (Khớp code)** |
| **VI** | **TẦNG SERVICE (BACKEND FASTAPI - BUSINESS LOGIC)** | | | |
| 21 | `booking_service.py` | `API/api/services/booking_service.py` | Xử lý quy tắc nghiệp vụ lữ hành: `place_booking()`, `ensure_capacity()` (chống Overbooking), `totals()`, `sweep()`. | **Chính xác 100% (Khớp code)** |
| 22 | `auth_service.py` | `API/api/services/auth_service.py` | Xử lý nghiệp vụ bảo mật: `credentials_match()`, mã hóa mật khẩu Scrypt + Salt ngẫu nhiên, tạo session token. | **Chính xác 100% (Khớp code)** |
| 23 | `tour_service.py` | `API/api/services/tour_service.py` | Xử lý nghiệp vụ hiển thị tour: `public_tour()`, bóc tách gallery ảnh, tính số chỗ khả dụng trên từng chuyến (`availability()`). | **Chính xác 100% (Khớp code)** |
| 24 | `payment_service.py` | `API/api/services/payment_service.py` | Xử lý nghiệp vụ thanh toán: đối soát số tiền chuyển khoản, kiểm tra chống trùng lặp mã giao dịch (`payment_reference_used`). | **Chính xác 100% (Khớp code)** |
| 25 | `admin_service.py` | `API/api/services/admin_service.py` | Xử lý nghiệp vụ quản trị: tổng hợp báo cáo doanh thu tháng (`aggregate_monthly_revenue`), bóc tách bản ghi đơn hàng. | **Chính xác 100% (Khớp code)** |
| **VII** | **TẦNG REPOSITORY (BACKEND FASTAPI - DATA ACCESS)** | | | |
| 26 | `booking_repository.py` | `API/api/repositories/booking_repository.py` | Thực thi truy vấn SQLAlchemy cho đơn hàng: `find_by_idempotency()`, `lock_booking_for_owner()`, `list_bookings_for_user()`. | **Chính xác 100% (Khớp code)** |
| 27 | `schedule_repository.py` | `API/api/repositories/schedule_repository.py` | Khóa bản ghi chuyến khởi hành (`lock_schedule`) bằng câu lệnh `with_for_update()` để chống tranh chấp đồng thời. | **Chính xác 100% (Khớp code)** |
| 28 | `tour_repository.py` | `API/api/repositories/tour_repository.py` | Thực thi truy vấn lọc tour đa tiêu chí (`search_public_tours`) tham số hóa chống SQL Injection. | **Chính xác 100% (Khớp code)** |
| 29 | `user_repository.py` | `API/api/repositories/user_repository.py` | Thực thi truy vấn người dùng: `find_user_by_email()`, `user_conflict()` (kiểm tra trùng lặp email/SĐT). | **Chính xác 100% (Khớp code)** |
| **VIII** | **TẦNG MODEL & SCHEMA (TÁCH BIỆT RÕ RÀNG)** | | | |
| 30 | SQLAlchemy ORM Entities | `API/api/models/` (`user.py`, `tour.py`, `schedule.py`, `booking.py`, `tour_detail.py`, `audit.py`, `favorite.py`) | Định nghĩa các lớp thực thể ORM kế thừa từ `Base` ánh xạ tới các bảng CSDL: `User`, `Tour`, `TourSchedule`, `Booking`, `AuditLog`. | **Chính xác 100% (Khớp code)** |
| 31 | Pydantic Schemas (DTOs) | `API/api/schemas/` (`auth_schema.py`, `tour_schema.py`, `booking_schema.py`) | Định nghĩa hợp đồng dữ liệu DTO: kiểm tra hợp lệ dữ liệu đầu vào (Validation) và serialize dữ liệu đầu ra dạng JSON. Không phải bảng DB. | **Chính xác 100% (Khớp code)** |
| **IX** | **TẦNG CƠ SỞ DỮ LIỆU (MICROSOFT SQL SERVER - ĐÚNG 12 BẢNG 3NF)** | | | |
| 32 | `dbo.NGUOIDUNG` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng lưu trữ tài khoản người dùng, email, số điện thoại, mật khẩu băm, vai trò. | **Chính xác 100% (Khớp code)** |
| 33 | `dbo.DANHMUC` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng phân loại danh mục tour theo các vùng miền địa lý (Bắc, Trung, Nam, Tây Nguyên). | **Chính xác 100% (Khớp code)** |
| 34 | `dbo.TOUR` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng sản phẩm tour cốt lõi chứa thông tin lộ trình cố định, giá gốc, số ngày đêm. | **Chính xác 100% (Khớp code)** |
| 35 | `dbo.HINHANH_TOUR` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng lưu trữ gallery hình ảnh chụp thực tế đa góc nhìn cho từng tour. | **Chính xác 100% (Khớp code)** |
| 36 | `dbo.LICH_TRINH_DETAIL` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng bóc tách hoạt động cụ thể từng ngày của tour (Day 1, Day 2,...). | **Chính xác 100% (Khớp code)** |
| 37 | `dbo.CHUYENKHOIHANH` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng quản lý đợt khởi hành cụ thể, ngày đi, ngày về, giá vé, số chỗ tối đa và đã đặt. | **Chính xác 100% (Khớp code)** |
| 38 | `dbo.DATTOUR` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng đơn đặt chỗ của khách hàng, mã booking duy nhất `BK...`, trạng thái đơn hàng. | **Chính xác 100% (Khớp code)** |
| 39 | `dbo.CHITIET_HANHKHACH` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng danh sách hành khách thực tế đi kèm (Họ tên, ngày sinh, loại khách, CCCD/Passport). | **Chính xác 100% (Khớp code)** |
| 40 | `dbo.THANHTOAN` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng lưu trữ thông tin đối soát giao dịch VietQR, số tiền, ngày giờ, ảnh biên lai. | **Chính xác 100% (Khớp code)** |
| 41 | `dbo.DANHGIA` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng đánh giá nhận xét và chấm điểm sao của khách sau khi hoàn thành chuyến đi. | **Chính xác 100% (Khớp code)** |
| 42 | `dbo.BAIVIET_QUANGBA` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng bài viết cẩm nang quảng bá văn hóa, điểm đến du lịch thu hút du khách. | **Chính xác 100% (Khớp code)** |
| 43 | `dbo.AUDITLOG` | `database/database/01_schema/02_create_tables_3nf.sql` | Bảng nhật ký kiểm toán hệ thống bất biến lưu vết các thao tác thay đổi dữ liệu nhạy cảm. | **Chính xác 100% (Khớp code)** |
| **X** | **TRIGGERS & STORED PROCEDURES THỰC TẾ TRONG CSDL** | | | |
| 44 | `TRG_DATTOUR_CheckAndLockSeats` | `database/database/04_programmability/01_triggers_booking_inventory.sql` | Trigger CSDL: Tự động kiểm tra số chỗ và khóa chỗ hoặc Rollback khi hết chỗ (chống Overbooking). | **Chính xác 100% (Khớp code)** |
| 45 | `TRG_DATTOUR_HandleCancellation` | `database/database/04_programmability/01_triggers_booking_inventory.sql` | Trigger CSDL: Tự động hoàn trả số chỗ trống vào bảng CHUYENKHOIHANH khi đơn hàng bị hủy. | **Chính xác 100% (Khớp code)** |
| 46 | `TRG_DANHGIA_CheckCompletedTour` | `database/database/04_programmability/01_triggers_booking_inventory.sql` | Trigger CSDL: Kiểm tra ràng buộc chỉ cho phép gửi đánh giá khi đơn hàng ở trạng thái HOAN_THANH. | **Chính xác 100% (Khớp code)** |
| 47 | `sp_TaoDonDatTour` | `database/database/04_programmability/02_stored_procedures_booking.sql` | Stored Procedure: Tạo đơn đặt tour an toàn trong giao dịch SERIALIZABLE. | **Chính xác 100% (Khớp code)** |
| 48 | `sp_XacNhanThanhToanDonTour` | `database/database/04_programmability/02_stored_procedures_booking.sql` | Stored Procedure: Cập nhật trạng thái thanh toán và chốt vé cho khách hàng. | **Chính xác 100% (Khớp code)** |
| 49 | `sp_HuyDonDatTour` | `database/database/04_programmability/02_stored_procedures_booking.sql` | Stored Procedure: Hủy đơn đặt tour và hoàn trả lại số chỗ trống an toàn. | **Chính xác 100% (Khớp code)** |
| 50 | `sp_ThongKeDoanhThuVaDonHang` | `database/database/04_programmability/03_stored_procedures_reports.sql` | Stored Procedure: Tổng hợp số liệu doanh thu và số lượng đơn đặt phục vụ báo cáo Admin. | **Chính xác 100% (Khớp code)** |

---

## 2. GIẢI THÍCH NGẮN GỌN LUỒNG HOẠT ĐỘNG CỦA KIẾN TRÚC

Toàn bộ hệ thống vận hành theo chu trình khép kín hai chiều (Bidirectional Pipeline) qua 8 bước:

1. **Thao tác giao diện (View):** Người dùng tương tác trên các trang giao diện HTML5 (`index.html`, `booking.html`).
2. **Điều phối sự kiện (Client Controller):** JavaScript (`main.js`, `auth.js`) lắng nghe sự kiện DOM, kiểm tra tính hợp lệ của dữ liệu form đầu vào (Client Validation).
3. **Gửi yêu cầu mạng (Client Service):** `api.js` đóng gói dữ liệu thành đối tượng JSON và phát lệnh HTTP Request bất đồng bộ (Fetch API) qua môi trường mạng.
4. **Định tuyến (API Router):** Cửa ngõ Backend (`api/routes/`) đón nhận URL path và phương thức HTTP, chuyển giao trực tiếp cho Controller tương ứng.
5. **Điều phối HTTP (Backend Controller):** Controller (`api/controllers/`) kiểm tra quyền hạn định danh (`Depends(me)`), xác thực cấu trúc dữ liệu qua Pydantic Schemas, và gọi tầng Service.
6. **Xử lý nghiệp vụ lữ hành (Service Layer):** Tầng Service (`api/services/`) thực thi các quy tắc nghiệp vụ: tính giá tour theo độ tuổi, kiểm tra sức chứa chuyến đi, mở giao dịch chống Overbooking.
7. **Truy xuất CSDL (Repository Layer & ORM):** Repository (`api/repositories/`) thực thi truy vấn thông qua các Entity ORM SQLAlchemy (`api/models/`), phát lệnh T-SQL kết nối tới Microsoft SQL Server.
8. **Thực thi CSDL & Luồng phản hồi ngược lại (Database Tier & Reverse Flow):**
   - Microsoft SQL Server thực thi câu lệnh, kích hoạt Trigger `TRG_DATTOUR_CheckAndLockSeats` kiểm tra số chỗ và khóa dòng.
   - Kết quả phản hồi ngược theo chiều mũi tên đứt đoạn: `SQL Server` → `Repository / ORM` → `Service` (trả về DTO kết quả hoặc ném ngoại lệ nếu hết chỗ) → `Backend Controller` → `API Router` → `Client Service (api.js)` → `Client Controller (main.js)` → `View (Cập nhật DOM & Mở modal VietQR thanh toán)`.
