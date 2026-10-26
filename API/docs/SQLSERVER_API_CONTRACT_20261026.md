# API contract SQL Server 12 bảng | 26/10/2026

**Ứng dụng:** `uvicorn api.tham_sqlserver_app:app` (độc lập với `api.app` demo cũ). **Trạng thái:** READ-ONLY và quote; không có auth hoặc ghi booking an toàn. Tất cả endpoint bên dưới cần xác minh với SQL Server thật.

| Method | Endpoint | Đọc từ | Phạm vi |
|---|---|---|---|
| GET | /api/v1/health/ready | INFORMATION_SCHEMA | Thấy đủ tên 12 bảng cơ bản, không xác nhận các cột |
| GET | /api/v1/categories | DANHMUC | Tên, mô tả danh mục |
| GET | /api/v1/tours | TOUR, DANHMUC | Tour mở bán, q/category/max_price; tối đa 100 tour |
| GET | /api/v1/tours/{id} | TOUR, DANHMUC | Tour công khai |
| GET | /api/v1/tours/{id}/schedules | CHUYENKHOIHANH | Chuyến đi tương lai, giá thực tế và số chỗ |
| GET | /api/v1/tours/{id}/gallery | HINHANH_TOUR | Danh sách ảnh theo tour |
| GET | /api/v1/tours/{id}/itinerary | LICH_TRINH_DETAIL | Lịch từng ngày |
| GET | /api/v1/articles | BAIVIET_QUANGBA | Bài viết đang công khai |
| GET | /api/v1/articles/{id} | BAIVIET_QUANGBA | HTML nguồn chưa sanitize; frontend phải sanitize |
| POST | /api/v1/bookings/quote | CHUYENKHOIHANH, TOUR | Chỉ báo giá người lớn, `quoteOnly=true` |
| POST | /api/v1/bookings | Không ghi | **503 có chủ ý** |
| POST | /api/v1/admin/bookings/{id}/confirm-payment | Không ghi | **503 có chủ ý** |

## Ví dụ request báo giá

```json
{"schedule_id":"42","adults":2,"children":0,"infants":0}
```

Response: `scheduleId`, `tourId`, `seats`, `availableSeats`, `unitPrice`, `totalPrice`, `currency`, `quoteOnly: true`. Số trên chỉ là hình dạng dữ liệu, không phải vé đặt thành công. Giá VND phải nguyên; chính sách trẻ em/infant chưa thống nhất nên trả 409 nếu khác 0.

## Kiểu và điểm cần An lưu ý

- PK SQL Server `INT`, API hiện chuyển các ID sang string. Không ghép chuỗi tùy ý vào SQL; driver dùng bound parameters.
- Giá VND trả int; `TOUR.GiaKhuyenNghi` khác `CHUYENKHOIHANH.GiaThucTe`; **khi báo giá dùng GiaThucTe**.
- SQL Server `DATETIME/GETDATE` không mang timezone; `departureTimeZone: unspecified` cho đến khi nhóm quyết định.
- Không suy diễn duration/region/flash_sale từ trường chưa có; filter `region` và `flash` bị từ chối 422.
- Chi tiết bài viết có `contentHtmlUntrusted`; cần sanitize theo allowlist khi render, không dùng raw `innerHTML`/HTML không kiểm soát.
- Để chạy API FE ↔ BE ↔ DB thật, còn cần duyệt thống nhất domain/origin, session/cookie/CSRF, thời điểm giữ chỗ, admin role và chính sách thanh toán.

## Definition of done cho API thật

Nhóm chốt DBMS; SQL Server có schema + dữ liệu test và user chỉ SELECT; runbook nhận `READ_ONLY_OK`; QA gọi từng endpoint và so kết quả DB; tiếp đó xây auth/booking/payment với migration/test SQL Server và review. Mock CI xanh không tính DONE.
