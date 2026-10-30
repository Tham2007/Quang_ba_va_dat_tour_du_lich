-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 02_create_tables_3nf.sql
-- Mục đích: Khởi tạo cấu trúc 12 bảng chuẩn hóa 3NF với các kiểu dữ liệu tối ưu nhất
-- ==========================================================================================

USE TourDuLichDB;
GO

-- 1. BẢNG NGUOIDUNG (Tài khoản người dùng hệ thống)
-- LƯU Ý QUAN TRỌNG: Bảng không chứa thuộc tính VaiTro (phân quyền quản trị xử lý qua ứng dụng/token claims)
IF OBJECT_ID(N'dbo.NGUOIDUNG', N'U') IS NOT NULL DROP TABLE dbo.NGUOIDUNG;
CREATE TABLE dbo.NGUOIDUNG (
    MaNguoiDung INT IDENTITY(1,1) NOT NULL,
    HoTen       NVARCHAR(100)     NOT NULL,
    Email       VARCHAR(100)      NOT NULL,
    SoDienThoai VARCHAR(15)       NOT NULL,
    MatKhau     VARCHAR(255)      NOT NULL, -- Chuỗi băm mật khẩu (Bcrypt / Argon2)
    DiaChi      NVARCHAR(200)     NULL,
    TrangThai   BIT               NOT NULL CONSTRAINT DF_NGUOIDUNG_TrangThai DEFAULT (1), -- 1: Hoạt động, 0: Bị khóa
    NgayTao     DATETIME          NOT NULL CONSTRAINT DF_NGUOIDUNG_NgayTao DEFAULT (GETDATE()),
    
    CONSTRAINT PK_NGUOIDUNG PRIMARY KEY CLUSTERED (MaNguoiDung ASC),
    CONSTRAINT UQ_NGUOIDUNG_Email UNIQUE NONCLUSTERED (Email ASC)
);
GO

-- 2. BẢNG DANHMUC (Danh mục du lịch / Điểm đến)
IF OBJECT_ID(N'dbo.DANHMUC', N'U') IS NOT NULL DROP TABLE dbo.DANHMUC;
CREATE TABLE dbo.DANHMUC (
    MaDanhMuc   INT IDENTITY(1,1) NOT NULL,
    TenDanhMuc  NVARCHAR(100)     NOT NULL,
    MoTa        NVARCHAR(MAX)     NULL,
    
    CONSTRAINT PK_DANHMUC PRIMARY KEY CLUSTERED (MaDanhMuc ASC),
    CONSTRAINT UQ_DANHMUC_TenDanhMuc UNIQUE NONCLUSTERED (TenDanhMuc ASC)
);
GO

-- 3. BẢNG TOUR (Thông tin tổng quan Tour du lịch)
IF OBJECT_ID(N'dbo.TOUR', N'U') IS NOT NULL DROP TABLE dbo.TOUR;
CREATE TABLE dbo.TOUR (
    MaTour            INT IDENTITY(1,1) NOT NULL,
    MaDanhMuc         INT               NOT NULL,
    TenTour           NVARCHAR(200)     NOT NULL,
    MoTaChiTiet       NVARCHAR(MAX)     NULL,
    LichTrinhTongQuan NVARCHAR(500)     NULL,
    GiaKhuyenNghi     DECIMAL(18,2)     NOT NULL,
    HinhAnhDaiDien    VARCHAR(255)      NULL,
    TrangThai         BIT               NOT NULL CONSTRAINT DF_TOUR_TrangThai DEFAULT (1), -- 1: Mở bán, 0: Tạm ẩn
    
    CONSTRAINT PK_TOUR PRIMARY KEY CLUSTERED (MaTour ASC)
);
GO

-- 4. BẢNG HINHANH_TOUR (Bộ sưu tập ảnh Slide Gallery của Tour - Chuẩn hóa 3NF)
IF OBJECT_ID(N'dbo.HINHANH_TOUR', N'U') IS NOT NULL DROP TABLE dbo.HINHANH_TOUR;
CREATE TABLE dbo.HINHANH_TOUR (
    MaHinhAnh   INT IDENTITY(1,1) NOT NULL,
    MaTour      INT               NOT NULL,
    DuongDanAnh VARCHAR(255)      NOT NULL,
    GhiChu      NVARCHAR(200)     NULL,
    
    CONSTRAINT PK_HINHANH_TOUR PRIMARY KEY CLUSTERED (MaHinhAnh ASC)
);
GO

-- 5. BẢNG LICH_TRINH_DETAIL (Lịch trình chi tiết từng ngày của Tour - Chuẩn hóa 3NF)
IF OBJECT_ID(N'dbo.LICH_TRINH_DETAIL', N'U') IS NOT NULL DROP TABLE dbo.LICH_TRINH_DETAIL;
CREATE TABLE dbo.LICH_TRINH_DETAIL (
    MaLichTrinh   INT IDENTITY(1,1) NOT NULL,
    MaTour        INT               NOT NULL,
    NgayThu       INT               NOT NULL, -- Ngày 1, Ngày 2, Ngày 3...
    TieuDeNgay    NVARCHAR(200)     NOT NULL,
    NoiDungChiTiet NVARCHAR(MAX)    NOT NULL,
    BuaAn         NVARCHAR(100)     NULL, -- Ví dụ: Sáng, Trưa, Tối
    
    CONSTRAINT PK_LICH_TRINH_DETAIL PRIMARY KEY CLUSTERED (MaLichTrinh ASC)
);
GO

-- 6. BẢNG CHUYENKHOIHANH (Lịch khởi hành cụ thể theo thời gian thực)
IF OBJECT_ID(N'dbo.CHUYENKHOIHANH', N'U') IS NOT NULL DROP TABLE dbo.CHUYENKHOIHANH;
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
IF OBJECT_ID(N'dbo.DATTOUR', N'U') IS NOT NULL DROP TABLE dbo.DATTOUR;
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

-- 8. BẢNG CHITIET_HANHKHACH (Danh sách hành khách đi cùng trong đơn đặt)
IF OBJECT_ID(N'dbo.CHITIET_HANHKHACH', N'U') IS NOT NULL DROP TABLE dbo.CHITIET_HANHKHACH;
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
IF OBJECT_ID(N'dbo.THANHTOAN', N'U') IS NOT NULL DROP TABLE dbo.THANHTOAN;
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

-- 10. BẢNG DANHGIA (Đánh giá chất lượng sau chuyến đi - Mỗi đơn chỉ đánh giá 1 lần)
IF OBJECT_ID(N'dbo.DANHGIA', N'U') IS NOT NULL DROP TABLE dbo.DANHGIA;
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
    CONSTRAINT UQ_DANHGIA_MaDatTour UNIQUE NONCLUSTERED (MaDatTour ASC) -- Mỗi đơn chỉ được đánh giá 1 lần duy nhất
);
GO

-- 11. BẢNG BAIVIET_QUANGBA (Bài viết truyền thông du lịch & SEO)
IF OBJECT_ID(N'dbo.BAIVIET_QUANGBA', N'U') IS NOT NULL DROP TABLE dbo.BAIVIET_QUANGBA;
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

-- 12. BẢNG AUDITLOG (Nhật ký giám sát hệ thống & An ninh)
IF OBJECT_ID(N'dbo.AUDITLOG', N'U') IS NOT NULL DROP TABLE dbo.AUDITLOG;
CREATE TABLE dbo.AUDITLOG (
    MaLog           INT IDENTITY(1,1) NOT NULL,
    MaNguoiThucHien INT               NULL, -- Có thể NULL nếu hành động phát sinh từ Background Job hoặc Trigger
    HanhDong        NVARCHAR(100)     NOT NULL,
    DuLieuCu        NVARCHAR(MAX)     NULL,
    DuLieuMoi       NVARCHAR(MAX)     NULL,
    ThoiGian        DATETIME          NOT NULL CONSTRAINT DF_AUDITLOG_ThoiGian DEFAULT (GETDATE()),
    
    CONSTRAINT PK_AUDITLOG PRIMARY KEY CLUSTERED (MaLog ASC)
);
GO

PRINT N'==> Đã khởi tạo hoàn chỉnh cấu trúc 12 bảng chuẩn 3NF thành công!';
GO
