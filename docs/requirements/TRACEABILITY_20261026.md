# Traceability UC ↔ Database Thắm ↔ API

**Ngày:** 26/10/2026. **Nguồn UC:** bản phân tích 12 bảng Thắm gửi (UC-01 đến UC-20). **Lưu ý:** "Có bảng SQL" khác với "có DB đã chạy"; "API cũ demo" khác "API đã kết nối DB Thắm". Chỉ endpoint của `api.tham_sqlserver_app` được ghi là **READ-MOCKED** sau PR #8.

| UC | Bảng 12-table liên quan | API theo schema Thắm đang có | Trạng thái |
|---|---|---|---|
| 01 danh sách/lọc | TOUR, DANHMUC, CHUYENKHOIHANH | GET /api/v1/tours, GET /api/v1/categories | READ-MOCKED |
| 02 chi tiết/gallery/ngày | TOUR, HINHANH_TOUR, LICH_TRINH_DETAIL, CHUYENKHOIHANH | GET /api/v1/tours/{id}, /gallery, /itinerary, /schedules | READ-MOCKED |
| 03 quảng bá/banner | BAIVIET_QUANGBA | GET /api/v1/articles, /articles/{id} | Bài viết READ-MOCKED; banner chưa xác minh |
| 04 tư vấn/liên hệ | **thiếu entity** | Chưa có | BLOCKED schema |
| 05 đăng ký/đăng nhập | NGUOIDUNG, **thiếu session schema** | Chỉ có trong backend SQLite demo cũ | BLOCKED DB/auth |
| 06 hồ sơ | NGUOIDUNG, **thiếu session schema** | Chỉ có trong backend demo cũ | BLOCKED DB/auth |
| 07 yêu thích | **thiếu favorites** | Chỉ có trong backend demo cũ | BLOCKED schema |
| 08 đặt tour + hành khách | DATTOUR, CHUYENKHOIHANH, CHITIET_HANHKHACH | POST /api/v1/bookings/quote chỉ báo giá người lớn; POST /bookings bị chặn 503 | QUOTE-MOCKED / WRITE-BLOCKED |
| 09 lịch sử đơn | DATTOUR, CHUYENKHOIHANH | Chưa có API xác thực dùng SQL Server | BLOCKED DB/auth |
| 10 đổi/hủy/hoàn tiền | DATTOUR, THANHTOAN | Chưa có API an toàn; stored procedures hiện có chưa review | BLOCKED nghiệp vụ |
| 11 đánh giá | DANHGIA, DATTOUR | Chưa có API ghi theo quyền khách | BLOCKED auth/DB |
| 12 quyền người dùng | NGUOIDUNG, **thiếu VaiTro** | Chưa có | BLOCKED security |
| 13 quản trị tour/gallery | TOUR, DANHMUC, HINHANH_TOUR, LICH_TRINH_DETAIL | Chưa có API admin SQL Server | BLOCKED auth |
| 14 quản lý lịch | CHUYENKHOIHANH | Chưa có API admin SQL Server | BLOCKED auth |
| 15 quản lý bài viết | BAIVIET_QUANGBA | Chưa có API admin SQL Server | BLOCKED auth |
| 16 quản lý đơn | DATTOUR | Chưa có API admin SQL Server | BLOCKED auth/logic |
| 17 xác nhận thanh toán | DATTOUR, THANHTOAN, AUDITLOG | POST /api/v1/admin/bookings/{id}/confirm-payment cố ý 503 | BLOCKED financial verification |
| 18 duyệt đánh giá | DANHGIA | Chưa có API admin SQL Server | BLOCKED auth |
| 19 báo cáo | DATTOUR, THANHTOAN | Có SQL stored procedures, chưa API tích hợp chạy thật | BLOCKED integration |
| 20 audit log | AUDITLOG | Có bảng SQL, chưa API admin tích hợp | BLOCKED auth/integration |

## Căn cứ test và quy tắc tiến độ

- PR #8 đã merge mã **chỉ-đọc** và `11/11` bài mock qua GitHub Actions. Không tính là DB connection/E2E.
- Kịch bản kiểm tra mới: `python -m scripts.check_tham_sqlserver`, account SELECT-only, yêu cầu trạng thái `READ_ONLY_OK`; `SCHEMA_INCOMPLETE` hoặc `NOT_CONNECTED` là NO-GO.
- Thắm sửa schema/ADR → Mạnh triển khai auth/booking/payment với test SQL Server thật → An frontend → Đăng test/UAT → Phúc staging/CI.
- Với mỗi UC muốn đổi thành DONE: cần link PR/commit, API/UI chạy trên DB thật, chứng cứ test, review và không có lỗi P0/P1.
