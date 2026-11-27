-- ==========================================================================================
-- MIGRATION 004: CẬP NHẬT ĐỒNG BỘ TOÀN DIỆN CSDL LÊN 16 BẢNG (CHUẨN HÓA 3NF & SRS)
-- Áp dụng cho: Microsoft SQL Server (Hỗ trợ cả TourDuLichDB nội bộ và db_ad0b71_dattour trên hosting SmarterASP.NET)
-- Đặc điểm: AN TOÀN TUYỆT ĐỐI (NON-DESTRUCTIVE) - KHÔNG DROP DATABASE, KHÔNG MẤT DỮ LIỆU HIỆN CÓ
-- ==========================================================================================

SET NOCOUNT ON;
GO

PRINT N'======================================================================';
PRINT N'BẮT ĐẦU CẬP NHẬT CSDL SQL SERVER (MIGRATION 004 - 16 BẢNG CHUẨN 3NF)...';
PRINT N'======================================================================';
GO

-- ------------------------------------------------------------------------------------------
-- 1. BỔ SUNG CỘT CHO BẢNG NGUOIDUNG (Cột VaiTro phục vụ phân quyền)
-- ------------------------------------------------------------------------------------------
IF COL_LENGTH('dbo.NGUOIDUNG', 'VaiTro') IS NULL
BEGIN
    PRINT N'--> Đang thêm cột VaiTro vào bảng dbo.NGUOIDUNG...';
    ALTER TABLE dbo.NGUOIDUNG ADD VaiTro NVARCHAR(20) NOT NULL CONSTRAINT DF_NGUOIDUNG_VaiTro DEFAULT (N'KhachHang');
END
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_NGUOIDUNG_VaiTro')
BEGIN
    ALTER TABLE dbo.NGUOIDUNG DROP CONSTRAINT CK_NGUOIDUNG_VaiTro;
END
GO

ALTER TABLE dbo.NGUOIDUNG ADD CONSTRAINT CK_NGUOIDUNG_VaiTro CHECK (VaiTro IN (N'Admin', N'NhanVien', N'KhachHang', N'CUSTOMER', N'ADMIN', N'STAFF'));
PRINT N'--> Đã cập nhật ràng buộc CK_NGUOIDUNG_VaiTro.';
GO

-- ------------------------------------------------------------------------------------------
-- 2. BỔ SUNG CỘT CHO BẢNG CHUYENKHOIHANH (Cột SoChoGiuCho phục vụ khóa giữ chỗ 15 phút)
-- ------------------------------------------------------------------------------------------
IF COL_LENGTH('dbo.CHUYENKHOIHANH', 'SoChoGiuCho') IS NULL
BEGIN
    PRINT N'--> Đang thêm cột SoChoGiuCho vào bảng dbo.CHUYENKHOIHANH...';
    ALTER TABLE dbo.CHUYENKHOIHANH ADD SoChoGiuCho INT NOT NULL CONSTRAINT DF_CHUYEN_SoChoGiuCho DEFAULT (0);
END
GO

-- Cập nhật ràng buộc kiểm tra số chỗ hợp lệ
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CHUYEN_SoChoHopLe')
BEGIN
    ALTER TABLE dbo.CHUYENKHOIHANH DROP CONSTRAINT CK_CHUYEN_SoChoHopLe;
END
GO
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_SoChoHopLe 
    CHECK (SoChoToiDa > 0 AND SoChoDaDat >= 0 AND SoChoGiuCho >= 0 AND (SoChoDaDat + SoChoGiuCho) <= SoChoToiDa);
GO
PRINT N'--> Đã cập nhật ràng buộc CK_CHUYEN_SoChoHopLe (hỗ trợ SoChoGiuCho).';
GO

-- ------------------------------------------------------------------------------------------
-- 3. BỔ SUNG CỘT CHO BẢNG DATTOUR (Cột ThoiHanGiuCho)
-- ------------------------------------------------------------------------------------------
IF COL_LENGTH('dbo.DATTOUR', 'ThoiHanGiuCho') IS NULL
BEGIN
    PRINT N'--> Đang thêm cột ThoiHanGiuCho vào bảng dbo.DATTOUR...';
    ALTER TABLE dbo.DATTOUR ADD ThoiHanGiuCho DATETIME NULL;
END
GO

-- ------------------------------------------------------------------------------------------
-- 4. BỔ SUNG CỘT CHO BẢNG THANHTOAN (Phân biệt Loại giao dịch Thu tiền / Hoàn tiền)
-- ------------------------------------------------------------------------------------------
IF COL_LENGTH('dbo.THANHTOAN', 'LoaiGiaoDich') IS NULL
BEGIN
    PRINT N'--> Đang thêm cột LoaiGiaoDich vào bảng dbo.THANHTOAN...';
    ALTER TABLE dbo.THANHTOAN ADD LoaiGiaoDich NVARCHAR(50) NOT NULL CONSTRAINT DF_THANHTOAN_LoaiGiaoDich DEFAULT (N'Thanh toán');
END
GO

IF COL_LENGTH('dbo.THANHTOAN', 'GhiChu') IS NULL
BEGIN
    PRINT N'--> Đang thêm cột GhiChu vào bảng dbo.THANHTOAN...';
    ALTER TABLE dbo.THANHTOAN ADD GhiChu NVARCHAR(500) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_THANHTOAN_LoaiGiaoDich')
BEGIN
    ALTER TABLE dbo.THANHTOAN ADD CONSTRAINT CK_THANHTOAN_LoaiGiaoDich CHECK (LoaiGiaoDich IN (N'Thanh toán', N'Hoàn tiền', N'Phụ thu'));
    PRINT N'--> Đã tạo ràng buộc CK_THANHTOAN_LoaiGiaoDich.';
END
GO

-- ------------------------------------------------------------------------------------------
-- 5. TẠO 4 BẢNG MỚI ĐÁP ỨNG ĐẶC TẢ SRS (UC-10, UC-07, UC-04, UC-15)
-- ------------------------------------------------------------------------------------------

-- 13. BẢNG YEUCAU_HOANTIEN_DOILICH (UC-10)
IF OBJECT_ID(N'dbo.YEUCAU_HOANTIEN_DOILICH', N'U') IS NULL
BEGIN
    PRINT N'--> Đang tạo bảng dbo.YEUCAU_HOANTIEN_DOILICH...';
    CREATE TABLE dbo.YEUCAU_HOANTIEN_DOILICH (
        MaYeuCau         INT IDENTITY(1,1) NOT NULL,
        MaDatTour        INT               NOT NULL,
        MaKhachHang      INT               NOT NULL,
        LoaiYeuCau       NVARCHAR(50)      NOT NULL,
        LyDo             NVARCHAR(1000)    NOT NULL,
        SoTienYeuCauHoan DECIMAL(18,2)     NULL,
        ThongTinNganHang NVARCHAR(255)     NULL,
        TrangThai        NVARCHAR(50)      NOT NULL CONSTRAINT DF_YEUCAU_TrangThai DEFAULT (N'Chờ xử lý'),
        PhanHoiAdmin     NVARCHAR(1000)    NULL,
        NgayTao          DATETIME          NOT NULL CONSTRAINT DF_YEUCAU_NgayTao DEFAULT (GETDATE()),
        NgayXuLy         DATETIME          NULL,
        NguoiXuLy        INT               NULL,
        
        CONSTRAINT PK_YEUCAU_HOANTIEN_DOILICH PRIMARY KEY CLUSTERED (MaYeuCau ASC),
        CONSTRAINT FK_YEUCAU_DATTOUR FOREIGN KEY (MaDatTour) REFERENCES dbo.DATTOUR(MaDatTour),
        CONSTRAINT FK_YEUCAU_KHACHHANG FOREIGN KEY (MaKhachHang) REFERENCES dbo.NGUOIDUNG(MaNguoiDung),
        CONSTRAINT FK_YEUCAU_NGUOIXULY FOREIGN KEY (NguoiXuLy) REFERENCES dbo.NGUOIDUNG(MaNguoiDung),
        CONSTRAINT CK_YEUCAU_LoaiYeuCau CHECK (LoaiYeuCau IN (N'Hủy tour hoàn tiền', N'Đổi lịch khởi hành', N'Đổi thông tin hành khách')),
        CONSTRAINT CK_YEUCAU_TrangThai CHECK (TrangThai IN (N'Chờ xử lý', N'Đã duyệt', N'Từ chối'))
    );
    CREATE NONCLUSTERED INDEX IX_YEUCAU_MaDatTour_TrangThai ON dbo.YEUCAU_HOANTIEN_DOILICH (MaDatTour ASC, TrangThai ASC);
END
GO

-- 14. BẢNG TOUR_YEUTHICH (UC-07)
IF OBJECT_ID(N'dbo.TOUR_YEUTHICH', N'U') IS NULL
BEGIN
    PRINT N'--> Đang tạo bảng dbo.TOUR_YEUTHICH...';
    CREATE TABLE dbo.TOUR_YEUTHICH (
        MaYeuThich  INT IDENTITY(1,1) NOT NULL,
        MaNguoiDung INT               NOT NULL,
        MaTour      INT               NOT NULL,
        NgayLuu     DATETIME          NOT NULL CONSTRAINT DF_YEUTHICH_NgayLuu DEFAULT (GETDATE()),
        
        CONSTRAINT PK_TOUR_YEUTHICH PRIMARY KEY CLUSTERED (MaYeuThich ASC),
        CONSTRAINT UQ_TOUR_YEUTHICH UNIQUE NONCLUSTERED (MaNguoiDung ASC, MaTour ASC),
        CONSTRAINT FK_YEUTHICH_NGUOIDUNG FOREIGN KEY (MaNguoiDung) REFERENCES dbo.NGUOIDUNG(MaNguoiDung),
        CONSTRAINT FK_YEUTHICH_TOUR FOREIGN KEY (MaTour) REFERENCES dbo.TOUR(MaTour)
    );
    CREATE NONCLUSTERED INDEX IX_TOUR_YEUTHICH_MaNguoiDung ON dbo.TOUR_YEUTHICH (MaNguoiDung ASC) INCLUDE (MaTour, NgayLuu);
END
GO

-- 15. BẢNG LIENHE_TUVAN (UC-04)
IF OBJECT_ID(N'dbo.LIENHE_TUVAN', N'U') IS NULL
BEGIN
    PRINT N'--> Đang tạo bảng dbo.LIENHE_TUVAN...';
    CREATE TABLE dbo.LIENHE_TUVAN (
        MaLienHe     INT IDENTITY(1,1) NOT NULL,
        HoTen        NVARCHAR(100)     NOT NULL,
        Email        VARCHAR(100)      NULL,
        SoDienThoai  VARCHAR(15)       NOT NULL,
        MaTour       INT               NULL,
        NoiDung      NVARCHAR(1000)    NOT NULL,
        TrangThai    NVARCHAR(50)      NOT NULL CONSTRAINT DF_LIENHE_TrangThai DEFAULT (N'Chưa xử lý'),
        GhiChuAdmin  NVARCHAR(500)     NULL,
        NgayGui      DATETIME          NOT NULL CONSTRAINT DF_LIENHE_NgayGui DEFAULT (GETDATE()),
        NguoiXuLy    INT               NULL,
        
        CONSTRAINT PK_LIENHE_TUVAN PRIMARY KEY CLUSTERED (MaLienHe ASC),
        CONSTRAINT FK_LIENHE_TOUR FOREIGN KEY (MaTour) REFERENCES dbo.TOUR(MaTour),
        CONSTRAINT FK_LIENHE_NGUOIXULY FOREIGN KEY (NguoiXuLy) REFERENCES dbo.NGUOIDUNG(MaNguoiDung),
        CONSTRAINT CK_LIENHE_TrangThai CHECK (TrangThai IN (N'Chưa xử lý', N'Đã liên hệ', N'Đã hủy'))
    );
    CREATE NONCLUSTERED INDEX IX_LIENHE_TUVAN_TrangThai_NgayGui ON dbo.LIENHE_TUVAN (TrangThai ASC, NgayGui DESC);
END
GO

-- 16. BẢNG BANNER_QUANGCAO (UC-15)
IF OBJECT_ID(N'dbo.BANNER_QUANGCAO', N'U') IS NULL
BEGIN
    PRINT N'--> Đang tạo bảng dbo.BANNER_QUANGCAO...';
    CREATE TABLE dbo.BANNER_QUANGCAO (
        MaBanner      INT IDENTITY(1,1) NOT NULL,
        TieuDe        NVARCHAR(200)     NOT NULL,
        HinhAnh       VARCHAR(255)      NOT NULL,
        LienKet       VARCHAR(255)      NULL,
        ViTri         NVARCHAR(50)      NOT NULL CONSTRAINT DF_BANNER_ViTri DEFAULT (N'TrangChu_Hero'),
        ThuTuHienThi  INT               NOT NULL CONSTRAINT DF_BANNER_ThuTu DEFAULT (1),
        TrangThai     BIT               NOT NULL CONSTRAINT DF_BANNER_TrangThai DEFAULT (1),
        NgayBatDau    DATETIME          NULL,
        NgayKetThuc   DATETIME          NULL,
        NgayTao       DATETIME          NOT NULL CONSTRAINT DF_BANNER_NgayTao DEFAULT (GETDATE()),
        MaNguoiTao    INT               NOT NULL,
        
        CONSTRAINT PK_BANNER_QUANGCAO PRIMARY KEY CLUSTERED (MaBanner ASC),
        CONSTRAINT FK_BANNER_NGUOITAO FOREIGN KEY (MaNguoiTao) REFERENCES dbo.NGUOIDUNG(MaNguoiDung),
        CONSTRAINT CK_BANNER_ViTri CHECK (ViTri IN (N'TrangChu_Hero', N'TrangChu_GiuaTrang', N'Sidebar'))
    );
    CREATE NONCLUSTERED INDEX IX_BANNER_QUANGCAO_ViTri_TrangThai ON dbo.BANNER_QUANGCAO (ViTri ASC, TrangThai ASC) INCLUDE (ThuTuHienThi);
END
GO

-- ------------------------------------------------------------------------------------------
-- 6. CẬP NHẬT TRIGGERS KIỂM SOÁT GIỮ CHỖ VÀ DANH SÁCH HÀNH KHÁCH
-- ------------------------------------------------------------------------------------------
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
PRINT N'--> Đã cập nhật Trigger TRG_CHITIET_HANHKHACH_KiemTraSoLuong.';
GO

-- ------------------------------------------------------------------------------------------
-- 7. CẬP NHẬT VIEW HIỂN THỊ CHỖ TRỐNG VÀ FUNCTION TÍNH CHỖ TRỐNG
-- ------------------------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.fn_TinhSoChoConLai', N'FN') IS NOT NULL
    DROP FUNCTION dbo.fn_TinhSoChoConLai;
GO
CREATE FUNCTION dbo.fn_TinhSoChoConLai (@MaChuyen INT)
RETURNS INT
AS
BEGIN
    DECLARE @SoChoConLai INT = 0;
    SELECT @SoChoConLai = (SoChoToiDa - SoChoDaDat - ISNULL(SoChoGiuCho, 0))
    FROM dbo.CHUYENKHOIHANH
    WHERE MaChuyen = @MaChuyen;
    RETURN ISNULL(@SoChoConLai, 0);
END;
GO
PRINT N'--> Đã cập nhật hàm fn_TinhSoChoConLai.';
GO

-- ------------------------------------------------------------------------------------------
-- 8. NẠP DỮ LIỆU MẪU BAN ĐẦU CHO 4 BẢNG MỚI (NẾU CHƯA CÓ)
-- ------------------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.BANNER_QUANGCAO)
BEGIN
    DECLARE @AdminId INT = (SELECT TOP 1 MaNguoiDung FROM dbo.NGUOIDUNG ORDER BY MaNguoiDung);
    IF @AdminId IS NOT NULL
    BEGIN
        INSERT INTO dbo.BANNER_QUANGCAO (TieuDe, HinhAnh, LienKet, ViTri, ThuTuHienThi, TrangThai, NgayBatDau, NgayKetThuc, NgayTao, MaNguoiTao)
        VALUES 
        (N'Khám Phá Hàn Quốc Mùa Thu - Giảm Ngay 1.000.000đ', '/images/banners/banner-korea-autumn.jpg', '/tours/han-quoc-seoul-nami', N'TrangChu_Hero', 1, 1, '2026-09-01', '2026-12-31', GETDATE(), @AdminId),
        (N'Mùa Lúa Chín Sa Pa - Trọn Gói 3N2Đ Chỉ Từ 3.850.000đ', '/images/banners/banner-sapa-harvest.jpg', '/tours/sapa-fansipan-catcat', N'TrangChu_Hero', 2, 1, '2026-09-15', '2026-11-30', GETDATE(), @AdminId),
        (N'Ưu Đãi Đặt Tour Sớm - Đón Mùa Lễ Hội 2027', '/images/banners/banner-promotion-earlybird.jpg', '/promotions/early-bird-2027', N'TrangChu_GiuaTrang', 1, 1, '2026-10-01', '2027-01-15', GETDATE(), @AdminId);
        PRINT N'--> Đã nạp 3 banner quảng cáo mẫu.';
    END
END
GO

PRINT N'======================================================================';
PRINT N'🎉 HOÀN THÀNH: ĐÃ CẬP NHẬT THÀNH CÔNG 100% CSDL LÊN 16 BẢNG CHUẨN 3NF!';
PRINT N'======================================================================';
GO
