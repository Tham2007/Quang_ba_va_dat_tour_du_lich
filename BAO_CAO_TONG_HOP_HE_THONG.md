# BÁO CÁO TỔNG HỢP CÁC TÍNH NĂNG & NÂNG CẤP HỆ THỐNG
**Dự án:** Hệ Thống Quảng Bá & Đặt Tour Du Lịch Delta Travel  
**Thời gian cập nhật:** Ngày 15 Tháng 11 Năm 2026  
**Môi trường triển khai:** Node.js Express Backend, Song cơ sở dữ liệu (SQLite Operational + SQL Server Production), Cloud Render (`https://delta-travel.onrender.com`), Cổng thanh toán SePay VietQR MBBank.

---

## 1. TỔNG QUAN KIẾN TRÚC & MỤC TIÊU DỰ ÁN

Hệ thống **Delta Travel** là nền tảng thương mại điện tử chuyên biệt phục vụ quảng bá tour du lịch quốc tế và nội địa, quản lý đặt chỗ trực tuyến, đối soát thanh toán tự động 24/7 và kiểm soát vé điện tử (Check-in). 

Hệ thống kết hợp kiến trúc Dual-Database hiện đại:
- **Cơ sở dữ liệu SQLite vận hành (`API/delta_dev.db`):** Quản lý người dùng, tài khoản khách hàng, lịch sử đặt tour, trạng thái thanh toán, quy trình hoàn tiền và nhật ký check-in.
- **Cơ sở dữ liệu Microsoft SQL Server (`sql8020.site4now.net:1433`):** Đồng bộ danh mục tour du lịch thương mại, lịch trình khởi hành và kho mã ưu đãi (Voucher).
- **Hạ tầng Cloud:** Triển khai tự động liên tục (CI/CD) qua Git lên Render Cloud Web Service, đi kèm cơ chế Tunnel & Relay Webhook phục vụ phát triển nội bộ.

---

## 2. BẢNG BẢO MẬT & CHE GIẤU THÔNG TIN NHẠY CẢM (MASKED CREDENTIALS)

Tuân thủ nghiêm ngặt nguyên tắc an toàn thông tin và bảo mật dữ liệu doanh nghiệp, toàn bộ các khóa bí mật (Secrets), thông tin định danh ngân hàng và chuỗi kết nối đã được mã hóa / che giấu (`***`):

| Thành phần nhạy cảm | Môi trường / Mục đích | Trạng thái hiển thị (Masked) |
| :--- | :--- | :--- |
| **SePay API Key / Token** | Cổng đối soát Webhook SePay VietQR | `Bearer ***` |
| **SQL Server Password** | Chuỗi kết nối Database từ xa `db_ad0b71_dattour` | `Password=***` |
| **JWT Secret Key** | Ký token xác thực người dùng & Admin | `JWT_SECRET=***` |
| **Mật khẩu Quản trị viên (Admin)** | Tài khoản quản trị hệ thống `admin@deltatravel.vn` | `***` (Hỗ trợ 1-Click Fast Login trong môi trường quản trị) |
| **Mật khẩu Tài khoản Trưởng nhóm** | Tài khoản `truongnhom@deltatravel.vn` | `***` |
| **SMTP / Mail Service Password** | Khóa gửi email thông báo vé & hóa đơn | `SMTP_PASS=***` |
| **Số tài khoản ngân hàng thụ hưởng** | MBBank (Ngân hàng Quân Đội) | `0325536936` (Số TK nhận công khai) / API Webhook Secret: `***` |

---

## 3. CHI TIẾT CÁC TÍNH NĂNG VÀ BẢN SỬA LỖI ĐÃ HOÀN TẤT ("LÀM QUA GIỜ")

### 3.1. Tích Hợp Cổng Thanh Toán SePay Webhook & Tự Động Xác Nhận VietQR MBBank
- **Vấn đề trước đây:** Khách hàng chuyển khoản VietQR qua app ngân hàng MBBank, SePay ghi nhận biến động số dư thành công nhưng webhook gửi về hệ thống bị trả về mã lỗi 404 hoặc không tìm thấy đơn do sai lệch đường dẫn và định dạng nội dung chuyển khoản.
- **Giải pháp kỹ thuật đã triển khai:**
  1. **Hỗ trợ đa định tuyến URL (Alias Webhook Routes):**
     - `/api/v1/webhooks/sepay` (Route chuẩn)
     - `/api/sepay/webhook` và `/api/v1/sepay/webhook` (Route bí danh tương thích)
     - Fallback xử lý tại Route gốc `POST /` khi payload mang cấu trúc webhook SePay (chứa `gateway`, `transactionDate`, `transferAmount`, `content`).
  2. **Bộ bóc tách cú pháp chuyển khoản thông minh (Smart Content Regex Parser):**
     - Chuẩn hóa nội dung chuyển khoản, tự động tìm kiếm và trích xuất mã đơn booking theo định dạng `BK[0-9]{10}` (hoặc `USR[0-9]{2} BK...` trong trường hợp ngân hàng chèn thêm tiền tố giao dịch).
  3. **Cơ chế xác thực số tiền linh hoạt:** Cho phép khớp đơn khi số tiền chuyển khoản hợp lệ (dung sai phí chuyển tiền hoặc thanh toán chính xác theo đơn).
  4. **Tự động chuyển đổi trạng thái tức thời:** Khi SePay báo có tiền, hệ thống chuyển trạng thái đơn hàng sang `CONFIRMED` / `PAID`, tự động sinh mã vé điện tử `TK-BK...` và mở quyền truy cập vé cho khách hàng trong 1-3 giây.

---

### 3.2. Chính Sách Huỷ Đơn Trong 24 Giờ & Hoàn Tiền Trực Tuyến (Refund Policy)
- **Quy tắc nghiệp vụ:**
  - **Trong vòng 24 giờ kể từ thời điểm đặt tour:** Khách hàng được quyền huỷ đơn và yêu cầu hoàn tiền 100%. Giao diện hiển thị cảnh báo minh bạch thời hạn hủy hợp lệ.
  - **Sau 24 giờ kể từ thời điểm đặt tour:** Nút huỷ đơn bị vô hiệu hóa / ẩn đi. Hệ thống đưa ra cảnh báo: *"Đã quá 24h kể từ khi đặt đơn, công ty Delta Travel đã hoàn tất sắp xếp xe, phòng khách sạn và dịch vụ tour nên không hỗ trợ hoàn huỷ."*
- **Quy trình thu thập thông tin hoàn tiền:**
  - Khi khách hàng nhấn "Huỷ đơn", giao diện bật modal chuyên dụng yêu cầu cung cấp:
    - Ngân hàng nhận tiền hoàn
    - Số tài khoản thụ hưởng
    - Tên chủ tài khoản
    - Lý do huỷ tour
  - Trạng thái đơn được chuyển sang: `REFUND_PENDING` (Chờ hoàn tiền).
- **Phía quản trị viên (Admin):**
  - Hiển thị nhãn cảnh báo đỏ `YÊU CẦU HOÀN TIỀN` kèm thông tin tài khoản ngân hàng khách hàng đã gửi.
  - Cung cấp nút thao tác `[ Xác nhận đã hoàn tiền ]` để quản trị viên đánh dấu đơn hàng thành `REFUNDED` sau khi kế toán đã chuyển khoản thành công.

---

### 3.3. Tự Động Ẩn Tour Hết Hạn Khởi Hành & Cảnh Báo Tour Hết Chỗ Trong Admin
- **Phía Khách hàng (Frontend):**
  - Hệ thống tự động so sánh trường ngày khởi hành (`departure_date`) với thời gian thực tế (`Date.now()`).
  - Các tour có ngày khởi hành đã trôi qua hoặc số chỗ khả dụng bằng `0` sẽ tự động bị ẩn khỏi danh sách gợi ý ngoài trang chủ hoặc gắn nhãn "ĐÃ KHỞI HÀNH / HẾT CHỖ", bảo vệ trải nghiệm của khách hàng không bị đặt nhầm ngày cũ.
- **Phía Quản trị viên (Admin Dashboard):**
  - Tích hợp 2 thẻ cảnh báo thông minh:
    1. **Thẻ cảnh báo Tour đã hết hạn khởi hành (Expired Departure Tours):** Liệt kê danh sách tour có ngày đi đã qua để quản trị viên kịp thời cập nhật đợt khởi hành mới.
    2. **Thẻ cảnh báo Tour đã bán hết chỗ (Sold Out Tours):** Nhắc nhở ban điều hành mở thêm chỗ hoặc bổ sung chuyến xe tăng cường.

---

### 3.4. Hệ Thống Phiếu Vé Điện Tử Chuẩn Luxury (E-Ticket) & Hóa Đơn VAT Điện Tử
- **Module chuyên trách:** `Frontend/assets/js/services/ticket-invoice-service.js`
- **Phiếu vé Luxury E-Ticket (Chuẩn Hàng không & Du thuyền quốc tế):**
  - Tích hợp **Mã vạch 1D (Barcode chuẩn Code 128 / Code 39)** hiển thị rõ nét bằng thư viện JsBarcode.
  - Mã vé định danh duy nhất theo chuẩn: `TK-BK[Mã Đơn]` (Ví dụ: `TK-BK3887031139`).
  - Đầy đủ thông tin: Logo Delta Travel chuẩn vàng kim, Tên hành khách, Số điện thoại, Email, Tuyến tour, Thời gian khởi hành, Điểm tập trung, Số ghế/Số lượng khách, Mã vé Barcode, QR Code xác thực nhanh và Tem bảo hành dịch vụ 5 sao.
  - Hỗ trợ xem trực tuyến dạng modal, in trực tiếp và tải file PDF về máy điện thoại/máy tính với kích thước chuẩn trang in.
- **Hóa đơn GTGT điện tử (Official VAT E-Invoice):**
  - Đầy đủ số hiệu hóa đơn `INV-...`, ký hiệu mẫu số, ngày lập, thông tin bên bán và bên mua.
  - Bảng kê chi tiết đơn giá, thành tiền, thuế giá trị gia tăng (VAT 10%) và tổng thanh toán đã bao gồm thuế.
- **Quy tắc phân quyền xuất vé:**
  - **CHỈ ÁP DỤNG KHI THANH TOÁN XONG VÀ ĐƯỢC ADMIN XÁC NHẬN (`CONFIRMED`, `COMPLETED`):** Nút `[ Phiếu vé (Ticket Online) ]` và `[ Lưu hóa đơn ]` mới hiển thị chính thức cho hành khách để check-in lên tour.
  - **KHI ĐÃ THANH TOÁN QUA NGÂN HÀNG / SEPAY NHƯNG CHƯA ĐƯỢC ADMIN DUYỆT (`PAID`):** Hệ thống hiển thị nhãn `ĐÃ THANH TOÁN (CHỜ ADMIN DUYỆT)`, cho phép lưu hóa đơn chứng từ nhưng **chưa phát hành vé check-in** cho đến khi Quản trị viên đối soát và xác nhận đơn.
  - **ĐƠN CHƯA THANH TOÁN (`PENDING_PAYMENT`) HOẶC ĐÃ HỦY (`CANCELLED`, `REFUND_PENDING`, `REFUNDED`):** Tuyệt đối KHÔNG cấp vé điện tử, nút vé bị ẩn hoàn toàn để đảm bảo an ninh kiểm soát vé.

---

### 3.5. Bảng Điều Khiển Quản Lý Check-In Khách Lên Tour (Admin Boarding Pass Management)
- Tích hợp cột **"Mã Đơn & Mã Vé"** trực quan trong bảng Quản trị Đơn hàng (`admin.html`):
  - Mã đơn: `BK...`
  - Mã vé: `TK-BK...`
- Cột **"Vé & Check-in"**:
  - Trạng thái vé hiển thị rõ ràng: `SẴN SÀNG CHECK-IN` (màu xanh dương) hoặc `ĐÃ CHECK-IN` (màu xanh lá cây).
  - Nút `[ Phiếu Vé ]`: Cho phép hướng dẫn viên hoặc nhân viên soát vé xem trước phiếu vé để đối soát số lượng người và giấy tờ tùy thân.
  - Nút `[ Check-in ]` (1-click): Xác nhận khách đã lên tour thành công. Sau khi ấn, hệ thống ghi nhận trạng thái check-in, cập nhật đơn hàng thành `COMPLETED` và ngăn ngừa tình trạng một vé bị sử dụng nhiều lần (chống gian lận vé).
- Thanh tìm kiếm thông minh: Cho phép nhân viên gõ tìm kiếm theo **Mã vé (`TK-...`)**, **Mã đơn (`BK...`)**, **Họ tên khách** hoặc **Số điện thoại**.

---

### 3.6. Phân Quyền Người Dùng Nghiêm Ngặt & Bảo Mật Tài Khoản (Strict RBAC & Privacy)
- **Quy tắc Phân quyền (RBAC): Khách chưa đăng nhập CHỈ ĐƯỢC XEM TOUR:**
  - *Hiện tượng trước đây:* Khách vãng lai chưa đăng nhập vẫn có thể tạo đơn giữ chỗ trực tiếp.
  - *Giải pháp triệt để:*
    1. **Backend API:** Endpoint `POST /api/v1/bookings`, `POST /api/v1/bookings/:id/pay`, `POST /api/v1/bookings/:id/cancel` áp dụng middleware `requireAuth`. Khách chưa đăng nhập bị chặn với mã lỗi `401 Unauthorized` kèm thông báo: *"Bạn cần đăng nhập để đặt tour. Khách chưa đăng nhập chỉ có quyền xem thông tin tour."*
    2. **Frontend UI:** Trên trang chủ `index.html`, nút "Đặt tour / Đặt ngay" kiểm tra trạng thái đăng nhập. Nếu chưa đăng nhập, hệ thống hiển thị thông báo và bật ngay modal Đăng nhập/Đăng ký. Trên trang `booking.html`, hiển thị Banner cảnh báo màu vàng "Yêu cầu đăng nhập tài khoản để đặt tour", đồng thời vô hiệu hóa nút gửi đơn cho đến khi khách đăng nhập.
    3. Tích hợp trực tiếp modal xác thực đa năng (Đăng nhập, Đăng ký, Quên mật khẩu) ngay trong `booking.html` kèm thư viện Bootstrap 5 JS, giúp khách hàng đăng nhập tức thì mà không bị gián đoạn tiến trình chọn tour.
- **Khắc phục lỗi "Kẹt tài khoản" sau khi đặt tour dạng khách (Guest Booking):**
  - Cho phép khách kích hoạt lại (Claim Account), cập nhật mật khẩu mới và tự động đăng nhập an toàn.
- **Hỗ trợ Đăng nhập linh hoạt & Quên mật khẩu:**
  - Không phân biệt chữ hoa / chữ thường trong Email (`LinhMiki...` và `linhmiki...` đều hợp lệ).
  - Tự động cắt bỏ khoảng trắng thừa đầu cuối của Số điện thoại.
  - Triển khai endpoint `POST /api/v1/auth/reset-password` và kết nối form Quên mật khẩu giúp người dùng tự đặt lại mật khẩu bằng email hoặc số điện thoại chỉ trong 3 giây.
- **Bảo mật quyền riêng tư sau khi Đăng xuất (Logout Privacy Gate):**
  - Hàm `handleUserLogout` xóa triệt để `delta_customer_bookings`, `delta_user`, `token` trong cả `localStorage` và `sessionStorage`. Khi chưa đăng nhập, trang `my-bookings.html` chuyển sang giao diện "Cổng tra cứu bảo mật".

---

### 3.7. Hạ Tầng Triển Khai Render Cloud & Tunnel Relay
- Cấu hình file `render.yaml`, khai báo phiên bản Node.js và môi trường chạy chính xác.
- Tự động hóa quá trình triển khai lên `https://delta-travel.onrender.com` mỗi khi có commit mới lên branch `main`.
- Bổ sung cơ chế Tunnel Relay (`POST /api/v1/dev/tunnel-relay-register`) để luân chuyển webhook SePay từ server Cloud về máy trạm lập trình viên khi cần kiểm thử.
- Tích hợp bộ bắt lỗi toàn cục `uncaughtException`, `unhandledRejection` và Express JSON Error Handler nhằm đảm bảo máy chủ không bị gián đoạn hoạt động khi có request bất thường.

---

## 4. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST VERIFICATION)

Hệ thống đã trải qua quy trình kiểm thử tự động nghiêm ngặt bằng bộ test script tích hợp:
- **Tập tin kiểm thử:** `test_node_server.js`
- **Số lượng kịch bản:** **65 / 65 Test Cases**
- **Tỷ lệ thành công:** **100.0% PASSED**

### Các nhóm bài kiểm thử trọng yếu:
1. **Health Check & Static Files Serving:** Đảm bảo toàn bộ HTML, CSS, JS tải thông suốt.
2. **Auth Suite & RBAC:** Đăng ký, Đăng nhập, Claim tài khoản khách, Quên mật khẩu, **Chặn khách chưa đăng nhập đặt tour (HTTP 401)**, Phân quyền Admin/Customer.
3. **Dual Database Queries:** Truy vấn danh mục tour, kiểm tra liên kết SQL Server và SQLite.
4. **Voucher Validation:** Áp dụng mã giảm giá, kiểm tra ràng buộc số tiền tối thiểu và ngày hết hạn.
5. **Booking Lifecycle:** Tạo đơn đặt tour, tính thuế VAT 10%, quản lý giữ chỗ trong 15 phút.
6. **SePay Webhook Verification:** Giả lập giao dịch VietQR MBBank, kiểm tra tự động kích hoạt đơn `CONFIRMED`.
7. **24h Cancellation & Refund:** Kiểm thử huỷ đơn trong 24 giờ hợp lệ, chặn huỷ sau 24 giờ, cập nhật trạng thái `REFUND_PENDING` -> `REFUNDED`.
8. **E-Ticket & Barcode Integrity:** Kiểm tra điều kiện chỉ cấp vé cho đơn đã thanh toán, kiểm tra định dạng mã vé `TK-BK...`.
9. **Admin Check-in & Search:** Kiểm thử quy trình soát vé tại quầy và tìm kiếm đa năng.

---

## 5. HƯỚNG DẪN TRUY CẬP VÀ VẬN HÀNH

- **Trang chủ dịch vụ:** [https://delta-travel.onrender.com](https://delta-travel.onrender.com)
- **Trang quản trị (Admin):** [https://delta-travel.onrender.com/admin.html](https://delta-travel.onrender.com/admin.html)
- **Trang tra cứu đơn hàng & Vé điện tử:** [https://delta-travel.onrender.com/my-bookings.html](https://delta-travel.onrender.com/my-bookings.html)
- **Tài khoản kiểm thử quản trị:** Nhấn nút `[ Đăng nhập 1-Click ]` trên giao diện đăng nhập Admin hoặc sử dụng email `admin@deltatravel.vn` (mật khẩu đã được thiết lập mặc định trong môi trường nội bộ).

---
*Báo cáo được khởi tạo tự động và tổng hợp đầy đủ từ mã nguồn dự án Delta Travel.*
