-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 02_stored_procedures_booking.sql
-- Mục đích: Stored Procedures thực hiện quy trình Đặt Tour an toàn (ACID Transaction, Concurrency Lock)
-- ==========================================================================================

USE TourDuLichDB;
GO

-- ==========================================================================================
-- 1. PROCEDURE: ĐẶT TOUR TRỰC TUYẾN AN TOÀN VỚI KHÓA ĐỒNG THỜI (UPDLOCK)
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_TaoDonDatTour', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_TaoDonDatTour;
GO

CREATE PROCEDURE dbo.sp_TaoDonDatTour
    @MaKhachHang   INT,
    @MaChuyen      INT,
    @SoLuongKhach  INT,
    @HoTenTruongDoan NVARCHAR(100),
    @SoDienThoai   VARCHAR(15),
    @MaDatTourMoi  INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Kiểm tra tham số đầu vào
    IF @SoLuongKhach <= 0
    BEGIN
        RAISERROR(N'Số lượng khách đặt tour phải lớn hơn 0.', 16, 1);
        RETURN -1;
    END;

    -- Khởi tạo Transaction xử lý toàn vẹn
    BEGIN TRANSACTION;
    BEGIN TRY
        -- 1. Kiểm tra tài khoản khách hàng
        IF NOT EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE MaNguoiDung = @MaKhachHang AND TrangThai = 1)
        BEGIN
            RAISERROR(N'Tài khoản khách hàng không tồn tại hoặc đã bị khóa.', 16, 1);
        END;

        -- 2. Kiểm tra chuyến khởi hành và thực hiện KHÓA ĐỘC QUYỀN (UPDLOCK, HOLDLOCK)
        -- Điều này ngăn chặn hiện tượng 2 người cùng đọc được còn 1 chỗ và cùng bấm đặt
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
            RAISERROR(N'Chuyến khởi hành không tồn tại trong hệ thống.', 16, 1);
        END;

        IF @TrangThaiChuyen <> N'Mở bán'
        BEGIN
            RAISERROR(N'Chuyến khởi hành này hiện đã đóng hoặc không còn mở bán.', 16, 1);
        END;

        -- Kiểm tra chỗ còn trống
        IF (@SoChoToiDa - @SoChoDaDat) < @SoLuongKhach
        BEGIN
            RAISERROR(N'Chuyến khởi hành không đủ số chỗ trống (Còn lại: %d chỗ, Yêu cầu: %d chỗ).', 16, 1, 
                      (@SoChoToiDa - @SoChoDaDat), @SoLuongKhach);
        END;

        -- 3. Tính toán tổng tiền
        DECLARE @TongTien DECIMAL(18,2) = @SoLuongKhach * @GiaThucTe;

        -- 4. Thêm đơn đặt tour mới (Trigger TRG_DATTOUR_CheckAndLockSeats sẽ tự động tăng số chỗ)
        INSERT INTO dbo.DATTOUR (
            MaKhachHang, 
            MaChuyen, 
            NgayDat, 
            SoLuongKhach, 
            TongTien, 
            TrangThaiDat, 
            TrangThaiThanhToan
        )
        VALUES (
            @MaKhachHang, 
            @MaChuyen, 
            GETDATE(), 
            @SoLuongKhach, 
            @TongTien, 
            N'Chờ xác nhận', 
            N'Chưa thanh toán'
        );

        SET @MaDatTourMoi = SCOPE_IDENTITY();

        -- 5. Tự động thêm thông tin Người đại diện / Trưởng đoàn vào danh sách hành khách
        INSERT INTO dbo.CHITIET_HANHKHACH (MaDatTour, HoTen, SoDienThoai)
        VALUES (@MaDatTourMoi, @HoTenTruongDoan, @SoDienThoai);

        -- Xác nhận giao dịch thành công
        COMMIT TRANSACTION;

        SELECT 
            @MaDatTourMoi AS MaDatTour,
            N'Đặt tour thành công, đã giữ chỗ tạm thời.' AS ThongBao,
            @TongTien AS TongTienThanhToan;
            
        RETURN 0;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
        RETURN -1;
    END CATCH;
END;
GO

PRINT N'==> Đã tạo Stored Procedure sp_TaoDonDatTour thành công.';
GO

-- ==========================================================================================
-- 2. PROCEDURE: XÁC NHẬN THANH TOÁN CHO ĐƠN ĐẶT TOUR
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_XacNhanThanhToanDonTour', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_XacNhanThanhToanDonTour;
GO

CREATE PROCEDURE dbo.sp_XacNhanThanhToanDonTour
    @MaDatTour     INT,
    @PhuongThuc    NVARCHAR(50),
    @SoTien        DECIMAL(18,2),
    @MaGiaoDich    VARCHAR(100),
    @MaAdmin       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Kiểm tra sự tồn tại của đơn đặt tour
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour)
        BEGIN
            RAISERROR(N'Đơn đặt tour không tồn tại.', 16, 1);
        END;

        -- 1. Ghi nhận giao dịch thanh toán
        INSERT INTO dbo.THANHTOAN (MaDatTour, PhuongThuc, SoTien, NgayThanhToan, MaGiaoDich, TrangThai)
        VALUES (@MaDatTour, @PhuongThuc, @SoTien, GETDATE(), @MaGiaoDich, N'Thành công');

        -- 2. Cập nhật trạng thái đơn đặt sang 'Đã xác nhận' và 'Đã thanh toán'
        UPDATE dbo.DATTOUR
        SET TrangThaiThanhToan = N'Đã thanh toán',
            TrangThaiDat = CASE WHEN TrangThaiDat = N'Chờ xác nhận' THEN N'Đã xác nhận' ELSE TrangThaiDat END
        WHERE MaDatTour = @MaDatTour;

        -- 3. Ghi vết Audit Log
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (
            @MaAdmin,
            N'XAC_NHAN_THANH_TOAN',
            CONCAT(N'Mã đơn: ', @MaDatTour),
            CONCAT(N'Đã thanh toán số tiền: ', @SoTien, N' qua phương thức: ', @PhuongThuc, N', Mã GD: ', @MaGiaoDich),
            GETDATE()
        );

        COMMIT TRANSACTION;
        PRINT N'Xác nhận thanh toán cho đơn đặt tour thành công!';
        RETURN 0;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

PRINT N'==> Đã tạo Stored Procedure sp_XacNhanThanhToanDonTour thành công.';
GO

-- ==========================================================================================
-- 3. PROCEDURE: HỦY ĐƠN ĐẶT TOUR
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_HuyDonDatTour', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_HuyDonDatTour;
GO

CREATE PROCEDURE dbo.sp_HuyDonDatTour
    @MaDatTour      INT,
    @MaNguoiYeuCau  INT,
    @LyDoHuy        NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour)
    BEGIN
        RAISERROR(N'Đơn đặt tour không tồn tại.', 16, 1);
        RETURN -1;
    END;

    -- Kiểm tra xem đơn đã bị hủy trước đó chưa
    IF EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND TrangThaiDat = N'Đã hủy')
    BEGIN
        RAISERROR(N'Đơn đặt tour này đã bị hủy trước đó.', 16, 1);
        RETURN -1;
    END;

    -- Cập nhật trạng thái đơn -> Trigger TRG_DATTOUR_HandleCancellation sẽ tự động hoàn trả số chỗ!
    UPDATE dbo.DATTOUR
    SET TrangThaiDat = N'Đã hủy'
    WHERE MaDatTour = @MaDatTour;

    -- Ghi chú lý do vào nhật ký
    INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
    VALUES (
        @MaNguoiYeuCau,
        N'LY_DO_HUY_TOUR',
        CONCAT(N'Mã Đơn: ', @MaDatTour),
        CONCAT(N'Lý do hủy: ', @LyDoHuy),
        GETDATE()
    );

    PRINT N'Đã hủy đơn đặt tour thành công và hoàn trả lại số chỗ cho chuyến đi.';
    RETURN 0;
END;
GO

PRINT N'==> Đã tạo Stored Procedure sp_HuyDonDatTour thành công.';
GO
