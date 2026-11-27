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

-- 12. Khóa ngoại bảng YEUCAU_HOANTIEN_DOILICH -> DATTOUR & NGUOIDUNG (UC-10)
ALTER TABLE dbo.YEUCAU_HOANTIEN_DOILICH WITH CHECK
ADD CONSTRAINT FK_YEUCAU_DATTOUR FOREIGN KEY (MaDatTour)
REFERENCES dbo.DATTOUR (MaDatTour)
ON UPDATE NO ACTION
ON DELETE NO ACTION;

ALTER TABLE dbo.YEUCAU_HOANTIEN_DOILICH WITH CHECK
ADD CONSTRAINT FK_YEUCAU_KHACHHANG FOREIGN KEY (MaKhachHang)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE NO ACTION
ON DELETE NO ACTION;

ALTER TABLE dbo.YEUCAU_HOANTIEN_DOILICH WITH CHECK
ADD CONSTRAINT FK_YEUCAU_NGUOIXULY FOREIGN KEY (NguoiXuLy)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE NO ACTION
ON DELETE NO ACTION;

-- 13. Khóa ngoại bảng TOUR_YEUTHICH -> NGUOIDUNG & TOUR (UC-07)
ALTER TABLE dbo.TOUR_YEUTHICH WITH CHECK
ADD CONSTRAINT FK_YEUTHICH_NGUOIDUNG FOREIGN KEY (MaNguoiDung)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE CASCADE
ON DELETE CASCADE;

ALTER TABLE dbo.TOUR_YEUTHICH WITH CHECK
ADD CONSTRAINT FK_YEUTHICH_TOUR FOREIGN KEY (MaTour)
REFERENCES dbo.TOUR (MaTour)
ON UPDATE CASCADE
ON DELETE CASCADE;

-- 14. Khóa ngoại bảng LIENHE_TUVAN -> TOUR & NGUOIDUNG (UC-04)
ALTER TABLE dbo.LIENHE_TUVAN WITH CHECK
ADD CONSTRAINT FK_LIENHE_TOUR FOREIGN KEY (MaTour)
REFERENCES dbo.TOUR (MaTour)
ON UPDATE SET NULL
ON DELETE SET NULL;

ALTER TABLE dbo.LIENHE_TUVAN WITH CHECK
ADD CONSTRAINT FK_LIENHE_NGUOIXULY FOREIGN KEY (NguoiXuLy)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE NO ACTION
ON DELETE NO ACTION;

-- 15. Khóa ngoại bảng BANNER_QUANGCAO -> NGUOIDUNG (UC-15)
ALTER TABLE dbo.BANNER_QUANGCAO WITH CHECK
ADD CONSTRAINT FK_BANNER_NGUOITAO FOREIGN KEY (MaNguoiTao)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE CASCADE
ON DELETE NO ACTION;

PRINT N'==> Đã thiết lập xong toàn bộ Foreign Keys chuẩn xác và an toàn cho 16 bảng.';
GO

-- ==========================================================================================
-- THIẾT LẬP RÀNG BUỘC KIỂM TRA TOÀN VẸN (CHECK CONSTRAINTS)
-- ==========================================================================================
PRINT N'==> Đang thiết lập các ràng buộc Check Constraints...';

-- 1. Phân quyền vai trò người dùng chuẩn
ALTER TABLE dbo.NGUOIDUNG ADD CONSTRAINT CK_NGUOIDUNG_VaiTro
CHECK (VaiTro IN (N'Admin', N'NhanVien', N'KhachHang', N'CUSTOMER', N'ADMIN', N'STAFF'));

-- 2. Giá khuyến nghị của Tour phải >= 0
ALTER TABLE dbo.TOUR ADD CONSTRAINT CK_TOUR_GiaKhuyenNghi 
CHECK (GiaKhuyenNghi >= 0);

-- 3. Lịch trình ngày thứ phải > 0
ALTER TABLE dbo.LICH_TRINH_DETAIL ADD CONSTRAINT CK_LICHTRINH_NgayThu 
CHECK (NgayThu > 0);

-- 4. Ngày kết thúc chuyến đi phải >= Ngày khởi hành
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_ThoiGian 
CHECK (NgayKetThuc >= NgayKhoiHanh);

-- 5. Giá thực tế của chuyến khởi hành phải >= 0
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_GiaThucTe 
CHECK (GiaThucTe >= 0);

-- 6. Số chỗ tối đa phải > 0
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_SoChoToiDa 
CHECK (SoChoToiDa > 0);

-- 7. Số chỗ đã đặt & số chỗ giữ phải hợp lệ (BR1: SoChoDaDat + SoChoGiuCho <= SoChoToiDa)
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_SoChoHopLe 
CHECK (SoChoDaDat >= 0 AND SoChoGiuCho >= 0 AND (SoChoDaDat + SoChoGiuCho) <= SoChoToiDa);

-- 8. Trạng thái chuyến khởi hành hợp lệ
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_TrangThai 
CHECK (TrangThaiChuyen IN (N'Mở bán', N'Hết chỗ', N'Hoàn thành', N'Hủy chuyến', N'Tạm dừng'));

-- 9. Số lượng khách trong đơn đặt phải > 0
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_SoLuongKhach 
CHECK (SoLuongKhach > 0);

-- 10. Tổng tiền đơn đặt tour phải >= 0
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TongTien 
CHECK (TongTien >= 0);

-- 11. Trạng thái đơn đặt tour quy chuẩn
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TrangThaiDat 
CHECK (TrangThaiDat IN (N'Chờ xác nhận', N'Đã xác nhận', N'Đã hoàn thành', N'Đã hủy'));

-- 12. Trạng thái thanh toán quy chuẩn
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TrangThaiThanhToan 
CHECK (TrangThaiThanhToan IN (N'Chưa thanh toán', N'Đã cọc', N'Đã thanh toán', N'Đã hoàn tiền'));

-- 13. Phân loại giao dịch thanh toán và hoàn tiền
ALTER TABLE dbo.THANHTOAN ADD CONSTRAINT CK_THANHTOAN_LoaiGiaoDich
CHECK (LoaiGiaoDich IN (N'Thanh toán', N'Hoàn tiền', N'Phụ thu'));

-- 14. Số tiền thanh toán/hoàn tiền phải > 0 (Phân biệt chiều dòng tiền qua LoaiGiaoDich)
ALTER TABLE dbo.THANHTOAN ADD CONSTRAINT CK_THANHTOAN_SoTien 
CHECK (SoTien > 0);

-- 15. Điểm số đánh giá bắt buộc từ 1 đến 5 sao
ALTER TABLE dbo.DANHGIA ADD CONSTRAINT CK_DANHGIA_SoSao 
CHECK (SoSao BETWEEN 1 AND 5);

-- 16. Lượt xem bài viết phải >= 0
ALTER TABLE dbo.BAIVIET_QUANGBA ADD CONSTRAINT CK_BAIVIET_LuotXem 
CHECK (LuotXem >= 0);

-- 17. Loại yêu cầu hỗ trợ đổi/hủy/hoàn tiền (UC-10)
ALTER TABLE dbo.YEUCAU_HOANTIEN_DOILICH ADD CONSTRAINT CK_YEUCAU_LoaiYeuCau
CHECK (LoaiYeuCau IN (N'Hủy tour hoàn tiền', N'Đổi lịch khởi hành', N'Đổi thông tin hành khách'));

-- 18. Trạng thái xử lý yêu cầu đổi/hủy/hoàn tiền
ALTER TABLE dbo.YEUCAU_HOANTIEN_DOILICH ADD CONSTRAINT CK_YEUCAU_TrangThai
CHECK (TrangThai IN (N'Chờ xử lý', N'Đã duyệt', N'Từ chối'));

-- 19. Trạng thái xử lý yêu cầu tư vấn (UC-04)
ALTER TABLE dbo.LIENHE_TUVAN ADD CONSTRAINT CK_LIENHE_TrangThai
CHECK (TrangThai IN (N'Chưa xử lý', N'Đã liên hệ', N'Đã hủy'));

-- 20. Vị trí hiển thị banner quảng cáo (UC-15)
ALTER TABLE dbo.BANNER_QUANGCAO ADD CONSTRAINT CK_BANNER_ViTri
CHECK (ViTri IN (N'TrangChu_Hero', N'TrangChu_GiuaTrang', N'Sidebar'));

PRINT N'==> Đã thiết lập xong toàn bộ 20 Check Constraints đảm bảo tính toàn vẹn nghiệp vụ!';
GO
