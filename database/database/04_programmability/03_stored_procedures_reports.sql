-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 03_stored_procedures_reports.sql
-- Mục đích: Stored Procedures phục vụ Dashboard Báo cáo & Thống kê Doanh thu Quản trị Admin
-- ==========================================================================================

USE TourDuLichDB;
GO

-- ==========================================================================================
-- 1. PROCEDURE: THỐNG KÊ DOANH THU VÀ ĐƠN ĐẶT TOUR THÀNH CÔNG THEO KHOẢNG THỜI GIAN
-- Mục tiêu: Đáp ứng yêu cầu Admin xem tổng doanh thu, số đơn thành công, số khách phục vụ
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_ThongKeDoanhThuVaDonHang', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ThongKeDoanhThuVaDonHang;
GO

CREATE PROCEDURE dbo.sp_ThongKeDoanhThuVaDonHang
    @TuNgay  DATETIME,
    @DenNgay DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    -- Chuẩn hóa thời gian kết thúc ngày (23:59:59)
    DECLARE @NgayKetThucChuan DATETIME = DATEADD(SECOND, -1, DATEADD(DAY, 1, CAST(CAST(@DenNgay AS DATE) AS DATETIME)));

    PRINT N'====================================================================================';
    PRINT N'             BÁO CÁO THỐNG KÊ DOANH THU & KẾT QUẢ KINH DOANH TOUR DU LỊCH           ';
    PRINT CONCAT(N' Giai đoạn: Từ ngày ', CONVERT(VARCHAR(10), @TuNgay, 105), N' đến ngày ', CONVERT(VARCHAR(10), @DenNgay, 105));
    PRINT N'====================================================================================';

    -- BẢNG 1: TỔNG QUAN CÁC CHỈ SỐ KPI CHÍNH
    SELECT 
        COUNT(DISTINCT dt.MaDatTour) AS TongSoDonDat,
        
        -- Đơn thành công: 'Đã xác nhận' hoặc 'Đã hoàn thành'
        SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS SoDonThanhCong,
        
        -- Đơn đã hủy
        SUM(CASE WHEN dt.TrangThaiDat = N'Đã hủy' THEN 1 ELSE 0 END) AS SoDonDaHuy,
        
        -- Tổng số hành khách của các đơn thành công
        ISNULL(SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN dt.SoLuongKhach ELSE 0 END), 0) AS TongSoKhachPhucVu,
        
        -- Tổng giá trị đơn đặt thành công
        ISNULL(SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN dt.TongTien ELSE 0 END), 0) AS TongGiaTriDonThanhCong,
        
        -- Tổng doanh thu thực tế đã thu về qua cổng thanh toán
        (
            SELECT ISNULL(SUM(tt.SoTien), 0)
            FROM dbo.THANHTOAN tt
            JOIN dbo.DATTOUR d ON tt.MaDatTour = d.MaDatTour
            WHERE tt.NgayThanhToan BETWEEN @TuNgay AND @NgayKetThucChuan
              AND tt.TrangThai = N'Thành công'
        ) AS DoanhThuThucThu
    FROM dbo.DATTOUR dt
    WHERE dt.NgayDat BETWEEN @TuNgay AND @NgayKetThucChuan;

    -- BẢNG 2: PHÂN TÍCH DOANH THU VÀ SỐ ĐƠN THEO TỪNG DANH MỤC DU LỊCH
    SELECT 
        dm.MaDanhMuc,
        dm.TenDanhMuc,
        COUNT(dt.MaDatTour) AS SoDonDat,
        SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS SoDonThanhCong,
        ISNULL(SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN dt.SoLuongKhach ELSE 0 END), 0) AS TongKhach,
        ISNULL(SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN dt.TongTien ELSE 0 END), 0) AS DoanhThuDanhMuc
    FROM dbo.DANHMUC dm
    LEFT JOIN dbo.TOUR t ON dm.MaDanhMuc = t.MaDanhMuc
    LEFT JOIN dbo.CHUYENKHOIHANH c ON t.MaTour = c.MaTour
    LEFT JOIN dbo.DATTOUR dt ON c.MaChuyen = dt.MaChuyen AND dt.NgayDat BETWEEN @TuNgay AND @NgayKetThucChuan
    GROUP BY dm.MaDanhMuc, dm.TenDanhMuc
    ORDER BY DoanhThuDanhMuc DESC;
END;
GO

PRINT N'==> Đã tạo Stored Procedure sp_ThongKeDoanhThuVaDonHang thành công.';
GO

-- ==========================================================================================
-- 2. PROCEDURE: THỐNG KÊ TOP N TOUR ĐƯỢC ĐẶT NHIỀU NHẤT
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_ThongKeTopTourBanChay', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ThongKeTopTourBanChay;
GO

CREATE PROCEDURE dbo.sp_ThongKeTopTourBanChay
    @TopN INT = 5
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@TopN)
        t.MaTour,
        t.TenTour,
        dm.TenDanhMuc,
        t.GiaKhuyenNghi,
        COUNT(dt.MaDatTour) AS TongSoDonDat,
        ISNULL(SUM(dt.SoLuongKhach), 0) AS TongSoKhach,
        ISNULL(SUM(dt.TongTien), 0) AS TongDoanhThu,
        ISNULL(AVG(CAST(dg.SoSao AS FLOAT)), 5.0) AS DiemDanhGiaTrungBinh
    FROM dbo.TOUR t
    JOIN dbo.DANHMUC dm ON t.MaDanhMuc = dm.MaDanhMuc
    JOIN dbo.CHUYENKHOIHANH c ON t.MaTour = c.MaTour
    LEFT JOIN dbo.DATTOUR dt ON c.MaChuyen = dt.MaChuyen AND dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành')
    LEFT JOIN dbo.DANHGIA dg ON dt.MaDatTour = dg.MaDatTour
    GROUP BY t.MaTour, t.TenTour, dm.TenDanhMuc, t.GiaKhuyenNghi
    ORDER BY TongDoanhThu DESC, TongSoKhach DESC;
END;
GO

PRINT N'==> Đã tạo Stored Procedure sp_ThongKeTopTourBanChay thành công.';
GO
