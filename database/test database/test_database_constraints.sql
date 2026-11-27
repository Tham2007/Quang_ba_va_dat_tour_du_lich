-- ==========================================================================================
-- TEST DATABASE SQL SERVER (16 BẢNG 3NF - CONSTRAINTS & TRIGGERS)
-- Thư mục: database/test database/test_database_constraints.sql
-- Phạm vi: Kiểm thử ràng buộc UNIQUE, CHECK, FOREIGN KEY và TRIGGER nghiệp vụ trên SQL Server.
-- Nguyên tắc an toàn: Mọi test case đều chạy trong Transaction và ROLLBACK sạch sẽ.
-- ==========================================================================================

-- USE TourDuLichDB; -- Chọn đúng Database (TourDuLichDB hoặc db_ad0b71_dattour) trước khi chạy nếu cần
SET NOCOUNT ON;
GO

PRINT N'======================================================================';
PRINT N'  [TEST DATABASE] BẮT ĐẦU KIỂM THỬ RÀNG BUỘC 16 BẢNG & TRIGGER';
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

-- ------------------------------------------------------------------------------------------
-- TC-DB-05: Test Ràng buộc CHECK VaiTro trên dbo.NGUOIDUNG (CK_NGUOIDUNG_VaiTro)
-- Kỳ vọng: Bị từ chối bởi lỗi 547 (CHECK Constraint Violation) khi chèn vai trò không hợp lệ
-- ------------------------------------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY
    INSERT INTO dbo.NGUOIDUNG (HoTen, Email, SoDienThoai, MatKhau, VaiTro)
    VALUES (N'Người dùng sai vai trò', 'invalid_role_test@deltatravel.vn', '0909999888', 'scrypt$hash', N'SuperHacker');

    ROLLBACK TRANSACTION;
    RAISERROR(N'[FAIL] TC-DB-05: Không chặn được VaiTro không hợp lệ!', 16, 1);
END TRY
BEGIN CATCH
    DECLARE @ErrRole INT = ERROR_NUMBER();
    DECLARE @MsgRole NVARCHAR(4000) = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    IF @ErrRole = 547
        PRINT CONCAT(N'[PASS] TC-DB-05: Đã chặn VaiTro không hợp lệ bởi CK_NGUOIDUNG_VaiTro (Error 547) -> ', @MsgRole);
    ELSE
        PRINT CONCAT(N'[FAIL] TC-DB-05: Lỗi không đúng kỳ vọng (', @ErrRole, N'): ', @MsgRole);
END CATCH;
GO

-- ------------------------------------------------------------------------------------------
-- TC-DB-06: Test Ràng buộc CHECK LoaiGiaoDich trên dbo.THANHTOAN (CK_THANHTOAN_LoaiGiaoDich)
-- Kỳ vọng: Bị từ chối bởi lỗi 547 khi chèn Loại giao dịch không nằm trong danh mục quy định
-- ------------------------------------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @MaDat_TT INT = (SELECT TOP 1 MaDatTour FROM dbo.DATTOUR ORDER BY MaDatTour);
    INSERT INTO dbo.THANHTOAN (MaDatTour, LoaiGiaoDich, PhuongThuc, SoTien, MaGiaoDich)
    VALUES (@MaDat_TT, N'Rút tiền cá nhân', N'Chuyển khoản', 5000000, 'TX_INVALID_999');

    ROLLBACK TRANSACTION;
    RAISERROR(N'[FAIL] TC-DB-06: Không chặn được LoaiGiaoDich không hợp lệ!', 16, 1);
END TRY
BEGIN CATCH
    DECLARE @ErrPay INT = ERROR_NUMBER();
    DECLARE @MsgPay NVARCHAR(4000) = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    IF @ErrPay = 547
        PRINT CONCAT(N'[PASS] TC-DB-06: Đã chặn LoaiGiaoDich không hợp lệ bởi CK_THANHTOAN_LoaiGiaoDich (Error 547) -> ', @MsgPay);
    ELSE
        PRINT CONCAT(N'[FAIL] TC-DB-06: Lỗi không đúng kỳ vọng (', @ErrPay, N'): ', @MsgPay);
END CATCH;
GO

-- ------------------------------------------------------------------------------------------
-- TC-DB-07: Test Ràng buộc CHECK SoChoGiuCho (CK_CHUYEN_SoChoHopLe: SoChoDaDat + SoChoGiuCho <= SoChoToiDa)
-- Kỳ vọng: Bị từ chối bởi lỗi 547 khi tổng chỗ đã đặt + giữ chỗ vượt quá số chỗ tối đa
-- ------------------------------------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @MaChuyen_Hold INT = (SELECT TOP 1 MaChuyen FROM dbo.CHUYENKHOIHANH ORDER BY MaChuyen);
    UPDATE dbo.CHUYENKHOIHANH
    SET SoChoGiuCho = SoChoToiDa + 1
    WHERE MaChuyen = @MaChuyen_Hold;

    ROLLBACK TRANSACTION;
    RAISERROR(N'[FAIL] TC-DB-07: Không chặn được SoChoDaDat + SoChoGiuCho > SoChoToiDa!', 16, 1);
END TRY
BEGIN CATCH
    DECLARE @ErrHold INT = ERROR_NUMBER();
    DECLARE @MsgHold NVARCHAR(4000) = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    IF @ErrHold = 547
        PRINT CONCAT(N'[PASS] TC-DB-07: Đã chặn giữ chỗ vượt số chỗ tối đa bởi CK_CHUYEN_SoChoHopLe (Error 547) -> ', @MsgHold);
    ELSE
        PRINT CONCAT(N'[FAIL] TC-DB-07: Lỗi không đúng kỳ vọng (', @ErrHold, N'): ', @MsgHold);
END CATCH;
GO

