-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 01_indexes_optimization.sql
-- Mục đích: Tối ưu hóa hiệu năng truy vấn cho Web App (Chỉ mục Non-Clustered & Covering Indexes)
-- ==========================================================================================

USE TourDuLichDB;
GO

PRINT N'==> Đang khởi tạo hệ thống Chỉ mục tối ưu hóa truy vấn (Performance Indexes)...';

-- 1. Tối ưu tìm kiếm và lọc Tour theo danh mục và giá
CREATE NONCLUSTERED INDEX IX_TOUR_MaDanhMuc_TrangThai
ON dbo.TOUR (MaDanhMuc ASC, TrangThai ASC)
INCLUDE (TenTour, GiaKhuyenNghi, HinhAnhDaiDien);
GO

-- 2. Tối ưu tải ảnh gallery cho một tour
CREATE NONCLUSTERED INDEX IX_HINHANH_TOUR_MaTour
ON dbo.HINHANH_TOUR (MaTour ASC)
INCLUDE (DuongDanAnh, GhiChu);
GO

-- 3. Tối ưu load lịch trình từng ngày theo thứ tự ngày tăng dần (Day 1 -> Day N)
CREATE NONCLUSTERED INDEX IX_LICH_TRINH_DETAIL_MaTour_NgayThu
ON dbo.LICH_TRINH_DETAIL (MaTour ASC, NgayThu ASC)
INCLUDE (TieuDeNgay, NoiDungChiTiet, BuaAn);
GO

-- 4. Tối ưu tra cứu chuyến khởi hành còn chỗ theo ngày đi và giá thực tế
CREATE NONCLUSTERED INDEX IX_CHUYENKHOIHANH_MaTour_NgayKhoiHanh
ON dbo.CHUYENKHOIHANH (MaTour ASC, NgayKhoiHanh ASC)
INCLUDE (NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen);
GO

-- 5. Tối ưu lịch sử đơn đặt tour của khách hàng
CREATE NONCLUSTERED INDEX IX_DATTOUR_MaKhachHang_NgayDat
ON dbo.DATTOUR (MaKhachHang ASC, NgayDat DESC)
INCLUDE (MaChuyen, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan);
GO

-- 6. Tối ưu tổng hợp đơn hàng theo chuyến khởi hành và trạng thái đơn
CREATE NONCLUSTERED INDEX IX_DATTOUR_MaChuyen_TrangThaiDat
ON dbo.DATTOUR (MaChuyen ASC, TrangThaiDat ASC)
INCLUDE (SoLuongKhach, TongTien);
GO

-- 7. Tối ưu load danh sách hành khách theo đơn đặt tour
CREATE NONCLUSTERED INDEX IX_CHITIET_HANHKHACH_MaDatTour
ON dbo.CHITIET_HANHKHACH (MaDatTour ASC)
INCLUDE (HoTen, NgaySinh, GioiTinh, SoDienThoai);
GO

-- 8. Tối ưu tra cứu các giao dịch thanh toán của đơn đặt tour
CREATE NONCLUSTERED INDEX IX_THANHTOAN_MaDatTour
ON dbo.THANHTOAN (MaDatTour ASC)
INCLUDE (PhuongThuc, SoTien, NgayThanhToan, TrangThai);
GO

-- 9. Tối ưu tra cứu bài viết theo người đăng và thời gian
CREATE NONCLUSTERED INDEX IX_BAIVIET_QUANGBA_MaNguoiDang_NgayTao
ON dbo.BAIVIET_QUANGBA (MaNguoiDang ASC, NgayTao DESC)
INCLUDE (TieuDe, Slug, LuotXem, TrangThai);
GO

-- 10. Tối ưu tra cứu Audit Log theo thời gian và người thực hiện
CREATE NONCLUSTERED INDEX IX_AUDITLOG_ThoiGian_MaNguoiThucHien
ON dbo.AUDITLOG (ThoiGian DESC, MaNguoiThucHien ASC)
INCLUDE (HanhDong);
GO

PRINT N'==> Khởi tạo hệ thống Indexes tối ưu hóa thành công!';
GO
