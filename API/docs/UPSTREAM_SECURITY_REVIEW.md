# Audit nguồn Delta Travel 2.0 của An, ngày 18/10/2026

**Repository gốc:** `https://github.com/Anniehatani/deltatrdelt2.0` (default branch `main` tại thời điểm kiểm tra). Chỉ có HTML/CSS/JS/images và README. Được đọc qua GitHub connector, không có quyền push. Các phát hiện dưới đây gắn với bản nguồn được đọc; hãy xác minh lại trước khi merge vì repo có thể tiếp tục thay đổi.

## Những lỗi cần loại bỏ khi đưa website lên server

1. `assets/js/auth.js`: đăng ký/đăng nhập và đổi mật khẩu trên `localStorage` với dữ liệu người dùng trong trình duyệt. README gốc ghi rõ tài khoản được xử lý hoàn toàn frontend và có tài khoản demo. Đây không phải xác thực an toàn, mọi khách đều có thể đọc/sửa dữ liệu trong trình duyệt. Thay toàn bộ luồng bằng `POST /api/v1/auth/register`, `/auth/login`, `/auth/logout`, `PATCH /auth/profile`; không mang tài khoản demo sang production.
2. `assets/js/main.js` dòng logic được đọc gần đoạn `handleBookingSubmission`: `isPaid = (AppState.selectedPaymentMethod !== 'cash')`. Kết quả đánh dấu "ĐÃ THANH TOÁN" dù chỉ chọn phương thức QR/thẻ/ví. Phải loại bỏ tự ghi nhận `paid`/tự tạo vé; đơn chỉ là `PENDING_PAYMENT` đến khi được verify.
3. `assets/js/main.js`: tính giá bằng `TOURS_DATA` và voucher frontend, lưu booking trong `localStorage`. Không cho browser quyết định giá hay kho chỗ. Backend tính giá, snapshot khi giữ chỗ, kiểm tra số chỗ trong cùng transaction, kiểm tra hạn hủy và timeout.
4. `assets/js/chatbot.js`: README hướng dẫn điền API key vào file JS của client, và code tạo URL gọi Gemini API trực tiếp từ browser. Khóa có thể bị xem và lạm dụng. Chỉ triển khai Gemini server-side với env secret, rate limit, input/output policy. Bộ demo bàn giao chạy FAQ theo quy tắc và ghi rõ mode.
5. Form `index.html` có các trường số thẻ/CVV. Không nên tự thu thập thông tin thẻ. Dùng hosted checkout của payment provider, xác minh webhook server-side, không lưu CVV.
6. Ảnh và đánh giá/điểm số/ưu đãi quảng cáo chưa có nguồn xác minh thương mại. Demo phải ghi nhãn dữ liệu minh họa, bỏ mọi cam kết thành tích không có chứng cứ.

## Hướng sửa ít rủi ro nhất cho An

Giữ CSS/HTML/screenshot layout gốc nếu muốn, nhưng loại bỏ handlers auth/payment/booking cũ và sử dụng frontend JS mới trong bản bàn giao. Mỗi thay đổi cần PR review để chắc chắn không còn một luồng demo nào có thể tự xác nhận PAID. Không chỉ thêm backend API mà vẫn cho code client cũ chạy song song.

Các endpoint đang có được liệt kê chính thức trong `docs/openapi.json`. Không có endpoint "đã thanh toán" dành cho khách. Việc xác minh thanh toán thủ công của admin chỉ phục vụ demo và cần chứng từ ngân hàng được kiểm tra độc lập.
