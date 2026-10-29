# Delta Travel — Frontend do An bàn giao (DEMO)

**Ngày đồng bộ:** 29/10/2026. Nguồn: [repo của Lê Văn An](https://github.com/Anniehatani/deltatrdelt2.0), commit `2457a46d6f3ffdabc4d246b9f61dc260ac4d1c50`.

Dự án gồm website khách hàng `index.html`, portal admin `admin.html`, CSS/JS và ảnh tour. **Đây là frontend demo chạy bằng HTML/CSS/JS + localStorage**, chưa tích hợp thật vào FastAPI/SQL Server của nhóm. README và đặc tả gốc của An được lưu ở [README_AN_ORIGINAL.md](README_AN_ORIGINAL.md) và [FRONTEND_STRUCTURE_AN.md](FRONTEND_STRUCTURE_AN.md).

## Chạy thử

Từ thư mục gốc repository:

```powershell
cd Frontend
py -3 -m http.server 5500
```

Mở http://127.0.0.1:5500/ hoặc http://127.0.0.1:5500/admin.html . Để dừng: Ctrl+C.

**Không bắt buộc Node.js để chạy frontend thuần**, nhưng có thể dùng Node.js để kiểm tra cú pháp JS. Không chạy `file://` để đánh giá lỗi URL tài nguyên. Cần mạng để tải Bootstrap, Bootstrap Icons và Google Fonts từ CDN. Không yêu cầu API key cho demo; chatbot không có Gemini key nên không phải dịch vụ AI trực tuyến.

## Những điều KHÔNG ĐƯỢC dùng thật

- Tài khoản demo nằm trong `localStorage`, bao gồm thông tin đăng nhập mẫu **không an toàn như xác thực backend**. Không dùng mật khẩu thật, dữ liệu khách hàng, CCCD hoặc số tài khoản.
- Admin hỗ trợ đổi phiên tài khoản mẫu nhưng **không có quyền server-side RBAC**. Bất kỳ người dùng nào có trình duyệt có thể chỉnh localStorage.
- Đơn đặt trên trang chỉ lưu **dữ liệu mô phỏng** trên một trình duyệt; không trừ chỗ trên SQL Server. Trạng thái đơn mới cố định `PENDING_DEMO`; không đánh dấu `PAID`.
- Không nhận thẻ/CVV, không thu tiền, không chuyển khoản QR dù có hình minh họa.
- Nội dung marketing, tour, lịch trình và doanh thu là dữ liệu demo.
- Có giao diện thanh toán/hoàn tiền và admin để trình bày, nhưng chưa được coi là hoạt động thật.
- File JS/HTML do An viết có nhiều `innerHTML` và dữ liệu client-controlled; cần review XSS và chuyển auth/booking sang FastAPI **trước khi mở public**.

## Đã chỉnh khi đồng bộ

- Import đúng thư mục `Frontend/` trên repo nhóm (không đè lên `API/frontend/` demo của backend).
- Hiển thị banner thông báo demo trên cả hai trang.
- Bỏ form nhập số thẻ/CVV; không tự đánh dấu đơn thanh toán khi chọn QR/ví điện tử.
- Không lưu CCCD vào đơn mới của localStorage; sửa regex số điện thoại.
- CI kiểm tra cú pháp JS, đường dẫn asset, HTTP static smoke và quy tắc demo/payment.

## Các mốc cần làm tiếp để hoàn thiện thật

1. **Thắm và Phúc:** SQL Server test có ERD/role/giữ chỗ đã duyệt, đưa bằng chứng `READ_ONLY_OK` của `API/scripts/check_tham_sqlserver.py`.
2. **Mạnh:** tích hợp các endpoints FastAPI phù hợp schema cuối, auth/session/RBAC, giá server, booking atomic/idempotent, trạng thái thanh toán được đối soát thật.
3. **An:** chuyển data.js và auth.js khỏi localStorage; dùng JSON contract được duyệt, tạo giao diện error/loading/no-data và lưu session an toàn, xóa đăng nhập nhanh admin khi có backend thật.
4. **Đăng:** kiểm thử trên dữ liệu giả: browser smoke, XSS, IDOR, RBAC, pricing, concurrency, 401/404, thanh toán không tự `PAID`.
5. **Phúc:** deploy staging từ repo nhóm, HTTPS, secrets/backup/rollback và log.

Chỉ coi hệ thống end-to-end DONE sau khi tất cả bài test FE → FastAPI → SQL Server thật đạt, không chỉ vì giao diện đẹp hoặc CI static xanh.
