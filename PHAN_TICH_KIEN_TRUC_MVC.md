# BÁO CÁO PHÂN TÍCH KIẾN TRÚC PHẦN MỀM THỰC TẾ (MVC & LAYERED ARCHITECTURE)
## ĐỀ TÀI: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN – DELTA TRAVEL

---

## 1. TỔNG QUAN VÀ BẢN CHẤT KIẾN TRÚC CỦA HỆ THỐNG DELTA TRAVEL

Qua khảo sát và rà soát toàn bộ source code trong repository thực tế, hệ thống **Delta Travel** không sử dụng mô hình MVC kinh điển một khối (Monolithic Desktop MVC dạng Smalltalk), mà được tổ chức theo mô hình **Kiến trúc Phân tầng kết hợp MVC trên nền tảng Web phân tán (Distributed Web Layered MVC Architecture)**.

Mô hình này phân định ranh giới vật lý và logic rõ rệt giữa hai đầu mút Client và Server qua môi trường mạng Internet:
- **Phía Frontend (Client-side):** Hoạt động trên trình duyệt người dùng, áp dụng mô hình **Client-side MVC/MVP** bằng JavaScript thuần hiện đại kết hợp CSS3 hiệu ứng kính mờ (Liquid Glass).
- **Giao thức liên kết (Network / API Gateway):** Giao tiếp bất đồng bộ thông qua **HTTP/HTTPS RESTful API**, định dạng trao đổi dữ liệu chuẩn **JSON**, quản lý phiên và bảo mật thông qua cặp Cookie an toàn (`HttpOnly, SameSite=Lax, Secure`) hoặc Bearer Token.
- **Phía Backend (Server-side):** Xây dựng trên nền tảng **FastAPI (Python)**, áp dụng mẫu thiết kế **Layered Architecture (Kiến trúc phân lớp chuẩn doanh nghiệp)** kết hợp MVC nhằm phân tách triệt để trách nhiệm (Separation of Concerns - SoC):
  - *Route Layer (`api/routes/`):* Khai báo URL và phương thức HTTP (không chứa logic nghiệp vụ).
  - *Controller Layer (`api/controllers/`):* Ranh giới tiếp nhận HTTP, kiểm tra ủy quyền (Guards), trích xuất DTO và điều phối.
  - *Service Layer (`api/services/`):* Xử lý quy tắc nghiệp vụ lữ hành (Business Rules), tính giá tour, kiểm soát sức chứa và chống Overbooking.
  - *Repository Layer (`api/repositories/`):* Lớp trừu tượng hóa truy xuất dữ liệu (Data Access Object - DAO) với SQLAlchemy ORM.
  - *Model & Schema Layer (`api/models/` & `api/schemas/`):* Định nghĩa các thực thể dữ liệu ORM và hợp đồng dữ liệu Pydantic (Data Transfer Objects - DTOs).
- **Phía Cơ sở dữ liệu (Database Tier):** Hệ quản trị CSDL quan hệ **Microsoft SQL Server** với 12 bảng chuẩn 3NF, bảo vệ toàn vẹn bằng hệ thống ràng buộc Khóa chính (PK), Khóa ngoại (FK), Ràng buộc CHECK và Trigger kiểm soát sức chứa (`TRG_DATTOUR_CheckAndLockSeats`).

---

## 2. PHÂN TÍCH CHI TIẾT CÁC TẦNG TRONG MÔ HÌNH KIẾN TRÚC

```
+-----------------------------------------------------------------------------------------+
|                  1. FRONTEND TIER (Client-Side MVC trên Trình duyệt Web)                 |
|  [VIEW: index.html, booking.html, my-bookings.html, admin.html + CSS3 Liquid Glass]     |
|  [CONTROLLER: main.js, auth.js, admin.js, chatbot.js]                                   |
|  [SERVICE & MODEL: api.js, vietqr-service.js, data.js, LocalStorage]                    |
+-----------------------------------------------------------------------------------------+
       |                                                                           ^
       | [HTTP Request: JSON Payload / Params]                                     | [HTTP Response: JSON DTOs]
       v                                                                           |
+-----------------------------------------------------------------------------------------+
|                  2. GIAO THỨC TRUYỀN THÔNG (HTTP/HTTPS RESTful API)                     |
+-----------------------------------------------------------------------------------------+
       |                                                                           ^
       | [Dispatch Request tới Router]                                             | [Stream Response]
       v                                                                           |
+-----------------------------------------------------------------------------------------+
|                  3. BACKEND TIER (FastAPI Server-Side Layered MVC)                      |
|  - ROUTE LAYER: routes/auth.py, tours.py, bookings.py, admin.py                         |
|  - CONTROLLER LAYER: auth_controller, tour_controller, booking_controller, admin_...     |
|  - SERVICE LAYER: auth_service, tour_service, booking_service, payment_service           |
|  - REPOSITORY LAYER: user_repository, tour_repository, schedule_repository, booking_... |
|  - MODEL & SCHEMA: SQLAlchemy ORM Entities (User, Tour, Booking...) + Pydantic DTOs    |
+-----------------------------------------------------------------------------------------+
       |                                                                           ^
       | [T-SQL / LINQ Query qua PyODBC]                                           | [Raw Data / Trigger Feedback]
       v                                                                           |
+-----------------------------------------------------------------------------------------+
|                  4. DATABASE TIER (Microsoft SQL Server - 12 Bảng 3NF)                  |
|  NGUOIDUNG, DANHMUC, TOUR, HINHANH_TOUR, LICH_TRINH_DETAIL, CHUYENKHOIHANH, DATTOUR,   |
|  CHITIET_HANHKHACH, THANHTOAN, DANHGIA, BAIVIET_QUANGBA, AUDITLOG + TRIGGERS           |
+-----------------------------------------------------------------------------------------+
```

### 2.1. Tầng Hiển thị phía Client (Frontend View Layer)
Tầng View tồn tại thực tế tại thư mục `Frontend/` gồm 4 màn hình HTML5 chính được thiết kế đồng bộ với CSS3:
1. **`index.html` (Trang chủ & Danh mục tour):**
   - Chứa khung Banner Hero tương tác xoay 3D (`assets/css/hero-3d.css`).
   - Bộ thanh tìm kiếm nhanh và dropdown lọc tour đa tiêu chí (`assets/css/hero-search.css`).
   - Lưới hiển thị danh sách các thẻ tour du lịch (`assets/css/tour-cards.css`).
   - Modal hiển thị chi tiết lộ trình từng ngày và bộ sưu tập ảnh gallery.
   - Modal Đăng nhập / Đăng ký tài khoản người dùng (`assets/css/auth.css`).
2. **`booking.html` (Trang Đặt tour & Nhập hành khách):**
   - Bảng tóm tắt thông tin chuyến đi đã chọn, bảng giá chi tiết theo độ tuổi.
   - Form thu thập danh sách chi tiết từng hành khách (Họ tên, ngày sinh, giới tính, CCCD/Passport) để phục vụ lập danh sách bảo hiểm du lịch.
   - Modal hiển thị mã thanh toán VietQR động chuẩn NAPAS kèm đồng hồ đếm ngược 15 phút.
   - Khu vực upload ảnh minh chứng thanh toán (biên lai ủy nhiệm chi).
3. **`my-bookings.html` (Trang Lịch sử đơn đặt của khách hàng):**
   - Danh sách các đơn đặt tour gắn liền với tài khoản đã đăng nhập.
   - Xem chi tiết vé điện tử, mã đặt chỗ (`BK...`), và trạng thái thanh toán.
   - Modal gửi yêu cầu đổi / hủy tour kèm lý do hủy.
4. **`admin.html` (Cổng Quản trị tập trung - Admin Dashboard):**
   - Bảng tổng hợp KPI doanh thu, số lượng đơn đặt, tỷ lệ lấp đầy chỗ.
   - Bảng quản trị CRUD tour du lịch, bộ sưu tập ảnh và lịch trình.
   - Bảng quản trị các đợt khởi hành (`CHUYENKHOIHANH`) và thiết lập số chỗ tối đa.
   - Bảng tiếp nhận duyệt đơn đặt chỗ và đối soát minh chứng thanh toán VietQR.
   - Bảng tra cứu nhật ký kiểm toán hệ thống (`AUDITLOG`).

### 2.2. Tầng Điều khiển phía Client (Client-side Controller Layer)
Nằm tại `Frontend/assets/js/controllers/`, chịu trách nhiệm bắt sự kiện DOM từ giao diện người dùng và điều phối dữ liệu:
- **`main.js`:** Lắng nghe sự kiện click/input trên trang chủ, gọi `api.js` để tìm kiếm và lọc tour, xử lý mở modal chi tiết lịch trình, điều hướng sang trang `booking.html`.
- **`auth.js`:** Điều khiển form Đăng nhập, Đăng ký, Quên mật khẩu; lưu trữ trạng thái người dùng (User Session / Cookie); cập nhật giao diện người dùng (Avatar, Tên hiển thị, Nút Đăng xuất).
- **`admin.js`:** Bắt sự kiện trên trang quản trị, thực thi các thao tác CRUD dữ liệu tour, gửi lệnh phê duyệt đơn hàng hoặc từ chối đơn hàng.
- **`chatbot.js`:** Điều khiển widget trợ lý AI ảo, thu thập tin nhắn từ người dùng và gửi tới endpoint `/api/v1/assistant/chat`.

### 2.3. Tầng Dịch vụ phía Client (Client-side Service & Model)
- **`api.js` (API Gateway Client):** Bao bọc thư viện `fetch()` của trình duyệt, tự động đính kèm thông tin xác thực (`credentials: 'include'` cho cookie hoặc Authorization Header), chuẩn hóa đường dẫn gốc (`/api/v1/`) và bắt lỗi mạng.
- **`vietqr-service.js`:** Thuật toán tạo chuỗi mã QR thanh toán ngân hàng chuẩn EMVCo/NAPAS chứa số tiền chính xác và cú pháp nội dung chuyển khoản gắn liền với mã booking.
- **`data.js` & LocalStorage:** Lưu trữ dữ liệu danh mục tĩnh, danh sách vùng miền, và bộ nhớ đệm trạng thái giỏ hàng phía Client.

---

### 2.4. Tầng Định tuyến Backend (Route Layer - `api/routes/`)
Tầng Route là cửa ngõ đón nhận các HTTP Request từ môi trường mạng. Đúng theo nguyên tắc phân lớp chuẩn, các file router trong `api/routes/` chỉ có nhiệm vụ khai báo URL path, HTTP Method (`GET, POST, PUT, DELETE`), định nghĩa kiểu phản hồi (response_model) và chuyển giao ngay lập tức cho Controller tương ứng:
- `api/routes/auth.py`: Đón nhận `/api/v1/auth/register`, `/login`, `/me`, `/logout`.
- `api/routes/tours.py`: Đón nhận `/api/v1/tours`, `/tours/{id}`, `/tours/{id}/schedules`, `/tours/{id}/itinerary`.
- `api/routes/bookings.py`: Đón nhận `/api/v1/bookings`, `/bookings/my`, `/bookings/{id}/cancel`, `/bookings/{id}/pay`.
- `api/routes/admin.py`: Đón nhận `/api/v1/admin/tours`, `/admin/bookings`, `/admin/reports`, `/admin/audit-logs`.
- `api/routes/assistant.py`: Đón nhận `/api/v1/assistant/chat`.

### 2.5. Tầng Điều khiển Backend (Controller Layer - `api/controllers/`)
Nằm tại `API/api/controllers/`, đóng vai trò ranh giới HTTP phía máy chủ (HTTP Boundary). Controller tiếp nhận `Request`, áp dụng các hàm phụ thuộc bảo mật (`Depends(me)`, `Depends(db_session)`), gọi tầng Service để thực thi nghiệp vụ, và đóng gói DTO kết quả trả về cho Client:
- **`auth_controller.py`:** Điều phối quy trình đăng ký tài khoản, xác thực mật khẩu qua Scrypt, cấp phát cặp Cookie bảo mật `HttpOnly`.
- **`tour_controller.py`:** Tiếp nhận các tham số tìm kiếm (điểm đến, giá tiền, ngày khởi hành), gọi Service lọc tour và trả về danh sách tour phân trang.
- **`booking_controller.py`:** Tiếp nhận DTO đặt chỗ, kiểm tra tính toàn vẹn (Idempotency Key), phối hợp với `booking_service` để kiểm tra chỗ trống và tạo đơn đặt.
- **`admin_controller.py`:** Kiểm tra quyền `ADMIN`, điều phối các thao tác thêm/sửa/xóa tour, duyệt đơn đặt tour và thống kê doanh thu.
- **`assistant_controller.py`:** Điều phối luồng hỏi đáp của trợ lý AI ảo, tìm kiếm tour phù hợp với ngữ cảnh câu hỏi của khách hàng.

### 2.6. Tầng Dịch vụ Nghiệp vụ Backend (Service Layer - `api/services/`)
Nằm tại `API/api/services/`, là nơi tập trung toàn bộ **Business Rules** của hệ thống lữ hành:
- **`booking_service.py`:**
  - `place_booking()`: Khởi tạo quy trình đặt tour, kiểm tra tính toàn vẹn của khách hàng.
  - `ensure_capacity()`: Kiểm tra sức chứa đợt khởi hành, chống Overbooking ở cấp ứng dụng.
  - `totals()`: Tính toán tổng chi phí chuyến đi dựa trên số lượng người lớn, trẻ em và trẻ nhỏ.
  - `sweep()`: Tác vụ tự động quét dọn và thu hồi số chỗ của các đơn đặt tour quá hạn 15 phút chưa thanh toán.
- **`auth_service.py`:** Kiểm tra đối soát mật khẩu hash bằng thuật toán an toàn chống Timing Attacks (`credentials_match`), tạo chuỗi token phiên.
- **`tour_service.py`:** Ghép nối dữ liệu tour thô từ CSDL với danh sách ảnh gallery (`tour_images`), lịch trình theo ngày (`itinerary_items`) và số chỗ khả dụng (`availability`).
- **`payment_service.py`:** Kiểm tra chống trùng lặp mã giao dịch ngân hàng (`payment_reference_used`), đối soát số tiền chuyển khoản với tổng tiền đơn hàng.
- **`admin_service.py`:** Tổng hợp số liệu thống kê báo cáo và bóc tách dữ liệu đơn đặt chỗ phục vụ Admin.

### 2.7. Tầng Truy xuất Dữ liệu Backend (Repository Layer - `api/repositories/`)
Nằm tại `API/api/repositories/`, đóng vai trò lớp trừu tượng hóa CSDL (Data Access Layer), giúp tách biệt hoàn toàn mã nguồn nghiệp vụ khỏi các câu lệnh truy vấn CSDL:
- **`booking_repository.py`:** Tìm kiếm đơn hàng theo Idempotency Key, truy vấn danh sách đơn hàng của khách hàng, khóa bản ghi đơn hàng để cập nhật trạng thái (`lock_booking_for_owner`).
- **`schedule_repository.py`:** Khóa dòng đợt khởi hành với gợi ý khóa `with_for_update()` để chống tranh chấp giữ chỗ đồng thời (`lock_schedule`).
- **`tour_repository.py`:** Thực thi câu lệnh truy vấn lọc tour đa tiêu chí (`search_public_tours`) với các điều kiện lọc linh hoạt.
- **`user_repository.py`:** Kiểm tra xung đột trùng lặp Email / Số điện thoại (`user_conflict`, `phone_conflict`), tìm kiếm người dùng theo định danh.

### 2.8. Tầng Mô hình và Hợp đồng Dữ liệu (Model & Schema Layer)
- **`api/models/` (SQLAlchemy ORM Entities):** Ánh xạ cấu trúc bảng CSDL thành các lớp Python (`User`, `Tour`, `TourSchedule`, `Booking`, `ItineraryItem`, `TourCostItem`, `AuditLog`, `Favorite`).
- **`api/schemas/` (Pydantic Schemas / DTOs):** Định nghĩa cấu trúc hợp đồng dữ liệu đầu vào và đầu ra (`Signup`, `Login`, `TourSearch`, `TourOut`, `BookingInput`, `BookingOut`, `QuoteInput`, `QuoteResponse`), thực hiện validate kiểu dữ liệu tự động trước khi tới Controller.

---

### 2.9. Tầng Cơ sở dữ liệu (Database Tier - Microsoft SQL Server 12 Bảng)
Hệ thống CSDL quan hệ chuẩn 3NF được triển khai trên Microsoft SQL Server thông qua các file DDL tại `database/database/`:
1. `dbo.NGUOIDUNG`: Lưu trữ thông tin tài khoản, mật khẩu băm, vai trò (`CUSTOMER`, `ADMIN`).
2. `dbo.DANHMUC`: Phân loại danh mục tour theo vùng miền (Miền Bắc, Miền Trung, Miền Nam, Tây Nguyên).
3. `dbo.TOUR`: Bảng sản phẩm tour du lịch gốc chứa các thuộc tính lộ trình cố định.
4. `dbo.HINHANH_TOUR`: Bộ sưu tập ảnh thực tế đa góc nhìn cho từng tour.
5. `dbo.LICH_TRINH_DETAIL`: Chi tiết hoạt động và điểm tham quan bóc tách theo từng ngày (Day 1, Day 2,...).
6. `dbo.CHUYENKHOIHANH`: Quản lý từng đợt khởi hành cụ thể, ngày đi, ngày về, giá vé và số chỗ (`SoChoToiDa`, `SoChoDaDat`).
7. `dbo.DATTOUR`: Lưu trữ thông tin đơn đặt vé, mã booking duy nhất (`BK...`), tổng tiền và trạng thái đơn hàng.
8. `dbo.CHITIET_HANHKHACH`: Danh sách từng hành khách thực tế đi tour (Người lớn, Trẻ em, CCCD/Passport).
9. `dbo.THANHTOAN`: Lưu trữ thông tin giao dịch VietQR, số tiền, ngày thanh toán và đường dẫn ảnh biên lai chuyển khoản.
10. `dbo.DANHGIA`: Đánh giá chấm điểm sao (1-5 sao) và nhận xét thực tế sau chuyến đi.
11. `dbo.BAIVIET_QUANGBA`: Bài viết cẩm nang du lịch và văn hóa nhằm thu hút du khách.
12. `dbo.AUDITLOG`: Nhật ký kiểm toán bất biến ghi nhận mọi thao tác thay đổi dữ liệu nhạy cảm.

**Ràng buộc & Trigger CSDL:**
- Trigger `TRG_DATTOUR_CheckAndLockSeats`: Tự động kiểm tra số chỗ trống còn lại trên bảng `CHUYENKHOIHANH` khi có đơn đặt tour mới; nếu `SoChoDaDat + SoLuongKhach > SoChoToiDa` thì lập tức `ROLLBACK TRANSACTION` và báo lỗi, đảm bảo an toàn tuyệt đối chống Overbooking ở cấp độ lưu trữ.

---

## 3. PHÂN TÍCH CHUYÊN SÂU: CHIỀU TƯƠNG TÁC QUAY NGƯỢC LẠI (REVERSE FLOW / FEEDBACK)

Một trong những yêu cầu kỹ thuật quan trọng nhất trong hệ thống Delta Travel là **Sự tồn tại của Chiều tương tác quay ngược lại từ Database / Model lên Controller và View**. Hệ thống không phải là luồng 1 chiều dội từ trên xuống mà hoạt động theo chu trình khép kín:

1. **Chiều quay ngược từ Database lên Model / Repository:**
   - Khi thực hiện lệnh `INSERT` đơn đặt tour, Trigger SQL Server kiểm tra số chỗ. Nếu thành công, CSDL trả về trạng thái Commit và bản ghi đã lưu. Nếu hết chỗ, Trigger ném mã lỗi vi phạm nghiệp vụ CSDL quay ngược lại cho tầng ORM Model bắt giữ.
2. **Chiều quay ngược từ Model / Repository lên Service:**
   - Repository trả về các thực thể ORM (`Booking`, `TourSchedule`) hoặc bắn ngoại lệ `IntegrityError` / `CapacityExceeded` quay ngược lên Service.
3. **Chiều quay ngược từ Service lên Controller:**
   - Tầng Service bóc tách dữ liệu thực thể thành DTO hoàn chỉnh (ví dụ: `BookingOut` kèm mã booking `BK...` và hạn thanh toán 15 phút).
   - Nếu vi phạm nghiệp vụ (hết chỗ, trùng lặp tài khoản), Service ném các nghiệp vụ ngoại lệ (Business Exceptions) như `HTTPException(409, "Hết chỗ trống")` quay ngược lên Controller.
4. **Chiều quay ngược từ Backend Controller về Frontend Client:**
   - Controller đóng gói dữ liệu JSON DTO và mã trạng thái HTTP (200 OK, 201 Created, 409 Conflict, 422 Unprocessable Entity) gửi qua mạng về cho Client API Service (`api.js`).
5. **Chiều quay ngược từ Client Service lên View:**
   - `api.js` giải mã JSON và trả kết quả về cho Controller giao diện (`main.js`, `auth.js`).
   - Controller giao diện thực hiện cập nhật DOM: đóng form đặt tour, tự động kích hoạt mở `VietQRModalView` hiển thị mã QR động cùng đồng hồ đếm ngược 15 phút cho khách hàng thanh toán.

---

## 4. CHU TRÌNH 7 BƯỚC XỬ LÝ MỘT YÊU CẦU ĐIỂN HÌNH (VÍ DỤ LUỒNG ĐẶT TOUR)

- **Bước 1 (Client Action):** Người dùng điền danh sách hành khách trên giao diện `booking.html` và nhấn nút "Xác nhận đặt tour".
- **Bước 2 (Client Controller Validation):** JavaScript `main.js` kiểm tra hợp lệ định dạng số điện thoại, CCCD/Passport ở phía máy khách.
- **Bước 3 (API Request Dispatching):** `api.js` đóng gói dữ liệu thành đối tượng JSON `BookingInput` và gửi HTTP POST tới `/api/v1/bookings`.
- **Bước 4 (Backend Controller & Auth Guard):** FastAPI Route tiếp nhận, chuyển qua `booking_controller.py`, kiểm tra xác thực JWT Cookie và Pydantic Schema.
- **Bước 5 (Service Execution & Capacity Check):** `booking_service.py` mở giao dịch CSDL, gọi `schedule_repository.lock_schedule()` để khóa dòng chuyến đi và kiểm tra số chỗ.
- **Bước 6 (Model / Database Trigger & Reverse Flow):** CSDL SQL Server kiểm tra số chỗ qua Trigger, ghi nhận bản ghi đơn hàng mới vào `DATTOUR`, cập nhật số chỗ trên `CHUYENKHOIHANH`, và phản hồi kết quả Commit quay ngược lên tầng Service & Controller.
- **Bước 7 (Response Stream & UI Dynamic Render):** Controller trả về JSON `BookingOut` (HTTP 201). Trình duyệt tiếp nhận dữ liệu, gọi `vietqr-service.js` tạo mã QR ngân hàng động và mở modal thanh toán cho khách hàng.
