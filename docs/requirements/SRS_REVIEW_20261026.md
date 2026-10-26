# SRS baseline V1 từ tài liệu phân tích 12 bảng của Thắm

**Ngày rà soát:** 26/10/2026. **Trạng thái:** BẢN CHỜ NHÓM/THẦY DUYỆT, không tự nhận là SRS được giảng viên phê duyệt.

**Nguồn:** `phan_tich_nghiep_vu_12_bang_txt.txt` do Thắm chia sẻ; mã trong `database/`, `API/` của repo. Giữ tên use case/đối tượng/vùng chức năng theo tài liệu Thắm. Những cột chưa có trong DB hoặc những API chưa có đều được đánh dấu chưa triển khai, không suy diễn đã hoàn thành.

## 1. Phạm vi và tác nhân

**Mục tiêu V1:** website quảng bá và đặt tour trực tuyến; danh mục/tour, gallery, lịch trình ngày, lịch khởi hành, khách và hành khách đi cùng, tạo đơn/giữ chỗ, trạng thái thanh toán thủ công, bài viết, đánh giá, báo cáo, audit.

**Vai trò trong bản phân tích:** Guest, KhachHang, NhanVien, Admin. **Còn thiếu:** `NGUOIDUNG` hiện chưa có cơ chế lưu `VaiTro`/RBAC dù UC-12 yêu cầu. Không thể suy role từ input frontend.

**Ngoài phạm vi V1 theo Thắm:** cổng thanh toán tự động, hệ thống nhiều tầng đại lý, theo dõi hướng dẫn viên theo thời gian thực.

## 2. Use cases nguồn (mã UC-01 đến UC-20 của Thắm)

| Vai trò | UC | Mô tả |
|---|---|---|
| Guest | UC-01 | Danh sách/tìm kiếm/lọc tour |
| Guest | UC-02 | Chi tiết, ảnh gallery, lịch trình từng ngày |
| Guest | UC-03 | Bài viết quảng bá/banner |
| Guest | UC-04 | Gửi tư vấn/liên hệ |
| Guest | UC-05 | Đăng ký tài khoản/đăng nhập |
| KhachHang | UC-06 | Đăng nhập/đăng xuất/quản lý tài khoản |
| KhachHang | UC-07 | Lưu tour yêu thích |
| KhachHang | UC-08 | Đặt tour, nhập danh sách hành khách |
| KhachHang | UC-09 | Lịch sử/trạng thái đơn |
| KhachHang | UC-10 | Đổi lịch/hủy/hoàn tiền theo quy trình |
| KhachHang | UC-11 | Đánh giá và ảnh sau khi hoàn thành |
| Admin/NhanVien | UC-12 | Quản trị tài khoản/vai trò |
| Admin/NhanVien | UC-13 | Quản trị danh mục, tour, gallery, lịch trình |
| Admin/NhanVien | UC-14 | Quản trị lịch khởi hành/chỗ |
| Admin/NhanVien | UC-15 | Quản trị bài viết/banner |
| Admin/NhanVien | UC-16 | Quản trị trạng thái đơn |
| Admin/NhanVien | UC-17 | Xác minh và cập nhật thanh toán |
| Admin/NhanVien | UC-18 | Kiểm duyệt/trả lời đánh giá |
| Admin/NhanVien | UC-19 | Báo cáo/thống kê |
| Admin/NhanVien | UC-20 | Tra cứu nhật ký AuditLog |

## 3. Quy tắc và tiêu chí nghiệm thu từ tài liệu Thắm

- **AC1:** lọc Đà Nẵng, giá 3–5 triệu; trả đúng tour, empty state khi không có.
- **AC2:** đăng ký/đăng nhập, hash mật khẩu và từ chối email trùng.
- **AC3:** còn 5 chỗ, đặt 3 giữ 3; đặt 3 khi còn 2 phải từ chối, không overbooking.
- **AC4:** nhân viên xác minh thanh toán rồi cập nhật đơn và audit.
- **AC5:** chỉ đánh giá tour đã hoàn thành; một đơn tối đa một đánh giá.
- **NFR theo tài liệu:** thời gian phản hồi trang tìm tour dưới 2 giây, tạo đơn dưới 3 giây, đồng thời có khóa/transaction, bcrypt/Argon2, HTTPS/SQL injection/XSS/CSRF, chuẩn hóa 3NF, responsive. **Đây là chỉ tiêu cần đo**, chưa có chứng cứ số đo.
- **Quy tắc bổ sung cần giải quyết:** AC3 nói giữ ghế tại tạo đơn; AC4 vừa lại nói tăng `SoChoDaDat` tại thanh toán. SQL trigger thực tế tăng chỗ khi INSERT. Chốt một nguồn sở hữu số ghế và không tăng 2 lần.

## 4. Điểm chưa quyết định

1. Chọn **SQL Server hay PostgreSQL** chính thức: SQL repo hiện là SQL Server, backend mẫu từng dùng PostgreSQL/SQLite.
2. VaiTro và phân quyền an toàn; guest/contact/favorites không có bảng tương ứng trong đúng 12 bảng.
3. Thời hạn giữ chỗ, retry/idempotency, cách hết hạn và hoàn chỗ, bằng chứng kế toán/hoàn tiền.
4. Snapshot giá, múi giờ `DATETIME`, chính sách giá trẻ em, quy định thông tin từng hành khách.
5. API public/auth/admin cuối cùng dùng đường dẫn/JSON thống nhất thế nào.
6. Tài liệu thầy, tiêu chí chấm, ngày nộp và phạm vi demo.

## 5. Phân công để chốt SRS

- **Mạnh:** tổng hợp SRS, chốt UC/nội dung thanh toán cùng cả nhóm, chuẩn hóa API contract.
- **Thắm:** ERD, data dictionary, quy tắc giữ chỗ, vai trò, migration và database test.
- **An:** xác nhận những UC có màn hình và trường dữ liệu; bàn giao FE trong `Frontend/`.
- **Đăng:** viết test case AC1–AC5 và negative flows, đo NFR.
- **Phúc:** môi trường CI, SQL Server kiểm thử/staging và nhật ký deployment.

**Acceptance để gọi SRS là Done:** Tài liệu đối chiếu đề bài của thầy + nhóm duyệt, các điểm mâu thuẫn có ADR/chữ ký hoặc xác nhận và mã UC khớp ma trận traceability. Tài liệu này **chưa đạt điều kiện đó**.
