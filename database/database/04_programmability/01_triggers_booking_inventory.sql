-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 01_triggers_booking_inventory.sql
-- Mục đích: Trigger nghiệp vụ cốt lõi - Kiểm soát số chỗ (Overbooking Prevention), 
--          khóa tạm giữ chỗ (15 phút), chuyển đổi giữ chỗ sang đã đặt khi thanh toán,
--          hoàn chỗ khi hủy tour, kiểm soát điều kiện đánh giá và kiểm tra danh sách hành khách.
-- ==========================================================================================

USE TourDuLichDB;
GO

-- ==========================================================================================
-- 1. TRIGGER: KIỂM SOÁT ĐẶT TOUR & CHỐNG OVERBOOKING (TỰ ĐỘNG KHÓA TẠM GIỮ CHỖ / CHỐT CHỖ)
-- Nghiệp vụ:
--   BR1: SoChoConLai = SoChoToiDa - SoChoDaDat - SoChoGiuCho.
--   - Khi đặt tour (TrangThaiThanhToan = 'Chưa thanh toán'): Tự động tăng SoChoGiuCho và set ThoiHanGiuCho = 15 phút.
--   - Nếu đơn đặt đã thanh toán ngay: Tự động tăng SoChoDaDat.
--   - Khi hết chỗ (SoChoDaDat + SoChoGiuCho >= SoChoToiDa): Đổi trạng thái sang 'Hết chỗ'.
--   - Nếu không đủ chỗ: Báo lỗi và ROLLBACK TRANSACTION ngay lập tức.
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

    -- 1. Kiểm tra tình trạng sức chứa còn lại của chuyến khởi hành (BR1)
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.CHUYENKHOIHANH c ON i.MaChuyen = c.MaChuyen
        WHERE (c.SoChoToiDa - c.SoChoDaDat - c.SoChoGiuCho) < i.SoLuongKhach
    )
    BEGIN
        RAISERROR (N'LỖI NGHIỆP VỤ: Số chỗ còn lại của chuyến khởi hành không đủ đáp ứng số lượng khách yêu cầu. Giao dịch bị hủy bỏ!', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    -- 2. Kiểm tra trạng thái chuyến đi có đang mở bán hay không
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

    -- 3. Cập nhật số chỗ: Nếu đã thanh toán thì tăng SoChoDaDat, nếu chưa thanh toán thì tăng SoChoGiuCho
    -- Xử lý đơn đã thanh toán ngay (ThanhToan = 'Đã thanh toán')
    UPDATE c
    SET c.SoChoDaDat = c.SoChoDaDat + i.TongKhachDat,
        c.TrangThaiChuyen = CASE 
                               WHEN (c.SoChoDaDat + c.SoChoGiuCho + i.TongKhachDat) >= c.SoChoToiDa THEN N'Hết chỗ'
                               ELSE c.TrangThaiChuyen 
                            END
    FROM dbo.CHUYENKHOIHANH c
    JOIN (
        SELECT MaChuyen, SUM(SoLuongKhach) AS TongKhachDat
        FROM inserted
        WHERE TrangThaiDat <> N'Đã hủy' AND TrangThaiThanhToan = N'Đã thanh toán'
        GROUP BY MaChuyen
    ) i ON c.MaChuyen = i.MaChuyen;

    -- Xử lý đơn đặt chờ thanh toán (Khóa tạm giữ chỗ SoChoGiuCho)
    UPDATE c
    SET c.SoChoGiuCho = c.SoChoGiuCho + i.TongKhachGiu,
        c.TrangThaiChuyen = CASE 
                               WHEN (c.SoChoDaDat + c.SoChoGiuCho + i.TongKhachGiu) >= c.SoChoToiDa THEN N'Hết chỗ'
                               ELSE c.TrangThaiChuyen 
                            END
    FROM dbo.CHUYENKHOIHANH c
    JOIN (
        SELECT MaChuyen, SUM(SoLuongKhach) AS TongKhachGiu
        FROM inserted
        WHERE TrangThaiDat <> N'Đã hủy' AND TrangThaiThanhToan <> N'Đã thanh toán'
        GROUP BY MaChuyen
    ) i ON c.MaChuyen = i.MaChuyen;

    -- Tự động gán thời hạn giữ chỗ 15 phút nếu đơn chưa có ThoiHanGiuCho
    UPDATE dt
    SET dt.ThoiHanGiuCho = DATEADD(MINUTE, 15, dt.NgayDat)
    FROM dbo.DATTOUR dt
    JOIN inserted i ON dt.MaDatTour = i.MaDatTour
    WHERE dt.ThoiHanGiuCho IS NULL AND dt.TrangThaiThanhToan <> N'Đã thanh toán';

    -- 4. Tự động ghi nhật ký hệ thống (AUDITLOG)
    INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
    SELECT 
        i.MaKhachHang,
        N'DAT_TOUR_THANH_CONG',
        NULL,
        CONCAT(N'Mã Đơn: ', i.MaDatTour, N', Chuyến: ', i.MaChuyen, N', Số khách: ', i.SoLuongKhach, N', Tổng tiền: ', i.TongTien, N', Trạng thái TT: ', i.TrangThaiThanhToan),
        GETDATE()
    FROM inserted i;
END;
GO

PRINT N'==> Đã tạo Trigger TRG_DATTOUR_CheckAndLockSeats thành công.';
GO

-- ==========================================================================================
-- 2. TRIGGER: CẬP NHẬT TRẠNG THÁI THANH TOÁN & HỦY ĐƠN (CHUYỂN ĐỔI GIỮ CHỖ HOẶC HOÀN CHỖ)
-- Nghiệp vụ:
--   A. Khi đơn chuyển từ 'Chưa thanh toán' sang 'Đã thanh toán':
--      -> Chuyển số chỗ từ SoChoGiuCho sang SoChoDaDat (giảm SoChoGiuCho, tăng SoChoDaDat).
--   B. Khi đơn chuyển sang 'Đã hủy':
--      -> Nếu trước đó đã thanh toán: hoàn trừ SoChoDaDat.
--      -> Nếu trước đó đang giữ chỗ: hoàn trừ SoChoGiuCho.
--      -> Nếu chuyến đang 'Hết chỗ', tự động mở lại 'Mở bán'.
--   C. Kiểm tra ràng buộc danh sách hành khách khi chuyển sang 'Đã xác nhận' hoặc 'Đã hoàn thành':
--      -> Số dòng trong CHITIET_HANHKHACH bắt buộc bằng SoLuongKhach.
-- ==========================================================================================
IF OBJECT_ID(N'dbo.TRG_DATTOUR_HandleUpdateAndCancellation', N'TR') IS NOT NULL
    DROP TRIGGER dbo.TRG_DATTOUR_HandleUpdateAndCancellation;
IF OBJECT_ID(N'dbo.TRG_DATTOUR_HandleCancellation', N'TR') IS NOT NULL
    DROP TRIGGER dbo.TRG_DATTOUR_HandleCancellation;
GO

CREATE TRIGGER dbo.TRG_DATTOUR_HandleUpdateAndCancellation
ON dbo.DATTOUR
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- ======================================================================================
    -- NHÁNH 1: XÁC THỰC RÀNG BUỘC DANH SÁCH HÀNH KHÁCH KHI XÁC NHẬN ĐƠN
    -- Khi đơn chuyển sang 'Đã xác nhận' hoặc 'Đã hoàn thành', kiểm tra số hành khách thực tế
    -- ======================================================================================
    IF UPDATE(TrangThaiDat)
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM inserted i
            JOIN deleted d ON i.MaDatTour = d.MaDatTour
            WHERE i.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') 
              AND d.TrangThaiDat NOT IN (N'Đã xác nhận', N'Đã hoàn thành')
              AND (
                  (SELECT COUNT(*) FROM dbo.CHITIET_HANHKHACH hk WHERE hk.MaDatTour = i.MaDatTour) <> i.SoLuongKhach
              )
        )
        BEGIN
            RAISERROR (N'LỖI TOÀN VẸN: Số lượng hành khách thực tế trong bảng CHITIET_HANHKHACH không khớp với số khách đã đăng ký của đơn đặt tour!', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END;
    END;

    -- ======================================================================================
    -- NHÁNH 2: XỬ LÝ THANH TOÁN THÀNH CÔNG (CHUYỂN TỪ GIỮ CHỖ SANG ĐÃ ĐẶT CHÍNH THỨC)
    -- ======================================================================================
    IF UPDATE(TrangThaiThanhToan)
    BEGIN
        IF EXISTS (
            SELECT 1 
            FROM inserted i
            JOIN deleted d ON i.MaDatTour = d.MaDatTour
            WHERE i.TrangThaiThanhToan = N'Đã thanh toán' 
              AND d.TrangThaiThanhToan <> N'Đã thanh toán'
              AND i.TrangThaiDat <> N'Đã hủy'
        )
        BEGIN
            -- Giảm SoChoGiuCho và tăng SoChoDaDat
            UPDATE c
            SET c.SoChoGiuCho = CASE WHEN c.SoChoGiuCho - p.TongKhach < 0 THEN 0 ELSE c.SoChoGiuCho - p.TongKhach END,
                c.SoChoDaDat = c.SoChoDaDat + p.TongKhach
            FROM dbo.CHUYENKHOIHANH c
            JOIN (
                SELECT i.MaChuyen, SUM(i.SoLuongKhach) AS TongKhach
                FROM inserted i
                JOIN deleted d ON i.MaDatTour = d.MaDatTour
                WHERE i.TrangThaiThanhToan = N'Đã thanh toán' 
                  AND d.TrangThaiThanhToan <> N'Đã thanh toán'
                  AND i.TrangThaiDat <> N'Đã hủy'
                GROUP BY i.MaChuyen
            ) p ON c.MaChuyen = p.MaChuyen;

            -- Xóa thời hạn giữ chỗ vì khách đã thanh toán thành công
            UPDATE dt
            SET dt.ThoiHanGiuCho = NULL
            FROM dbo.DATTOUR dt
            JOIN inserted i ON dt.MaDatTour = i.MaDatTour
            WHERE i.TrangThaiThanhToan = N'Đã thanh toán';

            -- Ghi nhật ký AUDITLOG
            INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
            SELECT 
                i.MaKhachHang,
                N'XAC_NHAN_THANH_TOAN_CHOT_CHO',
                CONCAT(N'Trạng thái TT cũ: ', d.TrangThaiThanhToan),
                CONCAT(N'Mã Đơn: ', i.MaDatTour, N', Chuyển giữ chỗ sang đã đặt: ', i.SoLuongKhach, N' chỗ'),
                GETDATE()
            FROM inserted i
            JOIN deleted d ON i.MaDatTour = d.MaDatTour
            WHERE i.TrangThaiThanhToan = N'Đã thanh toán' AND d.TrangThaiThanhToan <> N'Đã thanh toán';
        END;
    END;

    -- ======================================================================================
    -- NHÁNH 3: XỬ LÝ HỦY ĐƠN ĐẶT TOUR (HOÀN LẠI SỐ CHỖ TƯƠNG ỨNG)
    -- ======================================================================================
    IF UPDATE(TrangThaiDat)
    BEGIN
        IF EXISTS (
            SELECT 1 
            FROM inserted i 
            JOIN deleted d ON i.MaDatTour = d.MaDatTour
            WHERE i.TrangThaiDat = N'Đã hủy' AND d.TrangThaiDat <> N'Đã hủy'
        )
        BEGIN
            -- 3a. Hoàn số chỗ đã đặt chính thức (nếu đơn trước đó đã thanh toán)
            UPDATE c
            SET c.SoChoDaDat = CASE WHEN c.SoChoDaDat - h.TongKhachHuy < 0 THEN 0 ELSE c.SoChoDaDat - h.TongKhachHuy END,
                c.TrangThaiChuyen = CASE WHEN c.TrangThaiChuyen = N'Hết chỗ' THEN N'Mở bán' ELSE c.TrangThaiChuyen END
            FROM dbo.CHUYENKHOIHANH c
            JOIN (
                SELECT i.MaChuyen, SUM(i.SoLuongKhach) AS TongKhachHuy
                FROM inserted i
                JOIN deleted d ON i.MaDatTour = d.MaDatTour
                WHERE i.TrangThaiDat = N'Đã hủy' AND d.TrangThaiDat <> N'Đã hủy'
                  AND d.TrangThaiThanhToan = N'Đã thanh toán'
                GROUP BY i.MaChuyen
            ) h ON c.MaChuyen = h.MaChuyen;

            -- 3b. Hoàn số chỗ đang giữ tạm (nếu đơn trước đó chưa thanh toán)
            UPDATE c
            SET c.SoChoGiuCho = CASE WHEN c.SoChoGiuCho - h.TongKhachHuy < 0 THEN 0 ELSE c.SoChoGiuCho - h.TongKhachHuy END,
                c.TrangThaiChuyen = CASE WHEN c.TrangThaiChuyen = N'Hết chỗ' THEN N'Mở bán' ELSE c.TrangThaiChuyen END
            FROM dbo.CHUYENKHOIHANH c
            JOIN (
                SELECT i.MaChuyen, SUM(i.SoLuongKhach) AS TongKhachHuy
                FROM inserted i
                JOIN deleted d ON i.MaDatTour = d.MaDatTour
                WHERE i.TrangThaiDat = N'Đã hủy' AND d.TrangThaiDat <> N'Đã hủy'
                  AND d.TrangThaiThanhToan <> N'Đã thanh toán'
                GROUP BY i.MaChuyen
            ) h ON c.MaChuyen = h.MaChuyen;

            -- Ghi nhận vào AUDITLOG
            INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
            SELECT 
                i.MaKhachHang,
                N'HUY_DON_DAT_TOUR',
                CONCAT(N'Trạng thái cũ: ', d.TrangThaiDat, N' | ', d.TrangThaiThanhToan),
                CONCAT(N'Mã Đơn: ', i.MaDatTour, N', Đã hủy, hoàn lại số chỗ: ', i.SoLuongKhach),
                GETDATE()
            FROM inserted i
            JOIN deleted d ON i.MaDatTour = d.MaDatTour
            WHERE i.TrangThaiDat = N'Đã hủy' AND d.TrangThaiDat <> N'Đã hủy';
        END;
    END;
END;
GO

-- Alias để tương thích tên gọi cũ
IF OBJECT_ID(N'dbo.TRG_DATTOUR_HandleCancellation', N'TR') IS NULL
BEGIN
    EXEC('CREATE TRIGGER dbo.TRG_DATTOUR_HandleCancellation ON dbo.DATTOUR AFTER UPDATE AS BEGIN RETURN; END;');
    DROP TRIGGER dbo.TRG_DATTOUR_HandleCancellation;
END;
GO

PRINT N'==> Đã tạo Trigger TRG_DATTOUR_HandleUpdateAndCancellation thành công.';
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

-- ==========================================================================================
-- 4. TRIGGER: KIỂM SOÁT SỐ LƯỢNG HÀNH KHÁCH KHÔNG VƯỢT QUÁ SỐ CHỖ ĐÃ ĐẶT
-- Nghiệp vụ: Đảm bảo số lượng dòng hành khách trong CHITIET_HANHKHACH <= SoLuongKhach của DATTOUR.
-- ==========================================================================================
IF OBJECT_ID(N'dbo.TRG_CHITIET_HANHKHACH_KiemTraSoLuong', N'TR') IS NOT NULL
    DROP TRIGGER dbo.TRG_CHITIET_HANHKHACH_KiemTraSoLuong;
GO

CREATE TRIGGER dbo.TRG_CHITIET_HANHKHACH_KiemTraSoLuong
ON dbo.CHITIET_HANHKHACH
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.DATTOUR dt ON i.MaDatTour = dt.MaDatTour
        GROUP BY i.MaDatTour, dt.SoLuongKhach
        HAVING (SELECT COUNT(*) FROM dbo.CHITIET_HANHKHACH hk WHERE hk.MaDatTour = i.MaDatTour) > dt.SoLuongKhach
    )
    BEGIN
        RAISERROR (N'LỖI NGHIỆP VỤ: Số lượng hành khách nhập vào vượt quá số chỗ đã đăng ký của đơn đặt tour!', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;
END;
GO

PRINT N'==> Đã tạo Trigger TRG_CHITIET_HANHKHACH_KiemTraSoLuong thành công.';
GO
