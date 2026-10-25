-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 05_api_endpoints_procedures.sql
-- Mục đích: TẬP HỢP ĐẦY ĐỦ CÁC HÀM / STORED PROCEDURES ĐƯỢC CHUẨN HÓA DÀNH RIÊNG CHO WEB API
--          (Sẵn sàng gọi từ Backend: Node.js, ASP.NET Core, Java Spring, Python FastAPI, PHP)
-- ==========================================================================================

USE TourDuLichDB;
GO

PRINT N'==> Đang khởi tạo Bộ Stored Procedures dành riêng cho Web Backend API...';
GO

-- ##########################################################################################
-- PHẦN A: NHÓM API DÀNH CHO KHÁCH VÃNG LAI & CÔNG KHAI (PUBLIC / GUEST APIs)
-- ##########################################################################################

-- ==========================================================================================
-- A1. API: LẤY DANH SÁCH DANH MỤC DU LỊCH (KÈM SỐ LƯỢNG TOUR MỖI DANH MỤC)
-- Backend Endpoint đề xuất: GET /api/categories
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
-- A2. API: TÌM KIẾM, LỌC & PHÂN TRANG DANH SÁCH TOUR
-- Backend Endpoint đề xuất: GET /api/tours?keyword=&categoryId=&minPrice=&maxPrice=&pageIndex=1&pageSize=9
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

        -- 1. Trả về tổng số bản ghi thỏa mãn bộ lọc (phục vụ phân trang)
        SELECT COUNT(DISTINCT t.MaTour) AS TongSoBanGhi
        FROM dbo.TOUR t
        JOIN dbo.DANHMUC dm ON t.MaDanhMuc = dm.MaDanhMuc
        LEFT JOIN dbo.CHUYENKHOIHANH c ON t.MaTour = c.MaTour AND c.TrangThaiChuyen = N'Mở bán'
        WHERE t.TrangThai = 1
          AND (@MaDanhMuc IS NULL OR t.MaDanhMuc = @MaDanhMuc)
          AND (@TuKhoa IS NULL OR t.TenTour LIKE N'%' + @TuKhoa + N'%' OR dm.TenDanhMuc LIKE N'%' + @TuKhoa + N'%')
          AND (@TuGia IS NULL OR ISNULL(c.GiaThucTe, t.GiaKhuyenNghi) >= @TuGia)
          AND (@DenGia IS NULL OR ISNULL(c.GiaThucTe, t.GiaKhuyenNghi) <= @DenGia);

        -- 2. Trả về danh sách tour của trang hiện tại
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
-- A3. API: LẤY CHI TIẾT TOÀN DIỆN MỘT TOUR (THÔNG TIN + GALLERY + LỊCH TRÌNH NGÀY + CHUYẾN KHỞI HÀNH)
-- Backend Endpoint đề xuất: GET /api/tours/:id
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
-- A4. API: LẤY BÀI VIẾT QUẢNG BÁ & CHI TIẾT THEO SLUG (TỰ ĐỘNG TĂNG LƯỢT XEM)
-- Backend Endpoint đề xuất: GET /api/posts & GET /api/posts/:slug
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetBlogPosts', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetBlogPosts;
GO
CREATE PROCEDURE dbo.sp_api_GetBlogPosts
    @PageIndex INT = 1,
    @PageSize  INT = 6
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@PageIndex - 1) * @PageSize;

    SELECT COUNT(*) AS TongSoBaiViet FROM dbo.BAIVIET_QUANGBA WHERE TrangThai = 1;

    SELECT 
        b.MaBaiViet, b.TieuDe, b.Slug, b.TomTat, b.HinhAnhDaiDien,
        b.LuotXem, b.NgayTao, nd.HoTen AS TacGia
    FROM dbo.BAIVIET_QUANGBA b
    JOIN dbo.NGUOIDUNG nd ON b.MaNguoiDang = nd.MaNguoiDung
    WHERE b.TrangThai = 1
    ORDER BY b.NgayTao DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

IF OBJECT_ID(N'dbo.sp_api_GetBlogPostDetail', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetBlogPostDetail;
GO
CREATE PROCEDURE dbo.sp_api_GetBlogPostDetail
    @Slug VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    -- Tự động tăng lượt xem
    UPDATE dbo.BAIVIET_QUANGBA
    SET LuotXem = LuotXem + 1
    WHERE Slug = @Slug AND TrangThai = 1;

    -- Lấy chi tiết bài viết
    SELECT 
        b.MaBaiViet, b.TieuDe, b.Slug, b.TomTat, b.NoiDung, b.HinhAnhDaiDien,
        b.LuotXem, b.NgayTao, nd.HoTen AS TacGia, nd.Email AS EmailTacGia
    FROM dbo.BAIVIET_QUANGBA b
    JOIN dbo.NGUOIDUNG nd ON b.MaNguoiDang = nd.MaNguoiDung
    WHERE b.Slug = @Slug AND b.TrangThai = 1;
END;
GO


-- ##########################################################################################
-- PHẦN B: NHÓM API DÀNH CHO KHÁCH HÀNG THÀNH VIÊN (CUSTOMER / AUTHENTICATED APIs)
-- ##########################################################################################

-- ==========================================================================================
-- B1. API: ĐĂNG KÝ TÀI KHOẢN KHÁCH HÀNG MỚI
-- Backend Endpoint đề xuất: POST /api/auth/register
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
        -- Kiểm tra email đã tồn tại hay chưa
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
-- B2. API: LẤY THÔNG TIN ĐĂNG NHẬP THEO EMAIL (HỖ TRỢ BACKEND BCRYPT VERIFY)
-- Backend Endpoint đề xuất: POST /api/auth/login
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
-- B3. API: CẬP NHẬT THÔNG TIN HỒ SƠ CÁ NHÂN
-- Backend Endpoint đề xuất: PUT /api/user/profile
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_UpdateProfile', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_UpdateProfile;
GO
CREATE PROCEDURE dbo.sp_api_UpdateProfile
    @MaNguoiDung INT,
    @HoTen       NVARCHAR(100),
    @SoDienThoai VARCHAR(15),
    @DiaChi      NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE MaNguoiDung = @MaNguoiDung)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Người dùng không tồn tại.' AS Message;
            RETURN;
        END;

        UPDATE dbo.NGUOIDUNG
        SET HoTen = @HoTen,
            SoDienThoai = @SoDienThoai,
            DiaChi = @DiaChi
        WHERE MaNguoiDung = @MaNguoiDung;

        SELECT 1 AS Success, 200 AS StatusCode, N'Cập nhật thông tin thành công!' AS Message;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- B4. API: TẠO ĐƠN ĐẶT TOUR MỚI & THÊM HÀNH KHÁCH (CHỐNG OVERBOOKING VỚI TRANSACTION)
-- Backend Endpoint đề xuất: POST /api/bookings
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
        -- 1. Kiểm tra tài khoản khách
        IF NOT EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE MaNguoiDung = @MaKhachHang AND TrangThai = 1)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Success, 403 AS StatusCode, N'Tài khoản không hợp lệ hoặc đã bị khóa.' AS Message;
            RETURN;
        END;

        -- 2. Kiểm tra chuyến khởi hành và giữ khóa UPDLOCK chống race condition
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

        -- 3. Tạo đơn đặt tour (Trigger TRG_DATTOUR_CheckAndLockSeats sẽ tự động tăng số chỗ)
        DECLARE @TongTien DECIMAL(18,2) = @SoLuongKhach * @GiaThucTe;
        DECLARE @MaDatTourMoi INT;

        INSERT INTO dbo.DATTOUR (MaKhachHang, MaChuyen, NgayDat, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
        VALUES (@MaKhachHang, @MaChuyen, GETDATE(), @SoLuongKhach, @TongTien, N'Chờ xác nhận', N'Chưa thanh toán');

        SET @MaDatTourMoi = SCOPE_IDENTITY();

        -- 4. Thêm người liên hệ chính vào danh sách hành khách
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
-- B5. API: THÊM THÔNG TIN HÀNH KHÁCH ĐI CÙNG VÀO ĐƠN ĐẶT TOUR
-- Backend Endpoint đề xuất: POST /api/bookings/:bookingId/passengers
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
-- B6. API: LẤY LỊCH SỬ ĐƠN ĐẶT TOUR CỦA KHÁCH HÀNG
-- Backend Endpoint đề xuất: GET /api/user/bookings
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
-- B7. API: LẤY CHI TIẾT ĐẦY ĐỦ 1 ĐƠN ĐẶT TOUR (TOUR + HÀNH KHÁCH + THANH TOÁN + REVIEW)
-- Backend Endpoint đề xuất: GET /api/bookings/:id
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetBookingDetail', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetBookingDetail;
GO
CREATE PROCEDURE dbo.sp_api_GetBookingDetail
    @MaDatTour INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- 1. Thông tin tổng quan đơn đặt tour
        SELECT 
            dt.MaDatTour,
            dt.NgayDat,
            dt.SoLuongKhach,
            dt.TongTien,
            dt.TrangThaiDat,
            dt.TrangThaiThanhToan,
            nd.MaNguoiDung,
            nd.HoTen AS TenKhachHang,
            nd.Email,
            nd.SoDienThoai,
            t.MaTour,
            t.TenTour,
            t.HinhAnhDaiDien,
            c.MaChuyen,
            c.NgayKhoiHanh,
            c.NgayKetThuc,
            c.GiaThucTe
        FROM dbo.DATTOUR dt
        JOIN dbo.NGUOIDUNG nd ON dt.MaKhachHang = nd.MaNguoiDung
        JOIN dbo.CHUYENKHOIHANH c ON dt.MaChuyen = c.MaChuyen
        JOIN dbo.TOUR t ON c.MaTour = t.MaTour
        WHERE dt.MaDatTour = @MaDatTour;

        -- 2. Danh sách hành khách trong đoàn
        SELECT MaHanhKhach, HoTen, NgaySinh, GioiTinh, SoDienThoai
        FROM dbo.CHITIET_HANHKHACH
        WHERE MaDatTour = @MaDatTour;

        -- 3. Lịch sử thanh toán
        SELECT MaThanhToan, PhuongThuc, SoTien, NgayThanhToan, MaGiaoDich, TrangThai
        FROM dbo.THANHTOAN
        WHERE MaDatTour = @MaDatTour;

        -- 4. Thông tin đánh giá (nếu có)
        SELECT MaDanhGia, SoSao, NoiDung, HinhAnh, NgayDanhGia, PhanHoiAdmin
        FROM dbo.DANHGIA
        WHERE MaDatTour = @MaDatTour;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- B8. API: GỬI ĐÁNH GIÁ CHẤT LƯỢNG TOUR (CHỈ CHO PHÉP ĐƠN 'ĐÃ HOÀN THÀNH')
-- Backend Endpoint đề xuất: POST /api/bookings/:id/review
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
        -- Kiểm tra đơn đã hoàn thành chưa
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND TrangThaiDat = N'Đã hoàn thành')
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Quý khách chỉ có thể đánh giá cho chuyến đi đã hoàn thành.' AS Message;
            RETURN;
        END;

        -- Kiểm tra đã đánh giá trước đó chưa (UNIQUE)
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
-- B9. API: KHÁCH HÀNG YÊU CẦU HỦY ĐƠN ĐẶT TOUR (TỰ ĐỘNG HOÀN CHỖ QUA TRIGGER)
-- Backend Endpoint đề xuất: POST /api/bookings/:id/cancel
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
        -- Kiểm tra quyền sở hữu đơn đặt tour
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND MaKhachHang = @MaKhachHang)
        BEGIN
            SELECT 0 AS Success, 403 AS StatusCode, N'Bạn không có quyền thao tác trên đơn đặt này.' AS Message;
            RETURN;
        END;

        -- Kiểm tra nếu đơn đã hoàn thành hoặc đã bị hủy
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

        -- Cập nhật sang 'Đã hủy' -> Trigger TRG_DATTOUR_HandleCancellation tự động hoàn trả số chỗ!
        UPDATE dbo.DATTOUR
        SET TrangThaiDat = N'Đã hủy'
        WHERE MaDatTour = @MaDatTour;

        -- Ghi log
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (@MaKhachHang, N'KHACH_HUY_TOUR', CONCAT(N'Trạng thái cũ: ', @TrangThaiHienTai), @LyDoHuy, GETDATE());

        SELECT 1 AS Success, 200 AS StatusCode, N'Hủy đơn đặt tour thành công, chỗ trống đã được giải phóng.' AS Message;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO


-- ##########################################################################################
-- PHẦN C: NHÓM API DÀNH CHO QUẢN TRỊ VIÊN & ĐIỀU HÀNH (ADMIN / STAFF APIs)
-- ##########################################################################################

-- ==========================================================================================
-- C1. API ADMIN: THÊM MỚI TOUR DU LỊCH TRỌN GÓI
-- Backend Endpoint đề xuất: POST /api/admin/tours
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_CreateTour', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_CreateTour;
GO
CREATE PROCEDURE dbo.sp_api_Admin_CreateTour
    @MaDanhMuc         INT,
    @TenTour           NVARCHAR(200),
    @MoTaChiTiet       NVARCHAR(MAX) = NULL,
    @LichTrinhTongQuan NVARCHAR(500) = NULL,
    @GiaKhuyenNghi     DECIMAL(18,2),
    @HinhAnhDaiDien    VARCHAR(255)  = NULL,
    @MaAdmin           INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.DANHMUC WHERE MaDanhMuc = @MaDanhMuc)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Danh mục không tồn tại.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.TOUR (MaDanhMuc, TenTour, MoTaChiTiet, LichTrinhTongQuan, GiaKhuyenNghi, HinhAnhDaiDien, TrangThai)
        VALUES (@MaDanhMuc, @TenTour, @MoTaChiTiet, @LichTrinhTongQuan, @GiaKhuyenNghi, @HinhAnhDaiDien, 1);

        DECLARE @MaTourMoi INT = SCOPE_IDENTITY();

        -- Ghi log
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuMoi, ThoiGian)
        VALUES (@MaAdmin, N'ADMIN_THEM_TOUR', CONCAT(N'Tạo Tour mới #', @MaTourMoi, N': ', @TenTour), GETDATE());

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Thêm tour du lịch mới thành công!' AS Message,
            @MaTourMoi AS MaTour;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- C2. API ADMIN: MỞ BÁN CHUYẾN KHỞI HÀNH MỚI CHO TOUR
-- Backend Endpoint đề xuất: POST /api/admin/departures
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_CreateDeparture', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_CreateDeparture;
GO
CREATE PROCEDURE dbo.sp_api_Admin_CreateDeparture
    @MaTour        INT,
    @NgayKhoiHanh  DATETIME,
    @NgayKetThuc   DATETIME,
    @GiaThucTe     DECIMAL(18,2),
    @SoChoToiDa    INT,
    @MaAdmin       INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.TOUR WHERE MaTour = @MaTour)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Tour không tồn tại.' AS Message;
            RETURN;
        END;

        IF @NgayKetThuc < @NgayKhoiHanh
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Ngày kết thúc phải lớn hơn hoặc bằng ngày khởi hành.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.CHUYENKHOIHANH (MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen)
        VALUES (@MaTour, @NgayKhoiHanh, @NgayKetThuc, @GiaThucTe, @SoChoToiDa, 0, N'Mở bán');

        DECLARE @MaChuyenMoi INT = SCOPE_IDENTITY();

        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuMoi, ThoiGian)
        VALUES (@MaAdmin, N'ADMIN_MO_CHUYEN_DI', CONCAT(N'Mở chuyến #', @MaChuyenMoi, N' cho Tour #', @MaTour), GETDATE());

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Mở bán chuyến khởi hành thành công!' AS Message,
            @MaChuyenMoi AS MaChuyen;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- C3. API ADMIN: XÁC NHẬN THANH TOÁN & DUYỆT ĐƠN TOUR
-- Backend Endpoint đề xuất: POST /api/admin/bookings/:id/confirm-payment
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
-- C4. API ADMIN: CẬP NHẬT TRẠNG THÁI ĐƠN ĐẶT TOUR ('Đã xác nhận', 'Đã hoàn thành', 'Đã hủy')
-- Backend Endpoint đề xuất: PATCH /api/admin/bookings/:id/status
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_UpdateBookingStatus', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_UpdateBookingStatus;
GO
CREATE PROCEDURE dbo.sp_api_Admin_UpdateBookingStatus
    @MaDatTour       INT,
    @TrangThaiMoi    NVARCHAR(50),
    @MaAdmin         INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Đơn đặt tour không tồn tại.' AS Message;
            RETURN;
        END;

        DECLARE @TrangThaiCu NVARCHAR(50);
        SELECT @TrangThaiCu = TrangThaiDat FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour;

        -- Cập nhật trạng thái
        UPDATE dbo.DATTOUR
        SET TrangThaiDat = @TrangThaiMoi
        WHERE MaDatTour = @MaDatTour;

        -- Ghi log
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (@MaAdmin, N'ADMIN_DOI_TRANG_THAI_DON', @TrangThaiCu, CONCAT(N'Mã đơn #', @MaDatTour, N' -> ', @TrangThaiMoi), GETDATE());

        SELECT 1 AS Success, 200 AS StatusCode, N'Cập nhật trạng thái đơn đặt tour thành công!' AS Message;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- C5. API ADMIN: LẤY SỐ LIỆU TỔNG QUAN DASHBOARD KPI (THỐNG KÊ NHANH)
-- Backend Endpoint đề xuất: GET /api/admin/dashboard-kpi
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_GetDashboardKPI', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_GetDashboardKPI;
GO
CREATE PROCEDURE dbo.sp_api_Admin_GetDashboardKPI
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT 
            -- Tổng doanh thu đã thu thực tế
            (SELECT ISNULL(SUM(SoTien), 0) FROM dbo.THANHTOAN WHERE TrangThai = N'Thành công') AS TongDoanhThu,
            
            -- Tổng số đơn đặt tour
            (SELECT COUNT(*) FROM dbo.DATTOUR) AS TongDonDat,
            
            -- Số đơn đang chờ xử lý
            (SELECT COUNT(*) FROM dbo.DATTOUR WHERE TrangThaiDat = N'Chờ xác nhận') AS DonChoXacNhan,
            
            -- Tổng số khách hàng
            (SELECT COUNT(*) FROM dbo.NGUOIDUNG WHERE TrangThai = 1) AS TongKhachHang,
            
            -- Tổng số tour đang mở bán
            (SELECT COUNT(*) FROM dbo.TOUR WHERE TrangThai = 1) AS TongTourDangMoBan,
            
            -- Doanh thu tháng hiện tại
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

PRINT N'==> Đã khởi tạo hoàn tất toàn bộ Bộ Stored Procedures dành riêng cho Web Backend API!';
GO
