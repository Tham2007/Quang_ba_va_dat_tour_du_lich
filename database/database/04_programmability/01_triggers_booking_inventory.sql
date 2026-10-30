-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 01_triggers_booking_inventory.sql
-- Mục đích: Trigger nghiệp vụ cốt lõi - Kiểm soát số chỗ (Overbooking Prevention), 
--          hoàn chỗ khi hủy tour, kiểm soát đánh giá và ghi nhật ký tự động.
-- ==========================================================================================

USE TourDuLichDB;
GO

-- ==========================================================================================
-- 1. TRIGGER: KIỂM SOÁT ĐẶT TOUR & CHỐNG OVERBOOKING (KHÓA CHỖ TỰ ĐỘNG)
-- Nghiệp vụ: Khi có đơn đặt mới, kiểm tra (SoChoToiDa - SoChoDaDat) >= SoLuongKhach.
-- Nếu đủ chỗ: Tự động cộng SoChoDaDat. Nếu hết chỗ: Đổi trạng thái sang 'Hết chỗ'.
-- Nếu không đủ chỗ: Báo lỗi và ROLLBACK TRANSACTION ngay lập tức.
-- ==========================================================================================
IF OBJECT_ID(N'dbo.TRG_DATTOUR_CheckAndLockSeats', N'TR') IS NOT NULL
    DROP TRIGGER dbo.TRG_DATTOUR_CheckAndLockSeats;
GO

CREATE TRIGGER dbo.TRG_DATTOUR_CheckAndLockSeats
ON dbo.DATTOUR
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra nếu thao tác thêm đơn ở trạng thái đã bị hủy ngay từ đầu thì bỏ qua
    IF NOT EXISTS (SELECT 1 FROM inserted WHERE TrangThaiDat <> N'Đã hủy')
        RETURN;

    -- Kiểm tra tình trạng từng chuyến đi trong batch inserted
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.CHUYENKHOIHANH c ON i.MaChuyen = c.MaChuyen
        WHERE (c.SoChoToiDa - c.SoChoDaDat) < i.SoLuongKhach
    )
    BEGIN
        RAISERROR (N'LỖI NGHIỆP VỤ: Số chỗ còn lại của chuyến khởi hành không đủ đáp ứng số lượng khách yêu cầu. Giao dịch bị hủy bỏ!', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    -- Kiểm tra trạng thái chuyến đi có đang mở bán hay không
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.CHUYENKHOIHANH c ON i.MaChuyen = c.MaChuyen
        WHERE c.TrangThaiChuyen NOT IN (N'Mở bán')
    )
    BEGIN
        RAISERROR (N'LỖI NGHIỆP VỤ: Chuyến khởi hành này hiện không ở trạng thái [Mở bán] (đã hết chỗ hoặc bị hủy/tạm dừng).', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    -- Cập nhật tăng số chỗ đã đặt trong CHUYENKHOIHANH
    UPDATE c
    SET c.SoChoDaDat = c.SoChoDaDat + i.TongKhachDat,
        c.TrangThaiChuyen = CASE 
                               WHEN (c.SoChoDaDat + i.TongKhachDat) >= c.SoChoToiDa THEN N'Hết chỗ'
                               ELSE c.TrangThaiChuyen 
                            END
    FROM dbo.CHUYENKHOIHANH c
    JOIN (
        SELECT MaChuyen, SUM(SoLuongKhach) AS TongKhachDat
        FROM inserted
        WHERE TrangThaiDat <> N'Đã hủy'
        GROUP BY MaChuyen
    ) i ON c.MaChuyen = i.MaChuyen;

    -- Tự động ghi nhật ký hệ thống (AUDITLOG)
    INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
    SELECT 
        i.MaKhachHang,
        N'DAT_TOUR_THANH_CONG',
        NULL,
        CONCAT(N'Mã Đơn: ', i.MaDatTour, N', Chuyến: ', i.MaChuyen, N', Số khách: ', i.SoLuongKhach, N', Tổng tiền: ', i.TongTien),
        GETDATE()
    FROM inserted i;
END;
GO

PRINT N'==> Đã tạo Trigger TRG_DATTOUR_CheckAndLockSeats thành công.';
GO

-- ==========================================================================================
-- 2. TRIGGER: TỰ ĐỘNG HOÀN LẠI SỐ CHỖ KHI HỦY ĐƠN ĐẶT TOUR
-- Nghiệp vụ: Khi đơn đặt chuyển từ trạng thái khác sang 'Đã hủy', hệ thống tự động
-- trừ bớt SoChoDaDat để giải phóng ghế cho người khác và mở lại trạng thái 'Mở bán'.
-- ==========================================================================================
IF OBJECT_ID(N'dbo.TRG_DATTOUR_HandleCancellation', N'TR') IS NOT NULL
    DROP TRIGGER dbo.TRG_DATTOUR_HandleCancellation;
GO

CREATE TRIGGER dbo.TRG_DATTOUR_HandleCancellation
ON dbo.DATTOUR
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Chỉ xử lý khi có bản ghi chuyển sang trạng thái 'Đã hủy'
    IF NOT UPDATE(TrangThaiDat)
        RETURN;

    -- Danh sách các đơn chuyển trạng thái sang 'Đã hủy'
    IF EXISTS (
        SELECT 1 
        FROM inserted i 
        JOIN deleted d ON i.MaDatTour = d.MaDatTour
        WHERE i.TrangThaiDat = N'Đã hủy' AND d.TrangThaiDat <> N'Đã hủy'
    )
    BEGIN
        -- Giảm SoChoDaDat của chuyến đi tương ứng
        UPDATE c
        SET c.SoChoDaDat = CASE 
                              WHEN c.SoChoDaDat - h.TongKhachHuy < 0 THEN 0 
                              ELSE c.SoChoDaDat - h.TongKhachHuy 
                           END,
            c.TrangThaiChuyen = CASE 
                                  WHEN c.TrangThaiChuyen = N'Hết chỗ' THEN N'Mở bán' 
                                  ELSE c.TrangThaiChuyen 
                               END
        FROM dbo.CHUYENKHOIHANH c
        JOIN (
            SELECT i.MaChuyen, SUM(i.SoLuongKhach) AS TongKhachHuy
            FROM inserted i
            JOIN deleted d ON i.MaDatTour = d.MaDatTour
            WHERE i.TrangThaiDat = N'Đã hủy' AND d.TrangThaiDat <> N'Đã hủy'
            GROUP BY i.MaChuyen
        ) h ON c.MaChuyen = h.MaChuyen;

        -- Ghi nhận vào AUDITLOG
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        SELECT 
            i.MaKhachHang,
            N'HUY_DON_DAT_TOUR',
            CONCAT(N'Trạng thái cũ: ', d.TrangThaiDat),
            CONCAT(N'Mã Đơn: ', i.MaDatTour, N', Đã hủy, hoàn lại số chỗ: ', i.SoLuongKhach),
            GETDATE()
        FROM inserted i
        JOIN deleted d ON i.MaDatTour = d.MaDatTour
        WHERE i.TrangThaiDat = N'Đã hủy' AND d.TrangThaiDat <> N'Đã hủy';
    END;
END;
GO

PRINT N'==> Đã tạo Trigger TRG_DATTOUR_HandleCancellation thành công.';
GO

-- ==========================================================================================
-- 3. TRIGGER: KIỂM SOÁT ĐIỀU KIỆN ĐÁNH GIÁ TOUR
-- Nghiệp vụ: Khách hàng CHỈ ĐƯỢC PHÉP ĐÁNH GIÁ khi đơn đặt tour ở trạng thái 'Đã hoàn thành'.
-- ==========================================================================================
IF OBJECT_ID(N'dbo.TRG_DANHGIA_CheckCompletedTour', N'TR') IS NOT NULL
    DROP TRIGGER dbo.TRG_DANHGIA_CheckCompletedTour;
GO

CREATE TRIGGER dbo.TRG_DANHGIA_CheckCompletedTour
ON dbo.DANHGIA
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted dg
        JOIN dbo.DATTOUR dt ON dg.MaDatTour = dt.MaDatTour
        WHERE dt.TrangThaiDat <> N'Đã hoàn thành'
    )
    BEGIN
        RAISERROR (N'LỖI NGHIỆP VỤ: Quý khách chỉ có thể gửi đánh giá cho những đơn đặt tour đã hoàn thành chuyến đi!', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;
END;
GO

PRINT N'==> Đã tạo Trigger TRG_DANHGIA_CheckCompletedTour thành công.';
GO
