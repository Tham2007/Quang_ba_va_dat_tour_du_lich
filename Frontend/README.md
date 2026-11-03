# Giao Diện Frontend Delta Travel

> Cổng website thương mại điện tử du lịch nghỉ dưỡng và hệ thống điều hành quản trị trực tuyến thuần HTML5, CSS3, JavaScript ES6+ và Bootstrap 5.

## Cấu trúc thư mục

- `index.html`: Cổng khách hàng thương mại (Lọc tour, Chi tiết lịch trình, Đặt tour & tính giá thời gian thực, Quản lý đơn, Tra cứu mã vé, Đánh giá khách hàng carousel, Tải avatar cá nhân, Trợ lý AI Concierge).
- `admin.html`: Cổng điều hành quản trị doanh nghiệp (Dashboard số liệu, Quản lý tour & bộ biên tập lịch trình Day-by-Day Itinerary Editor, Quản lý lịch khởi hành, Phê duyệt đơn đặt, Kế toán đối soát thanh toán VietQR / Tiền mặt, Ghi nhận hoàn tiền, Nhật ký kiểm toán bảo mật).
- `assets/js/services/api.js`: Tầng kết nối API Client (`DeltaAPI`) kết nối FastAPI Backend (`/api/v1`) & Database với cơ chế Hybrid Fallback.
- `assets/js/models/data.js`: Quản lý 16 tour mẫu chuẩn UTF-8, cấu trúc storage keys, vouchers.
- `assets/js/controllers/main.js`: Bộ điều khiển trang khách hàng, lọc tour, mở modal lịch trình, tính giá động, đặt tour.
- `assets/js/controllers/auth.js`: Quản lý tài khoản, tải ảnh đại diện Avatar (Canvas Base64), phân quyền Admin 5 thành viên.
- `assets/js/controllers/admin.js`: Bộ điều khiển trung tâm Admin Portal, CRUD tour, Day-by-day Itinerary Builder, duyệt đơn, kế toán.
- `assets/js/controllers/chatbot.js`: Trợ lý AI du lịch Concierge 24/7.
- `FRONTEND_CHI_TIET.md`: Tài liệu đặc tả kỹ thuật chi tiết toàn bộ Frontend và báo cáo đối soát API/Database.

## Hướng dẫn chạy nhanh

Mở tệp `index.html` hoặc `admin.html` bằng trình duyệt web bất kỳ hoặc thông qua Visual Studio Code Live Server.
