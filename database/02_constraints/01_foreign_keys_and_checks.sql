-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 01_foreign_keys_and_checks.sql
-- Mục đích: Thiết lập khóa ngoại (Foreign Keys) và ràng buộc kiểm tra toàn vẹn (Check Constraints)
-- ==========================================================================================

USE TourDuLichDB;
GO

PRINT N'==> Đang thiết lập các ràng buộc Khóa ngoại (Foreign Keys)...';

-- 1. Khóa ngoại bảng TOUR -> DANHMUC
ALTER TABLE dbo.TOUR WITH CHECK 
ADD CONSTRAINT FK_TOUR_DANHMUC FOREIGN KEY (MaDanhMuc)
REFERENCES dbo.DANHMUC (MaDanhMuc)
ON UPDATE CASCADE
ON DELETE NO ACTION; -- Không cho xóa danh mục nếu còn tour trực thuộc

-- 2. Khóa ngoại bảng HINHANH_TOUR -> TOUR
ALTER TABLE dbo.HINHANH_TOUR WITH CHECK 
ADD CONSTRAINT FK_HINHANHTOUR_TOUR FOREIGN KEY (MaTour)
REFERENCES dbo.TOUR (MaTour)
ON UPDATE CASCADE
ON DELETE CASCADE; -- Xóa tour thì tự động xóa sạch ảnh gallery của tour đó

-- 3. Khóa ngoại bảng LICH_TRINH_DETAIL -> TOUR
ALTER TABLE dbo.LICH_TRINH_DETAIL WITH CHECK 
ADD CONSTRAINT FK_LICHTRINH_TOUR FOREIGN KEY (MaTour)
REFERENCES dbo.TOUR (MaTour)
ON UPDATE CASCADE
ON DELETE CASCADE; -- Xóa tour thì tự động xóa lịch trình các ngày

-- 4. Khóa ngoại bảng CHUYENKHOIHANH -> TOUR
ALTER TABLE dbo.CHUYENKHOIHANH WITH CHECK 
ADD CONSTRAINT FK_CHUYENKHOIHANH_TOUR FOREIGN KEY (MaTour)
REFERENCES dbo.TOUR (MaTour)
ON UPDATE CASCADE
ON DELETE NO ACTION; -- Bảo toàn dữ liệu chuyến đi, tránh multiple cascade paths

-- 5. Khóa ngoại bảng DATTOUR -> NGUOIDUNG (Khách hàng)
ALTER TABLE dbo.DATTOUR WITH CHECK 
ADD CONSTRAINT FK_DATTOUR_NGUOIDUNG FOREIGN KEY (MaKhachHang)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE NO ACTION
ON DELETE NO ACTION; -- Không bao giờ xóa tài khoản nếu khách đã có lịch sử đặt tour (Kế toán)

-- 6. Khóa ngoại bảng DATTOUR -> CHUYENKHOIHANH
ALTER TABLE dbo.DATTOUR WITH CHECK 
ADD CONSTRAINT FK_DATTOUR_CHUYENKHOIHANH FOREIGN KEY (MaChuyen)
REFERENCES dbo.CHUYENKHOIHANH (MaChuyen)
ON UPDATE NO ACTION
ON DELETE NO ACTION; -- Không xóa chuyến đi khi đã có đơn đặt phòng/chỗ

-- 7. Khóa ngoại bảng CHITIET_HANHKHACH -> DATTOUR
ALTER TABLE dbo.CHITIET_HANHKHACH WITH CHECK 
ADD CONSTRAINT FK_CHITIETHANHKHACH_DATTOUR FOREIGN KEY (MaDatTour)
REFERENCES dbo.DATTOUR (MaDatTour)
ON UPDATE CASCADE
ON DELETE CASCADE; -- Xóa đơn đặt tour thì dọn dẹp danh sách hành khách đi cùng

-- 8. Khóa ngoại bảng THANHTOAN -> DATTOUR
ALTER TABLE dbo.THANHTOAN WITH CHECK 
ADD CONSTRAINT FK_THANHTOAN_DATTOUR FOREIGN KEY (MaDatTour)
REFERENCES dbo.DATTOUR (MaDatTour)
ON UPDATE NO ACTION
ON DELETE NO ACTION; -- Bảo vệ chứng từ giao dịch kế toán

-- 9. Khóa ngoại bảng DANHGIA -> DATTOUR
ALTER TABLE dbo.DANHGIA WITH CHECK 
ADD CONSTRAINT FK_DANHGIA_DATTOUR FOREIGN KEY (MaDatTour)
REFERENCES dbo.DATTOUR (MaDatTour)
ON UPDATE CASCADE
ON DELETE CASCADE; -- Xóa đơn tour thì xóa đánh giá đi kèm

-- 10. Khóa ngoại bảng BAIVIET_QUANGBA -> NGUOIDUNG (Tác giả)
ALTER TABLE dbo.BAIVIET_QUANGBA WITH CHECK 
ADD CONSTRAINT FK_BAIVIET_NGUOIDUNG FOREIGN KEY (MaNguoiDang)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE CASCADE
ON DELETE NO ACTION;

-- 11. Khóa ngoại bảng AUDITLOG -> NGUOIDUNG
ALTER TABLE dbo.AUDITLOG WITH CHECK 
ADD CONSTRAINT FK_AUDITLOG_NGUOIDUNG FOREIGN KEY (MaNguoiThucHien)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE CASCADE
ON DELETE SET NULL; -- Nếu người dùng bị xóa thì gán Người thực hiện log về NULL, giữ nguyên lịch sử

PRINT N'==> Đã thiết lập xong toàn bộ Foreign Keys chuẩn xác và an toàn.';
GO

-- ==========================================================================================
-- THIẾT LẬP RÀNG BUỘC KIỂM TRA TOÀN VẸN (CHECK CONSTRAINTS)
-- ==========================================================================================
PRINT N'==> Đang thiết lập các ràng buộc Check Constraints...';

-- 1. Giá khuyến nghị của Tour phải >= 0
ALTER TABLE dbo.TOUR ADD CONSTRAINT CK_TOUR_GiaKhuyenNghi 
CHECK (GiaKhuyenNghi >= 0);

-- 2. Lịch trình ngày thứ phải > 0
ALTER TABLE dbo.LICH_TRINH_DETAIL ADD CONSTRAINT CK_LICHTRINH_NgayThu 
CHECK (NgayThu > 0);

-- 3. Ngày kết thúc chuyến đi phải >= Ngày khởi hành
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_ThoiGian 
CHECK (NgayKetThuc >= NgayKhoiHanh);

-- 4. Giá thực tế của chuyến khởi hành phải >= 0
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_GiaThucTe 
CHECK (GiaThucTe >= 0);

-- 5. Số chỗ tối đa phải > 0
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_SoChoToiDa 
CHECK (SoChoToiDa > 0);

-- 6. Số chỗ đã đặt phải >= 0 và không vượt quá số chỗ tối đa
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_SoChoHopLe 
CHECK (SoChoDaDat >= 0 AND SoChoDaDat <= SoChoToiDa);

-- 7. Trạng thái chuyến khởi hành hợp lệ
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_TrangThai 
CHECK (TrangThaiChuyen IN (N'Mở bán', N'Hết chỗ', N'Hoàn thành', N'Hủy chuyến', N'Tạm dừng'));

-- 8. Số lượng khách trong đơn đặt phải > 0
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_SoLuongKhach 
CHECK (SoLuongKhach > 0);

-- 9. Tổng tiền đơn đặt tour phải >= 0
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TongTien 
CHECK (TongTien >= 0);

-- 10. Trạng thái đơn đặt tour chỉ nhận 4 giá trị quy chuẩn
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TrangThaiDat 
CHECK (TrangThaiDat IN (N'Chờ xác nhận', N'Đã xác nhận', N'Đã hoàn thành', N'Đã hủy'));

-- 11. Trạng thái thanh toán quy chuẩn
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TrangThaiThanhToan 
CHECK (TrangThaiThanhToan IN (N'Chưa thanh toán', N'Đã cọc', N'Đã thanh toán', N'Đã hoàn tiền'));

-- 12. Số tiền thanh toán phải > 0
ALTER TABLE dbo.THANHTOAN ADD CONSTRAINT CK_THANHTOAN_SoTien 
CHECK (SoTien > 0);

-- 13. Điểm số đánh giá bắt buộc từ 1 đến 5 sao
ALTER TABLE dbo.DANHGIA ADD CONSTRAINT CK_DANHGIA_SoSao 
CHECK (SoSao BETWEEN 1 AND 5);

-- 14. Lượt xem bài viết phải >= 0
ALTER TABLE dbo.BAIVIET_QUANGBA ADD CONSTRAINT CK_BAIVIET_LuotXem 
CHECK (LuotXem >= 0);

PRINT N'==> Đã thiết lập xong toàn bộ Check Constraints đảm bảo tính toàn vẹn nghiệp vụ!';
GO
