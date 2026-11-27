-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 04_views_and_functions.sql
-- Mục đích: Views và User-Defined Functions tối ưu hóa hiển thị giao diện Web và Dashboard
-- ==========================================================================================

USE TourDuLichDB;
GO

-- ==========================================================================================
-- 1. FUNCTION: TÍNH TOÁN SỐ CHỖ CÒN TRỐNG CỦA MỘT CHUYẾN KHỞI HÀNH (BR1)
-- SoChoConLai = SoChoToiDa - SoChoDaDat - SoChoGiuCho
-- ==========================================================================================
IF OBJECT_ID(N'dbo.fn_TinhSoChoConLai', N'FN') IS NOT NULL
    DROP FUNCTION dbo.fn_TinhSoChoConLai;
GO

CREATE FUNCTION dbo.fn_TinhSoChoConLai (@MaChuyen INT)
RETURNS INT
AS
BEGIN
    DECLARE @SoChoConLai INT = 0;
    
    SELECT @SoChoConLai = (SoChoToiDa - SoChoDaDat - ISNULL(SoChoGiuCho, 0))
    FROM dbo.CHUYENKHOIHANH
    WHERE MaChuyen = @MaChuyen;

    RETURN ISNULL(@SoChoConLai, 0);
END;
GO

PRINT N'==> Đã tạo Function fn_TinhSoChoConLai thành công.';
GO

-- ==========================================================================================
-- 2. FUNCTION: KIỂM TRA TÍNH TOÀN VẸN DANH SÁCH HÀNH KHÁCH CỦA ĐƠN ĐẶT TOUR
-- Trả về 1 nếu số hành khách khai báo >= 1 và bằng đúng SoLuongKhach của đơn đặt tour
-- ==========================================================================================
IF OBJECT_ID(N'dbo.fn_KiemTraHopLeDanhSachKhach', N'FN') IS NOT NULL
    DROP FUNCTION dbo.fn_KiemTraHopLeDanhSachKhach;
GO

CREATE FUNCTION dbo.fn_KiemTraHopLeDanhSachKhach (@MaDatTour INT)
RETURNS BIT
AS
BEGIN
    DECLARE @SoChoDat INT = 0;
    DECLARE @SoKhachThucTe INT = 0;

    SELECT @SoChoDat = SoLuongKhach
    FROM dbo.DATTOUR
    WHERE MaDatTour = @MaDatTour;

    IF @SoChoDat IS NULL OR @SoChoDat <= 0
        RETURN 0;

    SELECT @SoKhachThucTe = COUNT(*)
    FROM dbo.CHITIET_HANHKHACH
    WHERE MaDatTour = @MaDatTour;

    IF @SoChoDat = @SoKhachThucTe
        RETURN 1;

    RETURN 0;
END;
GO

PRINT N'==> Đã tạo Function fn_KiemTraHopLeDanhSachKhach thành công.';
GO

-- ==========================================================================================
-- 3. VIEW: DANH SÁCH TOUR DU LỊCH HIỂN THỊ TRANG CHỦ & TÌM KIẾM
-- Tổng hợp thông tin tour, điểm đánh giá trung bình, số lượt review và giá bán khởi điểm
-- ==========================================================================================
IF OBJECT_ID(N'dbo.v_DanhSachTourHienThi', N'V') IS NOT NULL
    DROP VIEW dbo.v_DanhSachTourHienThi;
GO

CREATE VIEW dbo.v_DanhSachTourHienThi
AS
SELECT 
    t.MaTour,
    t.TenTour,
    dm.MaDanhMuc,
    dm.TenDanhMuc,
    t.HinhAnhDaiDien,
    t.LichTrinhTongQuan,
    t.GiaKhuyenNghi,
    t.TrangThai,
    ISNULL(MIN(c.GiaThucTe), t.GiaKhuyenNghi) AS GiaKhoiDiem,
    COUNT(DISTINCT c.MaChuyen) AS TongSoChuyenSapToi,
    ISNULL(AVG(CAST(dg.SoSao AS FLOAT)), 5.0) AS DiemDanhGiaTB,
    COUNT(DISTINCT dg.MaDanhGia) AS SoLuotDanhGia
FROM dbo.TOUR t
JOIN dbo.DANHMUC dm ON t.MaDanhMuc = dm.MaDanhMuc
LEFT JOIN dbo.CHUYENKHOIHANH c ON t.MaTour = c.MaTour 
     AND c.TrangThaiChuyen = N'Mở bán' 
     AND c.NgayKhoiHanh >= GETDATE()
LEFT JOIN dbo.DATTOUR dt ON c.MaChuyen = dt.MaChuyen
LEFT JOIN dbo.DANHGIA dg ON dt.MaDatTour = dg.MaDatTour AND dg.TrangThaiHienThi = 1
WHERE t.TrangThai = 1
GROUP BY 
    t.MaTour, t.TenTour, dm.MaDanhMuc, dm.TenDanhMuc, 
    t.HinhAnhDaiDien, t.LichTrinhTongQuan, t.GiaKhuyenNghi, t.TrangThai;
GO

PRINT N'==> Đã tạo View v_DanhSachTourHienThi thành công.';
GO

-- ==========================================================================================
-- 4. VIEW: DANH SÁCH CHUYẾN KHỞI HÀNH KHẢ DỤNG (CÒN CHỖ)
-- Thể hiện rõ số chỗ đã đặt chính thức, số chỗ đang giữ tạm 15 phút, và số chỗ còn lại (BR1)
-- ==========================================================================================
IF OBJECT_ID(N'dbo.v_DanhSachChuyenKhoiHanhConCho', N'V') IS NOT NULL
    DROP VIEW dbo.v_DanhSachChuyenKhoiHanhConCho;
GO

CREATE VIEW dbo.v_DanhSachChuyenKhoiHanhConCho
AS
SELECT 
    c.MaChuyen,
    c.MaTour,
    t.TenTour,
    c.NgayKhoiHanh,
    c.NgayKetThuc,
    DATEDIFF(DAY, c.NgayKhoiHanh, c.NgayKetThuc) + 1 AS SoNgay,
    c.GiaThucTe,
    c.SoChoToiDa,
    c.SoChoDaDat,
    c.SoChoGiuCho,
    (c.SoChoToiDa - c.SoChoDaDat - ISNULL(c.SoChoGiuCho, 0)) AS SoChoConLai,
    c.TrangThaiChuyen
FROM dbo.CHUYENKHOIHANH c
JOIN dbo.TOUR t ON c.MaTour = t.MaTour
WHERE c.TrangThaiChuyen = N'Mở bán'
  AND (c.SoChoToiDa - c.SoChoDaDat - ISNULL(c.SoChoGiuCho, 0)) > 0;
GO

PRINT N'==> Đã tạo View v_DanhSachChuyenKhoiHanhConCho thành công.';
GO

-- ==========================================================================================
-- 5. VIEW: TỔNG HỢP QUẢN LÝ ĐƠN ĐẶT TOUR CHO DASHBOARD ADMIN
-- Phân tách tổng tiền đã thanh toán (thu) và tổng tiền đã hoàn lại
-- ==========================================================================================
IF OBJECT_ID(N'dbo.v_QuanLyDonDatTourAdmin', N'V') IS NOT NULL
    DROP VIEW dbo.v_QuanLyDonDatTourAdmin;
GO

CREATE VIEW dbo.v_QuanLyDonDatTourAdmin
AS
SELECT 
    dt.MaDatTour,
    dt.NgayDat,
    dt.ThoiHanGiuCho,
    nd.MaNguoiDung,
    nd.HoTen AS TenKhachHang,
    nd.Email,
    nd.SoDienThoai,
    t.TenTour,
    c.NgayKhoiHanh,
    c.NgayKetThuc,
    dt.SoLuongKhach,
    dt.TongTien,
    dt.TrangThaiDat,
    dt.TrangThaiThanhToan,
    ISNULL(SUM(CASE WHEN tt.LoaiGiaoDich = N'Thanh toán' AND tt.TrangThai = N'Thành công' THEN tt.SoTien ELSE 0 END), 0) AS SoTienDaThu,
    ISNULL(SUM(CASE WHEN tt.LoaiGiaoDich = N'Hoàn tiền' AND tt.TrangThai = N'Thành công' THEN tt.SoTien ELSE 0 END), 0) AS SoTienDaHoan
FROM dbo.DATTOUR dt
JOIN dbo.NGUOIDUNG nd ON dt.MaKhachHang = nd.MaNguoiDung
JOIN dbo.CHUYENKHOIHANH c ON dt.MaChuyen = c.MaChuyen
JOIN dbo.TOUR t ON c.MaTour = t.MaTour
LEFT JOIN dbo.THANHTOAN tt ON dt.MaDatTour = tt.MaDatTour
GROUP BY 
    dt.MaDatTour, dt.NgayDat, dt.ThoiHanGiuCho, nd.MaNguoiDung, nd.HoTen, nd.Email, nd.SoDienThoai,
    t.TenTour, c.NgayKhoiHanh, c.NgayKetThuc, dt.SoLuongKhach, dt.TongTien,
    dt.TrangThaiDat, dt.TrangThaiThanhToan;
GO

PRINT N'==> Đã tạo View v_QuanLyDonDatTourAdmin thành công.';
GO

-- ==========================================================================================
-- 6. VIEW: QUẢN LÝ YÊU CẦU ĐỔI / HỦY / HOÀN TIỀN (UC-10) CHO ADMIN
-- ==========================================================================================
IF OBJECT_ID(N'dbo.v_QuanLyYeuCauDoiHuyHoanTien', N'V') IS NOT NULL
    DROP VIEW dbo.v_QuanLyYeuCauDoiHuyHoanTien;
GO

CREATE VIEW dbo.v_QuanLyYeuCauDoiHuyHoanTien
AS
SELECT 
    yc.MaYeuCau,
    yc.MaDatTour,
    dt.MaChuyen,
    t.TenTour,
    c.NgayKhoiHanh,
    yc.MaKhachHang,
    nd.HoTen AS TenKhachHang,
    nd.SoDienThoai,
    yc.LoaiYeuCau,
    yc.LyDo,
    yc.SoTienYeuCauHoan,
    yc.ThongTinNganHang,
    yc.TrangThai AS TrangThaiYeuCau,
    yc.PhanHoiAdmin,
    yc.NgayTao AS NgayGuiYeuCau,
    yc.NgayXuLy,
    admin_nd.HoTen AS NguoiXuLy
FROM dbo.YEUCAU_HOANTIEN_DOILICH yc
JOIN dbo.DATTOUR dt ON yc.MaDatTour = dt.MaDatTour
JOIN dbo.CHUYENKHOIHANH c ON dt.MaChuyen = c.MaChuyen
JOIN dbo.TOUR t ON c.MaTour = t.MaTour
JOIN dbo.NGUOIDUNG nd ON yc.MaKhachHang = nd.MaNguoiDung
LEFT JOIN dbo.NGUOIDUNG admin_nd ON yc.NguoiXuLy = admin_nd.MaNguoiDung;
GO

PRINT N'==> Đã tạo View v_QuanLyYeuCauDoiHuyHoanTien thành công.';
GO
