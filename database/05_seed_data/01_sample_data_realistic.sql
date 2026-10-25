-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 01_sample_data_realistic.sql
-- Mục đích: Nạp dữ liệu mẫu thực tế, phong phú theo các tour hot tại Việt Nam và Quốc tế
-- ==========================================================================================

USE TourDuLichDB;
GO

PRINT N'==> Đang tiến hành nạp dữ liệu mẫu (Sample Realistic Seed Data)...';

-- 1. NẠP DỮ LIỆU BẢNG NGUOIDUNG (Lưu ý: Không có cột VaiTro)
SET IDENTITY_INSERT dbo.NGUOIDUNG ON;
INSERT INTO dbo.NGUOIDUNG (MaNguoiDung, HoTen, Email, SoDienThoai, MatKhau, DiaChi, TrangThai, NgayTao)
VALUES 
(1, N'Trần Quốc Toản', 'admin@tourvietnam.vn', '0901234567', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Hoàn Kiếm, Hà Nội', 1, '2026-01-10'),
(2, N'Lê Thị Mai', 'dieuhanh@tourvietnam.vn', '0912345678', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Hải Châu, Đà Nẵng', 1, '2026-01-15'),
(3, N'Hoàng Văn Dũng', 'ketoan@tourvietnam.vn', '0987654321', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Quận 1, TP. Hồ Chí Minh', 1, '2026-02-01'),
(4, N'Nguyễn Văn An', 'nguyenvanan@gmail.com', '0933112233', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Cầu Giấy, Hà Nội', 1, '2026-03-01'),
(5, N'Phạm Thị Hương', 'phamhuong88@gmail.com', '0944556677', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Thanh Xuân, Hà Nội', 1, '2026-03-10'),
(6, N'Đỗ Minh Quân', 'minhquan.travel@outlook.com', '0977889900', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Bình Thạnh, TP. Hồ Chí Minh', 1, '2026-04-05');
SET IDENTITY_INSERT dbo.NGUOIDUNG OFF;
GO

-- 2. NẠP DỮ LIỆU BẢNG DANHMUC
SET IDENTITY_INSERT dbo.DANHMUC ON;
INSERT INTO dbo.DANHMUC (MaDanhMuc, TenDanhMuc, MoTa)
VALUES 
(1, N'Tour Du Lịch Đông Bắc Á', N'Khám phá văn hóa, cảnh sắc lãng mạn tại Hàn Quốc, Nhật Bản, Đài Loan'),
(2, N'Tour Miền Trung Di Sản', N'Hành trình di sản văn hóa: Đà Nẵng, Bà Nà Hills, Phố cổ Hội An, Cố đô Huế'),
(3, N'Tour Biển Đảo Nghỉ Dưỡng', N'Nghỉ dưỡng đẳng cấp tại Phú Quốc, Côn Đảo, Nha Trang, Vịnh Hạ Long'),
(4, N'Tour Khám Phá Vùng Cao Miền Bắc', N'Chinh phục nóc nhà Đông Dương Fansipan Sa Pa, Mù Cang Chải, Hà Giang mùa hoa');
SET IDENTITY_INSERT dbo.DANHMUC OFF;
GO

-- 3. NẠP DỮ LIỆU BẢNG TOUR
SET IDENTITY_INSERT dbo.TOUR ON;
INSERT INTO dbo.TOUR (MaTour, MaDanhMuc, TenTour, MoTaChiTiet, LichTrinhTongQuan, GiaKhuyenNghi, HinhAnhDaiDien, TrangThai)
VALUES 
(1, 1, N'Tour Hàn Quốc: Seoul - Đảo Nami - Tháp Namsan - Công Viên Lotte World', 
 N'Hành trình 5 ngày 4 đêm đưa quý khách đến với xứ sở kim chi thơ mộng. Dạo bước dưới hàng cây ngân hạnh tại đảo Nami, ngắm toàn cảnh Seoul từ tháp Namsan và thỏa sức vui chơi tại công viên giải trí trong nhà lớn nhất thế giới Lotte World.', 
 N'5 Ngày 4 Đêm | Bay Vietnam Airlines | Khách sạn 4 sao quốc tế', 13990000, '/images/tours/korea-seoul-nami.jpg', 1),

(2, 2, N'Tour Đà Nẵng - Bà Nà Hills - Cầu Vàng - Phố Cổ Hội An - Bán Đảo Sơn Trà', 
 N'Khám phá miền Trung trọn vẹn: Check-in Cầu Vàng bàn tay khổng lồ trên đỉnh Bà Nà, thả đèn hoa đăng lung linh trên sông Hoài Hội An và viếng chùa Linh Ứng Sơn Trà.', 
 N'4 Ngày 3 Đêm | Khách sạn 4 sao biển Mỹ Khê | Trọn gói vé cáp treo Bà Nà', 4890000, '/images/tours/danang-bana-hoian.jpg', 1),

(3, 3, N'Tour Phú Quốc Thiên Đường Đảo Ngọc - Cáp Treo Hòn Thơm - Thị Trấn Hoàng Hôn', 
 N'Trải nghiệm cáp treo vượt biển 3 dây dài nhất thế giới sang Hòn Thơm Nature Park, ngắm hoàng hôn rực rỡ tại Sunset Town và thưởng thức hải sản tươi sống Hàm Ninh.', 
 N'3 Ngày 2 Đêm | Resort 5 sao có bãi biển riêng | Tặng tour cano 4 đảo', 3990000, '/images/tours/phuquoc-honthom.jpg', 1),

(4, 4, N'Tour Sa Pa - Nóc Nhà Đông Dương Fansipan - Bản Cát Cát - Đèo Ô Quy Hồ', 
 N'Chinh phục đỉnh thiêng Fansipan cao 3.143m, ngắm biển mây bồng bềnh, tìm hiểu nếp sống đồng bào H''Mông tại bản Cát Cát và săn hoàng hôn tại cổng trời Ô Quy Hồ.', 
 N'3 Ngày 2 Đêm | Xe giường nằm Limousine | Khách sạn trung tâm thị xã', 2850000, '/images/tours/sapa-fansipan.jpg', 1);
SET IDENTITY_INSERT dbo.TOUR OFF;
GO

-- 4. NẠP DỮ LIỆU BẢNG HINHANH_TOUR (Bộ sưu tập Gallery của Tour)
SET IDENTITY_INSERT dbo.HINHANH_TOUR ON;
INSERT INTO dbo.HINHANH_TOUR (MaHinhAnh, MaTour, DuongDanAnh, GhiChu)
VALUES 
(1, 1, '/images/gallery/seoul-autumn.jpg', N'Đảo Nami lãng mạn mùa thu rực rỡ'),
(2, 1, '/images/gallery/namsan-tower.jpg', N'Tháp truyền hình N Seoul Tower và hàng ngàn ổ khóa tình yêu'),
(3, 1, '/images/gallery/lotte-world.jpg', N'Công viên giải trí phức hợp Lotte World Seoul'),
(4, 2, '/images/gallery/cau-vang-danang.jpg', N'Cây Cầu Vàng độc đáo được nâng đỡ bởi bàn tay khổng lồ'),
(5, 2, '/images/gallery/hoi-an-den-long.jpg', N'Phố cổ Hội An về đêm lung linh đèn lồng'),
(6, 2, '/images/gallery/son-tra-linh-ung.jpg', N'Tượng Phật Bà Quan Âm cao 67m tại bán đảo Sơn Trà'),
(7, 3, '/images/gallery/sunset-town.jpg', N'Thị trấn Hoàng Hôn Địa Trung Hải Sunset Town'),
(8, 3, '/images/gallery/cap-treo-hon-thom.jpg', N'Cáp treo Hòn Thơm ngắm trọn biển đảo An Thới'),
(9, 4, '/images/gallery/fansipan-peak.jpg', N'Cột mốc đỉnh thiêng Fansipan 3.143m ngập tràn cờ đỏ sao vàng'),
(10, 4, '/images/gallery/cat-cat-waterfall.jpg', N'Thác nước thơ mộng giữa bản Cát Cát Sa Pa');
SET IDENTITY_INSERT dbo.HINHANH_TOUR OFF;
GO

-- 5. NẠP DỮ LIỆU BẢNG LICH_TRINH_DETAIL (Lịch trình chi tiết từng ngày)
SET IDENTITY_INSERT dbo.LICH_TRINH_DETAIL ON;
INSERT INTO dbo.LICH_TRINH_DETAIL (MaLichTrinh, MaTour, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn)
VALUES 
(1, 1, 1, N'TP.HCM / HÀ NỘI - INCHEON (SEOUL)', 
 N'Quý khách tập trung tại sân bay làm thủ tục chuyến bay đi Incheon. Nghỉ đêm trên máy bay.', N'Ăn nhẹ trên máy bay'),
(2, 1, 2, N'SEOUL - ĐẢO NAMI - THÁP NAMSAN', 
 N'Đến sân bay Incheon, xe đưa đoàn đi ăn sáng canh sườn bò. Khởi hành đi đảo Nami - phim trường "Bản tình ca mùa đông". Chiều về Seoul tham quan Tháp Namsan.', N'Sáng, Trưa, Tối'),
(3, 1, 3, N'LOTTE WORLD - CUNG ĐIỆN GYEONGBOKGUNG', 
 N'Khám phá Cung điện Gyeongbokgung cổ kính trong trang phục Hanbok truyền thống. Buổi chiều trải nghiệm công viên giải trí Lotte World.', N'Sáng, Trưa, Tối'),
(4, 2, 1, N'ĐÓN KHÁCH - BÁN ĐẢO SƠN TRÀ - BIỂN MỸ KHÊ', 
 N'Xe đón khách tại sân bay Đà Nẵng, nhận phòng khách sạn. Chiều viếng chùa Linh Ứng Sơn Trà và tự do tắm biển Mỹ Khê.', N'Trưa, Tối'),
(5, 2, 2, N'BÀ NÀ HILLS - CẦU VÀNG - CHECK-IN LÀNG PHÁP', 
 N'Chinh phục đỉnh Bà Nà bằng cáp treo đạt 4 kỷ lục thế giới. Check-in Cầu Vàng, tham quan Hầm rượu Debay, Vườn hoa Le Jardin D''Amour.', N'Sáng, Trưa Buffet, Tối'),
(6, 2, 3, N'DANH THẮNG NGŨ HÀNH SƠN - PHỐ CỔ HỘI AN', 
 N'Tham quan làng đá mỹ nghệ Non Nước, khám phá động Huyền Không. Chiều sang Phố cổ Hội An tham quan Chùa Cầu, thả hoa đăng trên sông Hoài.', N'Sáng, Trưa, Tối'),
(7, 3, 1, N'ĐÓN BAY PHÚ QUỐC - DINH CẬU - SUNSET SANATO', 
 N'Xe đón đoàn tại sân bay Phú Quốc. Khởi hành viếng Dinh Cậu tâm linh, ngắm hoàng hôn độc đáo tại Sunset Sanato.', N'Trưa, Tối'),
(8, 3, 2, N'CANO 4 ĐẢO - CÁP TREO HÒN THƠM - CẦU HÔN', 
 N'Trải nghiệm cano cao tốc lặn ngắm san hô tại hòn Móng Tay, hòn Gầm Ghì. Đi cáp treo vượt biển Hòn Thơm và check-in Cầu Hôn (Kiss Bridge).', N'Sáng, Trưa, Tối'),
(9, 4, 1, N'HÀ NỘI - NỘI BÀI - SA PA - BẢN CÁT CÁT', 
 N'Xe Limousine đưa đoàn lên Sa Pa theo cao tốc Nội Bài - Lào Cai. Buổi chiều tham quan bản Cát Cát của đồng bào người H''Mông.', N'Trưa, Tối'),
(10, 4, 2, N'CHINH PHỤC FANSIPAN - CỔNG TRỜI Ô QUY HỒ', 
 N'Đi tàu hỏa leo núi Mường Hoa, cáp treo lên đỉnh Fansipan. Buổi chiều săn mây tuyệt đẹp tại đỉnh đèo Ô Quy Hồ.', N'Sáng, Trưa, Tối');
SET IDENTITY_INSERT dbo.LICH_TRINH_DETAIL OFF;
GO

-- 6. NẠP DỮ LIỆU BẢNG CHUYENKHOIHANH (Lịch khởi hành thực tế)
SET IDENTITY_INSERT dbo.CHUYENKHOIHANH ON;
INSERT INTO dbo.CHUYENKHOIHANH (MaChuyen, MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen)
VALUES 
-- Tour Hàn Quốc
(1, 1, '2026-11-15 08:00', '2026-11-19 18:00', 12990000, 25, 18, N'Mở bán'),
(2, 1, '2026-12-20 08:00', '2026-12-24 18:00', 14500000, 25, 25, N'Hết chỗ'),
(3, 1, '2027-01-10 08:00', '2027-01-14 18:00', 12990000, 25, 4, N'Mở bán'),

-- Tour Đà Nẵng
(4, 2, '2026-11-10 07:30', '2026-11-13 17:00', 4690000, 30, 20, N'Mở bán'),
(5, 2, '2026-12-05 07:30', '2026-12-08 17:00', 4890000, 30, 0, N'Mở bán'),

-- Tour Phú Quốc
(6, 3, '2026-11-20 09:00', '2026-11-22 16:00', 3890000, 20, 15, N'Mở bán'),
(7, 3, '2026-12-15 09:00', '2026-12-17 16:00', 4290000, 20, 0, N'Mở bán'),

-- Tour Sa Pa
(8, 4, '2026-11-05 06:30', '2026-11-07 19:00', 2750000, 25, 25, N'Hoàn thành'),
(9, 4, '2026-11-25 06:30', '2026-11-27 19:00', 2850000, 25, 8, N'Mở bán');
SET IDENTITY_INSERT dbo.CHUYENKHOIHANH OFF;
GO

-- 7. NẠP DỮ LIỆU BẢNG DATTOUR
-- Lưu ý: Tạm ngắt Trigger kiểm tra số chỗ khi seed dữ liệu ban đầu để nạp dữ liệu lịch sử chuẩn xác
DISABLE TRIGGER dbo.TRG_DATTOUR_CheckAndLockSeats ON dbo.DATTOUR;

SET IDENTITY_INSERT dbo.DATTOUR ON;
INSERT INTO dbo.DATTOUR (MaDatTour, MaKhachHang, MaChuyen, NgayDat, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
VALUES 
-- Đơn đã hoàn thành (chuyến Sa Pa đã đi)
(1, 4, 8, '2026-10-15 14:20', 2, 5500000, N'Đã hoàn thành', N'Đã thanh toán'),
(2, 5, 8, '2026-10-18 09:10', 3, 8250000, N'Đã hoàn thành', N'Đã thanh toán'),

-- Đơn tour Hàn Quốc sắp đi (đã cọc / đã thanh toán)
(3, 4, 1, '2026-10-20 10:00', 2, 25980000, N'Đã xác nhận', N'Đã thanh toán'),
(4, 6, 1, '2026-10-22 16:30', 4, 51960000, N'Đã xác nhận', N'Đã thanh toán'),

-- Đơn tour Đà Nẵng
(5, 5, 4, '2026-10-23 11:15', 2, 9380000, N'Đã xác nhận', N'Đã thanh toán'),

-- Đơn mới đặt (Chờ xác nhận)
(6, 6, 6, '2026-10-24 15:45', 3, 11670000, N'Chờ xác nhận', N'Chưa thanh toán'),

-- Đơn khách đã hủy
(7, 4, 4, '2026-10-12 08:30', 2, 9380000, N'Đã hủy', N'Đã hoàn tiền');
SET IDENTITY_INSERT dbo.DATTOUR OFF;

ENABLE TRIGGER dbo.TRG_DATTOUR_CheckAndLockSeats ON dbo.DATTOUR;
GO

-- 8. NẠP DỮ LIỆU BẢNG CHITIET_HANHKHACH
SET IDENTITY_INSERT dbo.CHITIET_HANHKHACH ON;
INSERT INTO dbo.CHITIET_HANHKHACH (MaHanhKhach, MaDatTour, HoTen, NgaySinh, GioiTinh, SoDienThoai)
VALUES 
(1, 1, N'Nguyễn Văn An', '1989-05-12', N'Nam', '0933112233'),
(2, 1, N'Trần Thị Bích', '1992-08-20', N'Nữ', '0933112234'),
(3, 2, N'Phạm Thị Hương', '1988-11-04', N'Nữ', '0944556677'),
(4, 2, N'Lê Minh Tuấn', '1985-03-15', N'Nam', '0944556678'),
(5, 2, N'Lê Minh Khang', '2016-09-10', N'Nam', NULL),
(6, 3, N'Nguyễn Văn An', '1989-05-12', N'Nam', '0933112233'),
(7, 3, N'Trần Thị Bích', '1992-08-20', N'Nữ', '0933112234'),
(8, 4, N'Đỗ Minh Quân', '1991-04-18', N'Nam', '0977889900'),
(9, 4, N'Hoàng Thu Thảo', '1993-07-22', N'Nữ', '0977889901'),
(10, 4, N'Đỗ Hoàng Anh', '2018-02-14', N'Nam', NULL),
(11, 4, N'Vũ Thị Mai', '1965-12-01', N'Nữ', '0977889902');
SET IDENTITY_INSERT dbo.CHITIET_HANHKHACH OFF;
GO

-- 9. NẠP DỮ LIỆU BẢNG THANHTOAN
SET IDENTITY_INSERT dbo.THANHTOAN ON;
INSERT INTO dbo.THANHTOAN (MaThanhToan, MaDatTour, PhuongThuc, SoTien, NgayThanhToan, MaGiaoDich, TrangThai)
VALUES 
(1, 1, N'Chuyển khoản QR', 5500000, '2026-10-15 14:30', 'MBVCB.982312389', N'Thành công'),
(2, 2, N'Thẻ tín dụng', 8250000, '2026-10-18 09:20', 'VNPAY-891238712', N'Thành công'),
(3, 3, N'Chuyển khoản QR', 25980000, '2026-10-20 10:15', 'TECH.812391283', N'Thành công'),
(4, 4, N'Chuyển khoản QR', 51960000, '2026-10-22 17:00', 'VIETIN.561239812', N'Thành công'),
(5, 5, N'Chuyển khoản QR', 9380000, '2026-10-23 11:30', 'MB.349182391', N'Thành công');
SET IDENTITY_INSERT dbo.THANHTOAN OFF;
GO

-- 10. NẠP DỮ LIỆU BẢNG DANHGIA (Chỉ dành cho các đơn 'Đã hoàn thành')
SET IDENTITY_INSERT dbo.DANHGIA ON;
INSERT INTO dbo.DANHGIA (MaDanhGia, MaDatTour, SoSao, NoiDung, HinhAnh, NgayDanhGia, TrangThaiHienThi, PhanHoiAdmin)
VALUES 
(1, 1, 5, N'Chuyến đi Sa Pa tuyệt vời! Hướng dẫn viên rất nhiệt tình và chu đáo, đồ ăn ngon, phòng khách sạn sạch sẽ ngắm mây rất chill.', 
 '/images/reviews/sapa-review1.jpg', '2026-11-08 10:00', 1, 
 N'Dạ cảm ơn anh An và gia đình đã tin tưởng đồng hành cùng công ty. Chúc anh và gia đình luôn dồi dào sức khỏe!'),

(2, 2, 5, N'Gia đình mình có bé nhỏ nhưng chuyến đi rất nhẹ nhàng và vui vẻ. Các điểm đến rất đẹp, đặc biệt là đỉnh Fansipan hùng vĩ.', 
 '/images/reviews/sapa-review2.jpg', '2026-11-08 14:30', 1, 
 N'Dạ công ty rất hân hạnh được phục vụ gia đình chị Hương. Hẹn gặp lại gia đình trong các chuyến tour tiếp theo ạ!');
SET IDENTITY_INSERT dbo.DANHGIA OFF;
GO

-- 11. NẠP DỮ LIỆU BẢNG BAIVIET_QUANGBA
SET IDENTITY_INSERT dbo.BAIVIET_QUANGBA ON;
INSERT INTO dbo.BAIVIET_QUANGBA (MaBaiViet, TieuDe, Slug, TomTat, NoiDung, HinhAnhDaiDien, LuotXem, NgayTao, TrangThai, MaNguoiDang)
VALUES 
(1, N'Cẩm Nang Du Lịch Hàn Quốc Mùa Thu: Những Điểm Ngắm Lá Vàng Đẹp Tựa Tranh Vẽ', 
 'cam-nang-du-lich-han-quoc-mua-thu-la-vang', 
 N'Mùa thu là thời điểm lãng mạn nhất trong năm để du lịch Hàn Quốc với sắc đỏ của lá phong và sắc vàng rực rỡ của rừng cây ngân hạnh.', 
 N'<p>Mùa thu Hàn Quốc kéo dài từ tháng 9 đến tháng 11 hàng năm. Đến với Seoul vào mùa này, bạn không thể bỏ lỡ đảo Nami rợp bóng cây ngân hạnh, Cung điện Gyeongbokgung cổ kính...</p>', 
 '/images/news/korea-autumn-guide.jpg', 1250, '2026-09-01', 1, 1),

(2, N'Kinh Nghiệm Check-in Cầu Vàng Bà Nà Hills Tránh Đông Đúc Cho Người Đi Lần Đầu', 
 'kinh-nghiem-check-in-cau-vang-ba-na-hills', 
 N'Bật mí khung giờ vàng và mẹo chụp hình triệu like tại Cây Cầu Vàng nổi tiếng thế giới tại Sun World Ba Na Hills Đà Nẵng.', 
 N'<p>Cầu Vàng Bà Nà Hills là kiệt tác kiến trúc được truyền thông quốc tế ca ngợi. Để có những bức hình ấn tượng không bị vướng khách tham quan, bạn nên chọn khung giờ 7h00 - 8h00 sáng...</p>', 
 '/images/news/cau-vang-bana-guide.jpg', 2340, '2026-09-15', 1, 2),

(3, N'Top 5 Trải Nghiệm Nhất Định Phải Thử Khi Đến Phú Quốc Năm 2026', 
 'top-5-trai-nghiem-phai-thu-tai-phu-quoc', 
 N'Từ đi cáp treo vượt biển 3 dây Hòn Thơm, ngắm hoàng hôn tại Sunset Town đến thưởng thức bún quậy trứ danh.', 
 N'<p>Đảo ngọc Phú Quốc luôn nằm trong top điểm đến hấp dẫn nhất Việt Nam. Hãy lưu ngay 5 trải nghiệm đắt giá này cho kỳ nghỉ dưỡng sắp tới của bạn...</p>', 
 '/images/news/phu-quoc-top-5.jpg', 980, '2026-10-01', 1, 2);
SET IDENTITY_INSERT dbo.BAIVIET_QUANGBA OFF;
GO

-- 12. NẠP DỮ LIỆU BẢNG AUDITLOG
SET IDENTITY_INSERT dbo.AUDITLOG ON;
INSERT INTO dbo.AUDITLOG (MaLog, MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
VALUES 
(1, 1, N'KHOI_TAO_HE_THONG', NULL, N'Khởi tạo thành công cấu trúc 12 bảng CSDL chuẩn 3NF', '2026-10-01 08:00'),
(2, 1, N'DANG_TOUR_MOI', NULL, N'Đăng tour mới: Hàn Quốc Seoul - Nami - Lotte World', '2026-10-02 09:30'),
(3, 2, N'MO_BAN_CHUYEN_DI', NULL, N'Mở bán chuyến khởi hành ngày 15/11/2026 cho Tour Hàn Quốc', '2026-10-05 14:15'),
(4, 3, N'XAC_NHAN_THANH_TOAN', N'Trạng thái: Chưa thanh toán', N'Xác nhận đơn #3 đã thanh toán 25.980.000 VNĐ qua QR Code', '2026-10-20 10:16');
SET IDENTITY_INSERT dbo.AUDITLOG OFF;
GO

PRINT N'==> Đã nạp thành công 100% dữ liệu mẫu thực tế và phong phú cho 12 bảng!';
GO
