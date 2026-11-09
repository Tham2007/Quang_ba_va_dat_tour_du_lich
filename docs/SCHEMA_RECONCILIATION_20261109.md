# Đối soát hợp đồng CSDL Delta Travel | 09/11/2026

**Trạng thái:** kiểm toán tĩnh trên tài liệu, file SQL và mã nguồn GitHub; **chưa xác minh schema/dữ liệu SmarterASP đang chạy**. Không coi URL `172.17.145.31:3000` (địa chỉ IP riêng) là bằng chứng kết nối SQL Server đối với môi trường ngoài mạng nội bộ.

## Kết luận kỹ thuật

**Mốc gốc đồ án là 12 bảng nghiệp vụ tiếng Việt**: `NGUOIDUNG`, `DANHMUC`, `TOUR`, `HINHANH_TOUR`, `LICH_TRINH_DETAIL`, `CHUYENKHOIHANH`, `DATTOUR`, `CHITIET_HANHKHACH`, `THANHTOAN`, `DANHGIA`, `BAIVIET_QUANGBA`, `AUDITLOG`. Chúng trùng tên các `CREATE TABLE` trong `database/database/01_schema/02_create_tables_3nf.sql` và database.zip do Thắm gửi.

Ba bảng `API_PHIENDANGNHAP`, `API_YEUCAU_DATTOUR`, `API_TOUR_COST_ITEM` **không thuộc 12 bảng gốc**. Repo hiện có migration `001_auth_sessions_idempotency.sql` và `002_admin_and_catalog_management.sql` để tạo chúng cho staging, nếu chủ DB phê duyệt. Vì thế: **12 bảng nghiệp vụ** khác với **tổng số bảng vật lý sau khi áp dụng migration** (có thể là 15), không được nhập nhằng.

## Các nguồn mâu thuẫn phải xử lý

| Nguồn | Mô tả | Đánh giá |
| --- | --- | --- |
| `database.zip`, `02_create_tables_3nf.sql` | Tạo 12 bảng, một số cột ít hơn bản mở rộng | Là baseline 12 bảng, **không phải migration an toàn**: có `DROP TABLE` |
| `DATABASE_SCHEMA (2).md` | 12 bảng, đề nghị không thêm phụ trợ | Tài liệu nghiệp vụ, không phải bản chụp SQL thực tế |
| `DATABASE_SCHEMA (1).md` | 12 bảng với các cột `TokenHash`, `CsrfHash`, `HetHan`, `ChiPhiChiTiet`, `KhoaYeuCau`, `DauVanTay` đã gộp | Là **phương án thay thế**, chưa được chứng minh đã migrate/đáp ứng đa phiên |
| `DATABASE_SCHEMA(1).md` | 15 bảng, ba bảng `API_*` riêng | Phương án có infrastructure tables; tuyên bố “15 hiện hữu” phải xác minh SQL thật |
| `DATABASE_SCHEMA.md` tại main | 12 bảng, có khẳng định khớp 100% DB thật | **Chưa có bằng chứng kiểm tra metadata trực tiếp** trong tài liệu; không được phát biểu 100% |
| `migrations/sqlserver/001_...`, `002_...` | Migration staging thêm 3 bảng phụ và một số cột, đổi quyền admin | Cần backup, chấp thuận schema, kiểm thử và đối chiếu với schema thực tế |

### Những chỗ không thể đồng nhất bằng đổi tên

- `NGUOIDUNG` trong SQL gốc **không có `VaiTro`**, còn API quản trị cần quyền có kiểm chứng. Migration 002 có thêm `VaiTro`.
- `TOUR` gốc không chứa `Slug`, `Duration`, `Departure`, `Transport`, `GiaGoc`, `FlashSale` hay trường chi phí. Migration 002 chỉ thêm một số trường.
- `DATTOUR` gốc không có `KhoaYeuCau`/`DauVanTay`, trong khi migration 001 dùng bảng riêng `API_YEUCAU_DATTOUR`; đây là hai phương án **không tương đương**, không tự ý triển khai đồng thời.
- `API_PHIENDANGNHAP` hỗ trợ **nhiều phiên trên một tài khoản**; nhét một bộ `TokenHash/CsrfHash/HetHan` vào mỗi dòng `NGUOIDUNG` chỉ biểu diễn được một phiên cùng lúc nếu không có thiết kế khác.
- `DANHGIA` trong SQL baseline có `UNIQUE(MaDatTour)`: tối đa một đánh giá trên một đơn. Một số tài liệu 15 bảng vẽ quan hệ 1-N. Cần thống nhất logic 1-1 trước khi công bố ERD.
- Dùng `users/tours/schedules/bookings/audit_log` là nhánh Node/SQLite hoặc schema demo riêng, **không phải tên 12 bảng SQL Server tiếng Việt**. Đổi tên theo văn bản không tự chuyển dữ liệu.
- Endpoint `/api/v1/health/ready` trả 200 chỉ xác nhận điều kiện health được mã hóa, **không chứng minh ghi đơn, trả ghế hay đối soát thanh toán**.

## Quyết định tạm thời an toàn

1. **Bảo toàn 12 bảng nghiệp vụ gốc**, không sửa trực tiếp bất kỳ bảng, cột, FK hay dữ liệu nào chỉ vì một tài liệu xuất hiện.
2. Ba bảng `API_*` là **phương án hạ tầng tùy chọn** cho backend SQL Server write API, phải có sự đồng thuận Thắm + cả nhóm + thầy về quy tắc “12 bảng”. Nếu thầy yêu cầu đúng 12 bảng vật lý, migration 001/002 **không được chạy**; thiết kế lại session/idempotency/chi phí trước khi bật SQL writes.
3. Không chạy lại `02_create_tables_3nf.sql`, `full_database_deploy.sql`, migration xóa bảng, hoặc `scripts/revert_extra_tables.js` trên SmarterASP thật. Đặc biệt `02_create_tables_3nf.sql` có lệnh `DROP TABLE`.
4. Chạy **chỉ đọc** `database/database/scripts/sqlserver_schema_preflight_readonly.sql` trong SSMS sau khi xác minh server và database đúng. Lưu đầy đủ 5 result sets, **xóa thông tin nhạy cảm** trước khi chia sẻ.
5. Đối chiếu SQL metadata với 12 bảng, các cột mở rộng, PK/FK, SP/trigger; sao lưu và kiểm thử staging độc lập trước khi đề xuất bất kỳ migration.
6. Mật khẩu SQL Server từng lộ trong chat và GitHub phải được thay ngay; chỉ sử dụng Render encrypted environment variables. Xem Issue #28.
7. `http://172.17.145.31:3000` là IP private, chỉ có thể kiểm tra từ thiết bị có đường mạng tới host đó; không nên dùng làm URL demo công khai.

## Phân công và tiêu chí hoàn thành

- **Thắm:** chạy script read-only trong SSMS với tài khoản chỉ đọc, xác nhận 12 hay 15 bảng hiện hữu, chụp màn hình danh sách bảng/PK/FK và export **chỉ metadata**, không gửi password, connection string hay dữ liệu khách.
- **An:** đối chiếu giao diện FE với API, đặc biệt luồng đặt/hủy, trang quản trị và phiên VI/EN; không gọi nhầm SQLite demo là SQL Server.
- **Phúc:** xác nhận endpoint deployment, SHA build, dịch vụ SQL Server đang dùng và biến môi trường đã xoay mật khẩu; không nhập secret vào repo hay chat.
- **Đăng:** kiểm thử thật E2E SQL Server **trên staging dữ liệu giả**: đăng nhập, giữ chỗ, hai request tranh một ghế, idempotency, hủy và hồi ghế, restart, kiểm tra quyền, từ chối tiền chưa đối soát.
- **Mạnh:** chốt ADR sau khi có số liệu; không merge migration hoặc PR thay đổi schema trước khi được duyệt.

**Tiêu chí PASS:** xác nhận metadata bằng SSMS, schema quyết định được tất cả 5 thành viên đồng ý, 3/3 CI của commit mục tiêu PASS, thử write/read/cancel SQL Server staging thật và chứng minh không sửa dữ liệu production. Đến trước các gate này: **chưa đủ bằng chứng production E2E**.
