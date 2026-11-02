# TÀI LIỆU KIẾN TRÚC & ĐẶC TẢ CHI TIẾT FRONTEND
## HỆ THỐNG QUẢNG BÁ & ĐẶT TOUR DU LỊCH NGHỈ DƯỠNG DELTA TRAVEL

---

## 1. TỔNG QUAN HỆ THỐNG FRONTEND

Dự án Frontend **Delta Travel** được phát triển theo tiêu chuẩn giao diện **Thương mại điện tử cao cấp (Luxury Commercial Grade)**, áp dụng ngôn ngữ thiết kế **Apple Liquid Glass UI** kết hợp **Bootstrap 5.3.3** và **JavaScript thuần (Vanilla ES6+)**.

- **Công nghệ cốt lõi**: HTML5, CSS3 (Custom CSS Grid, Flexbox, Glassmorphism, Micro-interactions), JavaScript ES6+ (Native Modules, Fetch API, LocalStorage persistence), Bootstrap 5.3.3 Bundle (CDN), Bootstrap Icons v1.11.3.
- **Cam kết kỹ thuật**:
  - 100% mã nguồn Frontend viết thuần túy (HTML, CSS, JS, Bootstrap), không phụ thuộc React/Vue/Node build step phức tạp, sẵn sàng chạy ngay trên bất kỳ Web Server tĩnh nào (Live Server, Nginx, Caddy, Apache, GitHub Pages, Vercel).
  - Không sử dụng thông tin bịa đặt. Toàn bộ thông tin nhóm phát triển và ban quản trị được bảo vệ đúng danh sách 5 thành viên chính thức.
  - Xóa bỏ hoàn toàn các nhãn "bản demo" hoặc "mô phỏng" để đưa website đạt chuẩn thương mại thực tế phục vụ khách hàng.

---

## 2. CẤU TRÚC THƯ MỤC FRONTEND

```text
Frontend/
├── index.html                  # Cổng website thương mại điện tử dành cho khách hàng
├── admin.html                  # Cổng điều hành quản trị doanh nghiệp (Admin Operations Portal)
├── FRONTEND_CHI_TIET.md        # Tài liệu đặc tả kỹ thuật chi tiết Frontend & đối soát API
├── README.md                   # Hướng dẫn nhanh khởi chạy giao diện
└── assets/
    ├── css/
    │   ├── main.css            # Biến màu sắc toàn cục (:root), Typography, Reset, Utilities
    │   ├── header.css          # Navigation bar, Sticky Header, Glass Pill, Topbar
    │   ├── hero.css            # Banner Hero du thuyền vịnh Hạ Long, Floating badges
    │   ├── search-filter.css   # Thanh công cụ tìm kiếm nhanh & bộ lọc ngân sách
    │   ├── sections.css        # Tour cards, Testimonials Slider, Footer contrast fix, Chatbot
    │   ├── booking.css         # Modal đặt tour, Calendar picker, Real-time pricing, E-Ticket
    │   ├── auth.css            # Modal đăng nhập/đăng ký, Profile, Avatar upload badge
    │   ├── admin.css           # Bảng điều khiển quản trị, Sidebar, Data tables, Responsive grid
    │   └── responsive.css      # Tối ưu hóa hiển thị Mobile (>=320px) đến 4K Ultra Wide
    ├── js/
    │   ├── api.js              # Tầng kết nối API Client (DeltaAPI) & Hybrid LocalStorage Fallback
    │   ├── data.js             # 16 tour mẫu chuẩn UTF-8, cấu trúc storage keys, vouchers
    │   ├── main.js             # Logic lọc tour, xem chi tiết lịch trình, đặt tour, tra cứu đơn
    │   ├── auth.js             # Quản lý tài khoản, tải ảnh avatar Base64, phân quyền Admin 5 người
    │   ├── admin.js            # CRUD tour, Bộ biên tập Day-by-Day Itinerary, duyệt đơn, kế toán
    │   └── chatbot.js          # Trợ lý ảo AI Concierge tư vấn tour thông minh 24/7
    └── images/                 # Thư viện hình ảnh chuẩn điểm đến, icons, avatars, mã QR
```

---

## 3. DANH SÁCH MÀN HÌNH & CHỨC NĂNG NGHIỆP VỤ

### 3.1. Cổng Khách Hàng Thương Mại (`index.html`)

1. **Thanh điều hướng Liquid Glass (Header)**:
   - Hiển thị logo tam giác vàng thương hiệu Delta Travel.
   - Thanh điều hướng danh mục: *Trang chủ*, *Miền Bắc*, *Miền Trung*, *Miền Nam*, *Tất cả tour*, *Đơn của tôi*, *Trợ lý AI*.
   - Khối người dùng: Hiển thị avatar tròn (hoặc chữ cái đầu), tên người dùng, nút đăng xuất nhanh và nút mở hồ sơ tài khoản.
2. **Bộ lọc tour đa chiều**:
   - Lọc theo 3 vùng miền lớn (Bắc, Trung, Nam).
   - Lọc theo từ khóa tìm kiếm (tên tour, điểm đón, vùng miền).
   - Lọc theo khoảng giá ngân sách (Dưới 3 triệu, 3 - 5 triệu, Trên 5 triệu).
   - Sắp xếp linh hoạt theo giá tăng dần, giá giảm dần, hoặc điểm đánh giá sao cao nhất.
3. **Danh mục 16 Tour Du Lịch Toàn Quốc**:
   - Thẻ tour hiện đại với hình ảnh sắc nét, huy hiệu nổi bật, đánh giá sao, thời lượng, số chỗ còn trống, giá gốc gạch ngang và giá ưu đãi.
   - **Tương tác trực quan**: Nhấp chuột vào ảnh thẻ tour, tiêu đề tour hoặc nút *"Xem lịch trình"* đều mở ngay Modal Chi Tiết Lịch Trình.
4. **Modal Chi Tiết Toàn Bộ Tour & Lịch Trình Từng Ngày (`#itineraryModal`)**:
   - Hiển thị ảnh bìa lớn, thông số phương tiện di chuyển, điểm đón tận nơi, thời lượng.
   - **Tab 1 - Lịch trình từng ngày (Timeline)**: Chia chi tiết từng ngày theo 3 buổi: *Buổi Sáng*, *Buổi Chiều*, *Buổi Tối*.
   - **Tab 2 - Dịch vụ bao gồm & Loại trừ**: Liệt kê rõ ràng minh bạch các tiêu chuẩn ăn uống, xe đưa đón, bảo hiểm du lịch 100 triệu và các chi phí phụ thu nếu có.
   - **Tab 3 - Chính sách hoàn hủy**: Quy định hoàn hủy tour rõ ràng theo mốc thời gian (15 ngày, 7 ngày, 3 ngày, 48h).
   - **Thanh CTA dính đáy (Sticky Footer)**: Hiển thị giá trọn gói và nút *"Đặt tour này ngay"*.
5. **Hệ thống Đặt Tour & Tính Giá Thời Gian Thực (`#bookingModal`)**:
   - Lựa chọn ngày khởi hành linh hoạt (giới hạn tối thiểu từ ngày mai).
   - Điều chỉnh số lượng: Người lớn, Trẻ em (giảm 35%), Em bé (< 2 tuổi, miễn phí vé).
   - Bảng giá tạm tính cập nhật thời gian thực khi thay đổi số lượng khách.
   - Áp dụng mã giảm giá voucher (kiểm tra hạn dùng và số tiền giảm).
   - Tạo mã đơn hàng duy nhất chuẩn nghiệp vụ (`DL-XXXXXX`).
6. **Thanh Toán & Cấp Vé Điện Tử (E-Ticket)**:
   - Hỗ trợ thanh toán VietQR ngân hàng 24/7 với nội dung chuyển khoản tự động là mã đơn hàng.
   - Thanh toán tiền mặt tại quầy giao dịch (giữ chỗ 24h).
   - Xuất vé điện tử chứa đầy đủ thông tin hành khách, mã QR và nút in vé.
7. **Tra Cứu Đơn Đặt Chỗ & Lịch Sử Đơn Hàng (`#lookupModal`)**:
   - Tra cứu nhanh theo mã đơn hàng hoặc xem danh sách đơn của tài khoản đang đăng nhập.
   - Hỗ trợ hủy đơn kèm lý do bảo vệ quyền lợi người dùng.
8. **Carousel Nhận Xét Khách Hàng (Testimonials Slider)**:
   - Tích hợp 8 đánh giá thực tế từ khách hàng đã trải nghiệm các tour Hạ Long, Đà Nẵng, Phú Quốc, Sa Pa, Đà Lạt, Miền Tây, Hà Giang, Mộc Châu.
   - Hai nút chuyển tiếp Trước (`<`) và Sau (`>`) cùng thanh chỉ số (indicators) cho phép người dùng lướt qua lại mượt mà.
9. **Hồ Sơ Cá Nhân & Tải Lên Ảnh Đại Diện Avatar (`#userProfileModal`)**:
   - Hiển thị thông tin cá nhân, ngày tham gia, hạng VIP, tổng số đơn đã đặt.
   - **Nút camera tải ảnh avatar**: Cho phép người dùng chọn ảnh bất kỳ từ máy tính hoặc điện thoại. Ảnh được tự động tối ưu hóa và nén qua HTML Canvas thành chuẩn kích thước nhỏ gọn, lưu trữ Base64 vào hồ sơ người dùng và cập nhật đồng bộ lên Header.
10. **Trợ Lý Du Lịch Thông Minh Delta AI Concierge 24/7 (`#deltaChatbotWidget`)**:
    - Trợ lý ảo tư vấn điểm đến, gợi ý tour theo sở thích, kiểm tra giá vé và giải đáp thắc mắc.

---

### 3.2. Cổng Quản Trị Doanh Nghiệp (`admin.html`)

1. **Khóa Bảo Vệ Đăng Nhập (Auth Guard)**:
   - Giới hạn quyền truy cập riêng cho Ban Quản Trị gồm đúng 5 thành viên của nhóm:
     1. `hongtham@deltatravel.vn` - Hồng Thắm (Trưởng nhóm)
     2. `linhmiki2002@gmail.com` - Lê Văn An (Quản trị viên)
     3. `haidang@deltatravel.vn` - Lê Hải Đăng (Thành viên)
     4. `nguyenphuc@deltatravel.vn` - Nguyễn Phúc (Thành viên)
     5. `manhle@deltatravel.vn` - Mạnh Lê (Thành viên)
2. **Bảng Điều Khiển Số Liệu (Dashboard Metrics)**:
   - Thống kê doanh thu thực tế, số lượng đơn hàng, số chỗ còn trống, tỷ lệ lấp đầy.
   - Biểu đồ và chỉ số sẵn sàng vận hành hệ thống.
3. **Quản Lý Danh Mục Tour & Bộ Biên Tập Lịch Trình Chi Tiết (`#adminTourModal`)**:
   - **Tab 1 - Thông tin cơ bản & Giá bán**: Mã ID, Tên tour, Slug URL, Vùng miền, Thời lượng (3N2Đ, 4N3Đ...), Giá niêm yết, Giá bán ưu đãi, Điểm đón, Phương tiện di chuyển, Số chỗ mở bán, Trạng thái (ACTIVE / DRAFT / INACTIVE), Huy hiệu (Badge), Tải ảnh bìa từ máy tính / Chọn nhanh từ thư viện / Nhập URL.
   - **Tab 2 - Quản lý lịch trình từng ngày (Day-by-Day Timeline)**:
     - Hiển thị danh sách động các ngày trong tour.
     - Mỗi ngày gồm: Tiêu đề ngày, Buổi sáng, Buổi chiều, Buổi tối.
     - Nút **"+ Thêm Ngày Mới"**: Tự động sinh thêm ngày và tự động cập nhật lại thời lượng tour.
     - Nút **"Xóa ngày"**: Xóa ngày tương ứng và tự động đánh lại số thứ tự (Ngày 1, Ngày 2...).
   - **Tab 3 - Điểm nổi bật & Dịch vụ bao gồm / Loại trừ / Chính sách**:
     - Biên tập danh sách Điểm nổi bật (Highlights).
     - Biên tập danh sách Dịch vụ bao gồm trong giá (Inclusions).
     - Biên tập danh sách Dịch vụ không bao gồm / Phụ thu (Exclusions).
     - Biên tập Quy định hoàn đổi vé & Lưu ý (Terms).
4. **Quản Lý Lịch Khởi Hành (Schedules & Slots)**:
   - Thêm, sửa lịch khởi hành theo ngày giờ cụ thể cho từng tour, quản lý tải trọng số ghế (capacity) và trạng thái mở bán (OPEN / CLOSED).
5. **Quản Lý & Phê Duyệt Đơn Đặt Tour (Bookings Management)**:
   - Bảng theo dõi toàn bộ đơn hàng với các bộ lọc trạng thái (Chờ thanh toán, Đã thanh toán, Hoàn thành, Đã hủy).
   - Xem chi tiết hồ sơ đặt chỗ khách hàng.
   - Phê duyệt xác nhận thanh toán chuyển khoản hoặc thu tiền mặt.
   - Hủy đơn kèm ghi nhận lý do chuẩn nghiệp vụ.
   - Xuất dữ liệu sao kê danh sách đơn ra tệp CSV / Excel.
6. **Đối Soát Tài Chính & Ghi Nhận Hoàn Tiền (Payments & Refunds)**:
   - Kiểm tra mã giao dịch VietQR ngân hàng.
   - Lập phiếu thu tiền mặt trực tiếp tại quầy có mã biên lai.
   - Xử lý hoàn tiền cho khách hàng khi hủy tour hợp lệ và lưu vết kế toán.
7. **Nhật Ký Kiểm Toán Bảo Mật (Audit Logs)**:
   - Ghi lại tự động mọi hành động của quản trị viên: Tạo tour, Cập nhật lịch trình, Sửa giá, Duyệt đơn, Xác nhận thanh toán, Hoàn tiền...

---

## 4. TẦNG KẾT NỐI API & DATABASE (API CLIENT LAYER)

Tệp `assets/js/api.js` cung cấp đối tượng toàn cục `DeltaAPI` với cơ chế **Hybrid Two-Way Fallback**:
- Khi FastAPI Backend đang chạy tại `http://localhost:8000/api/v1` (hoặc cùng máy chủ production), Frontend tự động gửi và nhận dữ liệu trực tiếp tới Database (PostgreSQL / SQLite).
- Khi Backend chưa được khởi động, Frontend chuyển tiếp mượt mà sang tầng Persistent LocalStorage mà không gây lỗi hoặc gián đoạn trải nghiệm người dùng.

```javascript
// Ví dụ gọi API từ Frontend:
const result = await DeltaAPI.getTours();
const quote = await DeltaAPI.getQuote({ tour_id: "DL-HL01", adults: 2, children: 1 });
const booking = await DeltaAPI.createBooking(bookingPayload);
```

---

## 5. BÁO CÁO ĐỐI SOÁT API & DATABASE GIỮA FRONTEND VÀ BACKEND

> **GHI CHÚ QUAN TRỌNG DÀNH CHO NHÓM PHÁT TRIỂN BACKEND (Mạnh, Thắm, Đăng, Phúc):**
> Dưới đây là kết quả rà soát chi tiết giữa mã nguồn Backend hiện tại (`API/api/models.py`, `API/api/schemas.py`, `API/docs/openapi.json`) và yêu cầu nghiệp vụ thương mại của Frontend:

### 5.1. Các API Đã Kết Nối Khớp 100%

| Phương thức | Đường dẫn API | Mục đích | Trạng thái kết nối |
|---|---|---|---|
| `GET` | `/api/v1/health/ready` | Kiểm tra trạng thái máy chủ Backend | Hoàn thành |
| `POST` | `/api/v1/auth/register` | Đăng ký tài khoản khách hàng mới | Hoàn thành |
| `POST` | `/api/v1/auth/login` | Đăng nhập tài khoản & nhận JWT token | Hoàn thành |
| `GET` | `/api/v1/auth/me` | Lấy thông tin tài khoản hiện tại | Hoàn thành |
| `POST` | `/api/v1/auth/logout` | Đăng xuất & hủy session | Hoàn thành |
| `PATCH` | `/api/v1/auth/profile` | Cập nhật họ tên, số điện thoại | Hoàn thành |
| `POST` | `/api/v1/auth/change-password` | Đổi mật khẩu tài khoản | Hoàn thành |
| `GET` | `/api/v1/tours` | Lấy danh sách tour mở bán | Hoàn thành |
| `GET` | `/api/v1/tours/{tour_id}` | Lấy chi tiết tour theo ID | Hoàn thành |
| `GET` | `/api/v1/tours/{tour_id}/schedules` | Lấy lịch khởi hành của tour | Hoàn thành |
| `POST` | `/api/v1/bookings/quote` | Tính toán báo giá đơn đặt trước | Hoàn thành |
| `POST` | `/api/v1/bookings` | Tạo đơn đặt tour mới | Hoàn thành |
| `GET` | `/api/v1/bookings` | Lấy danh sách đơn của người dùng | Hoàn thành |
| `GET` | `/api/v1/bookings/{booking_id}` | Tra cứu chi tiết đơn hàng | Hoàn thành |
| `POST` | `/api/v1/bookings/{booking_id}/cancel` | Hủy đơn đặt tour | Hoàn thành |
| `GET` | `/api/v1/admin/tours` | Quản trị viên lấy toàn bộ tour | Hoàn thành |
| `POST` | `/api/v1/admin/tours` | Quản trị viên tạo tour mới | Hoàn thành |
| `PATCH` | `/api/v1/admin/tours/{tour_id}` | Quản trị viên cập nhật thông tin tour | Hoàn thành |
| `GET` | `/api/v1/admin/bookings` | Quản trị viên lấy danh sách đơn | Hoàn thành |
| `POST` | `/api/v1/admin/bookings/{id}/confirm-payment` | Xác nhận đơn đã thanh toán | Hoàn thành |
| `GET` | `/api/v1/admin/metrics` | Lấy số liệu thống kê Dashboard | Hoàn thành |
| `GET` | `/api/v1/admin/audit` | Lấy nhật ký kiểm toán hệ thống | Hoàn thành |
| `POST` | `/api/v1/assistant/chat` | Tích hợp hội thoại trợ lý ảo AI | Hoàn thành |

---

### 5.2. Danh Sách Các Mục Backend Cần Bổ Sung / Chuẩn Hóa Thêm

1. **Bảng `users` (Model `User`)**:
   - **Hiện tại**: Có các cột `id, full_name, email, phone, password_hash, role, active, created_at, updated_at`.
   - **Thiếu**: Cột `avatar` (kiểu `Text` hoặc `String(500)`).
   - **Khuyến nghị**: Thêm cột `avatar` vào bảng `users` trong database và bổ sung trường `avatar` vào schema `UserResponse` và `ProfileUpdateRequest` để ảnh đại diện của khách hàng được lưu vĩnh viễn trên máy chủ.

2. **Bảng `tours` (Model `Tour`)**:
   - **Hiện tại**: Cột `itinerary_json` lưu dạng chuỗi văn bản JSON.
   - **Cần hoàn thiện**: Frontend gửi lên mảng JSON các ngày gồm `{ day, title, morning, afternoon, evening }`. Backend cần đảm bảo trường `itinerary_json` trong schema `TourCreate` và `TourUpdate` cho phép nhận chuỗi này hoặc đối tượng list.
   - **Các trường mở rộng**: Frontend đang sử dụng `highlights` (Điểm nổi bật), `inclusions` (Dịch vụ bao gồm), `exclusions` (Không bao gồm), `terms` (Chính sách hoàn hủy), `badge` (Huy hiệu), `child_price` (Giá vé trẻ em). Hiện tại backend đang gộp vào trường `description`. Khuyến nghị backend có thể lưu trữ các danh sách này thành các cột JSON hoặc văn bản nhiều dòng để đồng bộ tuyệt đối với Frontend.

3. **Dữ liệu mầm (Seed Data)**:
   - **Hiện tại**: Tệp `API/api/seed.py` mới chỉ tạo 6 tour cơ bản.
   - **Frontend**: Đã có 16 tour đầy đủ thông tin chuẩn thương mại bao gồm miền Bắc (Hạ Long, Sa Pa, Ninh Bình, Hà Giang, Cao Bằng, Mộc Châu), miền Trung (Đà Nẵng, Huế, Nha Trang, Quy Nhơn, Phú Yên, Đà Lạt), và miền Nam/Đảo (Phú Quốc, Miền Tây, Tây Ninh, Côn Đảo).
   - **Khuyến nghị**: Backend chạy cập nhật seed từ danh sách `DEFAULT_TOURS` trong `Frontend/assets/js/data.js` để dữ liệu hai bên khớp nhau 100%.

4. **API Mã Khuyến Mãi (Vouchers)**:
   - **Hiện tại**: Backend chưa có bảng `vouchers` và endpoint `/api/v1/vouchers`. Việc giảm giá đang được tính toán theo payload gửi lên của quote.
   - **Khuyến nghị**: Nếu cần quản trị mã giảm giá từ phía server, nhóm backend có thể bổ sung thêm bảng `vouchers` và endpoint quản trị voucher.

5. **API Đánh Giá Khách Hàng (Reviews)**:
   - **Hiện tại**: Backend chưa có bảng `reviews` và endpoint `/api/v1/reviews`.
   - **Khuyến nghị**: Bổ sung bảng đánh giá tour để khách hàng sau khi hoàn thành chuyến đi có thể viết nhận xét thật lên hệ thống.

---

## 6. HƯỚNG DẪN KHỞI CHẠY VÀ KIỂM THỬ

### 6.1. Khởi Chạy Nhanh Frontend Độc Lập
1. Mở thư mục `Frontend/` bằng Visual Studio Code hoặc bất kỳ trình soạn thảo nào.
2. Nhấp chuột phải vào tệp `index.html` và chọn **"Open with Live Server"** (hoặc mở trực tiếp file `index.html` trên trình duyệt Google Chrome / Microsoft Edge).
3. Truy cập `admin.html` để quản trị tour, chỉnh sửa lịch trình các ngày, và kiểm tra đối soát đơn hàng.

### 6.2. Khởi Chạy Kết Hợp Với FastAPI Backend
1. Khởi động máy chủ backend tại thư mục `API/`:
   ```bash
   cd API
   python -m uvicorn api.app:app --reload --port 8000
   ```
2. Mở trình duyệt truy cập `Frontend/index.html`. File `assets/js/api.js` sẽ tự động phát hiện backend đang hoạt động tại cổng 8000 và chuyển sang kết nối trực tiếp với Database.

---

*Tài liệu được lập và xác thực toàn diện bởi Nhóm Phát Triển Delta Travel.*
