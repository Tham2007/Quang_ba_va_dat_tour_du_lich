-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 02_stored_procedures_booking.sql
-- Mục đích: Stored Procedures thực hiện quy trình Đặt Tour, Khóa giữ chỗ (15 phút),
--          Thanh toán, Hoàn tiền, Giải phóng chỗ hết hạn (ACID Transaction, Concurrency Lock)
-- ==========================================================================================

USE TourDuLichDB;
GO

-- ==========================================================================================
-- 1. PROCEDURE: ĐẶT TOUR TRỰC TUYẾN AN TOÀN VỚI KHÓA ĐỒNG THỜI (UPDLOCK, HOLDLOCK)
-- Nghiệp vụ BR1: SoChoConLai = SoChoToiDa - SoChoDaDat - SoChoGiuCho
-- Tự động thiết lập thời hạn giữ chỗ 15 phút (ThoiHanGiuCho)
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_TaoDonDatTour', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_TaoDonDatTour;
GO

CREATE PROCEDURE dbo.sp_TaoDonDatTour
    @MaKhachHang     INT,
    @MaChuyen        INT,
    @SoLuongKhach    INT,
    @HoTenTruongDoan NVARCHAR(100),
    @SoDienThoai     VARCHAR(15),
    @MaDatTourMoi    INT OUTPUT
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
        -- Ngăn chặn hiện tượng 2 người cùng đọc được còn 1 chỗ và cùng bấm đặt (Race Condition)
        DECLARE @GiaThucTe DECIMAL(18,2);
        DECLARE @SoChoToiDa INT;
        DECLARE @SoChoDaDat INT;
        DECLARE @SoChoGiuCho INT;
        DECLARE @TrangThaiChuyen NVARCHAR(50);

        SELECT 
            @GiaThucTe = GiaThucTe,
            @SoChoToiDa = SoChoToiDa,
            @SoChoDaDat = SoChoDaDat,
            @SoChoGiuCho = ISNULL(SoChoGiuCho, 0),
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

        -- Kiểm tra chỗ còn trống theo công thức BR1
        DECLARE @SoChoConLai INT = @SoChoToiDa - @SoChoDaDat - @SoChoGiuCho;
        IF @SoChoConLai < @SoLuongKhach
        BEGIN
            RAISERROR(N'Chuyến khởi hành không đủ số chỗ trống (Còn lại: %d chỗ, Yêu cầu: %d chỗ).', 16, 1,
                      @SoChoConLai, @SoLuongKhach);
        END;

        -- 3. Tính toán tổng tiền
        DECLARE @TongTien DECIMAL(18,2) = @SoLuongKhach * @GiaThucTe;
        DECLARE @ThoiHanGiuCho DATETIME = DATEADD(MINUTE, 15, GETDATE());

        -- 4. Thêm đơn đặt tour mới (Trigger TRG_DATTOUR_CheckAndLockSeats sẽ tự động tăng SoChoGiuCho)
        INSERT INTO dbo.DATTOUR (
            MaKhachHang, 
            MaChuyen, 
            NgayDat, 
            ThoiHanGiuCho,
            SoLuongKhach, 
            TongTien, 
            TrangThaiDat, 
            TrangThaiThanhToan
        )
        VALUES (
            @MaKhachHang, 
            @MaChuyen, 
            GETDATE(), 
            @ThoiHanGiuCho,
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
            N'Đặt tour thành công, đã khóa tạm giữ chỗ trong 15 phút.' AS ThongBao,
            @TongTien AS TongTienThanhToan,
            @ThoiHanGiuCho AS ThoiHanGiuCho;
            
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
-- Ghi nhận giao dịch thu tiền vào THANHTOAN với LoaiGiaoDich = N'Thanh toán'
-- Trigger sẽ tự động chuyển số chỗ từ SoChoGiuCho sang SoChoDaDat chính thức
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

        -- 1. Ghi nhận giao dịch thanh toán (LoaiGiaoDich = N'Thanh toán')
        INSERT INTO dbo.THANHTOAN (MaDatTour, LoaiGiaoDich, PhuongThuc, SoTien, NgayThanhToan, MaGiaoDich, TrangThai)
        VALUES (@MaDatTour, N'Thanh toán', @PhuongThuc, @SoTien, GETDATE(), @MaGiaoDich, N'Thành công');

        -- 2. Cập nhật trạng thái đơn đặt sang 'Đã xác nhận' và 'Đã thanh toán'
        -- Trigger TRG_DATTOUR_HandleUpdateAndCancellation sẽ tự động chuyển SoChoGiuCho -> SoChoDaDat
        UPDATE dbo.DATTOUR
        SET TrangThaiThanhToan = N'Đã thanh toán',
            TrangThaiDat = CASE WHEN TrangThaiDat = N'Chờ xác nhận' THEN N'Đã xác nhận' ELSE TrangThaiDat END,
            ThoiHanGiuCho = NULL
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
-- 3. PROCEDURE: XÁC NHẬN HOÀN TIỀN CHO ĐƠN ĐẶT TOUR (UC-10)
-- Ghi nhận giao dịch hoàn tiền vào THANHTOAN với LoaiGiaoDich = N'Hoàn tiền'
-- Cập nhật đơn đặt sang 'Đã hủy' & 'Đã hoàn tiền', giải phóng số chỗ
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_XacNhanHoanTienDonTour', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_XacNhanHoanTienDonTour;
GO

CREATE PROCEDURE dbo.sp_XacNhanHoanTienDonTour
    @MaDatTour      INT,
    @SoTienHoan     DECIMAL(18,2),
    @PhuongThuc     NVARCHAR(50),
    @MaGiaoDichHoan VARCHAR(100),
    @GhiChu         NVARCHAR(500),
    @MaAdmin        INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour)
        BEGIN
            RAISERROR(N'Đơn đặt tour không tồn tại.', 16, 1);
        END;

        -- 1. Ghi nhận giao dịch hoàn tiền trong THANHTOAN
        INSERT INTO dbo.THANHTOAN (MaDatTour, LoaiGiaoDich, PhuongThuc, SoTien, NgayThanhToan, MaGiaoDich, TrangThai, GhiChu)
        VALUES (@MaDatTour, N'Hoàn tiền', @PhuongThuc, @SoTienHoan, GETDATE(), @MaGiaoDichHoan, N'Thành công', @GhiChu);

        -- 2. Cập nhật trạng thái đơn sang 'Đã hủy' và 'Đã hoàn tiền' (Trigger sẽ tự động giải phóng chỗ)
        UPDATE dbo.DATTOUR
        SET TrangThaiDat = N'Đã hủy',
            TrangThaiThanhToan = N'Đã hoàn tiền'
        WHERE MaDatTour = @MaDatTour;

        -- 3. Cập nhật bảng yêu cầu đổi/hủy nếu có yêu cầu liên quan đang chờ xử lý
        UPDATE dbo.YEUCAU_HOANTIEN_DOILICH
        SET TrangThai = N'Đã duyệt',
            NgayXuLy = GETDATE(),
            NguoiXuLy = @MaAdmin,
            PhanHoiAdmin = CONCAT(N'Đã hoàn tất chuyển tiền hoàn: ', @SoTienHoan, N' VNĐ. Mã GD: ', @MaGiaoDichHoan)
        WHERE MaDatTour = @MaDatTour AND TrangThai = N'Chờ xử lý';

        -- 4. Ghi vết Audit Log
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (
            @MaAdmin,
            N'XAC_NHAN_HOAN_TIEN',
            CONCAT(N'Mã đơn: ', @MaDatTour),
            CONCAT(N'Đã hoàn tiền: ', @SoTienHoan, N' VNĐ qua: ', @PhuongThuc, N'. Ghi chú: ', @GhiChu),
            GETDATE()
        );

        COMMIT TRANSACTION;
        PRINT N'Đã xác nhận hoàn tiền và cập nhật trạng thái đơn tour thành công!';
        RETURN 0;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

PRINT N'==> Đã tạo Stored Procedure sp_XacNhanHoanTienDonTour thành công.';
GO

-- ==========================================================================================
-- 4. PROCEDURE: HỦY ĐƠN ĐẶT TOUR
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

    -- Cập nhật trạng thái đơn -> Trigger sẽ tự động hoàn trả số chỗ (SoChoGiuCho hoặc SoChoDaDat)!
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

-- ==========================================================================================
-- 5. PROCEDURE: TỰ ĐỘNG QUÉT & GIẢI PHÓNG CÁC ĐƠN GIỮ CHỖ HẾT HẠN (BACKGROUND JOB)
-- Nghiệp vụ: Đơn chưa thanh toán quá 15 phút (ThoiHanGiuCho < GETDATE()) sẽ tự hủy
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_GiaiPhongGiuChoHetHan', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GiaiPhongGiuChoHetHan;
GO

CREATE PROCEDURE dbo.sp_GiaiPhongGiuChoHetHan
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @SoDonHetHan INT = 0;

    -- Lấy danh sách các đơn giữ chỗ quá 15 phút mà chưa thanh toán
    DECLARE @GiaiPhong TABLE (MaDatTour INT);

    UPDATE dt
    SET dt.TrangThaiDat = N'Đã hủy'
    OUTPUT deleted.MaDatTour INTO @GiaiPhong
    FROM dbo.DATTOUR dt
    WHERE dt.TrangThaiDat = N'Chờ xác nhận'
      AND dt.TrangThaiThanhToan = N'Chưa thanh toán'
      AND dt.ThoiHanGiuCho IS NOT NULL
      AND dt.ThoiHanGiuCho < GETDATE();

    SET @SoDonHetHan = @@ROWCOUNT;

    IF @SoDonHetHan > 0
    BEGIN
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (
            NULL,
            N'GIAI_PHONG_GIU_CHO_HET_HAN',
            NULL,
            CONCAT(N'Hệ thống tự động hủy và giải phóng chỗ cho ', @SoDonHetHan, N' đơn đặt tour quá hạn 15 phút.'),
            GETDATE()
        );
    END;

    SELECT @SoDonHetHan AS SoDonDaGiaiPhong, N'Quét và giải phóng chỗ hết hạn hoàn tất.' AS ThongBao;
    RETURN 0;
END;
GO

PRINT N'==> Đã tạo Stored Procedure sp_GiaiPhongGiuChoHetHan thành công.';
GO

-- ==========================================================================================
-- 6. PROCEDURE: ĐẶT TOUR KÈM ĐẦY ĐỦ DANH SÁCH HÀNH KHÁCH (ĐẢM BẢO QUY TẮC NGHIỆP VỤ 6)
-- Kiểm tra:
--   1. SoLuongKhach >= 1
--   2. Số lượng dòng hành khách trong JSON danh sách bắt buộc = SoLuongKhach
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_TaoDonDatTour_KemDanhSachKhach', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_TaoDonDatTour_KemDanhSachKhach;
GO

CREATE PROCEDURE dbo.sp_TaoDonDatTour_KemDanhSachKhach
    @MaKhachHang            INT,
    @MaChuyen               INT,
    @SoLuongKhach           INT,
    @DanhSachHanhKhachJson  NVARCHAR(MAX), -- Chuỗi JSON: [{"HoTen":"...","NgaySinh":"...","GioiTinh":"...","SoDienThoai":"..."}]
    @MaDatTourMoi           INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- 1. Kiểm tra số lượng khách > 0
    IF @SoLuongKhach <= 0
    BEGIN
        RAISERROR(N'Số lượng khách đặt tour phải lớn hơn 0.', 16, 1);
        RETURN -1;
    END;

    -- 2. Kiểm tra chuỗi JSON danh sách hành khách
    IF ISJSON(@DanhSachHanhKhachJson) <> 1
    BEGIN
        RAISERROR(N'Dữ liệu danh sách hành khách không đúng định dạng JSON hợp lệ.', 16, 1);
        RETURN -1;
    END;

    -- Đếm số hành khách trong JSON
    DECLARE @SoKhachKhaiBao INT;
    SELECT @SoKhachKhaiBao = COUNT(*) 
    FROM OPENJSON(@DanhSachHanhKhachJson);

    IF @SoKhachKhaiBao <> @SoLuongKhach
    BEGIN
        RAISERROR(N'LỖI NGHIỆP VỤ: Số lượng hành khách khai báo (%d) không khớp với số lượng chỗ đặt (%d)!', 16, 1,
                  @SoKhachKhaiBao, @SoLuongKhach);
        RETURN -1;
    END;

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Kiểm tra chỗ trống
        DECLARE @GiaThucTe DECIMAL(18,2);
        DECLARE @SoChoToiDa INT;
        DECLARE @SoChoDaDat INT;
        DECLARE @SoChoGiuCho INT;

        SELECT 
            @GiaThucTe = GiaThucTe,
            @SoChoToiDa = SoChoToiDa,
            @SoChoDaDat = SoChoDaDat,
            @SoChoGiuCho = ISNULL(SoChoGiuCho, 0)
        FROM dbo.CHUYENKHOIHANH WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChuyen = @MaChuyen AND TrangThaiChuyen = N'Mở bán';

        IF (@SoChoToiDa - @SoChoDaDat - @SoChoGiuCho) < @SoLuongKhach
        BEGIN
            RAISERROR(N'Chuyến khởi hành không đủ số chỗ trống.', 16, 1);
        END;

        DECLARE @TongTien DECIMAL(18,2) = @SoLuongKhach * @GiaThucTe;
        DECLARE @ThoiHanGiuCho DATETIME = DATEADD(MINUTE, 15, GETDATE());

        -- Thêm đơn đặt
        INSERT INTO dbo.DATTOUR (MaKhachHang, MaChuyen, NgayDat, ThoiHanGiuCho, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
        VALUES (@MaKhachHang, @MaChuyen, GETDATE(), @ThoiHanGiuCho, @SoLuongKhach, @TongTien, N'Chờ xác nhận', N'Chưa thanh toán');

        SET @MaDatTourMoi = SCOPE_IDENTITY();

        -- Thêm toàn bộ hành khách từ JSON vào bảng CHITIET_HANHKHACH
        INSERT INTO dbo.CHITIET_HANHKHACH (MaDatTour, HoTen, NgaySinh, GioiTinh, SoDienThoai)
        SELECT 
            @MaDatTourMoi,
            JSON_VALUE(value, '$.HoTen'),
            TRY_CAST(JSON_VALUE(value, '$.NgaySinh') AS DATE),
            JSON_VALUE(value, '$.GioiTinh'),
            JSON_VALUE(value, '$.SoDienThoai')
        FROM OPENJSON(@DanhSachHanhKhachJson);

        COMMIT TRANSACTION;

        SELECT 
            @MaDatTourMoi AS MaDatTour,
            N'Đặt tour và lưu danh sách hành khách thành công!' AS ThongBao,
            @TongTien AS TongTien,
            @ThoiHanGiuCho AS ThoiHanGiuCho;

        RETURN 0;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

PRINT N'==> Đã tạo Stored Procedure sp_TaoDonDatTour_KemDanhSachKhach thành công.';
GO
