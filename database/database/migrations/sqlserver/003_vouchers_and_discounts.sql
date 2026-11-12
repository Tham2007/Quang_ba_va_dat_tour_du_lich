-- ==========================================================================================
-- MIGRATION 003: HỆ THỐNG MÃ ƯU ĐÃI (VOUCHER / PROMO CODE) TRÊN MICROSOFT SQL SERVER
-- BẢO TOÀN ĐÚNG 12 BẢNG GỐC (KHÔNG TẠO THÊM BẢNG MỚI, KHÔNG SỬA CẤU TRÚC CỘT BẢNG CŨ)
-- Dữ liệu định nghĩa mã ưu đãi & lịch sử lượt dùng được lưu trực tiếp trong dbo.AUDITLOG
-- với HanhDong = N'VOUCHER_DEF' / N'VOUCHER_USE' và khóa đồng thời UPDLOCK/HOLDLOCK.
-- ==========================================================================================

-- 1. Trigger tự động hoàn lượt sử dụng voucher khi đơn trong dbo.DATTOUR chuyển sang 'Đã hủy'
IF OBJECT_ID(N'dbo.TRG_DATTOUR_ReleaseVoucherOnCancel', N'TR') IS NOT NULL
  DROP TRIGGER dbo.TRG_DATTOUR_ReleaseVoucherOnCancel;
GO
CREATE TRIGGER dbo.TRG_DATTOUR_ReleaseVoucherOnCancel
ON dbo.DATTOUR
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF NOT EXISTS (
    SELECT 1 FROM inserted i
    JOIN deleted d ON i.MaDatTour = d.MaDatTour
    WHERE i.TrangThaiDat = N'Đã hủy' AND d.TrangThaiDat <> N'Đã hủy'
  )
    RETURN;

  DECLARE @ReleasedCodes TABLE (MaCode NVARCHAR(100));

  UPDATE a
  SET a.DuLieuMoi = JSON_MODIFY(a.DuLieuMoi, '$.status', N'RELEASED')
  OUTPUT UPPER(inserted.DuLieuCu) INTO @ReleasedCodes(MaCode)
  FROM dbo.AUDITLOG a
  WHERE a.HanhDong = N'VOUCHER_USE'
    AND ISJSON(a.DuLieuMoi) = 1
    AND JSON_VALUE(CASE WHEN ISJSON(a.DuLieuMoi) = 1 THEN a.DuLieuMoi END, '$.status') = N'ACTIVE'
    AND EXISTS (
      SELECT 1
      FROM inserted i
      JOIN deleted d ON i.MaDatTour = d.MaDatTour
      WHERE i.TrangThaiDat = N'Đã hủy'
        AND d.TrangThaiDat <> N'Đã hủy'
        AND TRY_CAST(JSON_VALUE(CASE WHEN ISJSON(a.DuLieuMoi) = 1 THEN a.DuLieuMoi END, '$.maDatTour') AS INT) = i.MaDatTour
    );

  IF EXISTS (SELECT 1 FROM @ReleasedCodes)
  BEGIN
    ;WITH Agg AS (
      SELECT MaCode, COUNT(*) AS Cnt
      FROM @ReleasedCodes
      WHERE MaCode IS NOT NULL AND MaCode <> N''
      GROUP BY MaCode
    )
    UPDATE d
    SET d.DuLieuMoi = JSON_MODIFY(
          JSON_MODIFY(
            d.DuLieuMoi,
            '$.usedCount',
            CASE
              WHEN ISNULL(TRY_CAST(JSON_VALUE(CASE WHEN ISJSON(d.DuLieuMoi) = 1 THEN d.DuLieuMoi END, '$.usedCount') AS INT), 0) >= Agg.Cnt
              THEN ISNULL(TRY_CAST(JSON_VALUE(CASE WHEN ISJSON(d.DuLieuMoi) = 1 THEN d.DuLieuMoi END, '$.usedCount') AS INT), 0) - Agg.Cnt
              ELSE 0
            END
          ),
          '$.updatedAt',
          CONVERT(VARCHAR(30), SYSUTCDATETIME(), 127) + 'Z'
        )
    FROM dbo.AUDITLOG d
    JOIN Agg ON UPPER(d.DuLieuCu) = Agg.MaCode
    WHERE d.HanhDong = N'VOUCHER_DEF' AND ISJSON(d.DuLieuMoi) = 1;
  END;
END;
GO

-- 2. Nâng cấp Stored Procedure sp_TaoDonDatTour hỗ trợ tham số tùy chọn @MaCodeUuDai
--    Giữ nguyên 12 bảng gốc (không thêm cột/bảng mới) & tương thích nested transaction từ Python API
IF OBJECT_ID(N'dbo.sp_TaoDonDatTour', N'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_TaoDonDatTour;
GO
CREATE PROCEDURE dbo.sp_TaoDonDatTour
    @MaKhachHang    INT,
    @MaChuyen       INT,
    @SoLuongKhach   INT,
    @HoTenTruongDoan NVARCHAR(100),
    @SoDienThoai    VARCHAR(15),
    @MaDatTourMoi   INT OUTPUT,
    @MaCodeUuDai    VARCHAR(32) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT OFF;

    IF @SoLuongKhach <= 0
    BEGIN
        RAISERROR(N'Số lượng khách đặt tour phải lớn hơn 0.', 16, 1);
        RETURN -1;
    END;

    DECLARE @StartedTran BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRANSACTION;
        SET @StartedTran = 1;
    END
    ELSE
    BEGIN
        SAVE TRANSACTION sp_TaoDonDatTour_Save;
    END;

    BEGIN TRY
        DECLARE @EmailKhach NVARCHAR(150) = N'';
        SELECT @EmailKhach = Email
        FROM dbo.NGUOIDUNG
        WHERE MaNguoiDung = @MaKhachHang AND TrangThai = 1;

        IF @EmailKhach IS NULL OR @EmailKhach = N''
            RAISERROR(N'Tài khoản khách hàng không tồn tại hoặc đã bị khóa.', 16, 1);

        DECLARE @GiaThucTe DECIMAL(18,2), @SoChoToiDa INT, @SoChoDaDat INT, @TrangThaiChuyen NVARCHAR(50), @MaTour INT, @TenTour NVARCHAR(255), @TenDanhMuc NVARCHAR(100);
        SELECT
            @GiaThucTe = c.GiaThucTe,
            @SoChoToiDa = c.SoChoToiDa,
            @SoChoDaDat = c.SoChoDaDat,
            @TrangThaiChuyen = c.TrangThaiChuyen,
            @MaTour = t.MaTour,
            @TenTour = t.TenTour,
            @TenDanhMuc = dm.TenDanhMuc
        FROM dbo.CHUYENKHOIHANH c WITH (UPDLOCK, HOLDLOCK)
        JOIN dbo.TOUR t ON c.MaTour = t.MaTour
        JOIN dbo.DANHMUC dm ON t.MaDanhMuc = dm.MaDanhMuc
        WHERE c.MaChuyen = @MaChuyen;

        IF @GiaThucTe IS NULL
            RAISERROR(N'Chuyến khởi hành không tồn tại trong hệ thống.', 16, 1);
        IF @TrangThaiChuyen <> N'Mở bán'
            RAISERROR(N'Chuyến khởi hành này hiện đã đóng hoặc không còn mở bán.', 16, 1);
        IF (@SoChoToiDa - @SoChoDaDat) < @SoLuongKhach
            RAISERROR(N'Chuyến khởi hành không đủ số chỗ trống.', 16, 1);

        DECLARE @TongTienGoc DECIMAL(18,2) = @SoLuongKhach * @GiaThucTe;
        DECLARE @TienGiam DECIMAL(18,2) = 0;
        DECLARE @VoucherLogId INT = NULL;
        DECLARE @NormCode VARCHAR(32) = UPPER(LTRIM(RTRIM(ISNULL(@MaCodeUuDai, ''))));

        IF @NormCode <> ''
        BEGIN
            DECLARE @VoucherJson NVARCHAR(MAX) = NULL;
            SELECT TOP 1
                @VoucherLogId = MaLog,
                @VoucherJson = DuLieuMoi
            FROM dbo.AUDITLOG WITH (UPDLOCK, HOLDLOCK)
            WHERE HanhDong = N'VOUCHER_DEF' AND UPPER(DuLieuCu) = @NormCode AND ISJSON(DuLieuMoi) = 1
            ORDER BY MaLog DESC;

            IF @VoucherLogId IS NULL
                RAISERROR(N'Mã ưu đãi không tồn tại.', 16, 1);

            DECLARE @ActiveStr NVARCHAR(10) = LOWER(ISNULL(JSON_VALUE(@VoucherJson, '$.active'), N'false'));
            IF @ActiveStr NOT IN (N'true', N'1')
                RAISERROR(N'Mã ưu đãi hiện đang ngừng hoạt động.', 16, 1);

            DECLARE @StartStr NVARCHAR(50) = JSON_VALUE(@VoucherJson, '$.startAt');
            DECLARE @EndStr NVARCHAR(50) = JSON_VALUE(@VoucherJson, '$.endAt');
            DECLARE @NgayBatDau DATETIME2(0) = COALESCE(TRY_CONVERT(DATETIME2(0), @StartStr, 127), TRY_CONVERT(DATETIME2(0), LEFT(@StartStr, 19), 126));
            DECLARE @NgayKetThuc DATETIME2(0) = COALESCE(TRY_CONVERT(DATETIME2(0), @EndStr, 127), TRY_CONVERT(DATETIME2(0), LEFT(@EndStr, 19), 126));

            IF @NgayBatDau IS NOT NULL AND SYSUTCDATETIME() < @NgayBatDau
                RAISERROR(N'Mã ưu đãi chưa đến thời gian áp dụng.', 16, 1);
            IF @NgayKetThuc IS NOT NULL AND SYSUTCDATETIME() > @NgayKetThuc
                RAISERROR(N'Mã ưu đãi đã hết hạn sử dụng.', 16, 1);

            DECLARE @TongLuot INT = ISNULL(TRY_CAST(JSON_VALUE(@VoucherJson, '$.usageLimit') AS INT), 0);
            DECLARE @DaSuDung INT = ISNULL(TRY_CAST(JSON_VALUE(@VoucherJson, '$.usedCount') AS INT), 0);
            IF @TongLuot > 0 AND @DaSuDung >= @TongLuot
                RAISERROR(N'Mã ưu đãi đã hết lượt sử dụng.', 16, 1);

            DECLARE @DonToiThieu DECIMAL(18,2) = ISNULL(TRY_CAST(JSON_VALUE(@VoucherJson, '$.minOrderValue') AS DECIMAL(18,2)), 0);
            IF @DonToiThieu > 0 AND @TongTienGoc < @DonToiThieu
                RAISERROR(N'Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã ưu đãi.', 16, 1);

            DECLARE @PhamVi NVARCHAR(20) = LOWER(ISNULL(JSON_VALUE(@VoucherJson, '$.scopeType'), N'all'));
            IF @PhamVi = N'tours'
            BEGIN
                DECLARE @TourJson NVARCHAR(MAX) = ISNULL(JSON_QUERY(@VoucherJson, '$.scopeTourIds'), N'[]');
                IF NOT EXISTS (
                    SELECT 1 FROM OPENJSON(@TourJson)
                    WHERE UPPER(LTRIM(RTRIM(CAST([value] AS NVARCHAR(50))))) = CAST(@MaTour AS NVARCHAR(20))
                )
                    RAISERROR(N'Mã ưu đãi không áp dụng cho tour này.', 16, 1);
            END;

            IF @PhamVi = N'region'
            BEGIN
                DECLARE @KhuVucJson NVARCHAR(500) = ISNULL(JSON_QUERY(@VoucherJson, '$.scopeRegions'), N'[]');
                DECLARE @RegionKey NVARCHAR(20) = CASE
                    WHEN LOWER(@TenDanhMuc) LIKE N'%trung%' THEN N'central'
                    WHEN LOWER(@TenDanhMuc) LIKE N'%nam%' THEN N'south'
                    ELSE N'north'
                END;
                IF NOT EXISTS (
                    SELECT 1 FROM OPENJSON(@KhuVucJson)
                    WHERE LOWER(LTRIM(RTRIM(CAST([value] AS NVARCHAR(20))))) = @RegionKey
                )
                    RAISERROR(N'Mã ưu đãi không áp dụng cho khu vực tour này.', 16, 1);
            END;

            DECLARE @DoiTuong NVARCHAR(30) = LOWER(ISNULL(JSON_VALUE(@VoucherJson, '$.targetAudience'), N'all'));
            IF @DoiTuong = N'new_customer'
            BEGIN
                IF EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaKhachHang = @MaKhachHang AND TrangThaiDat <> N'Đã hủy')
                    RAISERROR(N'Mã ưu đãi chỉ dành cho khách hàng đặt tour lần đầu.', 16, 1);
            END;

            DECLARE @MoiKhach INT = ISNULL(TRY_CAST(JSON_VALUE(@VoucherJson, '$.perUserLimit') AS INT), 1);
            IF @MoiKhach > 0
            BEGIN
                DECLARE @UserUsed INT = (
                    SELECT COUNT(*)
                    FROM dbo.AUDITLOG
                    WHERE HanhDong = N'VOUCHER_USE'
                      AND UPPER(DuLieuCu) = @NormCode
                      AND ISJSON(DuLieuMoi) = 1
                      AND JSON_VALUE(CASE WHEN ISJSON(DuLieuMoi) = 1 THEN DuLieuMoi END, '$.status') = N'ACTIVE'
                      AND (
                        MaNguoiThucHien = @MaKhachHang
                        OR TRY_CAST(JSON_VALUE(CASE WHEN ISJSON(DuLieuMoi) = 1 THEN DuLieuMoi END, '$.maNguoiDung') AS INT) = @MaKhachHang
                        OR LOWER(ISNULL(JSON_VALUE(CASE WHEN ISJSON(DuLieuMoi) = 1 THEN DuLieuMoi END, '$.email'), N'')) = LOWER(@EmailKhach)
                      )
                );
                IF @UserUsed >= @MoiKhach
                    RAISERROR(N'Bạn đã sử dụng hết số lượt cho phép của mã ưu đãi này.', 16, 1);
            END;

            DECLARE @LoaiGiam NVARCHAR(16) = LOWER(ISNULL(JSON_VALUE(@VoucherJson, '$.discountType'), N'percent'));
            DECLARE @GiaTriGiam DECIMAL(18,2) = ISNULL(TRY_CAST(JSON_VALUE(@VoucherJson, '$.discountValue') AS DECIMAL(18,2)), 0);
            DECLARE @GiamToiDa DECIMAL(18,2) = TRY_CAST(JSON_VALUE(@VoucherJson, '$.maxDiscount') AS DECIMAL(18,2));

            IF @LoaiGiam = N'percent'
            BEGIN
                SET @TienGiam = ROUND(@TongTienGoc * @GiaTriGiam / 100.0, 0);
                IF @GiamToiDa IS NOT NULL AND @GiamToiDa > 0 AND @TienGiam > @GiamToiDa
                    SET @TienGiam = @GiamToiDa;
            END
            ELSE
                SET @TienGiam = @GiaTriGiam;

            IF @TienGiam > @TongTienGoc SET @TienGiam = @TongTienGoc;
            IF @TienGiam < 0 SET @TienGiam = 0;

            UPDATE dbo.AUDITLOG
            SET DuLieuMoi = JSON_MODIFY(
                  JSON_MODIFY(@VoucherJson, '$.usedCount', @DaSuDung + 1),
                  '$.updatedAt',
                  CONVERT(VARCHAR(30), SYSUTCDATETIME(), 127) + 'Z'
                )
            WHERE MaLog = @VoucherLogId
              AND HanhDong = N'VOUCHER_DEF'
              AND ISNULL(TRY_CAST(JSON_VALUE(CASE WHEN ISJSON(DuLieuMoi) = 1 THEN DuLieuMoi END, '$.usedCount') AS INT), 0) = @DaSuDung
              AND (@TongLuot <= 0 OR ISNULL(TRY_CAST(JSON_VALUE(CASE WHEN ISJSON(DuLieuMoi) = 1 THEN DuLieuMoi END, '$.usedCount') AS INT), 0) < @TongLuot);

            IF @@ROWCOUNT <> 1
                RAISERROR(N'Mã ưu đãi đã hết lượt sử dụng.', 16, 1);
        END;

        DECLARE @TongTienSauGiam DECIMAL(18,2) = CASE WHEN @TongTienGoc - @TienGiam < 0 THEN 0 ELSE @TongTienGoc - @TienGiam END;

        INSERT INTO dbo.DATTOUR (
            MaKhachHang, MaChuyen, NgayDat, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan
        )
        VALUES (
            @MaKhachHang, @MaChuyen, GETDATE(), @SoLuongKhach, @TongTienSauGiam, N'Chờ xác nhận', N'Chưa thanh toán'
        );

        SET @MaDatTourMoi = SCOPE_IDENTITY();

        INSERT INTO dbo.CHITIET_HANHKHACH (MaDatTour, HoTen, SoDienThoai)
        VALUES (@MaDatTourMoi, @HoTenTruongDoan, @SoDienThoai);

        IF @VoucherLogId IS NOT NULL
        BEGIN
            DECLARE @NowIso VARCHAR(32) = CONVERT(VARCHAR(30), SYSUTCDATETIME(), 127) + 'Z';
            DECLARE @UseJson NVARCHAR(MAX) = CONCAT(
                N'{"voucherLogId":', @VoucherLogId,
                N',"code":"', STRING_ESCAPE(@NormCode, 'json'),
                N'","maDatTour":', @MaDatTourMoi,
                N',"bookingExternalId":null',
                N',"maNguoiDung":', @MaKhachHang,
                N',"userExternalId":null',
                N',"email":"', STRING_ESCAPE(LOWER(@EmailKhach), 'json'),
                N'","phone":"', STRING_ESCAPE(ISNULL(@SoDienThoai, ''), 'json'),
                N'","subtotal":', CAST(@TongTienGoc AS DECIMAL(18,0)),
                N',"discountAmount":', CAST(@TienGiam AS DECIMAL(18,0)),
                N',"bookingTotal":', CAST(@TongTienSauGiam AS DECIMAL(18,0)),
                N',"status":"ACTIVE"',
                N',"createdAt":"', @NowIso, N'"}'
            );

            INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
            VALUES (@MaKhachHang, N'VOUCHER_USE', @NormCode, @UseJson, GETDATE());
        END;

        IF @StartedTran = 1
            COMMIT TRANSACTION;

        SELECT
            @MaDatTourMoi AS MaDatTour,
            N'Đặt tour thành công, đã giữ chỗ tạm thời.' AS ThongBao,
            @TongTienGoc AS TienGocTruocGiam,
            @TienGiam AS TienGiam,
            @TongTienSauGiam AS TongTienThanhToan;
        RETURN 0;
    END TRY
    BEGIN CATCH
        IF @StartedTran = 1
        BEGIN
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        END
        ELSE IF XACT_STATE() = 1
        BEGIN
            ROLLBACK TRANSACTION sp_TaoDonDatTour_Save;
        END;
        DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@Err, 16, 1);
        RETURN -1;
    END CATCH;
END;
GO

-- 3. Seed 5 mã ưu đãi ban đầu ngay trong bảng dbo.AUDITLOG (chỉ thêm khi chưa có VOUCHER_DEF)
IF NOT EXISTS (SELECT 1 FROM dbo.AUDITLOG WHERE HanhDong = N'VOUCHER_DEF')
BEGIN
  DECLARE @StartIso VARCHAR(32) = CONVERT(VARCHAR(30), DATEADD(day, -7, SYSUTCDATETIME()), 127) + 'Z';
  DECLARE @EndIso   VARCHAR(32) = CONVERT(VARCHAR(30), DATEADD(day, 180, SYSUTCDATETIME()), 127) + 'Z';
  DECLARE @NowSeed  VARCHAR(32) = CONVERT(VARCHAR(30), SYSUTCDATETIME(), 127) + 'Z';

  INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
  VALUES
  (NULL, N'VOUCHER_DEF', N'DELTA10',
   CONCAT(N'{"code":"DELTA10","name":"Ưu đãi khám phá Miền Bắc","description":"Giảm 10% (tối đa 1.000.000đ) cho tour Miền Bắc đơn từ 2.000.000đ","discountType":"percent","discountValue":10,"maxDiscount":1000000,"minOrderValue":2000000,"scopeType":"region","scopeRegions":["north"],"scopeTourIds":[],"startAt":"', @StartIso, N'","endAt":"', @EndIso, N'","usageLimit":100,"usedCount":0,"perUserLimit":1,"targetAudience":"all","active":true,"createdAt":"', @NowSeed, N'","updatedAt":"', @NowSeed, N'"}'),
   GETDATE()),
  (NULL, N'VOUCHER_DEF', N'HE2026',
   CONCAT(N'{"code":"HE2026","name":"Chào hè biển đảo Miền Trung & Nam","description":"Giảm trực tiếp 500.000đ cho các tour Đà Nẵng, Phú Quốc, Nha Trang, Quy Nhơn, Côn Đảo đơn từ 3.000.000đ","discountType":"fixed","discountValue":500000,"maxDiscount":null,"minOrderValue":3000000,"scopeType":"tours","scopeRegions":[],"scopeTourIds":["2","3","DL-DN02","DL-PQ03","DL-NT12","DL-QN13","DL-CD16"],"startAt":"', @StartIso, N'","endAt":"', @EndIso, N'","usageLimit":50,"usedCount":0,"perUserLimit":1,"targetAudience":"all","active":true,"createdAt":"', @NowSeed, N'","updatedAt":"', @NowSeed, N'"}'),
   GETDATE()),
  (NULL, N'VOUCHER_DEF', N'VIPTOUR',
   CONCAT(N'{"code":"VIPTOUR","name":"Đặc quyền thành viên đăng nhập","description":"Giảm 15% (tối đa 1.500.000đ) cho thành viên đăng nhập đơn từ 5.000.000đ","discountType":"percent","discountValue":15,"maxDiscount":1500000,"minOrderValue":5000000,"scopeType":"all","scopeRegions":[],"scopeTourIds":[],"startAt":"', @StartIso, N'","endAt":"', @EndIso, N'","usageLimit":30,"usedCount":0,"perUserLimit":1,"targetAudience":"logged_in","active":true,"createdAt":"', @NowSeed, N'","updatedAt":"', @NowSeed, N'"}'),
   GETDATE()),
  (NULL, N'VOUCHER_DEF', N'BANMOI',
   CONCAT(N'{"code":"BANMOI","name":"Quà tặng khách hàng mới","description":"Giảm 200.000đ cho khách hàng đặt tour lần đầu đơn từ 1.500.000đ","discountType":"fixed","discountValue":200000,"maxDiscount":null,"minOrderValue":1500000,"scopeType":"all","scopeRegions":[],"scopeTourIds":[],"startAt":"', @StartIso, N'","endAt":"', @EndIso, N'","usageLimit":100,"usedCount":0,"perUserLimit":1,"targetAudience":"new_customer","active":true,"createdAt":"', @NowSeed, N'","updatedAt":"', @NowSeed, N'"}'),
   GETDATE()),
  (NULL, N'VOUCHER_DEF', N'HALONG100K',
   CONCAT(N'{"code":"HALONG100K","name":"Ưu đãi Du Thuyền Hạ Long","description":"Giảm ngay 100.000đ riêng cho tour Vịnh Hạ Long (DL-HL01) đơn từ 1.000.000đ","discountType":"fixed","discountValue":100000,"maxDiscount":null,"minOrderValue":1000000,"scopeType":"tours","scopeRegions":[],"scopeTourIds":["1","DL-HL01"],"startAt":"', @StartIso, N'","endAt":"', @EndIso, N'","usageLimit":50,"usedCount":0,"perUserLimit":2,"targetAudience":"all","active":true,"createdAt":"', @NowSeed, N'","updatedAt":"', @NowSeed, N'"}'),
   GETDATE());
END;
GO
