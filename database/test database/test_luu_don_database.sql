-- ==========================================================================================
-- TEST LƯU ĐƠN ĐẶT TOUR CHO DATABASE SQL SERVER (SSMS)
-- Thư mục: database/test database/test_luu_don_database.sql
-- Phạm vi: Kiểm thử sp_api_CreateBooking (UPDLOCK, HOLDLOCK), sp_api_AddPassenger,
--          sp_api_CancelBooking, sp_XacNhanThanhToanDonTour, Trigger giữ/hoàn chỗ & AUDITLOG.
-- Nguyên tắc an toàn: Mọi test case đều chạy trong Transaction và ROLLBACK sạch sẽ.
-- ==========================================================================================

-- USE TourDuLichDB; -- Chọn đúng Database (TourDuLichDB hoặc db_ad0b71_dattour) trước khi chạy nếu cần
SET NOCOUNT ON;
GO

PRINT N'======================================================================';
PRINT N'  [TEST LƯU ĐƠN DATABASE] BẮT ĐẦU KIỂM THỬ STORED PROCEDURES & TRIGGER';
PRINT N'======================================================================';
GO

-- ------------------------------------------------------------------------------------------
-- TC-LUUDON-01: Test Lưu đơn thành công qua sp_api_CreateBooking + sp_api_AddPassenger
-- Kỳ vọng: Tạo bản ghi DATTOUR & CHITIET_HANHKHACH, Trigger tăng SoChoDaDat & ghi AUDITLOG
-- ------------------------------------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @MaKH INT = (SELECT TOP 1 MaNguoiDung FROM dbo.NGUOIDUNG WHERE TrangThai = 1 ORDER BY MaNguoiDung);
    DECLARE @MaChuyen INT = (
        SELECT TOP 1 MaChuyen
        FROM dbo.CHUYENKHOIHANH
        WHERE TrangThaiChuyen = N'Mở bán' AND (SoChoToiDa - SoChoDaDat) >= 2
        ORDER BY MaChuyen
    );

    IF @MaKH IS NULL OR @MaChuyen IS NULL
        RAISERROR(N'[FAIL] TC-LUUDON-01: Không có chuyến mở bán đủ >= 2 chỗ để test.', 16, 1);

    DECLARE @TruocSoCho INT = (SELECT SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @MaChuyen);
    DECLARE @AuditTruoc INT = (SELECT COUNT(*) FROM dbo.AUDITLOG);

    -- Gọi Stored Procedure lưu đơn trực tiếp
    DECLARE @ResSP TABLE (
        Success INT,
        StatusCode INT,
        Message NVARCHAR(500),
        MaDatTour INT,
        TongTien DECIMAL(18,2),
        SoLuongKhach INT
    );
    INSERT INTO @ResSP
    EXEC dbo.sp_api_CreateBooking
        @MaKhachHang = @MaKH,
        @MaChuyen = @MaChuyen,
        @SoLuongKhach = 2,
        @HoTenNguoiDat = N'Nguyễn Văn An Test',
        @SoDienThoai = '0912345678';

    DECLARE @MaDatMoi INT = (SELECT TOP 1 MaDatTour FROM @ResSP);
    DECLARE @StatusSP INT = (SELECT TOP 1 StatusCode FROM @ResSP);

    -- Thêm hành khách thứ 2 đi cùng qua sp_api_AddPassenger
    DECLARE @ResHK TABLE (
        Success INT,
        StatusCode INT,
        Message NVARCHAR(500),
        MaHanhKhach INT
    );
    INSERT INTO @ResHK
    EXEC dbo.sp_api_AddPassenger
        @MaDatTour = @MaDatMoi,
        @HoTen = N'Trần Thị Bình Test',
        @NgaySinh = '1998-05-15',
        @GioiTinh = N'Nữ',
        @SoDienThoai = '0987654321';

    DECLARE @SauSoCho INT = (SELECT SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @MaChuyen);
    DECLARE @SoHanhKhach INT = (SELECT COUNT(*) FROM dbo.CHITIET_HANHKHACH WHERE MaDatTour = @MaDatMoi);
    DECLARE @AuditSau INT = (SELECT COUNT(*) FROM dbo.AUDITLOG);

    IF (@StatusSP = 201 AND @SauSoCho = @TruocSoCho + 2 AND @SoHanhKhach = 2 AND @AuditSau > @AuditTruoc)
        PRINT CONCAT(N'[PASS] TC-LUUDON-01: Lưu đơn #', @MaDatMoi, N' (HTTP 201), SoChoDaDat ', @TruocSoCho, N'->', @SauSoCho, N', Hành khách=', @SoHanhKhach, N', AUDITLOG tăng ', @AuditTruoc, N'->', @AuditSau);
    ELSE
        RAISERROR(N'[FAIL] TC-LUUDON-01: Dữ liệu lưu đơn hoặc Trigger giữ chỗ không khớp kỳ vọng.', 16, 1);

    ROLLBACK TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT CONCAT(N'[FAIL] TC-LUUDON-01: ', ERROR_MESSAGE());
END CATCH;
GO

-- ------------------------------------------------------------------------------------------
-- TC-LUUDON-02A: Test sp_api_CreateBooking (UPDLOCK, HOLDLOCK) từ chối khi không đủ chỗ
-- Lưu ý: Chạy trực tiếp không mở outer TRAN để SP tự rollback và trả StatusCode = 400
-- ------------------------------------------------------------------------------------------
DECLARE @MaKH_OB INT = (SELECT TOP 1 MaNguoiDung FROM dbo.NGUOIDUNG WHERE TrangThai = 1 ORDER BY MaNguoiDung);
DECLARE @MaChuyen_OB INT = (
    SELECT TOP 1 MaChuyen FROM dbo.CHUYENKHOIHANH WHERE TrangThaiChuyen = N'Mở bán' ORDER BY MaChuyen
);
DECLARE @ConLai INT = (SELECT SoChoToiDa - SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @MaChuyen_OB);
DECLARE @DatVuot INT = @ConLai + 5;

EXEC dbo.sp_api_CreateBooking
    @MaKhachHang = @MaKH_OB,
    @MaChuyen = @MaChuyen_OB,
    @SoLuongKhach = @DatVuot,
    @HoTenNguoiDat = N'Khách Overbooking SP',
    @SoDienThoai = '0909998887';
GO

-- ------------------------------------------------------------------------------------------
-- TC-LUUDON-02B: Test Trigger TRG_DATTOUR_CheckAndLockSeats chống Overbooking khi INSERT trực tiếp
-- Kỳ vọng: Trigger phát RAISERROR (Msg 50000) và ROLLBACK TRANSACTION (Msg 3609)
-- ------------------------------------------------------------------------------------------
PRINT N'--> Đang chạy TC-LUUDON-02B (Kỳ vọng Trigger chặn Overbooking & ROLLBACK)...';
BEGIN TRANSACTION;
    DECLARE @MaKH_TR INT = (SELECT TOP 1 MaNguoiDung FROM dbo.NGUOIDUNG WHERE TrangThai = 1 ORDER BY MaNguoiDung);
    DECLARE @MaChuyen_TR INT = (SELECT TOP 1 MaChuyen FROM dbo.CHUYENKHOIHANH WHERE TrangThaiChuyen = N'Mở bán' ORDER BY MaChuyen);
    DECLARE @VuotCho INT = (SELECT (SoChoToiDa - SoChoDaDat) + 10 FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @MaChuyen_TR);

    INSERT INTO dbo.DATTOUR (
        MaKhachHang, MaChuyen, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan
    )
    VALUES (@MaKH_TR, @MaChuyen_TR, @VuotCho, 99000000, N'Chờ xác nhận', N'Chưa thanh toán');

    IF @@TRANCOUNT > 0
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'[FAIL] TC-LUUDON-02B: Trigger không chặn thao tác đặt vượt chỗ!', 16, 1);
    END
GO

-- ------------------------------------------------------------------------------------------
-- TC-LUUDON-03: Test Hủy đơn qua sp_api_CancelBooking + Trigger hoàn trả chỗ trống
-- Kỳ vọng: TrangThaiDat='Đã hủy', SoChoDaDat giảm đúng số khách đã đặt & ghi AUDITLOG
-- ------------------------------------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @MaKH_C INT = (SELECT TOP 1 MaNguoiDung FROM dbo.NGUOIDUNG WHERE TrangThai = 1 ORDER BY MaNguoiDung);
    DECLARE @MaChuyen_C INT = (
        SELECT TOP 1 MaChuyen
        FROM dbo.CHUYENKHOIHANH
        WHERE TrangThaiChuyen = N'Mở bán' AND (SoChoToiDa - SoChoDaDat) >= 2
        ORDER BY MaChuyen
    );
    DECLARE @ChoGoc INT = (SELECT SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @MaChuyen_C);

    DECLARE @ResCreate TABLE (Success INT, StatusCode INT, Message NVARCHAR(500), MaDatTour INT, TongTien DECIMAL(18,2), SoLuongKhach INT);
    INSERT INTO @ResCreate
    EXEC dbo.sp_api_CreateBooking @MaKH_C, @MaChuyen_C, 2, N'Khách Test Hủy', '0911223344';

    DECLARE @MaDatHuy INT = (SELECT TOP 1 MaDatTour FROM @ResCreate);
    DECLARE @ChoSauDat INT = (SELECT SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @MaChuyen_C);

    DECLARE @ResCancel TABLE (Success INT, StatusCode INT, Message NVARCHAR(500));
    INSERT INTO @ResCancel
    EXEC dbo.sp_api_CancelBooking @MaDatHuy, @MaKH_C, N'Kiểm thử tự động hoàn chỗ';

    DECLARE @ChoSauHuy INT = (SELECT SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @MaChuyen_C);
    DECLARE @TrangThaiSau NVARCHAR(50) = (SELECT TrangThaiDat FROM dbo.DATTOUR WHERE MaDatTour = @MaDatHuy);

    IF (@ChoSauDat = @ChoGoc + 2 AND @ChoSauHuy = @ChoGoc AND @TrangThaiSau = N'Đã hủy')
        PRINT CONCAT(N'[PASS] TC-LUUDON-03: Hủy đơn #', @MaDatHuy, N' thành công, SoChoDaDat ', @ChoGoc, N'->', @ChoSauDat, N'->', @ChoSauHuy, N' (hoàn chỗ đúng)');
    ELSE
        RAISERROR(N'[FAIL] TC-LUUDON-03: Số chỗ sau hủy không khớp.', 16, 1);

    ROLLBACK TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT CONCAT(N'[FAIL] TC-LUUDON-03: ', ERROR_MESSAGE());
END CATCH;
GO

-- ------------------------------------------------------------------------------------------
-- TC-LUUDON-04: Test Lưu Thanh toán & Đối soát đơn qua sp_XacNhanThanhToanDonTour
-- Kỳ vọng: Tạo bản ghi THANHTOAN, DATTOUR chuyển 'Đã thanh toán' & 'Đã xác nhận', ghi AUDITLOG
-- ------------------------------------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @MaKH_P INT = (SELECT TOP 1 MaNguoiDung FROM dbo.NGUOIDUNG WHERE TrangThai = 1 ORDER BY MaNguoiDung);
    DECLARE @MaChuyen_P INT = (
        SELECT TOP 1 MaChuyen
        FROM dbo.CHUYENKHOIHANH
        WHERE TrangThaiChuyen = N'Mở bán' AND (SoChoToiDa - SoChoDaDat) >= 1
        ORDER BY MaChuyen
    );

    DECLARE @ResBookP TABLE (Success INT, StatusCode INT, Message NVARCHAR(500), MaDatTour INT, TongTien DECIMAL(18,2), SoLuongKhach INT);
    INSERT INTO @ResBookP
    EXEC dbo.sp_api_CreateBooking @MaKH_P, @MaChuyen_P, 1, N'Khách Test Thanh Toán', '0933445566';

    DECLARE @MaDatPay INT = (SELECT TOP 1 MaDatTour FROM @ResBookP);
    DECLARE @TongTienPay DECIMAL(18,2) = (SELECT TOP 1 TongTien FROM @ResBookP);

    EXEC dbo.sp_XacNhanThanhToanDonTour
        @MaDatTour = @MaDatPay,
        @PhuongThuc = N'Chuyển khoản QR',
        @SoTien = @TongTienPay,
        @MaGiaoDich = 'VQR_TEST_SQL_20261111',
        @MaAdmin = @MaKH_P;

    DECLARE @TTDat NVARCHAR(50) = (SELECT TrangThaiDat FROM dbo.DATTOUR WHERE MaDatTour = @MaDatPay);
    DECLARE @TTPay NVARCHAR(50) = (SELECT TrangThaiThanhToan FROM dbo.DATTOUR WHERE MaDatTour = @MaDatPay);
    DECLARE @PayRows INT = (SELECT COUNT(*) FROM dbo.THANHTOAN WHERE MaDatTour = @MaDatPay AND MaGiaoDich = 'VQR_TEST_SQL_20261111');

    IF (@TTDat = N'Đã xác nhận' AND @TTPay = N'Đã thanh toán' AND @PayRows = 1)
        PRINT CONCAT(N'[PASS] TC-LUUDON-04: Lưu thanh toán đơn #', @MaDatPay, N' thành công (TrangThaiDat=', @TTDat, N', ThanhToan=', @TTPay, N')');
    ELSE
        RAISERROR(N'[FAIL] TC-LUUDON-04: Trạng thái đơn hoặc bản ghi THANHTOAN chưa cập nhật đúng.', 16, 1);

    ROLLBACK TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT CONCAT(N'[FAIL] TC-LUUDON-04: ', ERROR_MESSAGE());
END CATCH;
GO

