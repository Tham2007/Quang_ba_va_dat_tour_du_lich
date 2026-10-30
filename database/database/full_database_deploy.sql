-- LEGACY / DESTRUCTIVE: SQL Server only. Drops and recreates TourDuLichDB.
-- Do not run against production or the PostgreSQL database used by API/api.
-- ==========================================================================================
-- ==========================================================================================
--              HỆ THỐNG CƠ SỞ DỮ LIỆU MICROSOFT SQL SERVER HOÀN CHỈNH
--            ĐỀ TÀI: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
--              CHUẨN HÓA 3NF (12 BẢNG) - SCRIPT DEPLOY DUY NHẤT (ALL-IN-ONE)
-- ==========================================================================================
-- ==========================================================================================
-- Tác giả: Senior Database Architect / DBA
-- Ngày hoàn thành: 2026
-- Mô tả: File script tổng hợp chạy từ đầu đến cuối (F5 trong SSMS) tạo trọn vẹn:
--   1. Database TourDuLichDB cấu hình tối ưu hiệu năng cao
--   2. Cấu trúc 12 bảng chuẩn 3NF (Lưu ý: NGUOIDUNG không có thuộc tính VaiTro)
--   3. Toàn bộ Khóa chính, Khóa ngoại (Xử lý triệt để tránh Multiple Cascade Paths)
--   4. Ràng buộc Check Constraints & Defaults toàn vẹn
--   5. Hệ thống Indexes Non-Clustered & Covering Indexes
--   6. Triggers tự động khóa chỗ, chống Overbooking, hoàn chỗ khi hủy tour, kiểm tra đánh giá
--   7. Stored Procedures nghiệp vụ đặt tour an toàn (ACID Transaction) và Thống kê Doanh thu
--   8. Views hiển thị Web, Dashboard Admin và Function tính chỗ trống
--   9. Dữ liệu mẫu thực tế, phong phú (Tour Hàn Quốc, Đà Nẵng, Phú Quốc, Sa Pa...)
-- ==========================================================================================

USE master;
GO

-- ==========================================================================================
-- PHẦN 1: KHỞI TẠO CƠ SỞ DỮ LIỆU (DATABASE INITIALIZATION)
-- ==========================================================================================
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'TourDuLichDB')
BEGIN
    PRINT N'==> Phát hiện CSDL TourDuLichDB cũ, đang tiến hành đóng kết nối và xóa...';
    ALTER DATABASE TourDuLichDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE TourDuLichDB;
    PRINT N'==> Đã xóa CSDL cũ thành công.';
END
GO

PRINT N'==> Đang khởi tạo CSDL TourDuLichDB mới...';
CREATE DATABASE TourDuLichDB
COLLATE Vietnamese_CI_AS;
GO

ALTER DATABASE TourDuLichDB SET COMPATIBILITY_LEVEL = 150;
ALTER DATABASE TourDuLichDB SET AUTO_UPDATE_STATISTICS ON;
ALTER DATABASE TourDuLichDB SET ALLOW_SNAPSHOT_ISOLATION ON;
ALTER DATABASE TourDuLichDB SET READ_COMMITTED_SNAPSHOT ON;
GO

USE TourDuLichDB;
GO

-- ==========================================================================================
-- PHẦN 2: TẠO 12 BẢNG CỐT LÕI ĐẠT CHUẨN 3NF (SCHEMA CREATION)
-- ==========================================================================================
PRINT N'==> Đang tạo cấu trúc 12 bảng chuẩn 3NF...';

-- 1. BẢNG NGUOIDUNG (Tài khoản người dùng - Lưu ý: Không có thuộc tính VaiTro)
CREATE TABLE dbo.NGUOIDUNG (
    MaNguoiDung INT IDENTITY(1,1) NOT NULL,
    HoTen       NVARCHAR(100)     NOT NULL,
    Email       VARCHAR(100)      NOT NULL,
    SoDienThoai VARCHAR(15)       NOT NULL,
    MatKhau     VARCHAR(255)      NOT NULL,
    DiaChi      NVARCHAR(200)     NULL,
    TrangThai   BIT               NOT NULL CONSTRAINT DF_NGUOIDUNG_TrangThai DEFAULT (1),
    NgayTao     DATETIME          NOT NULL CONSTRAINT DF_NGUOIDUNG_NgayTao DEFAULT (GETDATE()),
    
    CONSTRAINT PK_NGUOIDUNG PRIMARY KEY CLUSTERED (MaNguoiDung ASC),
    CONSTRAINT UQ_NGUOIDUNG_Email UNIQUE NONCLUSTERED (Email ASC)
);
GO

-- 2. BẢNG DANHMUC (Danh mục / Điểm đến du lịch)
CREATE TABLE dbo.DANHMUC (
    MaDanhMuc   INT IDENTITY(1,1) NOT NULL,
    TenDanhMuc  NVARCHAR(100)     NOT NULL,
    MoTa        NVARCHAR(MAX)     NULL,
    
    CONSTRAINT PK_DANHMUC PRIMARY KEY CLUSTERED (MaDanhMuc ASC),
    CONSTRAINT UQ_DANHMUC_TenDanhMuc UNIQUE NONCLUSTERED (TenDanhMuc ASC)
);
GO

-- 3. BẢNG TOUR (Thông tin tổng quan Tour du lịch)
CREATE TABLE dbo.TOUR (
    MaTour            INT IDENTITY(1,1) NOT NULL,
    MaDanhMuc         INT               NOT NULL,
    TenTour           NVARCHAR(200)     NOT NULL,
    MoTaChiTiet       NVARCHAR(MAX)     NULL,
    LichTrinhTongQuan NVARCHAR(500)     NULL,
    GiaKhuyenNghi     DECIMAL(18,2)     NOT NULL,
    HinhAnhDaiDien    VARCHAR(255)      NULL,
    TrangThai         BIT               NOT NULL CONSTRAINT DF_TOUR_TrangThai DEFAULT (1),
    
    CONSTRAINT PK_TOUR PRIMARY KEY CLUSTERED (MaTour ASC)
);
GO

-- 4. BẢNG HINHANH_TOUR (Bộ sưu tập hình ảnh Gallery của Tour)
CREATE TABLE dbo.HINHANH_TOUR (
    MaHinhAnh   INT IDENTITY(1,1) NOT NULL,
    MaTour      INT               NOT NULL,
    DuongDanAnh VARCHAR(255)      NOT NULL,
    GhiChu      NVARCHAR(200)     NULL,
    
    CONSTRAINT PK_HINHANH_TOUR PRIMARY KEY CLUSTERED (MaHinhAnh ASC)
);
GO

-- 5. BẢNG LICH_TRINH_DETAIL (Lịch trình chi tiết từng ngày của Tour)
CREATE TABLE dbo.LICH_TRINH_DETAIL (
    MaLichTrinh   INT IDENTITY(1,1) NOT NULL,
    MaTour        INT               NOT NULL,
    NgayThu       INT               NOT NULL,
    TieuDeNgay    NVARCHAR(200)     NOT NULL,
    NoiDungChiTiet NVARCHAR(MAX)    NOT NULL,
    BuaAn         NVARCHAR(100)     NULL,
    
    CONSTRAINT PK_LICH_TRINH_DETAIL PRIMARY KEY CLUSTERED (MaLichTrinh ASC)
);
GO

-- 6. BẢNG CHUYENKHOIHANH (Lịch khởi hành cụ thể của từng Tour)
CREATE TABLE dbo.CHUYENKHOIHANH (
    MaChuyen        INT IDENTITY(1,1) NOT NULL,
    MaTour          INT               NOT NULL,
    NgayKhoiHanh    DATETIME          NOT NULL,
    NgayKetThuc     DATETIME          NOT NULL,
    GiaThucTe       DECIMAL(18,2)     NOT NULL,
    SoChoToiDa      INT               NOT NULL,
    SoChoDaDat      INT               NOT NULL CONSTRAINT DF_CHUYEN_SoChoDaDat DEFAULT (0),
    TrangThaiChuyen NVARCHAR(50)      NOT NULL CONSTRAINT DF_CHUYEN_TrangThaiChuyen DEFAULT (N'Mở bán'),
    
    CONSTRAINT PK_CHUYENKHOIHANH PRIMARY KEY CLUSTERED (MaChuyen ASC)
);
GO

-- 7. BẢNG DATTOUR (Đơn đặt tour du lịch)
CREATE TABLE dbo.DATTOUR (
    MaDatTour          INT IDENTITY(1,1) NOT NULL,
    MaKhachHang        INT               NOT NULL,
    MaChuyen           INT               NOT NULL,
    NgayDat            DATETIME          NOT NULL CONSTRAINT DF_DATTOUR_NgayDat DEFAULT (GETDATE()),
    SoLuongKhach       INT               NOT NULL,
    TongTien           DECIMAL(18,2)     NOT NULL,
    TrangThaiDat       NVARCHAR(50)      NOT NULL CONSTRAINT DF_DATTOUR_TrangThaiDat DEFAULT (N'Chờ xác nhận'),
    TrangThaiThanhToan NVARCHAR(50)      NOT NULL CONSTRAINT DF_DATTOUR_TrangThaiThanhToan DEFAULT (N'Chưa thanh toán'),
    
    CONSTRAINT PK_DATTOUR PRIMARY KEY CLUSTERED (MaDatTour ASC)
);
GO

-- 8. BẢNG CHITIET_HANHKHACH (Danh sách hành khách đi cùng trong đơn)
CREATE TABLE dbo.CHITIET_HANHKHACH (
    MaHanhKhach INT IDENTITY(1,1) NOT NULL,
    MaDatTour   INT               NOT NULL,
    HoTen       NVARCHAR(100)     NOT NULL,
    NgaySinh    DATE              NULL,
    GioiTinh    NVARCHAR(10)      NULL,
    SoDienThoai VARCHAR(15)       NULL,
    
    CONSTRAINT PK_CHITIET_HANHKHACH PRIMARY KEY CLUSTERED (MaHanhKhach ASC)
);
GO

-- 9. BẢNG THANHTOAN (Lịch sử giao dịch thanh toán)
CREATE TABLE dbo.THANHTOAN (
    MaThanhToan   INT IDENTITY(1,1) NOT NULL,
    MaDatTour     INT               NOT NULL,
    PhuongThuc    NVARCHAR(50)      NOT NULL,
    SoTien        DECIMAL(18,2)     NOT NULL,
    NgayThanhToan DATETIME          NOT NULL CONSTRAINT DF_THANHTOAN_NgayThanhToan DEFAULT (GETDATE()),
    MaGiaoDich    VARCHAR(100)      NULL,
    TrangThai     NVARCHAR(50)      NOT NULL CONSTRAINT DF_THANHTOAN_TrangThai DEFAULT (N'Thành công'),
    
    CONSTRAINT PK_THANHTOAN PRIMARY KEY CLUSTERED (MaThanhToan ASC)
);
GO

-- 10. BẢNG DANHGIA (Đánh giá & Nhận xét của đơn tour - Mỗi đơn hoàn thành chỉ đánh giá 1 lần)
CREATE TABLE dbo.DANHGIA (
    MaDanhGia       INT IDENTITY(1,1) NOT NULL,
    MaDatTour       INT               NOT NULL,
    SoSao           TINYINT           NOT NULL CONSTRAINT DF_DANHGIA_SoSao DEFAULT (5),
    NoiDung         NVARCHAR(1000)    NULL,
    HinhAnh         NVARCHAR(500)     NULL,
    NgayDanhGia     DATETIME          NOT NULL CONSTRAINT DF_DANHGIA_NgayDanhGia DEFAULT (GETDATE()),
    TrangThaiHienThi BIT              NOT NULL CONSTRAINT DF_DANHGIA_TrangThaiHienThi DEFAULT (1),
    PhanHoiAdmin    NVARCHAR(1000)    NULL,
    
    CONSTRAINT PK_DANHGIA PRIMARY KEY CLUSTERED (MaDanhGia ASC),
    CONSTRAINT UQ_DANHGIA_MaDatTour UNIQUE NONCLUSTERED (MaDatTour ASC)
);
GO

-- 11. BẢNG BAIVIET_QUANGBA (Bài viết truyền thông du lịch & SEO)
CREATE TABLE dbo.BAIVIET_QUANGBA (
    MaBaiViet      INT IDENTITY(1,1) NOT NULL,
    TieuDe         NVARCHAR(255)     NOT NULL,
    Slug           VARCHAR(255)      NULL,
    TomTat         NVARCHAR(500)     NULL,
    NoiDung        NVARCHAR(MAX)     NOT NULL,
    HinhAnhDaiDien VARCHAR(255)      NULL,
    LuotXem        INT               NOT NULL CONSTRAINT DF_BAIVIET_LuotXem DEFAULT (0),
    NgayTao        DATETIME          NOT NULL CONSTRAINT DF_BAIVIET_NgayTao DEFAULT (GETDATE()),
    TrangThai      BIT               NOT NULL CONSTRAINT DF_BAIVIET_TrangThai DEFAULT (1),
    MaNguoiDang    INT               NOT NULL,
    
    CONSTRAINT PK_BAIVIET_QUANGBA PRIMARY KEY CLUSTERED (MaBaiViet ASC),
    CONSTRAINT UQ_BAIVIET_Slug UNIQUE NONCLUSTERED (Slug ASC)
);
GO

-- 12. BẢNG AUDITLOG (Nhật ký theo dõi thao tác hệ thống & An ninh)
CREATE TABLE dbo.AUDITLOG (
    MaLog           INT IDENTITY(1,1) NOT NULL,
    MaNguoiThucHien INT               NULL,
    HanhDong        NVARCHAR(100)     NOT NULL,
    DuLieuCu        NVARCHAR(MAX)     NULL,
    DuLieuMoi       NVARCHAR(MAX)     NULL,
    ThoiGian        DATETIME          NOT NULL CONSTRAINT DF_AUDITLOG_ThoiGian DEFAULT (GETDATE()),
    
    CONSTRAINT PK_AUDITLOG PRIMARY KEY CLUSTERED (MaLog ASC)
);
GO

PRINT N'==> Tạo xong cấu trúc 12 bảng chuẩn 3NF.';
GO

-- ==========================================================================================
-- PHẦN 3: THIẾT LẬP KHÓA NGOẠI (FOREIGN KEYS) & CHECK CONSTRAINTS
-- Xử lý triệt để không bị lỗi Multiple Cascade Paths trong SQL Server
-- ==========================================================================================
PRINT N'==> Đang thiết lập các ràng buộc Khóa ngoại và Check Constraints...';

-- Khóa ngoại
ALTER TABLE dbo.TOUR WITH CHECK ADD CONSTRAINT FK_TOUR_DANHMUC 
FOREIGN KEY (MaDanhMuc) REFERENCES dbo.DANHMUC (MaDanhMuc) ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE dbo.HINHANH_TOUR WITH CHECK ADD CONSTRAINT FK_HINHANHTOUR_TOUR 
FOREIGN KEY (MaTour) REFERENCES dbo.TOUR (MaTour) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE dbo.LICH_TRINH_DETAIL WITH CHECK ADD CONSTRAINT FK_LICHTRINH_TOUR 
FOREIGN KEY (MaTour) REFERENCES dbo.TOUR (MaTour) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE dbo.CHUYENKHOIHANH WITH CHECK ADD CONSTRAINT FK_CHUYENKHOIHANH_TOUR 
FOREIGN KEY (MaTour) REFERENCES dbo.TOUR (MaTour) ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE dbo.DATTOUR WITH CHECK ADD CONSTRAINT FK_DATTOUR_NGUOIDUNG 
FOREIGN KEY (MaKhachHang) REFERENCES dbo.NGUOIDUNG (MaNguoiDung) ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE dbo.DATTOUR WITH CHECK ADD CONSTRAINT FK_DATTOUR_CHUYENKHOIHANH 
FOREIGN KEY (MaChuyen) REFERENCES dbo.CHUYENKHOIHANH (MaChuyen) ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE dbo.CHITIET_HANHKHACH WITH CHECK ADD CONSTRAINT FK_CHITIETHANHKHACH_DATTOUR 
FOREIGN KEY (MaDatTour) REFERENCES dbo.DATTOUR (MaDatTour) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE dbo.THANHTOAN WITH CHECK ADD CONSTRAINT FK_THANHTOAN_DATTOUR 
FOREIGN KEY (MaDatTour) REFERENCES dbo.DATTOUR (MaDatTour) ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE dbo.DANHGIA WITH CHECK ADD CONSTRAINT FK_DANHGIA_DATTOUR 
FOREIGN KEY (MaDatTour) REFERENCES dbo.DATTOUR (MaDatTour) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE dbo.BAIVIET_QUANGBA WITH CHECK ADD CONSTRAINT FK_BAIVIET_NGUOIDUNG 
FOREIGN KEY (MaNguoiDang) REFERENCES dbo.NGUOIDUNG (MaNguoiDung) ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE dbo.AUDITLOG WITH CHECK ADD CONSTRAINT FK_AUDITLOG_NGUOIDUNG 
FOREIGN KEY (MaNguoiThucHien) REFERENCES dbo.NGUOIDUNG (MaNguoiDung) ON UPDATE CASCADE ON DELETE SET NULL;

-- Check Constraints
ALTER TABLE dbo.TOUR ADD CONSTRAINT CK_TOUR_GiaKhuyenNghi CHECK (GiaKhuyenNghi >= 0);
ALTER TABLE dbo.LICH_TRINH_DETAIL ADD CONSTRAINT CK_LICHTRINH_NgayThu CHECK (NgayThu > 0);
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_ThoiGian CHECK (NgayKetThuc >= NgayKhoiHanh);
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_GiaThucTe CHECK (GiaThucTe >= 0);
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_SoChoToiDa CHECK (SoChoToiDa > 0);
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_SoChoHopLe CHECK (SoChoDaDat >= 0 AND SoChoDaDat <= SoChoToiDa);
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_TrangThai CHECK (TrangThaiChuyen IN (N'Mở bán', N'Hết chỗ', N'Hoàn thành', N'Hủy chuyến', N'Tạm dừng'));
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_SoLuongKhach CHECK (SoLuongKhach > 0);
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TongTien CHECK (TongTien >= 0);
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TrangThaiDat CHECK (TrangThaiDat IN (N'Chờ xác nhận', N'Đã xác nhận', N'Đã hoàn thành', N'Đã hủy'));
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TrangThaiThanhToan CHECK (TrangThaiThanhToan IN (N'Chưa thanh toán', N'Đã cọc', N'Đã thanh toán', N'Đã hoàn tiền'));
ALTER TABLE dbo.THANHTOAN ADD CONSTRAINT CK_THANHTOAN_SoTien CHECK (SoTien > 0);
ALTER TABLE dbo.DANHGIA ADD CONSTRAINT CK_DANHGIA_SoSao CHECK (SoSao BETWEEN 1 AND 5);
ALTER TABLE dbo.BAIVIET_QUANGBA ADD CONSTRAINT CK_BAIVIET_LuotXem CHECK (LuotXem >= 0);
GO

PRINT N'==> Thiết lập Khóa ngoại và Check Constraints hoàn tất.';
GO

-- ==========================================================================================
-- PHẦN 4: HỆ THỐNG INDEXES TỐI ƯU HÓA HIỆU NĂNG TRUY VẤN
-- ==========================================================================================
PRINT N'==> Đang khởi tạo Indexes tối ưu hóa...';

CREATE NONCLUSTERED INDEX IX_TOUR_MaDanhMuc_TrangThai ON dbo.TOUR (MaDanhMuc ASC, TrangThai ASC) INCLUDE (TenTour, GiaKhuyenNghi, HinhAnhDaiDien);
CREATE NONCLUSTERED INDEX IX_HINHANH_TOUR_MaTour ON dbo.HINHANH_TOUR (MaTour ASC) INCLUDE (DuongDanAnh, GhiChu);
CREATE NONCLUSTERED INDEX IX_LICH_TRINH_DETAIL_MaTour_NgayThu ON dbo.LICH_TRINH_DETAIL (MaTour ASC, NgayThu ASC) INCLUDE (TieuDeNgay, NoiDungChiTiet, BuaAn);
CREATE NONCLUSTERED INDEX IX_CHUYENKHOIHANH_MaTour_NgayKhoiHanh ON dbo.CHUYENKHOIHANH (MaTour ASC, NgayKhoiHanh ASC) INCLUDE (NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen);
CREATE NONCLUSTERED INDEX IX_DATTOUR_MaKhachHang_NgayDat ON dbo.DATTOUR (MaKhachHang ASC, NgayDat DESC) INCLUDE (MaChuyen, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan);
CREATE NONCLUSTERED INDEX IX_DATTOUR_MaChuyen_TrangThaiDat ON dbo.DATTOUR (MaChuyen ASC, TrangThaiDat ASC) INCLUDE (SoLuongKhach, TongTien);
CREATE NONCLUSTERED INDEX IX_CHITIET_HANHKHACH_MaDatTour ON dbo.CHITIET_HANHKHACH (MaDatTour ASC) INCLUDE (HoTen, NgaySinh, GioiTinh, SoDienThoai);
CREATE NONCLUSTERED INDEX IX_THANHTOAN_MaDatTour ON dbo.THANHTOAN (MaDatTour ASC) INCLUDE (PhuongThuc, SoTien, NgayThanhToan, TrangThai);
CREATE NONCLUSTERED INDEX IX_BAIVIET_QUANGBA_MaNguoiDang_NgayTao ON dbo.BAIVIET_QUANGBA (MaNguoiDang ASC, NgayTao DESC) INCLUDE (TieuDe, Slug, LuotXem, TrangThai);
CREATE NONCLUSTERED INDEX IX_AUDITLOG_ThoiGian_MaNguoiThucHien ON dbo.AUDITLOG (ThoiGian DESC, MaNguoiThucHien ASC) INCLUDE (HanhDong);
GO

PRINT N'==> Khởi tạo Indexes hoàn tất.';
GO

-- ==========================================================================================
-- PHẦN 5: TRIGGERS NGHIỆP VỤ CỐT LÕI (CHỐNG OVERBOOKING, HOÀN CHỖ, ĐÁNH GIÁ)
-- ==========================================================================================
PRINT N'==> Đang khởi tạo các Triggers nghiệp vụ...';
GO

-- 1. Trigger Đặt tour & Giữ chỗ: Kiểm tra (SoChoToiDa - SoChoDaDat), tăng SoChoDaDat, chống Overbooking
CREATE TRIGGER dbo.TRG_DATTOUR_CheckAndLockSeats
ON dbo.DATTOUR
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted WHERE TrangThaiDat <> N'Đã hủy')
        RETURN;

    -- Kiểm tra số chỗ còn trống
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

    -- Kiểm tra trạng thái chuyến khởi hành
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

    -- Tăng số chỗ đã đặt
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

    -- Ghi nhật ký AUDITLOG
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

-- 2. Trigger Tự động hoàn trả số chỗ khi đơn chuyển sang 'Đã hủy'
CREATE TRIGGER dbo.TRG_DATTOUR_HandleCancellation
ON dbo.DATTOUR
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(TrangThaiDat)
        RETURN;

    IF EXISTS (
        SELECT 1 
        FROM inserted i 
        JOIN deleted d ON i.MaDatTour = d.MaDatTour
        WHERE i.TrangThaiDat = N'Đã hủy' AND d.TrangThaiDat <> N'Đã hủy'
    )
    BEGIN
        -- Phục hồi lại số chỗ
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

        -- Ghi nhật ký AUDITLOG
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

-- 3. Trigger Kiểm tra điều kiện chỉ cho phép đánh giá đơn hàng 'Đã hoàn thành'
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

PRINT N'==> Khởi tạo Triggers hoàn tất.';
GO

-- ==========================================================================================
-- PHẦN 6: STORED PROCEDURES NGHIỆP VỤ & BÁO CÁO THỐNG KÊ
-- ==========================================================================================
PRINT N'==> Đang khởi tạo Stored Procedures...';
GO

-- 1. Procedure Đặt Tour Trực Tuyến An Toàn (ACID Transaction & UPDLOCK)
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

    IF @SoLuongKhach <= 0
    BEGIN
        RAISERROR(N'Số lượng khách đặt tour phải lớn hơn 0.', 16, 1);
        RETURN -1;
    END;

    BEGIN TRANSACTION;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE MaNguoiDung = @MaKhachHang AND TrangThai = 1)
        BEGIN
            RAISERROR(N'Tài khoản khách hàng không tồn tại hoặc đã bị khóa.', 16, 1);
        END;

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

        IF (@SoChoToiDa - @SoChoDaDat) < @SoLuongKhach
        BEGIN
            RAISERROR(N'Chuyến khởi hành không đủ số chỗ trống (Còn lại: %d chỗ, Yêu cầu: %d chỗ).', 16, 1, 
                      (@SoChoToiDa - @SoChoDaDat), @SoLuongKhach);
        END;

        DECLARE @TongTien DECIMAL(18,2) = @SoLuongKhach * @GiaThucTe;

        INSERT INTO dbo.DATTOUR (MaKhachHang, MaChuyen, NgayDat, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
        VALUES (@MaKhachHang, @MaChuyen, GETDATE(), @SoLuongKhach, @TongTien, N'Chờ xác nhận', N'Chưa thanh toán');

        SET @MaDatTourMoi = SCOPE_IDENTITY();

        INSERT INTO dbo.CHITIET_HANHKHACH (MaDatTour, HoTen, SoDienThoai)
        VALUES (@MaDatTourMoi, @HoTenTruongDoan, @SoDienThoai);

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

-- 2. Procedure Xác nhận thanh toán
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
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour)
        BEGIN
            RAISERROR(N'Đơn đặt tour không tồn tại.', 16, 1);
        END;

        INSERT INTO dbo.THANHTOAN (MaDatTour, PhuongThuc, SoTien, NgayThanhToan, MaGiaoDich, TrangThai)
        VALUES (@MaDatTour, @PhuongThuc, @SoTien, GETDATE(), @MaGiaoDich, N'Thành công');

        UPDATE dbo.DATTOUR
        SET TrangThaiThanhToan = N'Đã thanh toán',
            TrangThaiDat = CASE WHEN TrangThaiDat = N'Chờ xác nhận' THEN N'Đã xác nhận' ELSE TrangThaiDat END
        WHERE MaDatTour = @MaDatTour;

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

-- 3. Procedure Hủy đơn đặt tour
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

    IF EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND TrangThaiDat = N'Đã hủy')
    BEGIN
        RAISERROR(N'Đơn đặt tour này đã bị hủy trước đó.', 16, 1);
        RETURN -1;
    END;

    UPDATE dbo.DATTOUR
    SET TrangThaiDat = N'Đã hủy'
    WHERE MaDatTour = @MaDatTour;

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

-- 4. Procedure Thống kê Doanh thu và Đơn đặt tour thành công theo khoảng thời gian
CREATE PROCEDURE dbo.sp_ThongKeDoanhThuVaDonHang
    @TuNgay  DATETIME,
    @DenNgay DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NgayKetThucChuan DATETIME = DATEADD(SECOND, -1, DATEADD(DAY, 1, CAST(CAST(@DenNgay AS DATE) AS DATETIME)));

    -- BẢNG 1: TỔNG QUAN CHỈ SỐ KINH DOANH
    SELECT 
        COUNT(DISTINCT dt.MaDatTour) AS TongSoDonDat,
        SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS SoDonThanhCong,
        SUM(CASE WHEN dt.TrangThaiDat = N'Đã hủy' THEN 1 ELSE 0 END) AS SoDonDaHuy,
        ISNULL(SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN dt.SoLuongKhach ELSE 0 END), 0) AS TongSoKhachPhucVu,
        ISNULL(SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN dt.TongTien ELSE 0 END), 0) AS TongGiaTriDonThanhCong,
        (
            SELECT ISNULL(SUM(tt.SoTien), 0)
            FROM dbo.THANHTOAN tt
            JOIN dbo.DATTOUR d ON tt.MaDatTour = d.MaDatTour
            WHERE tt.NgayThanhToan BETWEEN @TuNgay AND @NgayKetThucChuan
              AND tt.TrangThai = N'Thành công'
        ) AS DoanhThuThucThu
    FROM dbo.DATTOUR dt
    WHERE dt.NgayDat BETWEEN @TuNgay AND @NgayKetThucChuan;

    -- BẢNG 2: PHÂN TÍCH DOANH THU THEO TỪNG DANH MỤC DU LỊCH
    SELECT 
        dm.MaDanhMuc,
        dm.TenDanhMuc,
        COUNT(dt.MaDatTour) AS SoDonDat,
        SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS SoDonThanhCong,
        ISNULL(SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN dt.SoLuongKhach ELSE 0 END), 0) AS TongKhach,
        ISNULL(SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN dt.TongTien ELSE 0 END), 0) AS DoanhThuDanhMuc
    FROM dbo.DANHMUC dm
    LEFT JOIN dbo.TOUR t ON dm.MaDanhMuc = t.MaDanhMuc
    LEFT JOIN dbo.CHUYENKHOIHANH c ON t.MaTour = c.MaTour
    LEFT JOIN dbo.DATTOUR dt ON c.MaChuyen = dt.MaChuyen AND dt.NgayDat BETWEEN @TuNgay AND @NgayKetThucChuan
    GROUP BY dm.MaDanhMuc, dm.TenDanhMuc
    ORDER BY DoanhThuDanhMuc DESC;
END;
GO

PRINT N'==> Khởi tạo Stored Procedures hoàn tất.';
GO

-- ==========================================================================================
-- PHẦN 7: VIEWS VÀ FUNCTIONS HỖ TRỢ GIAO DIỆN & TIỆN ÍCH
-- ==========================================================================================
PRINT N'==> Đang khởi tạo Views và Functions...';
GO

-- Function tính chỗ còn trống
CREATE FUNCTION dbo.fn_TinhSoChoConLai (@MaChuyen INT)
RETURNS INT
AS
BEGIN
    DECLARE @SoChoConLai INT = 0;
    SELECT @SoChoConLai = (SoChoToiDa - SoChoDaDat)
    FROM dbo.CHUYENKHOIHANH
    WHERE MaChuyen = @MaChuyen;
    RETURN ISNULL(@SoChoConLai, 0);
END;
GO

-- View danh sách tour hiển thị client
CREATE VIEW dbo.v_DanhSachTourHienThi
AS
SELECT 
    t.MaTour,
    t.TenTour,
    dm.MaDanhMuc,
    dm.TenDanhMuc,
    t.HinhAnhDaiDien,
    t.LichTrinhTongQuan,
    t.GiaKhuyenNghi,
    t.TrangThai,
    ISNULL(MIN(c.GiaThucTe), t.GiaKhuyenNghi) AS GiaKhoiDiem,
    COUNT(DISTINCT c.MaChuyen) AS TongSoChuyenSapToi,
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
GROUP BY 
    t.MaTour, t.TenTour, dm.MaDanhMuc, dm.TenDanhMuc, 
    t.HinhAnhDaiDien, t.LichTrinhTongQuan, t.GiaKhuyenNghi, t.TrangThai;
GO

-- View danh sách chuyến khởi hành còn chỗ
CREATE VIEW dbo.v_DanhSachChuyenKhoiHanhConCho
AS
SELECT 
    c.MaChuyen,
    c.MaTour,
    t.TenTour,
    c.NgayKhoiHanh,
    c.NgayKetThuc,
    DATEDIFF(DAY, c.NgayKhoiHanh, c.NgayKetThuc) + 1 AS SoNgay,
    c.GiaThucTe,
    c.SoChoToiDa,
    c.SoChoDaDat,
    (c.SoChoToiDa - c.SoChoDaDat) AS SoChoConLai,
    c.TrangThaiChuyen
FROM dbo.CHUYENKHOIHANH c
JOIN dbo.TOUR t ON c.MaTour = t.MaTour
WHERE c.TrangThaiChuyen = N'Mở bán'
  AND (c.SoChoToiDa - c.SoChoDaDat) > 0;
GO

-- View quản lý đơn đặt tour cho Dashboard Admin
CREATE VIEW dbo.v_QuanLyDonDatTourAdmin
AS
SELECT 
    dt.MaDatTour,
    dt.NgayDat,
    nd.MaNguoiDung,
    nd.HoTen AS TenKhachHang,
    nd.Email,
    nd.SoDienThoai,
    t.TenTour,
    c.NgayKhoiHanh,
    c.NgayKetThuc,
    dt.SoLuongKhach,
    dt.TongTien,
    dt.TrangThaiDat,
    dt.TrangThaiThanhToan,
    ISNULL(SUM(tt.SoTien), 0) AS SoTienDaThanhToan
FROM dbo.DATTOUR dt
JOIN dbo.NGUOIDUNG nd ON dt.MaKhachHang = nd.MaNguoiDung
JOIN dbo.CHUYENKHOIHANH c ON dt.MaChuyen = c.MaChuyen
JOIN dbo.TOUR t ON c.MaTour = t.MaTour
LEFT JOIN dbo.THANHTOAN tt ON dt.MaDatTour = tt.MaDatTour AND tt.TrangThai = N'Thành công'
GROUP BY 
    dt.MaDatTour, dt.NgayDat, nd.MaNguoiDung, nd.HoTen, nd.Email, nd.SoDienThoai,
    t.TenTour, c.NgayKhoiHanh, c.NgayKetThuc, dt.SoLuongKhach, dt.TongTien,
    dt.TrangThaiDat, dt.TrangThaiThanhToan;
GO

PRINT N'==> Khởi tạo Views và Functions hoàn tất.';
GO

-- ==========================================================================================
-- PHẦN 8: NẠP DỮ LIỆU MẪU THỰC TẾ (REALISTIC SAMPLE DATA)
-- ==========================================================================================
PRINT N'==> Đang nạp dữ liệu mẫu thực tế cho 12 bảng...';

-- 1. NGUOIDUNG (Lưu ý: Không có thuộc tính VaiTro)
SET IDENTITY_INSERT dbo.NGUOIDUNG ON;
INSERT INTO dbo.NGUOIDUNG (MaNguoiDung, HoTen, Email, SoDienThoai, MatKhau, DiaChi, TrangThai, NgayTao)
VALUES 
(1, N'Trần Quốc Toản', 'admin@tourvietnam.vn', '0901234567', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Hoàn Kiếm, Hà Nội', 1, '2026-01-10'),
(2, N'Lê Thị Mai', 'dieuhanh@tourvietnam.vn', '0912345678', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Hải Châu, Đà Nẵng', 1, '2026-01-15'),
(3, N'Hoàng Văn Dũng', 'ketoan@tourvietnam.vn', '0987654321', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Quận 1, TP. Hồ Chí Minh', 1, '2026-02-01'),
(4, N'Nguyễn Văn An', 'nguyenvanan@gmail.com', '0933112233', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Cầu Giấy, Hà Nội', 1, '2026-03-01'),
(5, N'Phạm Thị Hương', 'phamhuong88@gmail.com', '0944556677', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Thanh Xuân, Hà Nội', 1, '2026-03-10'),
(6, N'Đỗ Minh Quân', 'minhquan.travel@outlook.com', '0977889900', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Bình Thạnh, TP. Hồ Chí Minh', 1, '2026-04-05');
SET IDENTITY_INSERT dbo.NGUOIDUNG OFF;

-- 2. DANHMUC
SET IDENTITY_INSERT dbo.DANHMUC ON;
INSERT INTO dbo.DANHMUC (MaDanhMuc, TenDanhMuc, MoTa)
VALUES 
(1, N'Tour Du Lịch Đông Bắc Á', N'Khám phá văn hóa, cảnh sắc lãng mạn tại Hàn Quốc, Nhật Bản, Đài Loan'),
(2, N'Tour Miền Trung Di Sản', N'Hành trình di sản văn hóa: Đà Nẵng, Bà Nà Hills, Phố cổ Hội An, Cố đô Huế'),
(3, N'Tour Biển Đảo Nghỉ Dưỡng', N'Nghỉ dưỡng đẳng cấp tại Phú Quốc, Côn Đảo, Nha Trang, Vịnh Hạ Long'),
(4, N'Tour Khám Phá Vùng Cao Miền Bắc', N'Chinh phục nóc nhà Đông Dương Fansipan Sa Pa, Mù Cang Chải, Hà Giang mùa hoa');
SET IDENTITY_INSERT dbo.DANHMUC OFF;

-- 3. TOUR
SET IDENTITY_INSERT dbo.TOUR ON;
INSERT INTO dbo.TOUR (MaTour, MaDanhMuc, TenTour, MoTaChiTiet, LichTrinhTongQuan, GiaKhuyenNghi, HinhAnhDaiDien, TrangThai)
VALUES 
(1, 1, N'Tour Hàn Quốc: Seoul - Đảo Nami - Tháp Namsan - Công Viên Lotte World', 
 N'Hành trình 5 ngày 4 đêm đưa quý khách đến với xứ sở kim chi thơ mộng. Dạo bước dưới hàng cây ngân hạnh tại đảo Nami, ngắm toàn cảnh Seoul từ tháp Namsan và thỏa sức vui chơi tại công viên giải trí trong nhà lớn nhất thế giới Lotte World.', 
 N'5 Ngày 4 Đêm | Bay Vietnam Airlines | Khách sạn 4 sao quốc tế', 13990000, '/images/tours/korea-seoul-nami.jpg', 1),

(2, 2, N'Tour Đà Nẵng - Bà Nà Hills - Cầu Vàng - Phố Cổ Hội An - Bán Đảo Sơn Trà', 
 N'Khám phá miền Trung trọn vẹn: Check-in Cầu Vàng bàn tay khổng lồ trên đỉnh Bà Nà, thả đèn hoa đăng lung linh trên sông Hoài Hội An và viếng chùa Linh Ứng Sơn Trà.', 
 N'4 Ngày 3 Đêm | Khách sạn 4 sao biển Mỹ Khê | Trọn gói vé cáp treo Bà Nà', 4890000, '/images/tours/danang-bana-hoian.jpg', 1),

(3, 3, N'Tour Phú Quốc Thiên Đường Đảo Ngọc - Cáp Treo Hòn Thơm - Thị Trấn Hoàng Hôn', 
 N'Trải nghiệm cáp treo vượt biển 3 dây dài nhất thế giới sang Hòn Thơm Nature Park, ngắm hoàng hôn rực rỡ tại Sunset Town và thưởng thức hải sản tươi sống Hàm Ninh.', 
 N'3 Ngày 2 Đêm | Resort 5 sao có bãi biển riêng | Tặng tour cano 4 đảo', 3990000, '/images/tours/phuquoc-honthom.jpg', 1),

(4, 4, N'Tour Sa Pa - Nóc Nhà Đông Dương Fansipan - Bản Cát Cát - Đèo Ô Quy Hồ', 
 N'Chinh phục đỉnh thiêng Fansipan cao 3.143m, ngắm biển mây bồng bềnh, tìm hiểu nếp sống đồng bào H''Mông tại bản Cát Cát và săn hoàng hôn tại cổng trời Ô Quy Hồ.', 
 N'3 Ngày 2 Đêm | Xe giường nằm Limousine | Khách sạn trung tâm thị xã', 2850000, '/images/tours/sapa-fansipan.jpg', 1);
SET IDENTITY_INSERT dbo.TOUR OFF;

-- 4. HINHANH_TOUR
SET IDENTITY_INSERT dbo.HINHANH_TOUR ON;
INSERT INTO dbo.HINHANH_TOUR (MaHinhAnh, MaTour, DuongDanAnh, GhiChu)
VALUES 
(1, 1, '/images/gallery/seoul-autumn.jpg', N'Đảo Nami lãng mạn mùa thu rực rỡ'),
(2, 1, '/images/gallery/namsan-tower.jpg', N'Tháp truyền hình N Seoul Tower và hàng ngàn ổ khóa tình yêu'),
(3, 1, '/images/gallery/lotte-world.jpg', N'Công viên giải trí phức hợp Lotte World Seoul'),
(4, 2, '/images/gallery/cau-vang-danang.jpg', N'Cây Cầu Vàng độc đáo được nâng đỡ bởi bàn tay khổng lồ'),
(5, 2, '/images/gallery/hoi-an-den-long.jpg', N'Phố cổ Hội An về đêm lung linh đèn lồng'),
(6, 2, '/images/gallery/son-tra-linh-ung.jpg', N'Tượng Phật Bà Quan Âm cao 67m tại bán đảo Sơn Trà'),
(7, 3, '/images/gallery/sunset-town.jpg', N'Thị trấn Hoàng Hôn Địa Trung Hải Sunset Town'),
(8, 3, '/images/gallery/cap-treo-hon-thom.jpg', N'Cáp treo Hòn Thơm ngắm trọn biển đảo An Thới'),
(9, 4, '/images/gallery/fansipan-peak.jpg', N'Cột mốc đỉnh thiêng Fansipan 3.143m ngập tràn cờ đỏ sao vàng'),
(10, 4, '/images/gallery/cat-cat-waterfall.jpg', N'Thác nước thơ mộng giữa bản Cát Cát Sa Pa');
SET IDENTITY_INSERT dbo.HINHANH_TOUR OFF;

-- 5. LICH_TRINH_DETAIL
SET IDENTITY_INSERT dbo.LICH_TRINH_DETAIL ON;
INSERT INTO dbo.LICH_TRINH_DETAIL (MaLichTrinh, MaTour, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn)
VALUES 
(1, 1, 1, N'TP.HCM / HÀ NỘI - INCHEON (SEOUL)', N'Quý khách tập trung tại sân bay làm thủ tục chuyến bay đi Incheon. Nghỉ đêm trên máy bay.', N'Ăn nhẹ trên máy bay'),
(2, 1, 2, N'SEOUL - ĐẢO NAMI - THÁP NAMSAN', N'Đến sân bay Incheon, xe đưa đoàn đi ăn sáng canh sườn bò. Khởi hành đi đảo Nami. Chiều về Seoul tham quan Tháp Namsan.', N'Sáng, Trưa, Tối'),
(3, 1, 3, N'LOTTE WORLD - CUNG ĐIỆN GYEONGBOKGUNG', N'Khám phá Cung điện Gyeongbokgung cổ kính trong trang phục Hanbok. Chiều trải nghiệm công viên giải trí Lotte World.', N'Sáng, Trưa, Tối'),
(4, 2, 1, N'ĐÓN KHÁCH - BÁN ĐẢO SƠN TRÀ - BIỂN MỸ KHÊ', N'Xe đón khách tại sân bay Đà Nẵng, nhận phòng khách sạn. Chiều viếng chùa Linh Ứng Sơn Trà và tự do tắm biển Mỹ Khê.', N'Trưa, Tối'),
(5, 2, 2, N'BÀ NÀ HILLS - CẦU VÀNG - CHECK-IN LÀNG PHÁP', N'Chinh phục đỉnh Bà Nà bằng cáp treo. Check-in Cầu Vàng, tham quan Hầm rượu Debay, Vườn hoa Le Jardin D''Amour.', N'Sáng, Trưa Buffet, Tối'),
(6, 2, 3, N'DANH THẮNG NGŨ HÀNH SƠN - PHỐ CỔ HỘI AN', N'Tham quan làng đá mỹ nghệ Non Nước, khám phá động Huyền Không. Chiều sang Phố cổ Hội An, thả hoa đăng trên sông Hoài.', N'Sáng, Trưa, Tối'),
(7, 3, 1, N'ĐÓN BAY PHÚ QUỐC - DINH CẬU - SUNSET SANATO', N'Xe đón đoàn tại sân bay Phú Quốc. Khởi hành viếng Dinh Cậu tâm linh, ngắm hoàng hôn độc đáo tại Sunset Sanato.', N'Trưa, Tối'),
(8, 3, 2, N'CANO 4 ĐẢO - CÁP TREO HÒN THƠM - CẦU HÔN', N'Trải nghiệm cano cao tốc lặn ngắm san hô. Đi cáp treo vượt biển Hòn Thơm và check-in Cầu Hôn (Kiss Bridge).', N'Sáng, Trưa, Tối'),
(9, 4, 1, N'HÀ NỘI - NỘI BÀI - SA PA - BẢN CÁT CÁT', N'Xe Limousine đưa đoàn lên Sa Pa theo cao tốc. Buổi chiều tham quan bản Cát Cát của đồng bào người H''Mông.', N'Trưa, Tối'),
(10, 4, 2, N'CHINH PHỤC FANSIPAN - CỔNG TRỜI Ô QUY HỒ', N'Đi tàu hỏa leo núi Mường Hoa, cáp treo lên đỉnh Fansipan. Buổi chiều săn mây tuyệt đẹp tại đỉnh đèo Ô Quy Hồ.', N'Sáng, Trưa, Tối');
SET IDENTITY_INSERT dbo.LICH_TRINH_DETAIL OFF;

-- 6. CHUYENKHOIHANH
SET IDENTITY_INSERT dbo.CHUYENKHOIHANH ON;
INSERT INTO dbo.CHUYENKHOIHANH (MaChuyen, MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen)
VALUES 
(1, 1, '2026-11-15 08:00', '2026-11-19 18:00', 12990000, 25, 18, N'Mở bán'),
(2, 1, '2026-12-20 08:00', '2026-12-24 18:00', 14500000, 25, 25, N'Hết chỗ'),
(3, 1, '2027-01-10 08:00', '2027-01-14 18:00', 12990000, 25, 4, N'Mở bán'),
(4, 2, '2026-11-10 07:30', '2026-11-13 17:00', 4690000, 30, 20, N'Mở bán'),
(5, 2, '2026-12-05 07:30', '2026-12-08 17:00', 4890000, 30, 0, N'Mở bán'),
(6, 3, '2026-11-20 09:00', '2026-11-22 16:00', 3890000, 20, 15, N'Mở bán'),
(7, 3, '2026-12-15 09:00', '2026-12-17 16:00', 4290000, 20, 0, N'Mở bán'),
(8, 4, '2026-11-05 06:30', '2026-11-07 19:00', 2750000, 25, 25, N'Hoàn thành'),
(9, 4, '2026-11-25 06:30', '2026-11-27 19:00', 2850000, 25, 8, N'Mở bán');
SET IDENTITY_INSERT dbo.CHUYENKHOIHANH OFF;

-- 7. DATTOUR (Tắt trigger tạm thời khi nạp dữ liệu lịch sử)
DISABLE TRIGGER dbo.TRG_DATTOUR_CheckAndLockSeats ON dbo.DATTOUR;
SET IDENTITY_INSERT dbo.DATTOUR ON;
INSERT INTO dbo.DATTOUR (MaDatTour, MaKhachHang, MaChuyen, NgayDat, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
VALUES 
(1, 4, 8, '2026-10-15 14:20', 2, 5500000, N'Đã hoàn thành', N'Đã thanh toán'),
(2, 5, 8, '2026-10-18 09:10', 3, 8250000, N'Đã hoàn thành', N'Đã thanh toán'),
(3, 4, 1, '2026-10-20 10:00', 2, 25980000, N'Đã xác nhận', N'Đã thanh toán'),
(4, 6, 1, '2026-10-22 16:30', 4, 51960000, N'Đã xác nhận', N'Đã thanh toán'),
(5, 5, 4, '2026-10-23 11:15', 2, 9380000, N'Đã xác nhận', N'Đã thanh toán'),
(6, 6, 6, '2026-10-24 15:45', 3, 11670000, N'Chờ xác nhận', N'Chưa thanh toán'),
(7, 4, 4, '2026-10-12 08:30', 2, 9380000, N'Đã hủy', N'Đã hoàn tiền');
SET IDENTITY_INSERT dbo.DATTOUR OFF;
ENABLE TRIGGER dbo.TRG_DATTOUR_CheckAndLockSeats ON dbo.DATTOUR;

-- 8. CHITIET_HANHKHACH
SET IDENTITY_INSERT dbo.CHITIET_HANHKHACH ON;
INSERT INTO dbo.CHITIET_HANHKHACH (MaHanhKhach, MaDatTour, HoTen, NgaySinh, GioiTinh, SoDienThoai)
VALUES 
(1, 1, N'Nguyễn Văn An', '1989-05-12', N'Nam', '0933112233'),
(2, 1, N'Trần Thị Bích', '1992-08-20', N'Nữ', '0933112234'),
(3, 2, N'Phạm Thị Hương', '1988-11-04', N'Nữ', '0944556677'),
(4, 2, N'Lê Minh Tuấn', '1985-03-15', N'Nam', '0944556678'),
(5, 2, N'Lê Minh Khang', '2016-09-10', N'Nam', NULL),
(6, 3, N'Nguyễn Văn An', '1989-05-12', N'Nam', '0933112233'),
(7, 3, N'Trần Thị Bích', '1992-08-20', N'Nữ', '0933112234'),
(8, 4, N'Đỗ Minh Quân', '1991-04-18', N'Nam', '0977889900'),
(9, 4, N'Hoàng Thu Thảo', '1993-07-22', N'Nữ', '0977889901'),
(10, 4, N'Đỗ Hoàng Anh', '2018-02-14', N'Nam', NULL),
(11, 4, N'Vũ Thị Mai', '1965-12-01', N'Nữ', '0977889902');
SET IDENTITY_INSERT dbo.CHITIET_HANHKHACH OFF;

-- 9. THANHTOAN
SET IDENTITY_INSERT dbo.THANHTOAN ON;
INSERT INTO dbo.THANHTOAN (MaThanhToan, MaDatTour, PhuongThuc, SoTien, NgayThanhToan, MaGiaoDich, TrangThai)
VALUES 
(1, 1, N'Chuyển khoản QR', 5500000, '2026-10-15 14:30', 'MBVCB.982312389', N'Thành công'),
(2, 2, N'Thẻ tín dụng', 8250000, '2026-10-18 09:20', 'VNPAY-891238712', N'Thành công'),
(3, 3, N'Chuyển khoản QR', 25980000, '2026-10-20 10:15', 'TECH.812391283', N'Thành công'),
(4, 4, N'Chuyển khoản QR', 51960000, '2026-10-22 17:00', 'VIETIN.561239812', N'Thành công'),
(5, 5, N'Chuyển khoản QR', 9380000, '2026-10-23 11:30', 'MB.349182391', N'Thành công');
SET IDENTITY_INSERT dbo.THANHTOAN OFF;

-- 10. DANHGIA
SET IDENTITY_INSERT dbo.DANHGIA ON;
INSERT INTO dbo.DANHGIA (MaDanhGia, MaDatTour, SoSao, NoiDung, HinhAnh, NgayDanhGia, TrangThaiHienThi, PhanHoiAdmin)
VALUES 
(1, 1, 5, N'Chuyến đi Sa Pa tuyệt vời! Hướng dẫn viên rất nhiệt tình và chu đáo, đồ ăn ngon, phòng khách sạn sạch sẽ ngắm mây rất chill.', 
 '/images/reviews/sapa-review1.jpg', '2026-11-08 10:00', 1, 
 N'Dạ cảm ơn anh An và gia đình đã tin tưởng đồng hành cùng công ty. Chúc anh và gia đình luôn dồi dào sức khỏe!'),
(2, 2, 5, N'Gia đình mình có bé nhỏ nhưng chuyến đi rất nhẹ nhàng và vui vẻ. Các điểm đến rất đẹp, đặc biệt là đỉnh Fansipan hùng vĩ.', 
 '/images/reviews/sapa-review2.jpg', '2026-11-08 14:30', 1, 
 N'Dạ công ty rất hân hạnh được phục vụ gia đình chị Hương. Hẹn gặp lại gia đình trong các chuyến tour tiếp theo ạ!');
SET IDENTITY_INSERT dbo.DANHGIA OFF;

-- 11. BAIVIET_QUANGBA
SET IDENTITY_INSERT dbo.BAIVIET_QUANGBA ON;
INSERT INTO dbo.BAIVIET_QUANGBA (MaBaiViet, TieuDe, Slug, TomTat, NoiDung, HinhAnhDaiDien, LuotXem, NgayTao, TrangThai, MaNguoiDang)
VALUES 
(1, N'Cẩm Nang Du Lịch Hàn Quốc Mùa Thu: Những Điểm Ngắm Lá Vàng Đẹp Tựa Tranh Vẽ', 
 'cam-nang-du-lich-han-quoc-mua-thu-la-vang', 
 N'Mùa thu là thời điểm lãng mạn nhất trong năm để du lịch Hàn Quốc với sắc đỏ của lá phong và sắc vàng rực rỡ của rừng cây ngân hạnh.', 
 N'<p>Mùa thu Hàn Quốc kéo dài từ tháng 9 đến tháng 11 hàng năm. Đến với Seoul vào mùa này, bạn không thể bỏ lỡ đảo Nami rợp bóng cây ngân hạnh, Cung điện Gyeongbokgung cổ kính...</p>', 
 '/images/news/korea-autumn-guide.jpg', 1250, '2026-09-01', 1, 1),
(2, N'Kinh Nghiệm Check-in Cầu Vàng Bà Nà Hills Tránh Đông Đúc Cho Người Đi Lần Đầu', 
 'kinh-nghiem-check-in-cau-vang-ba-na-hills', 
 N'Bật mí khung giờ vàng và mẹo chụp hình triệu like tại Cây Cầu Vàng nổi tiếng thế giới tại Sun World Ba Na Hills Đà Nẵng.', 
 N'<p>Cầu Vàng Bà Nà Hills là kiệt tác kiến trúc được truyền thông quốc tế ca ngợi. Để có những bức hình ấn tượng không bị vướng khách tham quan, bạn nên chọn khung giờ 7h00 - 8h00 sáng...</p>', 
 '/images/news/cau-vang-bana-guide.jpg', 2340, '2026-09-15', 1, 2),
(3, N'Top 5 Trải Nghiệm Nhất Định Phải Thử Khi Đến Phú Quốc Năm 2026', 
 'top-5-trai-nghiem-phai-thu-tai-phu-quoc', 
 N'Từ đi cáp treo vượt biển 3 dây Hòn Thơm, ngắm hoàng hôn tại Sunset Town đến thưởng thức bún quậy trứ danh.', 
 N'<p>Đảo ngọc Phú Quốc luôn nằm trong top điểm đến hấp dẫn nhất Việt Nam. Hãy lưu ngay 5 trải nghiệm đắt giá này cho kỳ nghỉ dưỡng sắp tới của bạn...</p>', 
 '/images/news/phu-quoc-top-5.jpg', 980, '2026-10-01', 1, 2);
SET IDENTITY_INSERT dbo.BAIVIET_QUANGBA OFF;

-- 12. AUDITLOG
SET IDENTITY_INSERT dbo.AUDITLOG ON;
INSERT INTO dbo.AUDITLOG (MaLog, MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
VALUES 
(1, 1, N'KHOI_TAO_HE_THONG', NULL, N'Khởi tạo thành công cấu trúc 12 bảng CSDL chuẩn 3NF', '2026-10-01 08:00'),
(2, 1, N'DANG_TOUR_MOI', NULL, N'Đăng tour mới: Hàn Quốc Seoul - Nami - Lotte World', '2026-10-02 09:30'),
(3, 2, N'MO_BAN_CHUYEN_DI', NULL, N'Mở bán chuyến khởi hành ngày 15/11/2026 cho Tour Hàn Quốc', '2026-10-05 14:15'),
(4, 3, N'XAC_NHAN_THANH_TOAN', N'Trạng thái: Chưa thanh toán', N'Xác nhận đơn #3 đã thanh toán 25.980.000 VNĐ qua QR Code', '2026-10-20 10:16');
SET IDENTITY_INSERT dbo.AUDITLOG OFF;
GO

-- ==========================================================================================
-- PHẦN 9: BỘ STORED PROCEDURES CHUẨN HÓA DÀNH RIÊNG CHO WEB API (API ENDPOINTS)
-- Phục vụ gọi trực tiếp từ Backend: Node.js, C# ASP.NET Core, Java Spring, PHP Laravel, Python
-- ==========================================================================================
PRINT N'==> Đang khởi tạo Bộ Stored Procedures dành riêng cho Web Backend API...';
GO

-- 1. [PUBLIC] LẤY DANH MỤC TOUR -> GET /api/categories
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

-- 2. [PUBLIC] TÌM KIẾM, LỌC & PHÂN TRANG TOUR -> GET /api/tours
IF OBJECT_ID(N'dbo.sp_api_GetTours', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetTours;
GO
CREATE PROCEDURE dbo.sp_api_GetTours
    @TuKhoa       NVARCHAR(100) = NULL,
    @MaDanhMuc    INT           = NULL,
    @TuGia        DECIMAL(18,2) = NULL,
    @DenGia       DECIMAL(18,2) = NULL,
    @SapXepTheo   VARCHAR(20)   = 'GIA_TANG',
    @PageIndex    INT           = 1,
    @PageSize     INT           = 9
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF @PageIndex < 1 SET @PageIndex = 1;
        IF @PageSize < 1 SET @PageSize = 9;
        DECLARE @Offset INT = (@PageIndex - 1) * @PageSize;

        SELECT COUNT(DISTINCT t.MaTour) AS TongSoBanGhi
        FROM dbo.TOUR t
        JOIN dbo.DANHMUC dm ON t.MaDanhMuc = dm.MaDanhMuc
        LEFT JOIN dbo.CHUYENKHOIHANH c ON t.MaTour = c.MaTour AND c.TrangThaiChuyen = N'Mở bán'
        WHERE t.TrangThai = 1
          AND (@MaDanhMuc IS NULL OR t.MaDanhMuc = @MaDanhMuc)
          AND (@TuKhoa IS NULL OR t.TenTour LIKE N'%' + @TuKhoa + N'%' OR dm.TenDanhMuc LIKE N'%' + @TuKhoa + N'%')
          AND (@TuGia IS NULL OR ISNULL(c.GiaThucTe, t.GiaKhuyenNghi) >= @TuGia)
          AND (@DenGia IS NULL OR ISNULL(c.GiaThucTe, t.GiaKhuyenNghi) <= @DenGia);

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

-- 3. [PUBLIC] LẤY CHI TIẾT TOUR TOÀN DIỆN -> GET /api/tours/:id
IF OBJECT_ID(N'dbo.sp_api_GetTourDetail', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetTourDetail;
GO
CREATE PROCEDURE dbo.sp_api_GetTourDetail
    @MaTour INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT 
            t.MaTour, t.TenTour, dm.MaDanhMuc, dm.TenDanhMuc, 
            t.MoTaChiTiet, t.LichTrinhTongQuan, t.GiaKhuyenNghi, t.HinhAnhDaiDien,
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

        SELECT MaHinhAnh, DuongDanAnh, GhiChu FROM dbo.HINHANH_TOUR WHERE MaTour = @MaTour ORDER BY MaHinhAnh ASC;
        SELECT MaLichTrinh, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn FROM dbo.LICH_TRINH_DETAIL WHERE MaTour = @MaTour ORDER BY NgayThu ASC;
        SELECT 
            MaChuyen, NgayKhoiHanh, NgayKetThuc, DATEDIFF(DAY, NgayKhoiHanh, NgayKetThuc) + 1 AS SoNgay,
            GiaThucTe, SoChoToiDa, SoChoDaDat, (SoChoToiDa - SoChoDaDat) AS SoChoConLai, TrangThaiChuyen
        FROM dbo.CHUYENKHOIHANH
        WHERE MaTour = @MaTour AND TrangThaiChuyen = N'Mở bán' AND (SoChoToiDa - SoChoDaDat) > 0 AND NgayKhoiHanh >= GETDATE()
        ORDER BY NgayKhoiHanh ASC;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- 4. [AUTH] ĐĂNG KÝ TÀI KHOẢN -> POST /api/auth/register
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
        IF EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE Email = @Email)
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Địa chỉ Email này đã được đăng ký trong hệ thống.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.NGUOIDUNG (HoTen, Email, SoDienThoai, MatKhau, DiaChi, TrangThai, NgayTao)
        VALUES (@HoTen, @Email, @SoDienThoai, @MatKhauHash, @DiaChi, 1, GETDATE());

        SELECT 
            1 AS Success, 201 AS StatusCode, N'Đăng ký tài khoản thành công!' AS Message,
            SCOPE_IDENTITY() AS MaNguoiDung, @HoTen AS HoTen, @Email AS Email;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- 5. [AUTH] LẤY USER ĐĂNG NHẬP -> POST /api/auth/login
IF OBJECT_ID(N'dbo.sp_api_GetUserForLogin', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetUserForLogin;
GO
CREATE PROCEDURE dbo.sp_api_GetUserForLogin
    @Email VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT MaNguoiDung, HoTen, Email, SoDienThoai, MatKhau AS PasswordHash, DiaChi, TrangThai, NgayTao
    FROM dbo.NGUOIDUNG
    WHERE Email = @Email;
END;
GO

-- 6. [BOOKING] TẠO ĐƠN ĐẶT TOUR -> POST /api/bookings
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
        IF NOT EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE MaNguoiDung = @MaKhachHang AND TrangThai = 1)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Success, 403 AS StatusCode, N'Tài khoản không hợp lệ hoặc đã bị khóa.' AS Message;
            RETURN;
        END;

        DECLARE @GiaThucTe DECIMAL(18,2), @SoChoToiDa INT, @SoChoDaDat INT, @TrangThaiChuyen NVARCHAR(50);
        SELECT @GiaThucTe = GiaThucTe, @SoChoToiDa = SoChoToiDa, @SoChoDaDat = SoChoDaDat, @TrangThaiChuyen = TrangThaiChuyen
        FROM dbo.CHUYENKHOIHANH WITH (UPDLOCK, HOLDLOCK) WHERE MaChuyen = @MaChuyen;

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
            SELECT 0 AS Success, 400 AS StatusCode, CONCAT(N'Không đủ số chỗ trống. Hiện chỉ còn ', (@SoChoToiDa - @SoChoDaDat), N' chỗ.') AS Message;
            RETURN;
        END;

        DECLARE @TongTien DECIMAL(18,2) = @SoLuongKhach * @GiaThucTe;
        DECLARE @MaDatTourMoi INT;

        INSERT INTO dbo.DATTOUR (MaKhachHang, MaChuyen, NgayDat, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
        VALUES (@MaKhachHang, @MaChuyen, GETDATE(), @SoLuongKhach, @TongTien, N'Chờ xác nhận', N'Chưa thanh toán');

        SET @MaDatTourMoi = SCOPE_IDENTITY();

        INSERT INTO dbo.CHITIET_HANHKHACH (MaDatTour, HoTen, SoDienThoai)
        VALUES (@MaDatTourMoi, @HoTenNguoiDat, @SoDienThoai);

        COMMIT TRANSACTION;

        SELECT 
            1 AS Success, 201 AS StatusCode, N'Đặt tour thành công, đã giữ chỗ tạm thời!' AS Message,
            @MaDatTourMoi AS MaDatTour, @TongTien AS TongTien, @SoLuongKhach AS SoLuongKhach;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- 7. [BOOKING] THÊM HÀNH KHÁCH -> POST /api/bookings/:id/passengers
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

        SELECT 1 AS Success, 201 AS StatusCode, N'Đã thêm hành khách thành công!' AS Message, SCOPE_IDENTITY() AS MaHanhKhach;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- 8. [CUSTOMER] LỊCH SỬ ĐƠN TOUR -> GET /api/user/bookings
IF OBJECT_ID(N'dbo.sp_api_GetCustomerBookings', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetCustomerBookings;
GO
CREATE PROCEDURE dbo.sp_api_GetCustomerBookings
    @MaKhachHang INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT 
            dt.MaDatTour, dt.NgayDat, t.MaTour, t.TenTour, t.HinhAnhDaiDien,
            c.NgayKhoiHanh, c.NgayKetThuc, dt.SoLuongKhach, dt.TongTien,
            dt.TrangThaiDat, dt.TrangThaiThanhToan,
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

-- 9. [CUSTOMER] HỦY ĐƠN ĐẶT TOUR -> POST /api/bookings/:id/cancel
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
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND MaKhachHang = @MaKhachHang)
        BEGIN
            SELECT 0 AS Success, 403 AS StatusCode, N'Bạn không có quyền thao tác trên đơn đặt này.' AS Message;
            RETURN;
        END;

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

        UPDATE dbo.DATTOUR SET TrangThaiDat = N'Đã hủy' WHERE MaDatTour = @MaDatTour;

        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (@MaKhachHang, N'KHACH_HUY_TOUR', CONCAT(N'Trạng thái cũ: ', @TrangThaiHienTai), @LyDoHuy, GETDATE());

        SELECT 1 AS Success, 200 AS StatusCode, N'Hủy đơn đặt tour thành công, chỗ trống đã được giải phóng.' AS Message;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- 10. [REVIEW] ĐÁNH GIÁ CHUYẾN ĐI -> POST /api/bookings/:id/review
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
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND TrangThaiDat = N'Đã hoàn thành')
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Quý khách chỉ có thể đánh giá cho chuyến đi đã hoàn thành.' AS Message;
            RETURN;
        END;

        IF EXISTS (SELECT 1 FROM dbo.DANHGIA WHERE MaDatTour = @MaDatTour)
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Đơn đặt tour này đã được đánh giá trước đó.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.DANHGIA (MaDatTour, SoSao, NoiDung, HinhAnh, NgayDanhGia, TrangThaiHienThi)
        VALUES (@MaDatTour, @SoSao, @NoiDung, @HinhAnh, GETDATE(), 1);

        SELECT 1 AS Success, 201 AS StatusCode, N'Cảm ơn quý khách đã gửi đánh giá!' AS Message, SCOPE_IDENTITY() AS MaDanhGia;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- 11. [ADMIN] DUYỆT THANH TOÁN -> POST /api/admin/bookings/:id/confirm-payment
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

-- 12. [ADMIN] THỐNG KÊ DASHBOARD KPI -> GET /api/admin/dashboard-kpi
IF OBJECT_ID(N'dbo.sp_api_Admin_GetDashboardKPI', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_GetDashboardKPI;
GO
CREATE PROCEDURE dbo.sp_api_Admin_GetDashboardKPI
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT 
            (SELECT ISNULL(SUM(SoTien), 0) FROM dbo.THANHTOAN WHERE TrangThai = N'Thành công') AS TongDoanhThu,
            (SELECT COUNT(*) FROM dbo.DATTOUR) AS TongDonDat,
            (SELECT COUNT(*) FROM dbo.DATTOUR WHERE TrangThaiDat = N'Chờ xác nhận') AS DonChoXacNhan,
            (SELECT COUNT(*) FROM dbo.NGUOIDUNG WHERE TrangThai = 1) AS TongKhachHang,
            (SELECT COUNT(*) FROM dbo.TOUR WHERE TrangThai = 1) AS TongTourDangMoBan,
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

PRINT N'==========================================================================================';
PRINT N'🎉 CHÚC MỪNG: BẠN ĐÃ TRIỂN KHAI THÀNH CÔNG 100% CSDL TOUR DU LỊCH TRÊN MICROSOFT SQL SERVER!';
PRINT N'   ĐÃ TÍCH HỢP ĐẦY ĐỦ BỘ HÀM STORED PROCEDURES PHỤC VỤ WEB API CHO BACKEND!';
PRINT N'==========================================================================================';
GO
