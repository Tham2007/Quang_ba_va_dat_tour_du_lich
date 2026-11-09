# DELTA TRAVEL - DATABASE SCHEMA & TÀI LIỆU CẤU TRÚC CƠ SỞ DỮ LIỆU
**Hệ quản trị CSDL:** Microsoft SQL Server (SmarterASP.NET - `sql8020.site4now.net:1433`)  
**Tên Database:** `db_ad0b71_dattour`  
**Đặc tả:** 100% Cấu trúc chuẩn ERD Tiếng Việt gốc - Bảo toàn toàn vẹn thực thể, quan hệ và thuộc tính.

---

## 📌 NGUYÊN TẮC BẢO TOÀN CẤU TRÚC DATABASE (BẮT BUỘC TUÂN THỦ)

1. **Giữ nguyên các thực thể (Entities):** Tuyệt đối không tự ý thêm, xóa hoặc đổi tên 12 bảng gốc của đồ án trong database.
2. **Giữ nguyên các mối quan hệ (Relationships):** Bảo toàn 100% quan hệ 1-1, 1-N, N-N và các khóa ngoại (Foreign Key).
3. **Giữ nguyên các thuộc tính (Attributes):** Không xóa, không đổi tên hoặc thay đổi kiểu dữ liệu, độ dài và thuộc tính NOT NULL của các cột ban đầu.
4. **Giữ nguyên khóa:** Giữ nguyên khóa chính (PK), khóa ngoại (FK), khóa duy nhất (UK) và các ràng buộc toàn vẹn dữ liệu.
5. **Không phá vỡ ERD:** Cấu trúc database luôn đồng bộ và tương thích với bản vẽ thiết kế ERD 12 bảng đã hoàn thành.
6. **Ưu tiên tích hợp vào bảng hiện hữu:** Mọi dữ liệu phụ trợ về phiên bảo mật, cơ cấu chi phí hay chống trùng lặp đơn đều được tích hợp vào các thực thể gốc tương ứng (`NGUOIDUNG`, `TOUR`, `DATTOUR`), tuyệt đối không tạo thêm bảng dư thừa.
7. **Bảo toàn dữ liệu:** Không thực hiện DROP TABLE, TRUNCATE TABLE hoặc xóa dữ liệu nghiệp vụ của đồ án.

---

## 🗺️ BIỂU ĐỒ QUAN HỆ THỰC THỂ (ERD RELATIONSHIPS - 12 BẢNG GỐC)

```mermaid
erDiagram
    DANHMUC ||--o{ TOUR : "chứa (1-N)"
    TOUR ||--o{ CHUYENKHOIHANH : "có lịch (1-N)"
    TOUR ||--o{ HINHANH_TOUR : "có bộ ảnh (1-N)"
    TOUR ||--o{ LICH_TRINH_DETAIL : "có lộ trình chi tiết (1-N)"
    NGUOIDUNG ||--o{ DATTOUR : "đặt tour (1-N)"
    CHUYENKHOIHANH ||--o{ DATTOUR : "thuộc chuyến (1-N)"
    DATTOUR ||--o{ CHITIET_HANHKHACH : "danh sách khách (1-N)"
    DATTOUR ||--o{ THANHTOAN : "giao dịch (1-N)"
    DATTOUR ||--o{ DANHGIA : "đánh giá dịch vụ (1-N)"
    NGUOIDUNG ||--o{ BAIVIET_QUANGBA : "đăng bài (1-N)"
    NGUOIDUNG ||--o{ AUDITLOG : "thao tác kiểm toán (1-N)"
```

---

## 📋 CHI TIẾT 12 BẢNG CƠ SỞ DỮ LIỆU GỐC

### 1. Bảng `NGUOIDUNG` (Tài khoản người dùng, Khách hàng & Bảo mật phiên)
Lưu trữ thông tin người dùng, khách hàng, quản trị viên và dữ liệu bảo mật phiên xác thực (JWT / Token).

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaNguoiDung`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `HoTen` | `nvarchar(100)` | NOT NULL | Họ và tên người dùng |
| `Email` | `varchar(100)` | NOT NULL | Địa chỉ email (Định danh đăng nhập duy nhất) |
| `SoDienThoai` | `varchar(15)` | NOT NULL | Số điện thoại liên hệ |
| `MatKhau` | `varchar(255)` | NOT NULL | Mật khẩu hash bảo mật |
| `DiaChi` | `nvarchar(200)` | YES | Địa chỉ liên hệ / thường trú |
| `TrangThai` | `bit` | NOT NULL | Trạng thái: `1` (Hoạt động), `0` (Khóa) |
| `NgayTao` | `datetime` | NOT NULL | Thời gian tạo tài khoản |
| `VaiTro` | `nvarchar(20)` | NOT NULL | Quyền hạn: `KhachHang`, `Admin` |
| `TokenHash` | `char(64)` | YES | Hash mã Token xác thực phiên đăng nhập hiện hành |
| `CsrfHash` | `char(64)` | YES | Token chống giả mạo request (CSRF Protection) |
| `HetHan` | `datetime2` | YES | Thời hạn hiệu lực của phiên đăng nhập |

---

### 2. Bảng `DANHMUC` (Danh mục phân loại tour)
Phân loại tour theo vùng miền (Miền Bắc, Miền Trung, Miền Nam, Tour đặc biệt).

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaDanhMuc`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `TenDanhMuc` | `nvarchar(100)` | NOT NULL | Tên danh mục (VD: Tour Miền Bắc, Tour Miền Trung...) |
| `MoTa` | `nvarchar(max)` | YES | Mô tả ngắn gọn về danh mục |

---

### 3. Bảng `TOUR` (Thông tin gói tour du lịch & Cơ cấu chi phí)
Lưu trữ toàn bộ thông tin sản phẩm du lịch trọn gói và chi tiết các khoản mục chi phí cấu thành.

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaTour`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `MaDanhMuc` | `int` | NOT NULL | **Khóa ngoại (FK)** tham chiếu `DANHMUC(MaDanhMuc)` |
| `TenTour` | `nvarchar(200)` | NOT NULL | Tên đầy đủ của tour du lịch |
| `MoTaChiTiet` | `nvarchar(max)` | YES | Mô tả tổng quan, điểm đặc sắc, trải nghiệm |
| `LichTrinhTongQuan`| `nvarchar(500)` | YES | Lịch trình tóm tắt sơ bộ |
| `GiaKhuyenNghi` | `decimal(18,2)` | NOT NULL | Giá bán niêm yết khuyến nghị |
| `HinhAnhDaiDien` | `varchar(255)` | YES | Đường dẫn ảnh đại diện chính |
| `TrangThai` | `bit` | NOT NULL | Trạng thái: `1` (Mở bán), `0` (Tạm ngưng) |
| `Slug` | `varchar(255)` | YES | Định danh URL thân thiện SEO |
| `Duration` | `nvarchar(50)` | YES | Thời lượng hành trình (VD: `3N2Đ`, `4N3Đ`) |
| `Departure` | `nvarchar(255)` | YES | Điểm đón / khởi hành (Hà Nội, TP.HCM...) |
| `Transport` | `nvarchar(255)` | YES | Phương tiện chính (Du thuyền, Máy bay, Limousine...) |
| `GiaGoc` | `decimal(18,2)` | YES | Giá gốc trước khuyến mãi |
| `FlashSale` | `bit` | NOT NULL | Đánh dấu tour Flash Sale (`1` hoặc `0`) |
| `ChiPhiChiTiet` | `nvarchar(max)` | YES | Chi tiết các khoản chi cấu thành giá tour (Vận chuyển, Lưu trú, Ăn uống...) |

---

### 4. Bảng `CHUYENKHOIHANH` (Lịch khởi hành & Quản lý chỗ trống)
Quản lý các chuyến đi thực tế của từng tour theo ngày khởi hành cụ thể.

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaChuyen`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `MaTour` | `int` | NOT NULL | **Khóa ngoại (FK)** tham chiếu `TOUR(MaTour)` |
| `NgayKhoiHanh` | `datetime` | NOT NULL | Ngày và giờ bắt đầu khởi hành chuyến đi |
| `NgayKetThuc` | `datetime` | NOT NULL | Ngày và giờ kết thúc chuyến đi |
| `GiaThucTe` | `decimal(18,2)` | NOT NULL | Giá vé thực tế của chuyến đi này |
| `SoChoToiDa` | `int` | NOT NULL | Tổng số lượng chỗ tối đa của chuyến |
| `SoChoDaDat` | `int` | NOT NULL | Số chỗ đã được khách đặt thành công (Mặc định: `0`) |
| `TrangThaiChuyen` | `nvarchar(50)` | NOT NULL | `MoBan`, `HetCho`, `HoanTat`, `Huy` |

---

### 5. Bảng `HINHANH_TOUR` (Thư viện hình ảnh tour)
Bộ sưu tập các hình ảnh chất lượng cao đi kèm theo từng tour.

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaHinhAnh`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `MaTour` | `int` | NOT NULL | **Khóa ngoại (FK)** tham chiếu `TOUR(MaTour)` |
| `DuongDanAnh` | `varchar(255)` | NOT NULL | Đường dẫn file ảnh / CDN |
| `GhiChu` | `nvarchar(200)` | YES | Chú thích ảnh (VD: Sundeck du thuyền, Vịnh Lan Hạ...) |

---

### 6. Bảng `LICH_TRINH_DETAIL` (Lịch trình chi tiết từng ngày)
Lưu chi tiết lộ trình sáng, trưa, tối, địa điểm và hoạt động của từng ngày trong tour.

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaLichTrinh`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `MaTour` | `int` | NOT NULL | **Khóa ngoại (FK)** tham chiếu `TOUR(MaTour)` |
| `NgayThu` | `int` | NOT NULL | Số thứ tự ngày (Ngày 1, Ngày 2...) |
| `TieuDeNgay` | `nvarchar(200)` | NOT NULL | Tiêu đề tóm tắt ngày trải nghiệm |
| `NoiDungChiTiet` | `nvarchar(max)` | NOT NULL | Nội dung chi tiết các hoạt động trong ngày |
| `BuaAn` | `nvarchar(100)` | YES | Thông tin bữa ăn trong ngày (Sáng, Trưa, Tối) |
| `ThuTuTrongNgay` | `int` | YES | Thứ tự hoạt động trong ngày |
| `LoaiHoatDong` | `nvarchar(30)` | YES | Loại hình: Tham quan, Di chuyển, Ăn uống, Nghỉ ngơi |
| `DiaDiem` | `nvarchar(180)` | YES | Tên địa danh / tọa độ tham quan |
| `GioBatDau` | `char(5)` | YES | Mốc giờ dự kiến (VD: `08:00`, `14:00`) |

---

### 7. Bảng `DATTOUR` (Đơn đặt chỗ tour & Chống trùng lặp Idempotency)
Quản lý các đơn đặt vé của khách hàng, số lượng khách, tổng tiền, tiến độ và khóa chống trùng đơn.

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaDatTour`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `MaKhachHang` | `int` | NOT NULL | **Khóa ngoại (FK)** tham chiếu `NGUOIDUNG(MaNguoiDung)` |
| `MaChuyen` | `int` | NOT NULL | **Khóa ngoại (FK)** tham chiếu `CHUYENKHOIHANH(MaChuyen)` |
| `NgayDat` | `datetime` | NOT NULL | Thời gian tạo đơn đặt tour |
| `SoLuongKhach` | `int` | NOT NULL | Tổng số lượng hành khách trong đoàn |
| `TongTien` | `decimal(18,2)` | NOT NULL | Tổng giá trị đơn đặt tour (VND) |
| `TrangThaiDat` | `nvarchar(50)` | NOT NULL | `ChoXacNhan`, `DaXacNhan`, `HoanTat`, `DaHuy` |
| `TrangThaiThanhToan` | `nvarchar(50)` | NOT NULL | `ChuaThanhToan`, `DaThanhToan`, `HoanTien` |
| `KhoaYeuCau` | `varchar(64)` | YES | UUID Idempotency Key duy nhất của yêu cầu (chống lặp click) |
| `DauVanTay` | `char(64)` | YES | Hash dấu vân tay dữ liệu đơn tour |

---

### 8. Bảng `CHITIET_HANHKHACH` (Danh sách hành khách tham gia)
Lưu trữ họ tên, ngày sinh, giới tính và liên hệ của từng thành viên đi trong đơn tour.

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaHanhKhach`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `MaDatTour` | `int` | NOT NULL | **Khóa ngoại (FK)** tham chiếu `DATTOUR(MaDatTour)` |
| `HoTen` | `nvarchar(100)` | NOT NULL | Họ và tên hành khách |
| `NgaySinh` | `date` | YES | Ngày tháng năm sinh |
| `GioiTinh` | `nvarchar(10)` | YES | Giới tính: `Nam`, `Nữ`, `Khác` |
| `SoDienThoai` | `varchar(15)` | YES | Số điện thoại liên hệ cá nhân |

---

### 9. Bảng `THANHTOAN` (Giao dịch thanh toán tour)
Quản lý các bản ghi thanh toán chuyển khoản QR, thẻ tín dụng hoặc tiền mặt.

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaThanhToan`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `MaDatTour` | `int` | NOT NULL | **Khóa ngoại (FK)** tham chiếu `DATTOUR(MaDatTour)` |
| `PhuongThuc` | `nvarchar(50)` | NOT NULL | `VietQR`, `TheTinDung`, `TienMat`, `ChuyenKhoan` |
| `SoTien` | `decimal(18,2)` | NOT NULL | Số tiền thực thanh toán |
| `NgayThanhToan`| `datetime` | NOT NULL | Thời điểm hoàn tất giao dịch |
| `MaGiaoDich` | `varchar(100)` | YES | Mã tham chiếu ngân hàng / cổng thanh toán |
| `TrangThai` | `nvarchar(50)` | NOT NULL | `ThanhCong`, `ThatBai`, `DangXuLy`, `HoanTien` |

---

### 10. Bảng `DANHGIA` (Đánh giá & Phản hồi dịch vụ)
Nhận xét, chấm điểm sao và ý kiến trải nghiệm thực tế từ du khách sau chuyến đi.

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaDanhGia`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `MaDatTour` | `int` | NOT NULL | **Khóa ngoại (FK)** tham chiếu `DATTOUR(MaDatTour)` |
| `SoSao` | `tinyint` | NOT NULL | Điểm đánh giá (1 đến 5 sao) |
| `NoiDung` | `nvarchar(1000)` | YES | Nội dung cảm nhận của du khách |
| `HinhAnh` | `nvarchar(500)` | YES | Ảnh check-in thực tế đính kèm |
| `NgayDanhGia` | `datetime` | NOT NULL | Thời điểm gửi đánh giá |
| `TrangThaiHienThi`| `bit` | NOT NULL | `1` (Cho phép hiển thị công khai), `0` (Ẩn) |
| `PhanHoiAdmin` | `nvarchar(1000)` | YES | Lời cảm ơn hoặc phản hồi chính thức từ ban quản trị |

---

### 11. Bảng `BAIVIET_QUANGBA` (Cẩm nang du lịch & Blog kinh nghiệm)
Các bài viết hướng dẫn trải nghiệm, cẩm nang du lịch và điểm đến mới lạ của Delta Travel.

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaBaiViet`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `TieuDe` | `nvarchar(255)` | NOT NULL | Tiêu đề bài viết |
| `Slug` | `varchar(255)` | YES | Định danh URL thân thiện SEO |
| `TomTat` | `nvarchar(500)` | YES | Đoạn tóm tắt mở đầu |
| `NoiDung` | `nvarchar(max)` | NOT NULL | Nội dung chi tiết bài cẩm nang |
| `HinhAnhDaiDien`| `varchar(255)` | YES | Ảnh thumbnail bài viết |
| `LuotXem` | `int` | NOT NULL | Số lượt người xem (Mặc định: `0`) |
| `NgayTao` | `datetime` | NOT NULL | Thời gian xuất bản bài viết |
| `TrangThai` | `bit` | NOT NULL | `1` (Công khai), `0` (Bản nháp) |
| `MaNguoiDang` | `int` | NOT NULL | **Khóa ngoại (FK)** tham chiếu `NGUOIDUNG(MaNguoiDung)` |

---

### 12. Bảng `AUDITLOG` (Nhật ký kiểm toán hệ thống)
Ghi nhận mọi thao tác quan trọng để đảm bảo tính minh bạch và an toàn dữ liệu.

| Tên Cột | Kiểu Dữ Liệu | NULL / NOT NULL | Mô Tả & Ràng Buộc |
| :--- | :--- | :--- | :--- |
| **`MaLog`** | `int` (IDENTITY) | **NOT NULL** | **Khóa chính (PK)** |
| `MaNguoiThucHien` | `int` | YES | **Khóa ngoại (FK)** tham chiếu `NGUOIDUNG(MaNguoiDung)` |
| `HanhDong` | `nvarchar(100)` | NOT NULL | Tên hành động (VD: Đăng nhập, Tạo đơn, Hủy đơn...) |
| `DuLieuCu` | `nvarchar(max)` | YES | Dữ liệu trạng thái cũ (JSON / Text) |
| `DuLieuMoi` | `nvarchar(max)` | YES | Dữ liệu trạng thái mới (JSON / Text) |
| `ThoiGian` | `datetime` | NOT NULL | Thời điểm xảy ra thao tác (Mặc định: `GETDATE()`) |

---

## 🔒 CAM KẾT ĐẢM BẢO CHẤT LƯỢNG HỆ THỐNG
1. Toàn bộ 3 bảng tạm thời (`API_PHIENDANGNHAP`, `API_TOUR_COST_ITEM`, `API_YEUCAU_DATTOUR`) đã được **XÓA BỎ HOÀN TOÀN** khỏi cơ sở dữ liệu SQL Server.
2. Cơ sở dữ liệu hiện tại chỉ bao gồm duy nhất **12 bảng nghiệp vụ gốc**, bảo toàn 100% dữ liệu, khóa chính, khóa ngoại và quan hệ ERD đã thiết kế ban đầu.
3. Các trường chức năng hỗ trợ phiên bảo mật (`TokenHash`, `CsrfHash`, `HetHan`), cơ cấu chi phí (`ChiPhiChiTiet`) và chống trùng lặp đơn (`KhoaYeuCau`, `DauVanTay`) đã được tích hợp trực tiếp, an toàn vào đúng các bảng hiện hữu (`NGUOIDUNG`, `TOUR`, `DATTOUR`).
4. Mọi chức năng mở rộng phía giao diện người dùng (chuyển đổi đa ngôn ngữ Việt - Anh, biểu tượng cờ SVG, thanh điều hướng kính Liquid Glass, khung chat AI Concierge) đều tuân thủ nguyên tắc không tạo thêm bảng mới trong CSDL.
