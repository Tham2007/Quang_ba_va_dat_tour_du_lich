-- ==========================================================================================
-- BỘ HÀM / STORED PROCEDURES CHUẨN HÓA CHO BACKEND WEB API (MS SQL SERVER)
-- DỰ ÁN: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- ==========================================================================================
-- Hướng dẫn nhanh cho Lập trình viên Backend (Node.js, C# ASP.NET, Java Spring, PHP, Python):
-- Mỗi Procedure đã được đóng gói sẵn kiểm tra lỗi, Transaction toàn vẹn và trả về
-- cấu trúc chuẩn: { Success: 1/0, StatusCode: 200/400/404/500, Message: N'...', ...Data }
-- ==========================================================================================

USE TourDuLichDB;
GO

-- ==========================================================================================
-- 1. [PUBLIC API] LẤY DANH MỤC DU LỊCH -> GET /api/categories
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetCategories', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetCategories;
GO
CREATE PROCEDURE dbo.sp_api_GetCategories
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT 
            dm.MaDanhMuc,
            dm.TenDanhMuc,
            dm.MoTa,
            COUNT(t.MaTour) AS SoLuongTour
        FROM dbo.DANHMUC dm
        LEFT JOIN dbo.TOUR t ON dm.MaDanhMuc = t.MaDanhMuc AND t.TrangThai = 1
        GROUP BY dm.MaDanhMuc, dm.TenDanhMuc, dm.MoTa
        ORDER BY dm.MaDanhMuc ASC;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- 2. [PUBLIC API] TÌM KIẾM, LỌC & PHÂN TRANG TOUR -> GET /api/tours
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetTours', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetTours;
GO
CREATE PROCEDURE dbo.sp_api_GetTours
    @TuKhoa       NVARCHAR(100) = NULL,
    @MaDanhMuc    INT           = NULL,
    @TuGia        DECIMAL(18,2) = NULL,
    @DenGia       DECIMAL(18,2) = NULL,
    @SapXepTheo   VARCHAR(20)   = 'GIA_TANG', -- 'GIA_TANG', 'GIA_GIAM', 'MOI_NHAT'
    @PageIndex    INT           = 1,
    @PageSize     INT           = 9
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF @PageIndex < 1 SET @PageIndex = 1;
        IF @PageSize < 1 SET @PageSize = 9;
        DECLARE @Offset INT = (@PageIndex - 1) * @PageSize;

        -- Result Set 1: Tổng số bản ghi (Pagination metadata)
        SELECT COUNT(DISTINCT t.MaTour) AS TongSoBanGhi
        FROM dbo.TOUR t
        JOIN dbo.DANHMUC dm ON t.MaDanhMuc = dm.MaDanhMuc
        LEFT JOIN dbo.CHUYENKHOIHANH c ON t.MaTour = c.MaTour AND c.TrangThaiChuyen = N'Mở bán'
        WHERE t.TrangThai = 1
          AND (@MaDanhMuc IS NULL OR t.MaDanhMuc = @MaDanhMuc)
          AND (@TuKhoa IS NULL OR t.TenTour LIKE N'%' + @TuKhoa + N'%' OR dm.TenDanhMuc LIKE N'%' + @TuKhoa + N'%')
          AND (@TuGia IS NULL OR ISNULL(c.GiaThucTe, t.GiaKhuyenNghi) >= @TuGia)
          AND (@DenGia IS NULL OR ISNULL(c.GiaThucTe, t.GiaKhuyenNghi) <= @DenGia);

        -- Result Set 2: Danh sách dữ liệu của trang hiện tại
        SELECT 
            t.MaTour,
            t.TenTour,
            dm.MaDanhMuc,
            dm.TenDanhMuc,
            t.HinhAnhDaiDien,
            t.LichTrinhTongQuan,
            t.GiaKhuyenNghi,
            ISNULL(MIN(c.GiaThucTe), t.GiaKhuyenNghi) AS GiaKhoiDiem,
            COUNT(DISTINCT c.MaChuyen) AS SoChuyenSapKhoiHanh,
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
          AND (@MaDanhMuc IS NULL OR t.MaDanhMuc = @MaDanhMuc)
          AND (@TuKhoa IS NULL OR t.TenTour LIKE N'%' + @TuKhoa + N'%' OR dm.TenDanhMuc LIKE N'%' + @TuKhoa + N'%')
          AND (@TuGia IS NULL OR ISNULL(c.GiaThucTe, t.GiaKhuyenNghi) >= @TuGia)
          AND (@DenGia IS NULL OR ISNULL(c.GiaThucTe, t.GiaKhuyenNghi) <= @DenGia)
        GROUP BY 
            t.MaTour, t.TenTour, dm.MaDanhMuc, dm.TenDanhMuc, 
            t.HinhAnhDaiDien, t.LichTrinhTongQuan, t.GiaKhuyenNghi
        ORDER BY 
            CASE WHEN @SapXepTheo = 'GIA_TANG' THEN ISNULL(MIN(c.GiaThucTe), t.GiaKhuyenNghi) END ASC,
            CASE WHEN @SapXepTheo = 'GIA_GIAM' THEN ISNULL(MIN(c.GiaThucTe), t.GiaKhuyenNghi) END DESC,
            CASE WHEN @SapXepTheo = 'MOI_NHAT' THEN t.MaTour END DESC
        OFFSET @Offset ROWS 
        FETCH NEXT @PageSize ROWS ONLY;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- 3. [PUBLIC API] LẤY CHI TIẾT TOUR TOÀN DIỆN -> GET /api/tours/:id
-- Trả về 4 tập kết quả: (1) Info Tour, (2) Gallery, (3) Lịch trình từng ngày, (4) Chuyến đi khả dụng
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetTourDetail', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetTourDetail;
GO
CREATE PROCEDURE dbo.sp_api_GetTourDetail
    @MaTour INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- 1. Thông tin chung của Tour
        SELECT 
            t.MaTour,
            t.TenTour,
            dm.MaDanhMuc,
            dm.TenDanhMuc,
            t.MoTaChiTiet,
            t.LichTrinhTongQuan,
            t.GiaKhuyenNghi,
            t.HinhAnhDaiDien,
            ISNULL(AVG(CAST(dg.SoSao AS FLOAT)), 5.0) AS DiemDanhGiaTB,
            COUNT(DISTINCT dg.MaDanhGia) AS SoLuotDanhGia
        FROM dbo.TOUR t
        JOIN dbo.DANHMUC dm ON t.MaDanhMuc = dm.MaDanhMuc
        LEFT JOIN dbo.CHUYENKHOIHANH c ON t.MaTour = c.MaTour
        LEFT JOIN dbo.DATTOUR dt ON c.MaChuyen = dt.MaChuyen
        LEFT JOIN dbo.DANHGIA dg ON dt.MaDatTour = dg.MaDatTour AND dg.TrangThaiHienThi = 1
        WHERE t.MaTour = @MaTour AND t.TrangThai = 1
        GROUP BY 
            t.MaTour, t.TenTour, dm.MaDanhMuc, dm.TenDanhMuc, 
            t.MoTaChiTiet, t.LichTrinhTongQuan, t.GiaKhuyenNghi, t.HinhAnhDaiDien;

        -- 2. Bộ sưu tập ảnh Gallery (HINHANH_TOUR)
        SELECT MaHinhAnh, DuongDanAnh, GhiChu
        FROM dbo.HINHANH_TOUR
        WHERE MaTour = @MaTour
        ORDER BY MaHinhAnh ASC;

        -- 3. Lịch trình chi tiết từng ngày (LICH_TRINH_DETAIL)
        SELECT MaLichTrinh, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn
        FROM dbo.LICH_TRINH_DETAIL
        WHERE MaTour = @MaTour
        ORDER BY NgayThu ASC;

        -- 4. Danh sách các chuyến khởi hành khả dụng (còn chỗ và trong tương lai)
        SELECT 
            MaChuyen,
            NgayKhoiHanh,
            NgayKetThuc,
            DATEDIFF(DAY, NgayKhoiHanh, NgayKetThuc) + 1 AS SoNgay,
            GiaThucTe,
            SoChoToiDa,
            SoChoDaDat,
            (SoChoToiDa - SoChoDaDat) AS SoChoConLai,
            TrangThaiChuyen
        FROM dbo.CHUYENKHOIHANH
        WHERE MaTour = @MaTour 
          AND TrangThaiChuyen = N'Mở bán'
          AND (SoChoToiDa - SoChoDaDat) > 0
          AND NgayKhoiHanh >= GETDATE()
        ORDER BY NgayKhoiHanh ASC;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- 4. [AUTH API] ĐĂNG KÝ TÀI KHOẢN MỚI -> POST /api/auth/register
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Register', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Register;
GO
CREATE PROCEDURE dbo.sp_api_Register
    @HoTen        NVARCHAR(100),
    @Email        VARCHAR(100),
    @SoDienThoai  VARCHAR(15),
    @MatKhauHash  VARCHAR(255),
    @DiaChi       NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE Email = @Email)
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Địa chỉ Email này đã được đăng ký trong hệ thống.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.NGUOIDUNG (HoTen, Email, SoDienThoai, MatKhau, DiaChi, TrangThai, NgayTao)
        VALUES (@HoTen, @Email, @SoDienThoai, @MatKhauHash, @DiaChi, 1, GETDATE());

        DECLARE @NewUserId INT = SCOPE_IDENTITY();

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Đăng ký tài khoản thành công!' AS Message,
            @NewUserId AS MaNguoiDung,
            @HoTen AS HoTen,
            @Email AS Email;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- 5. [AUTH API] XÁC THỰC ĐĂNG NHẬP -> POST /api/auth/login
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetUserForLogin', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetUserForLogin;
GO
CREATE PROCEDURE dbo.sp_api_GetUserForLogin
    @Email VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        MaNguoiDung,
        HoTen,
        Email,
        SoDienThoai,
        MatKhau AS PasswordHash,
        DiaChi,
        TrangThai,
        NgayTao
    FROM dbo.NGUOIDUNG
    WHERE Email = @Email;
END;
GO

-- ==========================================================================================
-- 6. [BOOKING API] TẠO ĐƠN ĐẶT TOUR AN TOÀN -> POST /api/bookings
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_CreateBooking', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_CreateBooking;
GO
CREATE PROCEDURE dbo.sp_api_CreateBooking
    @MaKhachHang     INT,
    @MaChuyen        INT,
    @SoLuongKhach    INT,
    @HoTenNguoiDat   NVARCHAR(100),
    @SoDienThoai     VARCHAR(15)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE MaNguoiDung = @MaKhachHang AND TrangThai = 1)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Success, 403 AS StatusCode, N'Tài khoản không hợp lệ hoặc đã bị khóa.' AS Message;
            RETURN;
        END;

        DECLARE @GiaThucTe DECIMAL(18,2);
        DECLARE @SoChoToiDa INT;
        DECLARE @SoChoDaDat INT;
        DECLARE @TrangThaiChuyen NVARCHAR(50);

        SELECT 
            @GiaThucTe = GiaThucTe,
            @SoChoToiDa = SoChoToiDa,
            @SoChoDaDat = SoChoDaDat,
            @TrangThaiChuyen = TrangThaiChuyen
        FROM dbo.CHUYENKHOIHANH WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChuyen = @MaChuyen;

        IF @GiaThucTe IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Success, 404 AS StatusCode, N'Chuyến khởi hành không tồn tại.' AS Message;
            RETURN;
        END;

        IF @TrangThaiChuyen <> N'Mở bán'
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Success, 400 AS StatusCode, N'Chuyến đi này hiện không mở bán.' AS Message;
            RETURN;
        END;

        IF (@SoChoToiDa - @SoChoDaDat) < @SoLuongKhach
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Success, 400 AS StatusCode, 
                   CONCAT(N'Không đủ số chỗ trống. Hiện chỉ còn ', (@SoChoToiDa - @SoChoDaDat), N' chỗ.') AS Message;
            RETURN;
        END;

        DECLARE @TongTien DECIMAL(18,2) = @SoLuongKhach * @GiaThucTe;
        DECLARE @MaDatTourMoi INT;

        INSERT INTO dbo.DATTOUR (MaKhachHang, MaChuyen, NgayDat, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
        VALUES (@MaKhachHang, @MaChuyen, GETDATE(), @SoLuongKhach, @TongTien, N'Chờ xác nhận', N'Chưa thanh toán');

        SET @MaDatTourMoi = SCOPE_IDENTITY();

        INSERT INTO dbo.CHITIET_HANHKHACH (MaDatTour, HoTen, SoDienThoai)
        VALUES (@MaDatTourMoi, @HoTenNguoiDat, @SoDienThoai);

        COMMIT TRANSACTION;

        SELECT 
            1 AS Success,
            201 AS StatusCode,
            N'Đặt tour thành công, đã giữ chỗ tạm thời!' AS Message,
            @MaDatTourMoi AS MaDatTour,
            @TongTien AS TongTien,
            @SoLuongKhach AS SoLuongKhach;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- 7. [BOOKING API] THÊM HÀNH KHÁCH ĐI CÙNG -> POST /api/bookings/:id/passengers
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_AddPassenger', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_AddPassenger;
GO
CREATE PROCEDURE dbo.sp_api_AddPassenger
    @MaDatTour   INT,
    @HoTen       NVARCHAR(100),
    @NgaySinh    DATE          = NULL,
    @GioiTinh    NVARCHAR(10)  = NULL,
    @SoDienThoai VARCHAR(15)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Đơn đặt tour không tồn tại.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.CHITIET_HANHKHACH (MaDatTour, HoTen, NgaySinh, GioiTinh, SoDienThoai)
        VALUES (@MaDatTour, @HoTen, @NgaySinh, @GioiTinh, @SoDienThoai);

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Đã thêm hành khách thành công!' AS Message,
            SCOPE_IDENTITY() AS MaHanhKhach;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- 8. [CUSTOMER API] LẤY LỊCH SỬ ĐƠN TOUR -> GET /api/user/bookings
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetCustomerBookings', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetCustomerBookings;
GO
CREATE PROCEDURE dbo.sp_api_GetCustomerBookings
    @MaKhachHang INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT 
            dt.MaDatTour,
            dt.NgayDat,
            t.MaTour,
            t.TenTour,
            t.HinhAnhDaiDien,
            c.NgayKhoiHanh,
            c.NgayKetThuc,
            dt.SoLuongKhach,
            dt.TongTien,
            dt.TrangThaiDat,
            dt.TrangThaiThanhToan,
            CASE WHEN dg.MaDanhGia IS NOT NULL THEN 1 ELSE 0 END AS DaDanhGia,
            ISNULL(dg.SoSao, 0) AS SoSaoDanhGia
        FROM dbo.DATTOUR dt
        JOIN dbo.CHUYENKHOIHANH c ON dt.MaChuyen = c.MaChuyen
        JOIN dbo.TOUR t ON c.MaTour = t.MaTour
        LEFT JOIN dbo.DANHGIA dg ON dt.MaDatTour = dg.MaDatTour
        WHERE dt.MaKhachHang = @MaKhachHang
        ORDER BY dt.NgayDat DESC;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- 9. [CUSTOMER API] HỦY ĐƠN ĐẶT TOUR -> POST /api/bookings/:id/cancel
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_CancelBooking', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_CancelBooking;
GO
CREATE PROCEDURE dbo.sp_api_CancelBooking
    @MaDatTour    INT,
    @MaKhachHang  INT,
    @LyDoHuy      NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND MaKhachHang = @MaKhachHang)
        BEGIN
            SELECT 0 AS Success, 403 AS StatusCode, N'Bạn không có quyền thao tác trên đơn đặt này.' AS Message;
            RETURN;
        END;

        DECLARE @TrangThaiHienTai NVARCHAR(50);
        SELECT @TrangThaiHienTai = TrangThaiDat FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour;

        IF @TrangThaiHienTai = N'Đã hủy'
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Đơn tour này đã bị hủy trước đó.' AS Message;
            RETURN;
        END;

        IF @TrangThaiHienTai = N'Đã hoàn thành'
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Chuyến đi đã hoàn thành, không thể hủy đơn.' AS Message;
            RETURN;
        END;

        UPDATE dbo.DATTOUR
        SET TrangThaiDat = N'Đã hủy'
        WHERE MaDatTour = @MaDatTour;

        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (@MaKhachHang, N'KHACH_HUY_TOUR', CONCAT(N'Trạng thái cũ: ', @TrangThaiHienTai), @LyDoHuy, GETDATE());

        SELECT 1 AS Success, 200 AS StatusCode, N'Hủy đơn đặt tour thành công, chỗ trống đã được giải phóng.' AS Message;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- 10. [REVIEW API] GỬI ĐÁNH GIÁ CHUYẾN ĐI -> POST /api/bookings/:id/review
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_SubmitReview', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_SubmitReview;
GO
CREATE PROCEDURE dbo.sp_api_SubmitReview
    @MaDatTour INT,
    @SoSao     TINYINT,
    @NoiDung   NVARCHAR(1000) = NULL,
    @HinhAnh   NVARCHAR(500)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND TrangThaiDat = N'Đã hoàn thành')
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Quý khách chỉ có thể đánh giá cho chuyến đi đã hoàn thành.' AS Message;
            RETURN;
        END;

        IF EXISTS (SELECT 1 FROM dbo.DANHGIA WHERE MaDatTour = @MaDatTour)
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Đơn đặt tour này đã được đánh giá trước đó.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.DANHGIA (MaDatTour, SoSao, NoiDung, HinhAnh, NgayDanhGia, TrangThaiHienThi)
        VALUES (@MaDatTour, @SoSao, @NoiDung, @HinhAnh, GETDATE(), 1);

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Cảm ơn quý khách đã gửi đánh giá!' AS Message,
            SCOPE_IDENTITY() AS MaDanhGia;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- 11. [ADMIN API] DUYỆT XÁC NHẬN THANH TOÁN -> POST /api/admin/bookings/:id/confirm-payment
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_ConfirmPayment', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_ConfirmPayment;
GO
CREATE PROCEDURE dbo.sp_api_Admin_ConfirmPayment
    @MaDatTour   INT,
    @PhuongThuc  NVARCHAR(50),
    @SoTien      DECIMAL(18,2),
    @MaGiaoDich  VARCHAR(100),
    @MaAdmin     INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        EXEC dbo.sp_XacNhanThanhToanDonTour 
            @MaDatTour = @MaDatTour,
            @PhuongThuc = @PhuongThuc,
            @SoTien = @SoTien,
            @MaGiaoDich = @MaGiaoDich,
            @MaAdmin = @MaAdmin;

        SELECT 1 AS Success, 200 AS StatusCode, N'Đã duyệt và xác nhận thanh toán thành công!' AS Message;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- 12. [ADMIN API] THỐNG KÊ DASHBOARD KPI -> GET /api/admin/dashboard-kpi
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_GetDashboardKPI', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_GetDashboardKPI;
GO
CREATE PROCEDURE dbo.sp_api_Admin_GetDashboardKPI
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT 
            (SELECT ISNULL(SUM(SoTien), 0) FROM dbo.THANHTOAN WHERE TrangThai = N'Thành công') AS TongDoanhThu,
            (SELECT COUNT(*) FROM dbo.DATTOUR) AS TongDonDat,
            (SELECT COUNT(*) FROM dbo.DATTOUR WHERE TrangThaiDat = N'Chờ xác nhận') AS DonChoXacNhan,
            (SELECT COUNT(*) FROM dbo.NGUOIDUNG WHERE TrangThai = 1) AS TongKhachHang,
            (SELECT COUNT(*) FROM dbo.TOUR WHERE TrangThai = 1) AS TongTourDangMoBan,
            (
                SELECT ISNULL(SUM(SoTien), 0) 
                FROM dbo.THANHTOAN 
                WHERE TrangThai = N'Thành công' 
                  AND MONTH(NgayThanhToan) = MONTH(GETDATE()) 
                  AND YEAR(NgayThanhToan) = YEAR(GETDATE())
            ) AS DoanhThuThangNay;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

PRINT N'==> Đã tạo xong toàn bộ các Procedures cho Backend API!';
GO
