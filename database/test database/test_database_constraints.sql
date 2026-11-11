-- ==========================================================================================
-- TEST DATABASE SQL SERVER (12 BẢNG 3NF - CONSTRAINTS & TRIGGERS)
-- Thư mục: database/test database/test_database_constraints.sql
-- Phạm vi: Kiểm thử ràng buộc UNIQUE, CHECK, FOREIGN KEY và TRIGGER nghiệp vụ trên SQL Server.
-- Nguyên tắc an toàn: Mọi test case đều chạy trong Transaction và ROLLBACK sạch sẽ.
-- ==========================================================================================

-- USE TourDuLichDB; -- Chọn đúng Database (TourDuLichDB hoặc db_ad0b71_dattour) trước khi chạy nếu cần
SET NOCOUNT ON;
GO

PRINT N'======================================================================';
PRINT N'  [TEST DATABASE] BẮT ĐẦU KIỂM THỬ RÀNG BUỘC 12 BẢNG & TRIGGER';
PRINT N'======================================================================';
GO

-- ------------------------------------------------------------------------------------------
-- TC-DB-01: Test Ràng buộc UNIQUE Email (UQ_NGUOIDUNG_Email) trên bảng NGUOIDUNG
-- Kỳ vọng: Bị từ chối bởi lỗi 2627 (Unique Key Violation)
-- ------------------------------------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @EmailTrung VARCHAR(100) = (SELECT TOP 1 Email FROM dbo.NGUOIDUNG ORDER BY MaNguoiDung);

    INSERT INTO dbo.NGUOIDUNG (HoTen, Email, SoDienThoai, MatKhau)
    VALUES (N'Tài khoản Trùng Email', @EmailTrung, '0901234567', 'scrypt$salt$hashdemo');

    ROLLBACK TRANSACTION;
    RAISERROR(N'[FAIL] TC-DB-01: Không chặn được Email trùng lặp!', 16, 1);
END TRY
BEGIN CATCH
    DECLARE @ErrNum1 INT = ERROR_NUMBER();
    DECLARE @ErrMsg1 NVARCHAR(4000) = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    IF @ErrNum1 IN (2627, 2601)
        PRINT CONCAT(N'[PASS] TC-DB-01: Đã chặn trùng Email bởi UQ_NGUOIDUNG_Email (Error ', @ErrNum1, N') -> ', @ErrMsg1);
    ELSE
        PRINT CONCAT(N'[FAIL] TC-DB-01: Lỗi không đúng kỳ vọng (', @ErrNum1, N'): ', @ErrMsg1);
END CATCH;
GO

-- ------------------------------------------------------------------------------------------
-- TC-DB-02: Test Ràng buộc CHECK (CK_DANHGIA_SoSao: SoSao BETWEEN 1 AND 5)
-- Kỳ vọng: Bị từ chối bởi lỗi 547 (CHECK Constraint Violation)
-- ------------------------------------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @MaDat_CK INT = (
        SELECT TOP 1 d.MaDatTour
        FROM dbo.DATTOUR d
        LEFT JOIN dbo.DANHGIA g ON d.MaDatTour = g.MaDatTour
        WHERE g.MaDanhGia IS NULL
        ORDER BY d.MaDatTour
    );

    INSERT INTO dbo.DANHGIA (MaDatTour, SoSao, NoiDung)
    VALUES (@MaDat_CK, 6, N'Test vi phạm ràng buộc 6 sao');

    ROLLBACK TRANSACTION;
    RAISERROR(N'[FAIL] TC-DB-02: Không chặn được SoSao = 6!', 16, 1);
END TRY
BEGIN CATCH
    DECLARE @ErrNum2 INT = ERROR_NUMBER();
    DECLARE @ErrMsg2 NVARCHAR(4000) = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    IF @ErrNum2 = 547
        PRINT CONCAT(N'[PASS] TC-DB-02: Đã chặn SoSao = 6 bởi CK_DANHGIA_SoSao (Error 547) -> ', @ErrMsg2);
    ELSE
        PRINT CONCAT(N'[FAIL] TC-DB-02: Lỗi không đúng kỳ vọng (', @ErrNum2, N'): ', @ErrMsg2);
END CATCH;
GO

-- ------------------------------------------------------------------------------------------
-- TC-DB-03: Test Trigger TRG_DANHGIA_CheckCompletedTour
-- Kỳ vọng: Chặn đánh giá đơn chưa ở trạng thái 'Đã hoàn thành' (Msg 50000 + Msg 3609)
-- ------------------------------------------------------------------------------------------
PRINT N'--> Đang chạy TC-DB-03 (Kỳ vọng Trigger chặn đánh giá đơn chưa hoàn thành)...';
BEGIN TRANSACTION;
    DECLARE @MaDat_Pending INT = (
        SELECT TOP 1 d.MaDatTour
        FROM dbo.DATTOUR d
        LEFT JOIN dbo.DANHGIA g ON d.MaDatTour = g.MaDatTour
        WHERE d.TrangThaiDat <> N'Đã hoàn thành' AND g.MaDanhGia IS NULL
        ORDER BY d.MaDatTour DESC
    );

    INSERT INTO dbo.DANHGIA (MaDatTour, SoSao, NoiDung)
    VALUES (@MaDat_Pending, 5, N'Khách cố đánh giá khi tour chưa hoàn thành');

    IF @@TRANCOUNT > 0
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'[FAIL] TC-DB-03: Trigger không chặn đánh giá đơn chưa hoàn thành!', 16, 1);
    END
GO

-- ------------------------------------------------------------------------------------------
-- TC-DB-04: Test Khóa ngoại (FK_DATTOUR_CHUYENKHOIHANH) & CHECK số chỗ (CK_CHUYEN_SoChoHopLe)
-- Kỳ vọng: Bị từ chối bởi lỗi 547 (Foreign Key / Check Constraint Violation)
-- ------------------------------------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @MaKH_FK INT = (SELECT TOP 1 MaNguoiDung FROM dbo.NGUOIDUNG ORDER BY MaNguoiDung);
    INSERT INTO dbo.DATTOUR (MaKhachHang, MaChuyen, SoLuongKhach, TongTien)
    VALUES (@MaKH_FK, -999999, 1, 1000000);

    ROLLBACK TRANSACTION;
    RAISERROR(N'[FAIL] TC-DB-04A: Không chặn được MaChuyen không tồn tại!', 16, 1);
END TRY
BEGIN CATCH
    DECLARE @ErrFK INT = ERROR_NUMBER();
    DECLARE @MsgFK NVARCHAR(4000) = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    IF @ErrFK = 547
        PRINT CONCAT(N'[PASS] TC-DB-04A: Đã chặn MaChuyen không tồn tại bởi FK_DATTOUR_CHUYENKHOIHANH (Error 547) -> ', @MsgFK);
    ELSE
        PRINT CONCAT(N'[FAIL] TC-DB-04A: Lỗi không đúng kỳ vọng (', @ErrFK, N'): ', @MsgFK);
END CATCH;
GO

BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @MaChuyen_CK INT = (SELECT TOP 1 MaChuyen FROM dbo.CHUYENKHOIHANH ORDER BY MaChuyen);
    UPDATE dbo.CHUYENKHOIHANH
    SET SoChoDaDat = SoChoToiDa + 5
    WHERE MaChuyen = @MaChuyen_CK;

    ROLLBACK TRANSACTION;
    RAISERROR(N'[FAIL] TC-DB-04B: Không chặn được SoChoDaDat > SoChoToiDa!', 16, 1);
END TRY
BEGIN CATCH
    DECLARE @ErrCK INT = ERROR_NUMBER();
    DECLARE @MsgCK NVARCHAR(4000) = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    IF @ErrCK = 547
        PRINT CONCAT(N'[PASS] TC-DB-04B: Đã chặn SoChoDaDat > SoChoToiDa bởi CK_CHUYEN_SoChoHopLe (Error 547) -> ', @MsgCK);
    ELSE
        PRINT CONCAT(N'[FAIL] TC-DB-04B: Lỗi không đúng kỳ vọng (', @ErrCK, N'): ', @MsgCK);
END CATCH;
GO

