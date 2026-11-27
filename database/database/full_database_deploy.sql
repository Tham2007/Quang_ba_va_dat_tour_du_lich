-- LEGACY / DESTRUCTIVE: SQL Server only. Drops and recreates TourDuLichDB.
-- Do not run against production or the PostgreSQL database used by API/api.
-- ==========================================================================================
-- ==========================================================================================
--              HỆ THỐNG CƠ SỞ DỮ LIỆU MICROSOFT SQL SERVER HOÀN CHỈNH
--            ĐỀ TÀI: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
--              CHUẨN HÓA 3NF (16 BẢNG) - SCRIPT DEPLOY DUY NHẤT (ALL-IN-ONE)
-- ==========================================================================================
-- ==========================================================================================
-- Tác giả: Senior Database Architect / DBA
-- Ngày hoàn thành: 2026
-- Mô tả: File script tổng hợp chạy từ đầu đến cuối (F5 trong SSMS) tạo trọn vẹn:
--   1. Database TourDuLichDB cấu hình tối ưu hiệu năng cao
--   2. Cấu trúc 16 bảng chuẩn 3NF (Bao gồm cột VaiTro và 4 bảng UC-04, 07, 10, 15)
--   3. Toàn bộ Khóa chính, Khóa ngoại (Xử lý triệt để tránh Multiple Cascade Paths)
--   4. Ràng buộc Check Constraints & Defaults toàn vẹn (Hỗ trợ SoChoGiuCho & Hoàn tiền)
--   5. Hệ thống Indexes Non-Clustered & Covering Indexes
--   6. Triggers tự động khóa giữ chỗ 15 phút, chống Overbooking, chuyển trạng thái, kiểm tra số lượng hành khách
--   7. Stored Procedures nghiệp vụ đặt tour an toàn (ACID Transaction), hoàn tiền, hủy giữ chỗ quá hạn và Thống kê Doanh thu
--   8. Views hiển thị Web, Dashboard Admin và Function tính chỗ trống
--   9. Dữ liệu mẫu thực tế, phong phú (16 bảng hoàn chỉnh)
--  10. Bộ Stored Procedures chuẩn hóa dành riêng cho Web Backend API (API Endpoints)
--  11. Hệ thống mã ưu đãi (Voucher / Promo code)
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

-- 2. Khởi tạo Cơ sở dữ liệu mới với Collation hỗ trợ Unicode tiếng Việt chuẩn xác
PRINT N'==> Đang khởi tạo CSDL TourDuLichDB...';
CREATE DATABASE TourDuLichDB
COLLATE Vietnamese_CI_AS; -- Hoặc SQL_Latin1_General_CP1_CI_AS
GO

-- 3. Cấu hình các thiết lập tối ưu cho ứng dụng Web hiện đại
ALTER DATABASE TourDuLichDB SET COMPATIBILITY_LEVEL = 150; -- SQL Server 2019+
ALTER DATABASE TourDuLichDB SET ANSI_NULL_DEFAULT OFF;
ALTER DATABASE TourDuLichDB SET ANSI_NULLS ON;
ALTER DATABASE TourDuLichDB SET ANSI_PADDING ON;
ALTER DATABASE TourDuLichDB SET ANSI_WARNINGS ON;
ALTER DATABASE TourDuLichDB SET ARITHABORT ON;
ALTER DATABASE TourDuLichDB SET AUTO_CLOSE OFF;
ALTER DATABASE TourDuLichDB SET AUTO_SHRINK OFF;
ALTER DATABASE TourDuLichDB SET AUTO_UPDATE_STATISTICS ON;
ALTER DATABASE TourDuLichDB SET RECURSIVE_TRIGGERS OFF;
ALTER DATABASE TourDuLichDB SET ALLOW_SNAPSHOT_ISOLATION ON; -- Hỗ trợ snapshot isolation cho web concurrency
ALTER DATABASE TourDuLichDB SET READ_COMMITTED_SNAPSHOT ON;  -- Chống khóa chết (deadlock) khi đọc/ghi đồng thời
GO

PRINT N'==> Khởi tạo CSDL TourDuLichDB thành công và đã cấu hình tối ưu.';
GO

-- ==========================================================================================
-- PHẦN 2: TẠO 16 BẢNG CỐT LÕI ĐẠT CHUẨN 3NF (SCHEMA CREATION)
-- ==========================================================================================
USE TourDuLichDB;
GO

IF OBJECT_ID(N'dbo.NGUOIDUNG', N'U') IS NOT NULL DROP TABLE dbo.NGUOIDUNG;
CREATE TABLE dbo.NGUOIDUNG (
    MaNguoiDung INT IDENTITY(1,1) NOT NULL,
    HoTen       NVARCHAR(100)     NOT NULL,
    Email       VARCHAR(100)      NOT NULL,
    SoDienThoai VARCHAR(15)       NOT NULL,
    MatKhau     VARCHAR(255)      NOT NULL, -- Chuỗi băm mật khẩu (Bcrypt / Argon2 / Scrypt)
    DiaChi      NVARCHAR(200)     NULL,
    VaiTro      NVARCHAR(20)      NOT NULL CONSTRAINT DF_NGUOIDUNG_VaiTro DEFAULT (N'KhachHang'), -- Admin, NhanVien, KhachHang
    TrangThai   BIT               NOT NULL CONSTRAINT DF_NGUOIDUNG_TrangThai DEFAULT (1), -- 1: Hoạt động, 0: Bị khóa
    NgayTao     DATETIME          NOT NULL CONSTRAINT DF_NGUOIDUNG_NgayTao DEFAULT (GETDATE()),
    
    CONSTRAINT PK_NGUOIDUNG PRIMARY KEY CLUSTERED (MaNguoiDung ASC),
    CONSTRAINT UQ_NGUOIDUNG_Email UNIQUE NONCLUSTERED (Email ASC)
);
GO

-- 2. BẢNG DANHMUC (Danh mục du lịch / Điểm đến vùng miền)
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
    MaDanhMuc         INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc thuộc 1 danh mục)
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
    MaTour      INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc thuộc 1 tour)
    DuongDanAnh VARCHAR(255)      NOT NULL,
    GhiChu      NVARCHAR(200)     NULL,
    
    CONSTRAINT PK_HINHANH_TOUR PRIMARY KEY CLUSTERED (MaHinhAnh ASC)
);
GO

-- 5. BẢNG LICH_TRINH_DETAIL (Lịch trình chi tiết từng ngày của Tour - Chuẩn hóa 3NF)
IF OBJECT_ID(N'dbo.LICH_TRINH_DETAIL', N'U') IS NOT NULL DROP TABLE dbo.LICH_TRINH_DETAIL;
CREATE TABLE dbo.LICH_TRINH_DETAIL (
    MaLichTrinh   INT IDENTITY(1,1) NOT NULL,
    MaTour        INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc thuộc 1 tour)
    NgayThu       INT               NOT NULL, -- Ngày 1, Ngày 2, Ngày 3...
    TieuDeNgay    NVARCHAR(200)     NOT NULL,
    NoiDungChiTiet NVARCHAR(MAX)    NOT NULL,
    BuaAn         NVARCHAR(100)     NULL, -- Ví dụ: Sáng, Trưa, Tối
    
    CONSTRAINT PK_LICH_TRINH_DETAIL PRIMARY KEY CLUSTERED (MaLichTrinh ASC)
);
GO

-- 6. BẢNG CHUYENKHOIHANH (Lịch khởi hành cụ thể theo thời gian thực)
-- Bổ sung SoChoGiuCho để phân định rõ ràng giữa:
-- - Chỗ đang khóa tạm thời khi khách đặt tour (SoChoGiuCho)
-- - Chỗ đã được kế toán/admin xác nhận thanh toán (SoChoDaDat)
-- Công thức số chỗ còn lại: SoChoConLai = SoChoToiDa - SoChoDaDat - SoChoGiuCho
IF OBJECT_ID(N'dbo.CHUYENKHOIHANH', N'U') IS NOT NULL DROP TABLE dbo.CHUYENKHOIHANH;
CREATE TABLE dbo.CHUYENKHOIHANH (
    MaChuyen        INT IDENTITY(1,1) NOT NULL,
    MaTour          INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc thuộc 1 tour)
    NgayKhoiHanh    DATETIME          NOT NULL,
    NgayKetThuc     DATETIME          NOT NULL,
    GiaThucTe       DECIMAL(18,2)     NOT NULL,
    SoChoToiDa      INT               NOT NULL,
    SoChoDaDat      INT               NOT NULL CONSTRAINT DF_CHUYEN_SoChoDaDat DEFAULT (0), -- Chỗ đã thanh toán chính thức
    SoChoGiuCho     INT               NOT NULL CONSTRAINT DF_CHUYEN_SoChoGiuCho DEFAULT (0), -- Chỗ đang khóa tạm giữ trong 15 phút
    TrangThaiChuyen NVARCHAR(50)      NOT NULL CONSTRAINT DF_CHUYEN_TrangThaiChuyen DEFAULT (N'Mở bán'),
    
    CONSTRAINT PK_CHUYENKHOIHANH PRIMARY KEY CLUSTERED (MaChuyen ASC)
);
GO

-- 7. BẢNG DATTOUR (Đơn đặt tour du lịch)
-- Thêm ThoiHanGiuCho: Thời hạn 15 phút để khách thanh toán. Sau thời hạn này, chỗ giữ sẽ được giải phóng.
IF OBJECT_ID(N'dbo.DATTOUR', N'U') IS NOT NULL DROP TABLE dbo.DATTOUR;
CREATE TABLE dbo.DATTOUR (
    MaDatTour          INT IDENTITY(1,1) NOT NULL,
    MaKhachHang        INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc có khách hàng đặt)
    MaChuyen           INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc trên 1 chuyến đi)
    NgayDat            DATETIME          NOT NULL CONSTRAINT DF_DATTOUR_NgayDat DEFAULT (GETDATE()),
    ThoiHanGiuCho      DATETIME          NULL,     -- Mặc định DATEADD(MINUTE, 15, NgayDat)
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
    MaDatTour   INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc thuộc 1 đơn đặt tour)
    HoTen       NVARCHAR(100)     NOT NULL,
    NgaySinh    DATE              NULL,
    GioiTinh    NVARCHAR(10)      NULL,
    SoDienThoai VARCHAR(15)       NULL,
    
    CONSTRAINT PK_CHITIET_HANHKHACH PRIMARY KEY CLUSTERED (MaHanhKhach ASC)
);
GO

-- 9. BẢNG THANHTOAN (Lịch sử giao dịch thanh toán & Hoàn tiền)
-- Thêm LoaiGiaoDich: 'Thanh toán' (thu tiền) hoặc 'Hoàn tiền' (trả tiền cho khách), 'Phụ thu'
IF OBJECT_ID(N'dbo.THANHTOAN', N'U') IS NOT NULL DROP TABLE dbo.THANHTOAN;
CREATE TABLE dbo.THANHTOAN (
    MaThanhToan   INT IDENTITY(1,1) NOT NULL,
    MaDatTour     INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc gắn với 1 đơn đặt tour)
    LoaiGiaoDich  NVARCHAR(50)      NOT NULL CONSTRAINT DF_THANHTOAN_LoaiGiaoDich DEFAULT (N'Thanh toán'), -- 'Thanh toán', 'Hoàn tiền', 'Phụ thu'
    PhuongThuc    NVARCHAR(50)      NOT NULL,
    SoTien        DECIMAL(18,2)     NOT NULL,
    NgayThanhToan DATETIME          NOT NULL CONSTRAINT DF_THANHTOAN_NgayThanhToan DEFAULT (GETDATE()),
    MaGiaoDich    VARCHAR(100)      NULL,
    TrangThai     NVARCHAR(50)      NOT NULL CONSTRAINT DF_THANHTOAN_TrangThai DEFAULT (N'Thành công'),
    GhiChu        NVARCHAR(500)     NULL, -- Ghi chú số tài khoản nhận hoàn tiền, lý do hoàn tiền...
    
    CONSTRAINT PK_THANHTOAN PRIMARY KEY CLUSTERED (MaThanhToan ASC)
);
GO

-- 10. BẢNG DANHGIA (Đánh giá chất lượng sau chuyến đi - Mỗi đơn chỉ đánh giá 1 lần)
IF OBJECT_ID(N'dbo.DANHGIA', N'U') IS NOT NULL DROP TABLE dbo.DANHGIA;
CREATE TABLE dbo.DANHGIA (
    MaDanhGia        INT IDENTITY(1,1) NOT NULL,
    MaDatTour        INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc từ 1 đơn tour đã hoàn thành)
    SoSao            TINYINT           NOT NULL CONSTRAINT DF_DANHGIA_SoSao DEFAULT (5),
    NoiDung          NVARCHAR(1000)    NULL,
    HinhAnh          NVARCHAR(500)     NULL,
    NgayDanhGia      DATETIME          NOT NULL CONSTRAINT DF_DANHGIA_NgayDanhGia DEFAULT (GETDATE()),
    TrangThaiHienThi BIT               NOT NULL CONSTRAINT DF_DANHGIA_TrangThaiHienThi DEFAULT (1),
    PhanHoiAdmin     NVARCHAR(1000)    NULL,
    
    CONSTRAINT PK_DANHGIA PRIMARY KEY CLUSTERED (MaDanhGia ASC),
    CONSTRAINT UQ_DANHGIA_MaDatTour UNIQUE NONCLUSTERED (MaDatTour ASC)
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
    MaNguoiDang    INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc có tác giả người đăng)
    
    CONSTRAINT PK_BAIVIET_QUANGBA PRIMARY KEY CLUSTERED (MaBaiViet ASC),
    CONSTRAINT UQ_BAIVIET_Slug UNIQUE NONCLUSTERED (Slug ASC)
);
GO

-- 12. BẢNG AUDITLOG (Nhật ký giám sát hệ thống & An ninh)
IF OBJECT_ID(N'dbo.AUDITLOG', N'U') IS NOT NULL DROP TABLE dbo.AUDITLOG;
CREATE TABLE dbo.AUDITLOG (
    MaLog           INT IDENTITY(1,1) NOT NULL,
    MaNguoiThucHien INT               NULL, -- NULL nếu hành động phát sinh từ Background Job hoặc Trigger tự động
    HanhDong        NVARCHAR(100)     NOT NULL,
    DuLieuCu        NVARCHAR(MAX)     NULL,
    DuLieuMoi       NVARCHAR(MAX)     NULL,
    ThoiGian        DATETIME          NOT NULL CONSTRAINT DF_AUDITLOG_ThoiGian DEFAULT (GETDATE()),
    
    CONSTRAINT PK_AUDITLOG PRIMARY KEY CLUSTERED (MaLog ASC)
);
GO

-- 13. BẢNG YEUCAU_HOANTIEN_DOILICH (Phục vụ UC-10: Yêu cầu đổi lịch, hủy tour, hoàn tiền)
IF OBJECT_ID(N'dbo.YEUCAU_HOANTIEN_DOILICH', N'U') IS NOT NULL DROP TABLE dbo.YEUCAU_HOANTIEN_DOILICH;
CREATE TABLE dbo.YEUCAU_HOANTIEN_DOILICH (
    MaYeuCau         INT IDENTITY(1,1) NOT NULL,
    MaDatTour        INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc thuộc đơn đặt tour)
    MaKhachHang      INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc do khách hàng gửi)
    LoaiYeuCau       NVARCHAR(50)      NOT NULL, -- 'Hủy tour hoàn tiền', 'Đổi lịch khởi hành', 'Đổi thông tin hành khách'
    LyDo             NVARCHAR(1000)    NOT NULL,
    SoTienYeuCauHoan DECIMAL(18,2)     NULL,
    ThongTinNganHang NVARCHAR(255)     NULL,     -- Tên chủ TK, Số tài khoản, Ngân hàng nhận hoàn tiền
    TrangThai        NVARCHAR(50)      NOT NULL CONSTRAINT DF_YEUCAU_TrangThai DEFAULT (N'Chờ xử lý'), -- 'Chờ xử lý', 'Đã duyệt', 'Từ chối'
    PhanHoiAdmin     NVARCHAR(1000)    NULL,
    NgayTao          DATETIME          NOT NULL CONSTRAINT DF_YEUCAU_NgayTao DEFAULT (GETDATE()),
    NgayXuLy         DATETIME          NULL,
    NguoiXuLy        INT               NULL,     -- FK NGUOIDUNG (Nhân viên/Admin xử lý)
    
    CONSTRAINT PK_YEUCAU_HOANTIEN_DOILICH PRIMARY KEY CLUSTERED (MaYeuCau ASC)
);
GO

-- 14. BẢNG TOUR_YEUTHICH (Phục vụ UC-07: Lưu tour yêu thích của khách hàng)
IF OBJECT_ID(N'dbo.TOUR_YEUTHICH', N'U') IS NOT NULL DROP TABLE dbo.TOUR_YEUTHICH;
CREATE TABLE dbo.TOUR_YEUTHICH (
    MaYeuThich  INT IDENTITY(1,1) NOT NULL,
    MaNguoiDung INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc là người dùng)
    MaTour      INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc là một tour)
    NgayLuu     DATETIME          NOT NULL CONSTRAINT DF_YEUTHICH_NgayLuu DEFAULT (GETDATE()),
    
    CONSTRAINT PK_TOUR_YEUTHICH PRIMARY KEY CLUSTERED (MaYeuThich ASC),
    CONSTRAINT UQ_TOUR_YEUTHICH UNIQUE NONCLUSTERED (MaNguoiDung ASC, MaTour ASC) -- Mỗi người chỉ thích 1 tour 1 lần
);
GO

-- 15. BẢNG LIENHE_TUVAN (Phục vụ UC-04: Yêu cầu tư vấn của khách viếng thăm / Guest)
IF OBJECT_ID(N'dbo.LIENHE_TUVAN', N'U') IS NOT NULL DROP TABLE dbo.LIENHE_TUVAN;
CREATE TABLE dbo.LIENHE_TUVAN (
    MaLienHe     INT IDENTITY(1,1) NOT NULL,
    HoTen        NVARCHAR(100)     NOT NULL,
    Email        VARCHAR(100)      NULL,
    SoDienThoai  VARCHAR(15)       NOT NULL,
    MaTour       INT               NULL,     -- Khóa ngoại tùy chọn: Khách có thể hỏi về 1 tour cụ thể hoặc hỏi chung
    NoiDung      NVARCHAR(1000)    NOT NULL,
    TrangThai    NVARCHAR(50)      NOT NULL CONSTRAINT DF_LIENHE_TrangThai DEFAULT (N'Chưa xử lý'), -- 'Chưa xử lý', 'Đã liên hệ', 'Đã hủy'
    GhiChuAdmin  NVARCHAR(500)     NULL,
    NgayGui      DATETIME          NOT NULL CONSTRAINT DF_LIENHE_NgayGui DEFAULT (GETDATE()),
    NguoiXuLy    INT               NULL,     -- FK NGUOIDUNG (Nhân viên chăm sóc khách hàng)
    
    CONSTRAINT PK_LIENHE_TUVAN PRIMARY KEY CLUSTERED (MaLienHe ASC)
);
GO

-- 16. BẢNG BANNER_QUANGCAO (Phục vụ UC-15: Quản trị banner quảng cáo / slide trang chủ)
IF OBJECT_ID(N'dbo.BANNER_QUANGCAO', N'U') IS NOT NULL DROP TABLE dbo.BANNER_QUANGCAO;
CREATE TABLE dbo.BANNER_QUANGCAO (
    MaBanner      INT IDENTITY(1,1) NOT NULL,
    TieuDe        NVARCHAR(200)     NOT NULL,
    HinhAnh       VARCHAR(255)      NOT NULL,
    LienKet       VARCHAR(255)      NULL,     -- Đường dẫn link khi click banner
    ViTri         NVARCHAR(50)      NOT NULL CONSTRAINT DF_BANNER_ViTri DEFAULT (N'TrangChu_Hero'), -- 'TrangChu_Hero', 'TrangChu_GiuaTrang', 'Sidebar'
    ThuTuHienThi  INT               NOT NULL CONSTRAINT DF_BANNER_ThuTu DEFAULT (1),
    TrangThai     BIT               NOT NULL CONSTRAINT DF_BANNER_TrangThai DEFAULT (1), -- 1: Đang hiển thị, 0: Ẩn
    NgayBatDau    DATETIME          NULL,
    NgayKetThuc   DATETIME          NULL,
    NgayTao       DATETIME          NOT NULL CONSTRAINT DF_BANNER_NgayTao DEFAULT (GETDATE()),
    MaNguoiTao    INT               NOT NULL, -- Khóa ngoại tham gia toàn phần (Bắt buộc người tạo là Admin/Nhân viên)
    
    CONSTRAINT PK_BANNER_QUANGCAO PRIMARY KEY CLUSTERED (MaBanner ASC)
);
GO

PRINT N'==> Đã khởi tạo hoàn chỉnh cấu trúc 16 bảng CSDL chuẩn hóa 3NF thành công!';
GO

-- ==========================================================================================
-- PHẦN 3: THIẾT LẬP KHÓA NGOẠI (FOREIGN KEYS) & CHECK CONSTRAINTS
-- Xử lý triệt để không bị lỗi Multiple Cascade Paths trong SQL Server
-- ==========================================================================================
USE TourDuLichDB;
GO

PRINT N'==> Đang thiết lập các ràng buộc Khóa ngoại (Foreign Keys)...';

-- 1. Khóa ngoại bảng TOUR -> DANHMUC
ALTER TABLE dbo.TOUR WITH CHECK 
ADD CONSTRAINT FK_TOUR_DANHMUC FOREIGN KEY (MaDanhMuc)
REFERENCES dbo.DANHMUC (MaDanhMuc)
ON UPDATE CASCADE
ON DELETE NO ACTION; -- Không cho xóa danh mục nếu còn tour trực thuộc

-- 2. Khóa ngoại bảng HINHANH_TOUR -> TOUR
ALTER TABLE dbo.HINHANH_TOUR WITH CHECK 
ADD CONSTRAINT FK_HINHANHTOUR_TOUR FOREIGN KEY (MaTour)
REFERENCES dbo.TOUR (MaTour)
ON UPDATE CASCADE
ON DELETE CASCADE; -- Xóa tour thì tự động xóa sạch ảnh gallery của tour đó

-- 3. Khóa ngoại bảng LICH_TRINH_DETAIL -> TOUR
ALTER TABLE dbo.LICH_TRINH_DETAIL WITH CHECK 
ADD CONSTRAINT FK_LICHTRINH_TOUR FOREIGN KEY (MaTour)
REFERENCES dbo.TOUR (MaTour)
ON UPDATE CASCADE
ON DELETE CASCADE; -- Xóa tour thì tự động xóa lịch trình các ngày

-- 4. Khóa ngoại bảng CHUYENKHOIHANH -> TOUR
ALTER TABLE dbo.CHUYENKHOIHANH WITH CHECK 
ADD CONSTRAINT FK_CHUYENKHOIHANH_TOUR FOREIGN KEY (MaTour)
REFERENCES dbo.TOUR (MaTour)
ON UPDATE CASCADE
ON DELETE NO ACTION; -- Bảo toàn dữ liệu chuyến đi, tránh multiple cascade paths

-- 5. Khóa ngoại bảng DATTOUR -> NGUOIDUNG (Khách hàng)
ALTER TABLE dbo.DATTOUR WITH CHECK 
ADD CONSTRAINT FK_DATTOUR_NGUOIDUNG FOREIGN KEY (MaKhachHang)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE NO ACTION
ON DELETE NO ACTION; -- Không bao giờ xóa tài khoản nếu khách đã có lịch sử đặt tour (Kế toán)

-- 6. Khóa ngoại bảng DATTOUR -> CHUYENKHOIHANH
ALTER TABLE dbo.DATTOUR WITH CHECK 
ADD CONSTRAINT FK_DATTOUR_CHUYENKHOIHANH FOREIGN KEY (MaChuyen)
REFERENCES dbo.CHUYENKHOIHANH (MaChuyen)
ON UPDATE NO ACTION
ON DELETE NO ACTION; -- Không xóa chuyến đi khi đã có đơn đặt phòng/chỗ

-- 7. Khóa ngoại bảng CHITIET_HANHKHACH -> DATTOUR
ALTER TABLE dbo.CHITIET_HANHKHACH WITH CHECK 
ADD CONSTRAINT FK_CHITIETHANHKHACH_DATTOUR FOREIGN KEY (MaDatTour)
REFERENCES dbo.DATTOUR (MaDatTour)
ON UPDATE CASCADE
ON DELETE CASCADE; -- Xóa đơn đặt tour thì dọn dẹp danh sách hành khách đi cùng

-- 8. Khóa ngoại bảng THANHTOAN -> DATTOUR
ALTER TABLE dbo.THANHTOAN WITH CHECK 
ADD CONSTRAINT FK_THANHTOAN_DATTOUR FOREIGN KEY (MaDatTour)
REFERENCES dbo.DATTOUR (MaDatTour)
ON UPDATE NO ACTION
ON DELETE NO ACTION; -- Bảo vệ chứng từ giao dịch kế toán

-- 9. Khóa ngoại bảng DANHGIA -> DATTOUR
ALTER TABLE dbo.DANHGIA WITH CHECK 
ADD CONSTRAINT FK_DANHGIA_DATTOUR FOREIGN KEY (MaDatTour)
REFERENCES dbo.DATTOUR (MaDatTour)
ON UPDATE CASCADE
ON DELETE CASCADE; -- Xóa đơn tour thì xóa đánh giá đi kèm

-- 10. Khóa ngoại bảng BAIVIET_QUANGBA -> NGUOIDUNG (Tác giả)
ALTER TABLE dbo.BAIVIET_QUANGBA WITH CHECK 
ADD CONSTRAINT FK_BAIVIET_NGUOIDUNG FOREIGN KEY (MaNguoiDang)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE CASCADE
ON DELETE NO ACTION;

-- 11. Khóa ngoại bảng AUDITLOG -> NGUOIDUNG
ALTER TABLE dbo.AUDITLOG WITH CHECK 
ADD CONSTRAINT FK_AUDITLOG_NGUOIDUNG FOREIGN KEY (MaNguoiThucHien)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE CASCADE
ON DELETE SET NULL; -- Nếu người dùng bị xóa thì gán Người thực hiện log về NULL, giữ nguyên lịch sử

-- 12. Khóa ngoại bảng YEUCAU_HOANTIEN_DOILICH -> DATTOUR & NGUOIDUNG (UC-10)
ALTER TABLE dbo.YEUCAU_HOANTIEN_DOILICH WITH CHECK
ADD CONSTRAINT FK_YEUCAU_DATTOUR FOREIGN KEY (MaDatTour)
REFERENCES dbo.DATTOUR (MaDatTour)
ON UPDATE NO ACTION
ON DELETE NO ACTION;

ALTER TABLE dbo.YEUCAU_HOANTIEN_DOILICH WITH CHECK
ADD CONSTRAINT FK_YEUCAU_KHACHHANG FOREIGN KEY (MaKhachHang)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE NO ACTION
ON DELETE NO ACTION;

ALTER TABLE dbo.YEUCAU_HOANTIEN_DOILICH WITH CHECK
ADD CONSTRAINT FK_YEUCAU_NGUOIXULY FOREIGN KEY (NguoiXuLy)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE NO ACTION
ON DELETE NO ACTION;

-- 13. Khóa ngoại bảng TOUR_YEUTHICH -> NGUOIDUNG & TOUR (UC-07)
ALTER TABLE dbo.TOUR_YEUTHICH WITH CHECK
ADD CONSTRAINT FK_YEUTHICH_NGUOIDUNG FOREIGN KEY (MaNguoiDung)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE CASCADE
ON DELETE CASCADE;

ALTER TABLE dbo.TOUR_YEUTHICH WITH CHECK
ADD CONSTRAINT FK_YEUTHICH_TOUR FOREIGN KEY (MaTour)
REFERENCES dbo.TOUR (MaTour)
ON UPDATE CASCADE
ON DELETE CASCADE;

-- 14. Khóa ngoại bảng LIENHE_TUVAN -> TOUR & NGUOIDUNG (UC-04)
ALTER TABLE dbo.LIENHE_TUVAN WITH CHECK
ADD CONSTRAINT FK_LIENHE_TOUR FOREIGN KEY (MaTour)
REFERENCES dbo.TOUR (MaTour)
ON UPDATE SET NULL
ON DELETE SET NULL;

ALTER TABLE dbo.LIENHE_TUVAN WITH CHECK
ADD CONSTRAINT FK_LIENHE_NGUOIXULY FOREIGN KEY (NguoiXuLy)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE NO ACTION
ON DELETE NO ACTION;

-- 15. Khóa ngoại bảng BANNER_QUANGCAO -> NGUOIDUNG (UC-15)
ALTER TABLE dbo.BANNER_QUANGCAO WITH CHECK
ADD CONSTRAINT FK_BANNER_NGUOITAO FOREIGN KEY (MaNguoiTao)
REFERENCES dbo.NGUOIDUNG (MaNguoiDung)
ON UPDATE CASCADE
ON DELETE NO ACTION;

PRINT N'==> Đã thiết lập xong toàn bộ Foreign Keys chuẩn xác và an toàn cho 16 bảng.';
GO

-- ==========================================================================================
-- THIẾT LẬP RÀNG BUỘC KIỂM TRA TOÀN VẸN (CHECK CONSTRAINTS)
-- ==========================================================================================
PRINT N'==> Đang thiết lập các ràng buộc Check Constraints...';

-- 1. Phân quyền vai trò người dùng chuẩn
ALTER TABLE dbo.NGUOIDUNG ADD CONSTRAINT CK_NGUOIDUNG_VaiTro
CHECK (VaiTro IN (N'Admin', N'NhanVien', N'KhachHang', N'CUSTOMER', N'ADMIN', N'STAFF'));

-- 2. Giá khuyến nghị của Tour phải >= 0
ALTER TABLE dbo.TOUR ADD CONSTRAINT CK_TOUR_GiaKhuyenNghi 
CHECK (GiaKhuyenNghi >= 0);

-- 3. Lịch trình ngày thứ phải > 0
ALTER TABLE dbo.LICH_TRINH_DETAIL ADD CONSTRAINT CK_LICHTRINH_NgayThu 
CHECK (NgayThu > 0);

-- 4. Ngày kết thúc chuyến đi phải >= Ngày khởi hành
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_ThoiGian 
CHECK (NgayKetThuc >= NgayKhoiHanh);

-- 5. Giá thực tế của chuyến khởi hành phải >= 0
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_GiaThucTe 
CHECK (GiaThucTe >= 0);

-- 6. Số chỗ tối đa phải > 0
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_SoChoToiDa 
CHECK (SoChoToiDa > 0);

-- 7. Số chỗ đã đặt & số chỗ giữ phải hợp lệ (BR1: SoChoDaDat + SoChoGiuCho <= SoChoToiDa)
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_SoChoHopLe 
CHECK (SoChoDaDat >= 0 AND SoChoGiuCho >= 0 AND (SoChoDaDat + SoChoGiuCho) <= SoChoToiDa);

-- 8. Trạng thái chuyến khởi hành hợp lệ
ALTER TABLE dbo.CHUYENKHOIHANH ADD CONSTRAINT CK_CHUYEN_TrangThai 
CHECK (TrangThaiChuyen IN (N'Mở bán', N'Hết chỗ', N'Hoàn thành', N'Hủy chuyến', N'Tạm dừng'));

-- 9. Số lượng khách trong đơn đặt phải > 0
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_SoLuongKhach 
CHECK (SoLuongKhach > 0);

-- 10. Tổng tiền đơn đặt tour phải >= 0
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TongTien 
CHECK (TongTien >= 0);

-- 11. Trạng thái đơn đặt tour quy chuẩn
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TrangThaiDat 
CHECK (TrangThaiDat IN (N'Chờ xác nhận', N'Đã xác nhận', N'Đã hoàn thành', N'Đã hủy'));

-- 12. Trạng thái thanh toán quy chuẩn
ALTER TABLE dbo.DATTOUR ADD CONSTRAINT CK_DATTOUR_TrangThaiThanhToan 
CHECK (TrangThaiThanhToan IN (N'Chưa thanh toán', N'Đã cọc', N'Đã thanh toán', N'Đã hoàn tiền'));

-- 13. Phân loại giao dịch thanh toán và hoàn tiền
ALTER TABLE dbo.THANHTOAN ADD CONSTRAINT CK_THANHTOAN_LoaiGiaoDich
CHECK (LoaiGiaoDich IN (N'Thanh toán', N'Hoàn tiền', N'Phụ thu'));

-- 14. Số tiền thanh toán/hoàn tiền phải > 0 (Phân biệt chiều dòng tiền qua LoaiGiaoDich)
ALTER TABLE dbo.THANHTOAN ADD CONSTRAINT CK_THANHTOAN_SoTien 
CHECK (SoTien > 0);

-- 15. Điểm số đánh giá bắt buộc từ 1 đến 5 sao
ALTER TABLE dbo.DANHGIA ADD CONSTRAINT CK_DANHGIA_SoSao 
CHECK (SoSao BETWEEN 1 AND 5);

-- 16. Lượt xem bài viết phải >= 0
ALTER TABLE dbo.BAIVIET_QUANGBA ADD CONSTRAINT CK_BAIVIET_LuotXem 
CHECK (LuotXem >= 0);

-- 17. Loại yêu cầu hỗ trợ đổi/hủy/hoàn tiền (UC-10)
ALTER TABLE dbo.YEUCAU_HOANTIEN_DOILICH ADD CONSTRAINT CK_YEUCAU_LoaiYeuCau
CHECK (LoaiYeuCau IN (N'Hủy tour hoàn tiền', N'Đổi lịch khởi hành', N'Đổi thông tin hành khách'));

-- 18. Trạng thái xử lý yêu cầu đổi/hủy/hoàn tiền
ALTER TABLE dbo.YEUCAU_HOANTIEN_DOILICH ADD CONSTRAINT CK_YEUCAU_TrangThai
CHECK (TrangThai IN (N'Chờ xử lý', N'Đã duyệt', N'Từ chối'));

-- 19. Trạng thái xử lý yêu cầu tư vấn (UC-04)
ALTER TABLE dbo.LIENHE_TUVAN ADD CONSTRAINT CK_LIENHE_TrangThai
CHECK (TrangThai IN (N'Chưa xử lý', N'Đã liên hệ', N'Đã hủy'));

-- 20. Vị trí hiển thị banner quảng cáo (UC-15)
ALTER TABLE dbo.BANNER_QUANGCAO ADD CONSTRAINT CK_BANNER_ViTri
CHECK (ViTri IN (N'TrangChu_Hero', N'TrangChu_GiuaTrang', N'Sidebar'));

PRINT N'==> Đã thiết lập xong toàn bộ 20 Check Constraints đảm bảo tính toàn vẹn nghiệp vụ!';
GO

-- ==========================================================================================
-- PHẦN 4: HỆ THỐNG INDEXES TỐI ƯU HÓA HIỆU NĂNG TRUY VẤN
-- ==========================================================================================
USE TourDuLichDB;
GO

PRINT N'==> Đang khởi tạo hệ thống Chỉ mục tối ưu hóa truy vấn (Performance Indexes)...';

-- 1. Tối ưu tìm kiếm và lọc Tour theo danh mục và giá
CREATE NONCLUSTERED INDEX IX_TOUR_MaDanhMuc_TrangThai
ON dbo.TOUR (MaDanhMuc ASC, TrangThai ASC)
INCLUDE (TenTour, GiaKhuyenNghi, HinhAnhDaiDien);
GO

-- 2. Tối ưu tải ảnh gallery cho một tour
CREATE NONCLUSTERED INDEX IX_HINHANH_TOUR_MaTour
ON dbo.HINHANH_TOUR (MaTour ASC)
INCLUDE (DuongDanAnh, GhiChu);
GO

-- 3. Tối ưu load lịch trình từng ngày theo thứ tự ngày tăng dần (Day 1 -> Day N)
CREATE NONCLUSTERED INDEX IX_LICH_TRINH_DETAIL_MaTour_NgayThu
ON dbo.LICH_TRINH_DETAIL (MaTour ASC, NgayThu ASC)
INCLUDE (TieuDeNgay, NoiDungChiTiet, BuaAn);
GO

-- 4. Tối ưu tra cứu chuyến khởi hành còn chỗ theo ngày đi và giá thực tế
CREATE NONCLUSTERED INDEX IX_CHUYENKHOIHANH_MaTour_NgayKhoiHanh
ON dbo.CHUYENKHOIHANH (MaTour ASC, NgayKhoiHanh ASC)
INCLUDE (NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen);
GO

-- 5. Tối ưu lịch sử đơn đặt tour của khách hàng
CREATE NONCLUSTERED INDEX IX_DATTOUR_MaKhachHang_NgayDat
ON dbo.DATTOUR (MaKhachHang ASC, NgayDat DESC)
INCLUDE (MaChuyen, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan);
GO

-- 6. Tối ưu tổng hợp đơn hàng theo chuyến khởi hành và trạng thái đơn
CREATE NONCLUSTERED INDEX IX_DATTOUR_MaChuyen_TrangThaiDat
ON dbo.DATTOUR (MaChuyen ASC, TrangThaiDat ASC)
INCLUDE (SoLuongKhach, TongTien);
GO

-- 7. Tối ưu load danh sách hành khách theo đơn đặt tour
CREATE NONCLUSTERED INDEX IX_CHITIET_HANHKHACH_MaDatTour
ON dbo.CHITIET_HANHKHACH (MaDatTour ASC)
INCLUDE (HoTen, NgaySinh, GioiTinh, SoDienThoai);
GO

-- 8. Tối ưu tra cứu các giao dịch thanh toán của đơn đặt tour
CREATE NONCLUSTERED INDEX IX_THANHTOAN_MaDatTour
ON dbo.THANHTOAN (MaDatTour ASC)
INCLUDE (PhuongThuc, SoTien, NgayThanhToan, TrangThai);
GO

-- 9. Tối ưu tra cứu bài viết theo người đăng và thời gian
CREATE NONCLUSTERED INDEX IX_BAIVIET_QUANGBA_MaNguoiDang_NgayTao
ON dbo.BAIVIET_QUANGBA (MaNguoiDang ASC, NgayTao DESC)
INCLUDE (TieuDe, Slug, LuotXem, TrangThai);
GO

-- 10. Tối ưu tra cứu Audit Log theo thời gian và người thực hiện
CREATE NONCLUSTERED INDEX IX_AUDITLOG_ThoiGian_MaNguoiThucHien
ON dbo.AUDITLOG (ThoiGian DESC, MaNguoiThucHien ASC)
INCLUDE (HanhDong);
GO

-- 11. Tối ưu tra cứu yêu cầu hoàn tiền/đổi lịch theo đơn đặt tour và trạng thái
CREATE NONCLUSTERED INDEX IX_YEUCAU_MaDatTour_TrangThai
ON dbo.YEUCAU_HOANTIEN_DOILICH (MaDatTour ASC, TrangThai ASC)
INCLUDE (MaKhachHang, LoaiYeuCau, SoTienYeuCauHoan, NgayTao);
GO

-- 12. Tối ưu danh sách tour yêu thích của khách hàng
CREATE NONCLUSTERED INDEX IX_TOUR_YEUTHICH_MaNguoiDung
ON dbo.TOUR_YEUTHICH (MaNguoiDung ASC, NgayLuu DESC)
INCLUDE (MaTour);
GO

-- 13. Tối ưu tra cứu yêu cầu tư vấn theo trạng thái xử lý
CREATE NONCLUSTERED INDEX IX_LIENHE_TUVAN_TrangThai_NgayGui
ON dbo.LIENHE_TUVAN (TrangThai ASC, NgayGui DESC)
INCLUDE (HoTen, SoDienThoai, Email, MaTour);
GO

-- 14. Tối ưu hiển thị banner trang chủ theo vị trí và thứ tự
CREATE NONCLUSTERED INDEX IX_BANNER_QUANGCAO_ViTri_TrangThai
ON dbo.BANNER_QUANGCAO (ViTri ASC, TrangThai ASC, ThuTuHienThi ASC)
INCLUDE (TieuDe, HinhAnh, LienKet);
GO

PRINT N'==> Khởi tạo hệ thống Indexes tối ưu hóa thành công!';
GO

-- ==========================================================================================
-- PHẦN 5: TRIGGERS NGHIỆP VỤ CỐT LÕI (CHỐNG OVERBOOKING, HOÀN CHỖ, ĐÁNH GIÁ, KIỂM TRA HÀNH KHÁCH)
-- ==========================================================================================
USE TourDuLichDB;
GO

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

-- ==========================================================================================
-- PHẦN 6: STORED PROCEDURES NGHIỆP VỤ & BÁO CÁO THỐNG KÊ
-- ==========================================================================================
USE TourDuLichDB;
GO

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

IF OBJECT_ID(N'dbo.sp_ThongKeDoanhThuVaDonHang', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ThongKeDoanhThuVaDonHang;
GO

CREATE PROCEDURE dbo.sp_ThongKeDoanhThuVaDonHang
    @TuNgay  DATETIME,
    @DenNgay DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    -- Chuẩn hóa thời gian kết thúc ngày (23:59:59)
    DECLARE @NgayKetThucChuan DATETIME = DATEADD(SECOND, -1, DATEADD(DAY, 1, CAST(CAST(@DenNgay AS DATE) AS DATETIME)));

    PRINT N'====================================================================================';
    PRINT N'             BÁO CÁO THỐNG KÊ DOANH THU & KẾT QUẢ KINH DOANH TOUR DU LỊCH           ';
    PRINT CONCAT(N' Giai đoạn: Từ ngày ', CONVERT(VARCHAR(10), @TuNgay, 105), N' đến ngày ', CONVERT(VARCHAR(10), @DenNgay, 105));
    PRINT N'====================================================================================';

    -- BẢNG 1: TỔNG QUAN CÁC CHỈ SỐ KPI CHÍNH
    SELECT 
        COUNT(DISTINCT dt.MaDatTour) AS TongSoDonDat,
        
        -- Đơn thành công: 'Đã xác nhận' hoặc 'Đã hoàn thành'
        SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS SoDonThanhCong,
        
        -- Đơn đã hủy
        SUM(CASE WHEN dt.TrangThaiDat = N'Đã hủy' THEN 1 ELSE 0 END) AS SoDonDaHuy,
        
        -- Tổng số hành khách của các đơn thành công
        ISNULL(SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN dt.SoLuongKhach ELSE 0 END), 0) AS TongSoKhachPhucVu,
        
        -- Tổng giá trị đơn đặt thành công
        ISNULL(SUM(CASE WHEN dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành') THEN dt.TongTien ELSE 0 END), 0) AS TongGiaTriDonThanhCong,
        
        -- Tổng doanh thu thực tế đã thu về qua cổng thanh toán
        (
            SELECT ISNULL(SUM(tt.SoTien), 0)
            FROM dbo.THANHTOAN tt
            JOIN dbo.DATTOUR d ON tt.MaDatTour = d.MaDatTour
            WHERE tt.NgayThanhToan BETWEEN @TuNgay AND @NgayKetThucChuan
              AND tt.TrangThai = N'Thành công'
        ) AS DoanhThuThucThu
    FROM dbo.DATTOUR dt
    WHERE dt.NgayDat BETWEEN @TuNgay AND @NgayKetThucChuan;

    -- BẢNG 2: PHÂN TÍCH DOANH THU VÀ SỐ ĐƠN THEO TỪNG DANH MỤC DU LỊCH
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

PRINT N'==> Đã tạo Stored Procedure sp_ThongKeDoanhThuVaDonHang thành công.';
GO

-- ==========================================================================================
-- 2. PROCEDURE: THỐNG KÊ TOP N TOUR ĐƯỢC ĐẶT NHIỀU NHẤT
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_ThongKeTopTourBanChay', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ThongKeTopTourBanChay;
GO

CREATE PROCEDURE dbo.sp_ThongKeTopTourBanChay
    @TopN INT = 5
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@TopN)
        t.MaTour,
        t.TenTour,
        dm.TenDanhMuc,
        t.GiaKhuyenNghi,
        COUNT(dt.MaDatTour) AS TongSoDonDat,
        ISNULL(SUM(dt.SoLuongKhach), 0) AS TongSoKhach,
        ISNULL(SUM(dt.TongTien), 0) AS TongDoanhThu,
        ISNULL(AVG(CAST(dg.SoSao AS FLOAT)), 5.0) AS DiemDanhGiaTrungBinh
    FROM dbo.TOUR t
    JOIN dbo.DANHMUC dm ON t.MaDanhMuc = dm.MaDanhMuc
    JOIN dbo.CHUYENKHOIHANH c ON t.MaTour = c.MaTour
    LEFT JOIN dbo.DATTOUR dt ON c.MaChuyen = dt.MaChuyen AND dt.TrangThaiDat IN (N'Đã xác nhận', N'Đã hoàn thành')
    LEFT JOIN dbo.DANHGIA dg ON dt.MaDatTour = dg.MaDatTour
    GROUP BY t.MaTour, t.TenTour, dm.TenDanhMuc, t.GiaKhuyenNghi
    ORDER BY TongDoanhThu DESC, TongSoKhach DESC;
END;
GO

PRINT N'==> Đã tạo Stored Procedure sp_ThongKeTopTourBanChay thành công.';
GO

-- ==========================================================================================
-- PHẦN 7: VIEWS VÀ FUNCTIONS HỖ TRỢ GIAO DIỆN & TIỆN ÍCH
-- ==========================================================================================
USE TourDuLichDB;
GO

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

PRINT N'==> Đã tạo Function fn_TinhSoChoConLai thành công.';
GO

-- ==========================================================================================
-- 2. FUNCTION: KIỂM TRA TÍNH TOÀN VẸN DANH SÁCH HÀNH KHÁCH CỦA ĐƠN ĐẶT TOUR
-- Trả về 1 nếu số hành khách khai báo >= 1 và bằng đúng SoLuongKhach của đơn đặt tour
-- ==========================================================================================
IF OBJECT_ID(N'dbo.fn_KiemTraHopLeDanhSachKhach', N'FN') IS NOT NULL
    DROP FUNCTION dbo.fn_KiemTraHopLeDanhSachKhach;
GO

CREATE FUNCTION dbo.fn_KiemTraHopLeDanhSachKhach (@MaDatTour INT)
RETURNS BIT
AS
BEGIN
    DECLARE @SoChoDat INT = 0;
    DECLARE @SoKhachThucTe INT = 0;

    SELECT @SoChoDat = SoLuongKhach
    FROM dbo.DATTOUR
    WHERE MaDatTour = @MaDatTour;

    IF @SoChoDat IS NULL OR @SoChoDat <= 0
        RETURN 0;

    SELECT @SoKhachThucTe = COUNT(*)
    FROM dbo.CHITIET_HANHKHACH
    WHERE MaDatTour = @MaDatTour;

    IF @SoChoDat = @SoKhachThucTe
        RETURN 1;

    RETURN 0;
END;
GO

PRINT N'==> Đã tạo Function fn_KiemTraHopLeDanhSachKhach thành công.';
GO

-- ==========================================================================================
-- 3. VIEW: DANH SÁCH TOUR DU LỊCH HIỂN THỊ TRANG CHỦ & TÌM KIẾM
-- Tổng hợp thông tin tour, điểm đánh giá trung bình, số lượt review và giá bán khởi điểm
-- ==========================================================================================
IF OBJECT_ID(N'dbo.v_DanhSachTourHienThi', N'V') IS NOT NULL
    DROP VIEW dbo.v_DanhSachTourHienThi;
GO

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

PRINT N'==> Đã tạo View v_DanhSachTourHienThi thành công.';
GO

-- ==========================================================================================
-- 4. VIEW: DANH SÁCH CHUYẾN KHỞI HÀNH KHẢ DỤNG (CÒN CHỖ)
-- Thể hiện rõ số chỗ đã đặt chính thức, số chỗ đang giữ tạm 15 phút, và số chỗ còn lại (BR1)
-- ==========================================================================================
IF OBJECT_ID(N'dbo.v_DanhSachChuyenKhoiHanhConCho', N'V') IS NOT NULL
    DROP VIEW dbo.v_DanhSachChuyenKhoiHanhConCho;
GO

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
    c.SoChoGiuCho,
    (c.SoChoToiDa - c.SoChoDaDat - ISNULL(c.SoChoGiuCho, 0)) AS SoChoConLai,
    c.TrangThaiChuyen
FROM dbo.CHUYENKHOIHANH c
JOIN dbo.TOUR t ON c.MaTour = t.MaTour
WHERE c.TrangThaiChuyen = N'Mở bán'
  AND (c.SoChoToiDa - c.SoChoDaDat - ISNULL(c.SoChoGiuCho, 0)) > 0;
GO

PRINT N'==> Đã tạo View v_DanhSachChuyenKhoiHanhConCho thành công.';
GO

-- ==========================================================================================
-- 5. VIEW: TỔNG HỢP QUẢN LÝ ĐƠN ĐẶT TOUR CHO DASHBOARD ADMIN
-- Phân tách tổng tiền đã thanh toán (thu) và tổng tiền đã hoàn lại
-- ==========================================================================================
IF OBJECT_ID(N'dbo.v_QuanLyDonDatTourAdmin', N'V') IS NOT NULL
    DROP VIEW dbo.v_QuanLyDonDatTourAdmin;
GO

CREATE VIEW dbo.v_QuanLyDonDatTourAdmin
AS
SELECT 
    dt.MaDatTour,
    dt.NgayDat,
    dt.ThoiHanGiuCho,
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
    ISNULL(SUM(CASE WHEN tt.LoaiGiaoDich = N'Thanh toán' AND tt.TrangThai = N'Thành công' THEN tt.SoTien ELSE 0 END), 0) AS SoTienDaThu,
    ISNULL(SUM(CASE WHEN tt.LoaiGiaoDich = N'Hoàn tiền' AND tt.TrangThai = N'Thành công' THEN tt.SoTien ELSE 0 END), 0) AS SoTienDaHoan
FROM dbo.DATTOUR dt
JOIN dbo.NGUOIDUNG nd ON dt.MaKhachHang = nd.MaNguoiDung
JOIN dbo.CHUYENKHOIHANH c ON dt.MaChuyen = c.MaChuyen
JOIN dbo.TOUR t ON c.MaTour = t.MaTour
LEFT JOIN dbo.THANHTOAN tt ON dt.MaDatTour = tt.MaDatTour
GROUP BY 
    dt.MaDatTour, dt.NgayDat, dt.ThoiHanGiuCho, nd.MaNguoiDung, nd.HoTen, nd.Email, nd.SoDienThoai,
    t.TenTour, c.NgayKhoiHanh, c.NgayKetThuc, dt.SoLuongKhach, dt.TongTien,
    dt.TrangThaiDat, dt.TrangThaiThanhToan;
GO

PRINT N'==> Đã tạo View v_QuanLyDonDatTourAdmin thành công.';
GO

-- ==========================================================================================
-- 6. VIEW: QUẢN LÝ YÊU CẦU ĐỔI / HỦY / HOÀN TIỀN (UC-10) CHO ADMIN
-- ==========================================================================================
IF OBJECT_ID(N'dbo.v_QuanLyYeuCauDoiHuyHoanTien', N'V') IS NOT NULL
    DROP VIEW dbo.v_QuanLyYeuCauDoiHuyHoanTien;
GO

CREATE VIEW dbo.v_QuanLyYeuCauDoiHuyHoanTien
AS
SELECT 
    yc.MaYeuCau,
    yc.MaDatTour,
    dt.MaChuyen,
    t.TenTour,
    c.NgayKhoiHanh,
    yc.MaKhachHang,
    nd.HoTen AS TenKhachHang,
    nd.SoDienThoai,
    yc.LoaiYeuCau,
    yc.LyDo,
    yc.SoTienYeuCauHoan,
    yc.ThongTinNganHang,
    yc.TrangThai AS TrangThaiYeuCau,
    yc.PhanHoiAdmin,
    yc.NgayTao AS NgayGuiYeuCau,
    yc.NgayXuLy,
    admin_nd.HoTen AS NguoiXuLy
FROM dbo.YEUCAU_HOANTIEN_DOILICH yc
JOIN dbo.DATTOUR dt ON yc.MaDatTour = dt.MaDatTour
JOIN dbo.CHUYENKHOIHANH c ON dt.MaChuyen = c.MaChuyen
JOIN dbo.TOUR t ON c.MaTour = t.MaTour
JOIN dbo.NGUOIDUNG nd ON yc.MaKhachHang = nd.MaNguoiDung
LEFT JOIN dbo.NGUOIDUNG admin_nd ON yc.NguoiXuLy = admin_nd.MaNguoiDung;
GO

PRINT N'==> Đã tạo View v_QuanLyYeuCauDoiHuyHoanTien thành công.';
GO

-- ==========================================================================================
-- PHẦN 8: NẠP DỮ LIỆU MẪU THỰC TẾ (REALISTIC SAMPLE DATA - 16 BẢNG)
-- ==========================================================================================
USE TourDuLichDB;
GO

PRINT N'==> Đang tiến hành nạp dữ liệu mẫu (Sample Realistic Seed Data)...';

-- 1. NẠP DỮ LIỆU BẢNG NGUOIDUNG (Kèm cột VaiTro: Admin, NhanVien, KhachHang)
SET IDENTITY_INSERT dbo.NGUOIDUNG ON;
INSERT INTO dbo.NGUOIDUNG (MaNguoiDung, HoTen, Email, SoDienThoai, MatKhau, DiaChi, VaiTro, TrangThai, NgayTao)
VALUES 
(1, N'Trần Quốc Toản', 'admin@tourvietnam.vn', '0901234567', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Hoàn Kiếm, Hà Nội', N'Admin', 1, '2026-01-10'),
(2, N'Lê Thị Mai', 'dieuhanh@tourvietnam.vn', '0912345678', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Hải Châu, Đà Nẵng', N'NhanVien', 1, '2026-01-15'),
(3, N'Hoàng Văn Dũng', 'ketoan@tourvietnam.vn', '0987654321', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Quận 1, TP. Hồ Chí Minh', N'NhanVien', 1, '2026-02-01'),
(4, N'Nguyễn Văn An', 'nguyenvanan@gmail.com', '0933112233', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Cầu Giấy, Hà Nội', N'KhachHang', 1, '2026-03-01'),
(5, N'Phạm Thị Hương', 'phamhuong88@gmail.com', '0944556677', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Thanh Xuân, Hà Nội', N'KhachHang', 1, '2026-03-10'),
(6, N'Đỗ Minh Quân', 'minhquan.travel@outlook.com', '0977889900', '$2a$12$K8yR6jP2x1V9qZ0wY7s8uOp.QzZ9wJ6mX.1Y6o5b8w3e9u4k7h2a', N'Bình Thạnh, TP. Hồ Chí Minh', N'KhachHang', 1, '2026-04-05');
SET IDENTITY_INSERT dbo.NGUOIDUNG OFF;
GO

-- 2. NẠP DỮ LIỆU BẢNG DANHMUC
SET IDENTITY_INSERT dbo.DANHMUC ON;
INSERT INTO dbo.DANHMUC (MaDanhMuc, TenDanhMuc, MoTa)
VALUES 
(1, N'Tour Du Lịch Đông Bắc Á', N'Khám phá văn hóa, cảnh sắc lãng mạn tại Hàn Quốc, Nhật Bản, Đài Loan'),
(2, N'Tour Miền Trung Di Sản', N'Hành trình di sản văn hóa: Đà Nẵng, Bà Nà Hills, Phố cổ Hội An, Cố đô Huế'),
(3, N'Tour Biển Đảo Nghỉ Dưỡng', N'Nghỉ dưỡng đẳng cấp tại Phú Quốc, Côn Đảo, Nha Trang, Vịnh Hạ Long'),
(4, N'Tour Khám Phá Vùng Cao Miền Bắc', N'Chinh phục nóc nhà Đông Dương Fansipan Sa Pa, Mù Cang Chải, Hà Giang mùa hoa');
SET IDENTITY_INSERT dbo.DANHMUC OFF;
GO

-- 3. NẠP DỮ LIỆU BẢNG TOUR
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
GO

-- 4. NẠP DỮ LIỆU BẢNG HINHANH_TOUR (Bộ sưu tập Gallery của Tour)
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
GO

-- 5. NẠP DỮ LIỆU BẢNG LICH_TRINH_DETAIL (Lịch trình chi tiết từng ngày)
SET IDENTITY_INSERT dbo.LICH_TRINH_DETAIL ON;
INSERT INTO dbo.LICH_TRINH_DETAIL (MaLichTrinh, MaTour, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn)
VALUES 
(1, 1, 1, N'TP.HCM / HÀ NỘI - INCHEON (SEOUL)', 
 N'Quý khách tập trung tại sân bay làm thủ tục chuyến bay đi Incheon. Nghỉ đêm trên máy bay.', N'Ăn nhẹ trên máy bay'),
(2, 1, 2, N'SEOUL - ĐẢO NAMI - THÁP NAMSAN', 
 N'Đến sân bay Incheon, xe đưa đoàn đi ăn sáng canh sườn bò. Khởi hành đi đảo Nami - phim trường "Bản tình ca mùa đông". Chiều về Seoul tham quan Tháp Namsan.', N'Sáng, Trưa, Tối'),
(3, 1, 3, N'LOTTE WORLD - CUNG ĐIỆN GYEONGBOKGUNG', 
 N'Khám phá Cung điện Gyeongbokgung cổ kính trong trang phục Hanbok truyền thống. Buổi chiều trải nghiệm công viên giải trí Lotte World.', N'Sáng, Trưa, Tối'),
(4, 2, 1, N'ĐÓN KHÁCH - BÁN ĐẢO SƠN TRÀ - BIỂN MỸ KHÊ', 
 N'Xe đón khách tại sân bay Đà Nẵng, nhận phòng khách sạn. Chiều viếng chùa Linh Ứng Sơn Trà và tự do tắm biển Mỹ Khê.', N'Trưa, Tối'),
(5, 2, 2, N'BÀ NÀ HILLS - CẦU VÀNG - CHECK-IN LÀNG PHÁP', 
 N'Chinh phục đỉnh Bà Nà bằng cáp treo đạt 4 kỷ lục thế giới. Check-in Cầu Vàng, tham quan Hầm rượu Debay, Vườn hoa Le Jardin D''Amour.', N'Sáng, Trưa Buffet, Tối'),
(6, 2, 3, N'DANH THẮNG NGŨ HÀNH SƠN - PHỐ CỔ HỘI AN', 
 N'Tham quan làng đá mỹ nghệ Non Nước, khám phá động Huyền Không. Chiều sang Phố cổ Hội An tham quan Chùa Cầu, thả hoa đăng trên sông Hoài.', N'Sáng, Trưa, Tối'),
(7, 3, 1, N'ĐÓN BAY PHÚ QUỐC - DINH CẬU - SUNSET SANATO', 
 N'Xe đón đoàn tại sân bay Phú Quốc. Khởi hành viếng Dinh Cậu tâm linh, ngắm hoàng hôn độc đáo tại Sunset Sanato.', N'Trưa, Tối'),
(8, 3, 2, N'CANO 4 ĐẢO - CÁP TREO HÒN THƠM - CẦU HÔN', 
 N'Trải nghiệm cano cao tốc lặn ngắm san hô tại hòn Móng Tay, hòn Gầm Ghì. Đi cáp treo vượt biển Hòn Thơm và check-in Cầu Hôn (Kiss Bridge).', N'Sáng, Trưa, Tối'),
(9, 4, 1, N'HÀ NỘI - NỘI BÀI - SA PA - BẢN CÁT CÁT', 
 N'Xe Limousine đưa đoàn lên Sa Pa theo cao tốc Nội Bài - Lào Cai. Buổi chiều tham quan bản Cát Cát của đồng bào người H''Mông.', N'Trưa, Tối'),
(10, 4, 2, N'CHINH PHỤC FANSIPAN - CỔNG TRỜI Ô QUY HỒ', 
 N'Đi tàu hỏa leo núi Mường Hoa, cáp treo lên đỉnh Fansipan. Buổi chiều săn mây tuyệt đẹp tại đỉnh đèo Ô Quy Hồ.', N'Sáng, Trưa, Tối');
SET IDENTITY_INSERT dbo.LICH_TRINH_DETAIL OFF;
GO

-- 6. NẠP DỮ LIỆU BẢNG CHUYENKHOIHANH (Lịch khởi hành thực tế, kèm SoChoGiuCho = 0)
SET IDENTITY_INSERT dbo.CHUYENKHOIHANH ON;
INSERT INTO dbo.CHUYENKHOIHANH (MaChuyen, MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, SoChoGiuCho, TrangThaiChuyen)
VALUES 
-- Tour Hàn Quốc
(1, 1, '2026-11-15 08:00', '2026-11-19 18:00', 12990000, 25, 18, 0, N'Mở bán'),
(2, 1, '2026-12-20 08:00', '2026-12-24 18:00', 14500000, 25, 25, 0, N'Hết chỗ'),
(3, 1, '2027-01-10 08:00', '2027-01-14 18:00', 12990000, 25, 4, 0, N'Mở bán'),

-- Tour Đà Nẵng
(4, 2, '2026-11-10 07:30', '2026-11-13 17:00', 4690000, 30, 20, 0, N'Mở bán'),
(5, 2, '2026-12-05 07:30', '2026-12-08 17:00', 4890000, 30, 0, 0, N'Mở bán'),

-- Tour Phú Quốc
(6, 3, '2026-11-20 09:00', '2026-11-22 16:00', 3890000, 20, 15, 0, N'Mở bán'),
(7, 3, '2026-12-15 09:00', '2026-12-17 16:00', 4290000, 20, 0, 0, N'Mở bán'),

-- Tour Sa Pa
(8, 4, '2026-11-05 06:30', '2026-11-07 19:00', 2750000, 25, 25, 0, N'Hoàn thành'),
(9, 4, '2026-11-25 06:30', '2026-11-27 19:00', 2850000, 25, 8, 0, N'Mở bán');
SET IDENTITY_INSERT dbo.CHUYENKHOIHANH OFF;
GO

-- 7. NẠP DỮ LIỆU BẢNG DATTOUR
-- Lưu ý: Tạm ngắt Trigger kiểm tra số chỗ khi seed dữ liệu ban đầu để nạp dữ liệu lịch sử chuẩn xác
DISABLE TRIGGER dbo.TRG_DATTOUR_CheckAndLockSeats ON dbo.DATTOUR;

SET IDENTITY_INSERT dbo.DATTOUR ON;
INSERT INTO dbo.DATTOUR (MaDatTour, MaKhachHang, MaChuyen, NgayDat, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
VALUES 
-- Đơn đã hoàn thành (chuyến Sa Pa đã đi)
(1, 4, 8, '2026-10-15 14:20', 2, 5500000, N'Đã hoàn thành', N'Đã thanh toán'),
(2, 5, 8, '2026-10-18 09:10', 3, 8250000, N'Đã hoàn thành', N'Đã thanh toán'),

-- Đơn tour Hàn Quốc sắp đi (đã cọc / đã thanh toán)
(3, 4, 1, '2026-10-20 10:00', 2, 25980000, N'Đã xác nhận', N'Đã thanh toán'),
(4, 6, 1, '2026-10-22 16:30', 4, 51960000, N'Đã xác nhận', N'Đã thanh toán'),

-- Đơn tour Đà Nẵng
(5, 5, 4, '2026-10-23 11:15', 2, 9380000, N'Đã xác nhận', N'Đã thanh toán'),

-- Đơn mới đặt (Chờ xác nhận)
(6, 6, 6, '2026-10-24 15:45', 3, 11670000, N'Chờ xác nhận', N'Chưa thanh toán'),

-- Đơn khách đã hủy
(7, 4, 4, '2026-10-12 08:30', 2, 9380000, N'Đã hủy', N'Đã hoàn tiền');
SET IDENTITY_INSERT dbo.DATTOUR OFF;

ENABLE TRIGGER dbo.TRG_DATTOUR_CheckAndLockSeats ON dbo.DATTOUR;
GO

-- 8. NẠP DỮ LIỆU BẢNG CHITIET_HANHKHACH
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
GO

-- 9. NẠP DỮ LIỆU BẢNG THANHTOAN (Kèm LoaiGiaoDich = N'Thanh toán')
SET IDENTITY_INSERT dbo.THANHTOAN ON;
INSERT INTO dbo.THANHTOAN (MaThanhToan, MaDatTour, LoaiGiaoDich, PhuongThuc, SoTien, NgayThanhToan, MaGiaoDich, TrangThai)
VALUES 
(1, 1, N'Thanh toán', N'Chuyển khoản QR', 5500000, '2026-10-15 14:30', 'MBVCB.982312389', N'Thành công'),
(2, 2, N'Thanh toán', N'Thẻ tín dụng', 8250000, '2026-10-18 09:20', 'VNPAY-891238712', N'Thành công'),
(3, 3, N'Thanh toán', N'Chuyển khoản QR', 25980000, '2026-10-20 10:15', 'TECH.812391283', N'Thành công'),
(4, 4, N'Thanh toán', N'Chuyển khoản QR', 51960000, '2026-10-22 17:00', 'VIETIN.561239812', N'Thành công'),
(5, 5, N'Thanh toán', N'Chuyển khoản QR', 9380000, '2026-10-23 11:30', 'MB.349182391', N'Thành công');
SET IDENTITY_INSERT dbo.THANHTOAN OFF;
GO

-- 10. NẠP DỮ LIỆU BẢNG DANHGIA (Chỉ dành cho các đơn 'Đã hoàn thành')
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
GO

-- 11. NẠP DỮ LIỆU BẢNG BAIVIET_QUANGBA
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
GO

-- 12. NẠP DỮ LIỆU BẢNG AUDITLOG
SET IDENTITY_INSERT dbo.AUDITLOG ON;
INSERT INTO dbo.AUDITLOG (MaLog, MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
VALUES 
(1, 1, N'KHOI_TAO_HE_THONG', NULL, N'Khởi tạo thành công cấu trúc 16 bảng CSDL chuẩn 3NF', '2026-10-01 08:00'),
(2, 1, N'DANG_TOUR_MOI', NULL, N'Đăng tour mới: Hàn Quốc Seoul - Nami - Lotte World', '2026-10-02 09:30'),
(3, 2, N'MO_BAN_CHUYEN_DI', NULL, N'Mở bán chuyến khởi hành ngày 15/11/2026 cho Tour Hàn Quốc', '2026-10-05 14:15'),
(4, 3, N'XAC_NHAN_THANH_TOAN', N'Trạng thái: Chưa thanh toán', N'Xác nhận đơn #3 đã thanh toán 25.980.000 VNĐ qua QR Code', '2026-10-20 10:16');
SET IDENTITY_INSERT dbo.AUDITLOG OFF;
GO

-- 13. NẠP DỮ LIỆU BẢNG YEUCAU_HOANTIEN_DOILICH (UC-10)
SET IDENTITY_INSERT dbo.YEUCAU_HOANTIEN_DOILICH ON;
INSERT INTO dbo.YEUCAU_HOANTIEN_DOILICH (MaYeuCau, MaDatTour, MaKhachHang, LoaiYeuCau, LyDo, SoTienYeuCauHoan, ThongTinNganHang, TrangThai, PhanHoiAdmin, NgayTao, NgayXuLy, NguoiXuLy)
VALUES 
(1, 4, 4, N'Hủy tour hoàn tiền', N'Gia đình có việc đột xuất không thể tham gia chuyến đi đúng ngày.', 4500000, N'NGUYEN THI HUONG - 1903456789 - Techcombank', N'Chờ xử lý', NULL, '2026-10-21 09:00', NULL, NULL),
(2, 5, 5, N'Đổi thông tin hành khách', N'Thay đổi họ tên và CMND của 1 hành khách do người nhà bận công tác thay bằng người khác.', NULL, NULL, N'Đã duyệt', N'Đã cập nhật lại thông tin hành khách tham gia chuyến bay.', '2026-10-24 14:30', '2026-10-24 16:00', 2);
SET IDENTITY_INSERT dbo.YEUCAU_HOANTIEN_DOILICH OFF;
GO

-- 14. NẠP DỮ LIỆU BẢNG TOUR_YEUTHICH (UC-07)
SET IDENTITY_INSERT dbo.TOUR_YEUTHICH ON;
INSERT INTO dbo.TOUR_YEUTHICH (MaYeuThich, MaNguoiDung, MaTour, NgayLuu)
VALUES 
(1, 3, 1, '2026-10-10 10:00'),
(2, 3, 3, '2026-10-12 11:30'),
(3, 4, 2, '2026-10-15 15:45'),
(4, 5, 1, '2026-10-18 19:20');
SET IDENTITY_INSERT dbo.TOUR_YEUTHICH OFF;
GO

-- 15. NẠP DỮ LIỆU BẢNG LIENHE_TUVAN (UC-04)
SET IDENTITY_INSERT dbo.LIENHE_TUVAN ON;
INSERT INTO dbo.LIENHE_TUVAN (MaLienHe, HoTen, Email, SoDienThoai, MaTour, NoiDung, TrangThai, GhiChuAdmin, NgayGui, NguoiXuLy)
VALUES 
(1, N'Trần Đình Trọng', 'trong.td@gmail.com', '0912345678', 1, N'Cho tôi hỏi tour Sa Pa này vào tháng 12 có tuyết không và trẻ em 4 tuổi có tham gia được không?', N'Đã liên hệ', N'Đã gọi điện tư vấn chính sách giá trẻ em và thời tiết Sa Pa tháng 12, khách hẹn sẽ đặt tour vào tuần tới.', '2026-10-15 14:20', 2),
(2, N'Vũ Phương Linh', 'linh.vp@outlook.com', '0987654321', 2, N'Nhóm mình có 8 người muốn đặt tour Hàn Quốc khởi hành dịp Tết dương lịch 2027, công ty có ưu đãi cho nhóm không?', N'Chưa xử lý', NULL, '2026-10-25 16:00', NULL);
SET IDENTITY_INSERT dbo.LIENHE_TUVAN OFF;
GO

-- 16. NẠP DỮ LIỆU BẢNG BANNER_QUANGCAO (UC-15)
SET IDENTITY_INSERT dbo.BANNER_QUANGCAO ON;
INSERT INTO dbo.BANNER_QUANGCAO (MaBanner, TieuDe, HinhAnh, LienKet, ViTri, ThuTuHienThi, TrangThai, NgayBatDau, NgayKetThuc, NgayTao, MaNguoiTao)
VALUES 
(1, N'Khám Phá Hàn Quốc Mùa Thu - Giảm Ngay 1.000.000đ', '/images/banners/banner-korea-autumn.jpg', '/tours/han-quoc-seoul-nami', N'TrangChu_Hero', 1, 1, '2026-09-01', '2026-12-31', '2026-09-01 08:00', 1),
(2, N'Mùa Lúa Chín Sa Pa - Trọn Gói 3N2Đ Chỉ Từ 3.850.000đ', '/images/banners/banner-sapa-harvest.jpg', '/tours/sapa-fansipan-catcat', N'TrangChu_Hero', 2, 1, '2026-09-15', '2026-11-30', '2026-09-15 08:00', 1),
(3, N'Ưu Đãi Đặt Tour Sớm - Đón Mùa Lễ Hội 2027', '/images/banners/banner-promotion-earlybird.jpg', '/promotions/early-bird-2027', N'TrangChu_GiuaTrang', 1, 1, '2026-10-01', '2027-01-15', '2026-10-01 08:00', 2);
SET IDENTITY_INSERT dbo.BANNER_QUANGCAO OFF;
GO

PRINT N'==> Đã nạp thành công 100% dữ liệu mẫu thực tế và phong phú cho 16 bảng!';
GO

-- ==========================================================================================
-- PHẦN 9: BỘ STORED PROCEDURES CHUẨN HÓA DÀNH RIÊNG CHO WEB API (API ENDPOINTS)
-- Phục vụ gọi trực tiếp từ Backend: Node.js, C# ASP.NET Core, Java Spring, PHP Laravel, Python
-- ==========================================================================================
USE TourDuLichDB;
GO

PRINT N'==> Đang khởi tạo Bộ Stored Procedures dành riêng cho Web Backend API...';
GO

-- ##########################################################################################
-- PHẦN A: NHÓM API DÀNH CHO KHÁCH VÃNG LAI & CÔNG KHAI (PUBLIC / GUEST APIs)
-- ##########################################################################################

-- ==========================================================================================
-- A1. API: LẤY DANH SÁCH DANH MỤC DU LỊCH (KÈM SỐ LƯỢNG TOUR MỖI DANH MỤC)
-- Backend Endpoint đề xuất: GET /api/categories
-- ==========================================================================================
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

-- ==========================================================================================
-- A2. API: TÌM KIẾM, LỌC & PHÂN TRANG DANH SÁCH TOUR
-- Backend Endpoint đề xuất: GET /api/tours?keyword=&categoryId=&minPrice=&maxPrice=&pageIndex=1&pageSize=9
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetTours', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetTours;
GO
CREATE PROCEDURE dbo.sp_api_GetTours
    @TuKhoa       NVARCHAR(100) = NULL,
    @MaDanhMuc    INT           = NULL,
    @TuGia        DECIMAL(18,2) = NULL,
    @DenGia       DECIMAL(18,2) = NULL,
    @SapXepTheo   VARCHAR(20)   = 'GIA_TANG', -- 'GIA_TANG', 'GIA_GIAM', 'MOI_NHAT'
    @PageIndex    INT           = 1,
    @PageSize     INT           = 9
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF @PageIndex < 1 SET @PageIndex = 1;
        IF @PageSize < 1 SET @PageSize = 9;
        DECLARE @Offset INT = (@PageIndex - 1) * @PageSize;

        -- 1. Trả về tổng số bản ghi thỏa mãn bộ lọc (phục vụ phân trang)
        SELECT COUNT(DISTINCT t.MaTour) AS TongSoBanGhi
        FROM dbo.TOUR t
        JOIN dbo.DANHMUC dm ON t.MaDanhMuc = dm.MaDanhMuc
        LEFT JOIN dbo.CHUYENKHOIHANH c ON t.MaTour = c.MaTour AND c.TrangThaiChuyen = N'Mở bán'
        WHERE t.TrangThai = 1
          AND (@MaDanhMuc IS NULL OR t.MaDanhMuc = @MaDanhMuc)
          AND (@TuKhoa IS NULL OR t.TenTour LIKE N'%' + @TuKhoa + N'%' OR dm.TenDanhMuc LIKE N'%' + @TuKhoa + N'%')
          AND (@TuGia IS NULL OR ISNULL(c.GiaThucTe, t.GiaKhuyenNghi) >= @TuGia)
          AND (@DenGia IS NULL OR ISNULL(c.GiaThucTe, t.GiaKhuyenNghi) <= @DenGia);

        -- 2. Trả về danh sách tour của trang hiện tại
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

-- ==========================================================================================
-- A3. API: LẤY CHI TIẾT TOÀN DIỆN MỘT TOUR (THÔNG TIN + GALLERY + LỊCH TRÌNH NGÀY + CHUYẾN KHỞI HÀNH)
-- Backend Endpoint đề xuất: GET /api/tours/:id
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetTourDetail', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetTourDetail;
GO
CREATE PROCEDURE dbo.sp_api_GetTourDetail
    @MaTour INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- 1. Thông tin chung của Tour
        SELECT 
            t.MaTour,
            t.TenTour,
            dm.MaDanhMuc,
            dm.TenDanhMuc,
            t.MoTaChiTiet,
            t.LichTrinhTongQuan,
            t.GiaKhuyenNghi,
            t.HinhAnhDaiDien,
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

        -- 2. Bộ sưu tập ảnh Gallery (HINHANH_TOUR)
        SELECT MaHinhAnh, DuongDanAnh, GhiChu
        FROM dbo.HINHANH_TOUR
        WHERE MaTour = @MaTour
        ORDER BY MaHinhAnh ASC;

        -- 3. Lịch trình chi tiết từng ngày (LICH_TRINH_DETAIL)
        SELECT MaLichTrinh, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn
        FROM dbo.LICH_TRINH_DETAIL
        WHERE MaTour = @MaTour
        ORDER BY NgayThu ASC;

        -- 4. Danh sách các chuyến khởi hành khả dụng (còn chỗ và trong tương lai)
        SELECT 
            MaChuyen,
            NgayKhoiHanh,
            NgayKetThuc,
            DATEDIFF(DAY, NgayKhoiHanh, NgayKetThuc) + 1 AS SoNgay,
            GiaThucTe,
            SoChoToiDa,
            SoChoDaDat,
            (SoChoToiDa - SoChoDaDat) AS SoChoConLai,
            TrangThaiChuyen
        FROM dbo.CHUYENKHOIHANH
        WHERE MaTour = @MaTour 
          AND TrangThaiChuyen = N'Mở bán'
          AND (SoChoToiDa - SoChoDaDat) > 0
          AND NgayKhoiHanh >= GETDATE()
        ORDER BY NgayKhoiHanh ASC;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- A4. API: LẤY BÀI VIẾT QUẢNG BÁ & CHI TIẾT THEO SLUG (TỰ ĐỘNG TĂNG LƯỢT XEM)
-- Backend Endpoint đề xuất: GET /api/posts & GET /api/posts/:slug
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetBlogPosts', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetBlogPosts;
GO
CREATE PROCEDURE dbo.sp_api_GetBlogPosts
    @PageIndex INT = 1,
    @PageSize  INT = 6
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@PageIndex - 1) * @PageSize;

    SELECT COUNT(*) AS TongSoBaiViet FROM dbo.BAIVIET_QUANGBA WHERE TrangThai = 1;

    SELECT 
        b.MaBaiViet, b.TieuDe, b.Slug, b.TomTat, b.HinhAnhDaiDien,
        b.LuotXem, b.NgayTao, nd.HoTen AS TacGia
    FROM dbo.BAIVIET_QUANGBA b
    JOIN dbo.NGUOIDUNG nd ON b.MaNguoiDang = nd.MaNguoiDung
    WHERE b.TrangThai = 1
    ORDER BY b.NgayTao DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

IF OBJECT_ID(N'dbo.sp_api_GetBlogPostDetail', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetBlogPostDetail;
GO
CREATE PROCEDURE dbo.sp_api_GetBlogPostDetail
    @Slug VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    -- Tự động tăng lượt xem
    UPDATE dbo.BAIVIET_QUANGBA
    SET LuotXem = LuotXem + 1
    WHERE Slug = @Slug AND TrangThai = 1;

    -- Lấy chi tiết bài viết
    SELECT 
        b.MaBaiViet, b.TieuDe, b.Slug, b.TomTat, b.NoiDung, b.HinhAnhDaiDien,
        b.LuotXem, b.NgayTao, nd.HoTen AS TacGia, nd.Email AS EmailTacGia
    FROM dbo.BAIVIET_QUANGBA b
    JOIN dbo.NGUOIDUNG nd ON b.MaNguoiDang = nd.MaNguoiDung
    WHERE b.Slug = @Slug AND b.TrangThai = 1;
END;
GO


-- ##########################################################################################
-- PHẦN B: NHÓM API DÀNH CHO KHÁCH HÀNG THÀNH VIÊN (CUSTOMER / AUTHENTICATED APIs)
-- ##########################################################################################

-- ==========================================================================================
-- B1. API: ĐĂNG KÝ TÀI KHOẢN KHÁCH HÀNG MỚI
-- Backend Endpoint đề xuất: POST /api/auth/register
-- ==========================================================================================
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
        -- Kiểm tra email đã tồn tại hay chưa
        IF EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE Email = @Email)
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Địa chỉ Email này đã được đăng ký trong hệ thống.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.NGUOIDUNG (HoTen, Email, SoDienThoai, MatKhau, DiaChi, VaiTro, TrangThai, NgayTao)
        VALUES (@HoTen, @Email, @SoDienThoai, @MatKhauHash, @DiaChi, N'KhachHang', 1, GETDATE());

        DECLARE @NewUserId INT = SCOPE_IDENTITY();

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Đăng ký tài khoản thành công!' AS Message,
            @NewUserId AS MaNguoiDung,
            @HoTen AS HoTen,
            @Email AS Email;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- B2. API: LẤY THÔNG TIN ĐĂNG NHẬP THEO EMAIL (HỖ TRỢ BACKEND BCRYPT VERIFY)
-- Backend Endpoint đề xuất: POST /api/auth/login
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetUserForLogin', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetUserForLogin;
GO
CREATE PROCEDURE dbo.sp_api_GetUserForLogin
    @Email VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        MaNguoiDung,
        HoTen,
        Email,
        SoDienThoai,
        MatKhau AS PasswordHash,
        DiaChi,
        VaiTro,
        TrangThai,
        NgayTao
    FROM dbo.NGUOIDUNG
    WHERE Email = @Email;
END;
GO

-- ==========================================================================================
-- B3. API: CẬP NHẬT THÔNG TIN HỒ SƠ CÁ NHÂN
-- Backend Endpoint đề xuất: PUT /api/user/profile
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_UpdateProfile', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_UpdateProfile;
GO
CREATE PROCEDURE dbo.sp_api_UpdateProfile
    @MaNguoiDung INT,
    @HoTen       NVARCHAR(100),
    @SoDienThoai VARCHAR(15),
    @DiaChi      NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE MaNguoiDung = @MaNguoiDung)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Người dùng không tồn tại.' AS Message;
            RETURN;
        END;

        UPDATE dbo.NGUOIDUNG
        SET HoTen = @HoTen,
            SoDienThoai = @SoDienThoai,
            DiaChi = @DiaChi
        WHERE MaNguoiDung = @MaNguoiDung;

        SELECT 1 AS Success, 200 AS StatusCode, N'Cập nhật thông tin thành công!' AS Message;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- B4. API: TẠO ĐƠN ĐẶT TOUR MỚI & THÊM HÀNH KHÁCH (CHỐNG OVERBOOKING VỚI TRANSACTION)
-- Backend Endpoint đề xuất: POST /api/bookings
-- ==========================================================================================
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
        -- 1. Kiểm tra tài khoản khách
        IF NOT EXISTS (SELECT 1 FROM dbo.NGUOIDUNG WHERE MaNguoiDung = @MaKhachHang AND TrangThai = 1)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Success, 403 AS StatusCode, N'Tài khoản không hợp lệ hoặc đã bị khóa.' AS Message;
            RETURN;
        END;

        -- 2. Kiểm tra chuyến khởi hành và giữ khóa UPDLOCK chống race condition
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

        DECLARE @SoChoConLai INT = @SoChoToiDa - @SoChoDaDat - @SoChoGiuCho;
        IF @SoChoConLai < @SoLuongKhach
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0 AS Success, 400 AS StatusCode, 
                   CONCAT(N'Không đủ số chỗ trống. Hiện chỉ còn ', @SoChoConLai, N' chỗ.') AS Message;
            RETURN;
        END;

        -- 3. Tạo đơn đặt tour (Trigger TRG_DATTOUR_CheckAndLockSeats sẽ tự động tăng số chỗ giữ tạm)
        DECLARE @TongTien DECIMAL(18,2) = @SoLuongKhach * @GiaThucTe;
        DECLARE @ThoiHanGiuCho DATETIME = DATEADD(MINUTE, 15, GETDATE());
        DECLARE @MaDatTourMoi INT;

        INSERT INTO dbo.DATTOUR (MaKhachHang, MaChuyen, NgayDat, ThoiHanGiuCho, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
        VALUES (@MaKhachHang, @MaChuyen, GETDATE(), @ThoiHanGiuCho, @SoLuongKhach, @TongTien, N'Chờ xác nhận', N'Chưa thanh toán');

        SET @MaDatTourMoi = SCOPE_IDENTITY();

        -- 4. Thêm người liên hệ chính vào danh sách hành khách
        INSERT INTO dbo.CHITIET_HANHKHACH (MaDatTour, HoTen, SoDienThoai)
        VALUES (@MaDatTourMoi, @HoTenNguoiDat, @SoDienThoai);

        COMMIT TRANSACTION;

        SELECT 
            1 AS Success,
            201 AS StatusCode,
            N'Đặt tour thành công, đã giữ chỗ tạm thời!' AS Message,
            @MaDatTourMoi AS MaDatTour,
            @TongTien AS TongTien,
            @SoLuongKhach AS SoLuongKhach;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- B5. API: THÊM THÔNG TIN HÀNH KHÁCH ĐI CÙNG VÀO ĐƠN ĐẶT TOUR
-- Backend Endpoint đề xuất: POST /api/bookings/:bookingId/passengers
-- ==========================================================================================
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

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Đã thêm hành khách thành công!' AS Message,
            SCOPE_IDENTITY() AS MaHanhKhach;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- B6. API: LẤY LỊCH SỬ ĐƠN ĐẶT TOUR CỦA KHÁCH HÀNG
-- Backend Endpoint đề xuất: GET /api/user/bookings
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetCustomerBookings', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetCustomerBookings;
GO
CREATE PROCEDURE dbo.sp_api_GetCustomerBookings
    @MaKhachHang INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT 
            dt.MaDatTour,
            dt.NgayDat,
            t.MaTour,
            t.TenTour,
            t.HinhAnhDaiDien,
            c.NgayKhoiHanh,
            c.NgayKetThuc,
            dt.SoLuongKhach,
            dt.TongTien,
            dt.TrangThaiDat,
            dt.TrangThaiThanhToan,
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

-- ==========================================================================================
-- B7. API: LẤY CHI TIẾT ĐẦY ĐỦ 1 ĐƠN ĐẶT TOUR (TOUR + HÀNH KHÁCH + THANH TOÁN + REVIEW)
-- Backend Endpoint đề xuất: GET /api/bookings/:id
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetBookingDetail', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetBookingDetail;
GO
CREATE PROCEDURE dbo.sp_api_GetBookingDetail
    @MaDatTour INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- 1. Thông tin tổng quan đơn đặt tour
        SELECT 
            dt.MaDatTour,
            dt.NgayDat,
            dt.SoLuongKhach,
            dt.TongTien,
            dt.TrangThaiDat,
            dt.TrangThaiThanhToan,
            nd.MaNguoiDung,
            nd.HoTen AS TenKhachHang,
            nd.Email,
            nd.SoDienThoai,
            t.MaTour,
            t.TenTour,
            t.HinhAnhDaiDien,
            c.MaChuyen,
            c.NgayKhoiHanh,
            c.NgayKetThuc,
            c.GiaThucTe
        FROM dbo.DATTOUR dt
        JOIN dbo.NGUOIDUNG nd ON dt.MaKhachHang = nd.MaNguoiDung
        JOIN dbo.CHUYENKHOIHANH c ON dt.MaChuyen = c.MaChuyen
        JOIN dbo.TOUR t ON c.MaTour = t.MaTour
        WHERE dt.MaDatTour = @MaDatTour;

        -- 2. Danh sách hành khách trong đoàn
        SELECT MaHanhKhach, HoTen, NgaySinh, GioiTinh, SoDienThoai
        FROM dbo.CHITIET_HANHKHACH
        WHERE MaDatTour = @MaDatTour;

        -- 3. Lịch sử thanh toán
        SELECT MaThanhToan, PhuongThuc, SoTien, NgayThanhToan, MaGiaoDich, TrangThai
        FROM dbo.THANHTOAN
        WHERE MaDatTour = @MaDatTour;

        -- 4. Thông tin đánh giá (nếu có)
        SELECT MaDanhGia, SoSao, NoiDung, HinhAnh, NgayDanhGia, PhanHoiAdmin
        FROM dbo.DANHGIA
        WHERE MaDatTour = @MaDatTour;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- B8. API: GỬI ĐÁNH GIÁ CHẤT LƯỢNG TOUR (CHỈ CHO PHÉP ĐƠN 'ĐÃ HOÀN THÀNH')
-- Backend Endpoint đề xuất: POST /api/bookings/:id/review
-- ==========================================================================================
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
        -- Kiểm tra đơn đã hoàn thành chưa
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND TrangThaiDat = N'Đã hoàn thành')
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Quý khách chỉ có thể đánh giá cho chuyến đi đã hoàn thành.' AS Message;
            RETURN;
        END;

        -- Kiểm tra đã đánh giá trước đó chưa (UNIQUE)
        IF EXISTS (SELECT 1 FROM dbo.DANHGIA WHERE MaDatTour = @MaDatTour)
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Đơn đặt tour này đã được đánh giá trước đó.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.DANHGIA (MaDatTour, SoSao, NoiDung, HinhAnh, NgayDanhGia, TrangThaiHienThi)
        VALUES (@MaDatTour, @SoSao, @NoiDung, @HinhAnh, GETDATE(), 1);

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Cảm ơn quý khách đã gửi đánh giá!' AS Message,
            SCOPE_IDENTITY() AS MaDanhGia;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- B9. API: KHÁCH HÀNG YÊU CẦU HỦY ĐƠN ĐẶT TOUR (TỰ ĐỘNG HOÀN CHỖ QUA TRIGGER)
-- Backend Endpoint đề xuất: POST /api/bookings/:id/cancel
-- ==========================================================================================
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
        -- Kiểm tra quyền sở hữu đơn đặt tour
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND MaKhachHang = @MaKhachHang)
        BEGIN
            SELECT 0 AS Success, 403 AS StatusCode, N'Bạn không có quyền thao tác trên đơn đặt này.' AS Message;
            RETURN;
        END;

        -- Kiểm tra nếu đơn đã hoàn thành hoặc đã bị hủy
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

        -- Cập nhật sang 'Đã hủy' -> Trigger TRG_DATTOUR_HandleCancellation tự động hoàn trả số chỗ!
        UPDATE dbo.DATTOUR
        SET TrangThaiDat = N'Đã hủy'
        WHERE MaDatTour = @MaDatTour;

        -- Ghi log
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (@MaKhachHang, N'KHACH_HUY_TOUR', CONCAT(N'Trạng thái cũ: ', @TrangThaiHienTai), @LyDoHuy, GETDATE());

        SELECT 1 AS Success, 200 AS StatusCode, N'Hủy đơn đặt tour thành công, chỗ trống đã được giải phóng.' AS Message;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO


-- ##########################################################################################
-- PHẦN C: NHÓM API DÀNH CHO QUẢN TRỊ VIÊN & ĐIỀU HÀNH (ADMIN / STAFF APIs)
-- ##########################################################################################

-- ==========================================================================================
-- C1. API ADMIN: THÊM MỚI TOUR DU LỊCH TRỌN GÓI
-- Backend Endpoint đề xuất: POST /api/admin/tours
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_CreateTour', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_CreateTour;
GO
CREATE PROCEDURE dbo.sp_api_Admin_CreateTour
    @MaDanhMuc         INT,
    @TenTour           NVARCHAR(200),
    @MoTaChiTiet       NVARCHAR(MAX) = NULL,
    @LichTrinhTongQuan NVARCHAR(500) = NULL,
    @GiaKhuyenNghi     DECIMAL(18,2),
    @HinhAnhDaiDien    VARCHAR(255)  = NULL,
    @MaAdmin           INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.DANHMUC WHERE MaDanhMuc = @MaDanhMuc)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Danh mục không tồn tại.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.TOUR (MaDanhMuc, TenTour, MoTaChiTiet, LichTrinhTongQuan, GiaKhuyenNghi, HinhAnhDaiDien, TrangThai)
        VALUES (@MaDanhMuc, @TenTour, @MoTaChiTiet, @LichTrinhTongQuan, @GiaKhuyenNghi, @HinhAnhDaiDien, 1);

        DECLARE @MaTourMoi INT = SCOPE_IDENTITY();

        -- Ghi log
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuMoi, ThoiGian)
        VALUES (@MaAdmin, N'ADMIN_THEM_TOUR', CONCAT(N'Tạo Tour mới #', @MaTourMoi, N': ', @TenTour), GETDATE());

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Thêm tour du lịch mới thành công!' AS Message,
            @MaTourMoi AS MaTour;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- C2. API ADMIN: MỞ BÁN CHUYẾN KHỞI HÀNH MỚI CHO TOUR
-- Backend Endpoint đề xuất: POST /api/admin/departures
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_CreateDeparture', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_CreateDeparture;
GO
CREATE PROCEDURE dbo.sp_api_Admin_CreateDeparture
    @MaTour        INT,
    @NgayKhoiHanh  DATETIME,
    @NgayKetThuc   DATETIME,
    @GiaThucTe     DECIMAL(18,2),
    @SoChoToiDa    INT,
    @MaAdmin       INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.TOUR WHERE MaTour = @MaTour)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Tour không tồn tại.' AS Message;
            RETURN;
        END;

        IF @NgayKetThuc < @NgayKhoiHanh
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Ngày kết thúc phải lớn hơn hoặc bằng ngày khởi hành.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.CHUYENKHOIHANH (MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen)
        VALUES (@MaTour, @NgayKhoiHanh, @NgayKetThuc, @GiaThucTe, @SoChoToiDa, 0, N'Mở bán');

        DECLARE @MaChuyenMoi INT = SCOPE_IDENTITY();

        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuMoi, ThoiGian)
        VALUES (@MaAdmin, N'ADMIN_MO_CHUYEN_DI', CONCAT(N'Mở chuyến #', @MaChuyenMoi, N' cho Tour #', @MaTour), GETDATE());

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Mở bán chuyến khởi hành thành công!' AS Message,
            @MaChuyenMoi AS MaChuyen;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- C3. API ADMIN: XÁC NHẬN THANH TOÁN & DUYỆT ĐƠN TOUR
-- Backend Endpoint đề xuất: POST /api/admin/bookings/:id/confirm-payment
-- ==========================================================================================
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

-- ==========================================================================================
-- C4. API ADMIN: CẬP NHẬT TRẠNG THÁI ĐƠN ĐẶT TOUR ('Đã xác nhận', 'Đã hoàn thành', 'Đã hủy')
-- Backend Endpoint đề xuất: PATCH /api/admin/bookings/:id/status
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_UpdateBookingStatus', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_UpdateBookingStatus;
GO
CREATE PROCEDURE dbo.sp_api_Admin_UpdateBookingStatus
    @MaDatTour       INT,
    @TrangThaiMoi    NVARCHAR(50),
    @MaAdmin         INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Đơn đặt tour không tồn tại.' AS Message;
            RETURN;
        END;

        DECLARE @TrangThaiCu NVARCHAR(50);
        SELECT @TrangThaiCu = TrangThaiDat FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour;

        -- Cập nhật trạng thái
        UPDATE dbo.DATTOUR
        SET TrangThaiDat = @TrangThaiMoi
        WHERE MaDatTour = @MaDatTour;

        -- Ghi log
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (@MaAdmin, N'ADMIN_DOI_TRANG_THAI_DON', @TrangThaiCu, CONCAT(N'Mã đơn #', @MaDatTour, N' -> ', @TrangThaiMoi), GETDATE());

        SELECT 1 AS Success, 200 AS StatusCode, N'Cập nhật trạng thái đơn đặt tour thành công!' AS Message;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- C5. API ADMIN: LẤY SỐ LIỆU TỔNG QUAN DASHBOARD KPI (THỐNG KÊ NHANH)
-- Backend Endpoint đề xuất: GET /api/admin/dashboard-kpi
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_GetDashboardKPI', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_GetDashboardKPI;
GO
CREATE PROCEDURE dbo.sp_api_Admin_GetDashboardKPI
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT 
            -- Tổng doanh thu đã thu thực tế
            (SELECT ISNULL(SUM(SoTien), 0) FROM dbo.THANHTOAN WHERE TrangThai = N'Thành công') AS TongDoanhThu,
            
            -- Tổng số đơn đặt tour
            (SELECT COUNT(*) FROM dbo.DATTOUR) AS TongDonDat,
            
            -- Số đơn đang chờ xử lý
            (SELECT COUNT(*) FROM dbo.DATTOUR WHERE TrangThaiDat = N'Chờ xác nhận') AS DonChoXacNhan,
            
            -- Tổng số khách hàng
            (SELECT COUNT(*) FROM dbo.NGUOIDUNG WHERE TrangThai = 1) AS TongKhachHang,
            
            -- Tổng số tour đang mở bán
            (SELECT COUNT(*) FROM dbo.TOUR WHERE TrangThai = 1) AS TongTourDangMoBan,
            
            -- Doanh thu tháng hiện tại
            (
                SELECT ISNULL(SUM(CASE WHEN LoaiGiaoDich = N'Thanh toán' THEN SoTien ELSE -SoTien END), 0) 
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

-- ==========================================================================================
-- D1. API KHÁCH HÀNG: GỬI YÊU CẦU ĐỔI / HỦY / HOÀN TIỀN (UC-10)
-- Backend Endpoint đề xuất: POST /api/bookings/:id/refund-request
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_SubmitRefundRequest', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_SubmitRefundRequest;
GO
CREATE PROCEDURE dbo.sp_api_SubmitRefundRequest
    @MaDatTour          INT,
    @MaKhachHang        INT,
    @LoaiYeuCau         NVARCHAR(50),
    @LyDo               NVARCHAR(1000),
    @SoTienYeuCauHoan   DECIMAL(18,2) = NULL,
    @ThongTinNganHang   NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND MaKhachHang = @MaKhachHang)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Đơn đặt tour không tồn tại hoặc không thuộc quyền sở hữu của bạn.' AS Message;
            RETURN;
        END;

        -- Kiểm tra đơn đã bị hủy hoàn tất chưa
        IF EXISTS (SELECT 1 FROM dbo.DATTOUR WHERE MaDatTour = @MaDatTour AND TrangThaiDat = N'Đã hủy')
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Đơn đặt tour này đã bị hủy trước đó.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.YEUCAU_HOANTIEN_DOILICH (
            MaDatTour, MaKhachHang, LoaiYeuCau, LyDo, SoTienYeuCauHoan, ThongTinNganHang, TrangThai, NgayTao
        )
        VALUES (
            @MaDatTour, @MaKhachHang, @LoaiYeuCau, @LyDo, @SoTienYeuCauHoan, @ThongTinNganHang, N'Chờ xử lý', GETDATE()
        );

        DECLARE @MaYeuCauMoi INT = SCOPE_IDENTITY();

        -- Ghi log
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (@MaKhachHang, N'GUI_YEU_CAU_HOAN_TIEN_DOI_LICH', NULL, CONCAT(N'Yêu cầu #', @MaYeuCauMoi, N', Mã đơn: ', @MaDatTour, N', Loại: ', @LoaiYeuCau), GETDATE());

        SELECT 
            1 AS Success, 
            201 AS StatusCode, 
            N'Đã gửi yêu cầu đổi/hủy/hoàn tiền thành công. Bộ phận CSKH sẽ phản hồi trong 24h!' AS Message,
            @MaYeuCauMoi AS MaYeuCau;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- D2. API ADMIN: PHÊ DUYỆT HOẶC TỪ CHỐI YÊU CẦU ĐỔI / HỦY / HOÀN TIỀN (UC-10)
-- Backend Endpoint đề xuất: POST /api/admin/refund-requests/:id/process
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_Admin_ProcessRefundRequest', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_Admin_ProcessRefundRequest;
GO
CREATE PROCEDURE dbo.sp_api_Admin_ProcessRefundRequest
    @MaYeuCau           INT,
    @HanhDong           NVARCHAR(50), -- 'Đã duyệt' hoặc 'Từ chối'
    @PhanHoiAdmin       NVARCHAR(1000),
    @MaAdmin            INT,
    @PhuongThucHoan     NVARCHAR(50) = NULL,
    @MaGiaoDichHoan     VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        DECLARE @MaDatTour INT;
        DECLARE @SoTienHoan DECIMAL(18,2);
        DECLARE @TrangThaiHienTai NVARCHAR(50);

        SELECT 
            @MaDatTour = MaDatTour,
            @SoTienHoan = ISNULL(SoTienYeuCauHoan, 0),
            @TrangThaiHienTai = TrangThai
        FROM dbo.YEUCAU_HOANTIEN_DOILICH
        WHERE MaYeuCau = @MaYeuCau;

        IF @MaDatTour IS NULL
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Yêu cầu hỗ trợ không tồn tại.' AS Message;
            RETURN;
        END;

        IF @TrangThaiHienTai <> N'Chờ xử lý'
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Yêu cầu này đã được xử lý trước đó.' AS Message;
            RETURN;
        END;

        IF @HanhDong = N'Đã duyệt'
        BEGIN
            -- Thực thi Procedure xác nhận hoàn tiền chính thức
            EXEC dbo.sp_XacNhanHoanTienDonTour
                @MaDatTour = @MaDatTour,
                @SoTienHoan = @SoTienHoan,
                @PhuongThuc = ISNULL(@PhuongThucHoan, N'Chuyển khoản hoàn tiền'),
                @MaGiaoDichHoan = @MaGiaoDichHoan,
                @GhiChu = @PhanHoiAdmin,
                @MaAdmin = @MaAdmin;
        END
        ELSE
        BEGIN
            -- Cập nhật từ chối yêu cầu
            UPDATE dbo.YEUCAU_HOANTIEN_DOILICH
            SET TrangThai = N'Từ chối',
                PhanHoiAdmin = @PhanHoiAdmin,
                NgayXuLy = GETDATE(),
                NguoiXuLy = @MaAdmin
            WHERE MaYeuCau = @MaYeuCau;

            -- Ghi Audit Log
            INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
            VALUES (@MaAdmin, N'TU_CHOI_HOAN_TIEN', CONCAT(N'Yêu cầu #', @MaYeuCau), @PhanHoiAdmin, GETDATE());
        END;

        SELECT 1 AS Success, 200 AS StatusCode, N'Đã xử lý yêu cầu đổi/hủy/hoàn tiền thành công!' AS Message;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- D3. API KHÁCH HÀNG: THÊM HOẶC BỎ LƯU TOUR YÊU THÍCH (UC-07)
-- Backend Endpoint đề xuất: POST /api/tours/:tourId/favorite
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_ToggleFavoriteTour', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_ToggleFavoriteTour;
GO
CREATE PROCEDURE dbo.sp_api_ToggleFavoriteTour
    @MaNguoiDung INT,
    @MaTour      INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.TOUR WHERE MaTour = @MaTour)
        BEGIN
            SELECT 0 AS Success, 404 AS StatusCode, N'Tour du lịch không tồn tại.' AS Message;
            RETURN;
        END;

        IF EXISTS (SELECT 1 FROM dbo.TOUR_YEUTHICH WHERE MaNguoiDung = @MaNguoiDung AND MaTour = @MaTour)
        BEGIN
            -- Đã lưu thì xóa bỏ yêu thích
            DELETE FROM dbo.TOUR_YEUTHICH WHERE MaNguoiDung = @MaNguoiDung AND MaTour = @MaTour;
            SELECT 1 AS Success, 200 AS StatusCode, N'Đã bỏ lưu khỏi danh sách tour yêu thích.' AS Message, 0 AS IsFavorite;
        END
        ELSE
        BEGIN
            -- Chưa lưu thì thêm vào danh sách yêu thích
            INSERT INTO dbo.TOUR_YEUTHICH (MaNguoiDung, MaTour, NgayLuu)
            VALUES (@MaNguoiDung, @MaTour, GETDATE());
            SELECT 1 AS Success, 201 AS StatusCode, N'Đã thêm tour vào danh sách yêu thích!' AS Message, 1 AS IsFavorite;
        END;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- D4. API KHÁCH HÀNG: LẤY DANH SÁCH TOUR YÊU THÍCH (UC-07)
-- Backend Endpoint đề xuất: GET /api/user/favorites
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetFavoriteTours', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetFavoriteTours;
GO
CREATE PROCEDURE dbo.sp_api_GetFavoriteTours
    @MaNguoiDung INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        yt.MaYeuThich,
        yt.NgayLuu,
        t.MaTour,
        t.TenTour,
        dm.TenDanhMuc,
        t.HinhAnhDaiDien,
        t.LichTrinhTongQuan,
        t.GiaKhuyenNghi
    FROM dbo.TOUR_YEUTHICH yt
    JOIN dbo.TOUR t ON yt.MaTour = t.MaTour
    JOIN dbo.DANHMUC dm ON t.MaDanhMuc = dm.MaDanhMuc
    WHERE yt.MaNguoiDung = @MaNguoiDung AND t.TrangThai = 1
    ORDER BY yt.NgayLuu DESC;
END;
GO

-- ==========================================================================================
-- D5. API PUBLIC: KHÁCH VÃNG LAI GỬI YÊU CẦU TƯ VẤN (UC-04)
-- Backend Endpoint đề xuất: POST /api/contact/consultation
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_SubmitConsultation', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_SubmitConsultation;
GO
CREATE PROCEDURE dbo.sp_api_SubmitConsultation
    @HoTen        NVARCHAR(100),
    @Email        VARCHAR(100) = NULL,
    @SoDienThoai  VARCHAR(15),
    @MaTour       INT = NULL,
    @NoiDung      NVARCHAR(1000)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF @HoTen IS NULL OR @SoDienThoai IS NULL OR @NoiDung IS NULL
        BEGIN
            SELECT 0 AS Success, 400 AS StatusCode, N'Vui lòng điền đầy đủ Họ tên, Số điện thoại và Nội dung yêu cầu.' AS Message;
            RETURN;
        END;

        INSERT INTO dbo.LIENHE_TUVAN (HoTen, Email, SoDienThoai, MaTour, NoiDung, TrangThai, NgayGui)
        VALUES (@HoTen, @Email, @SoDienThoai, @MaTour, @NoiDung, N'Chưa xử lý', GETDATE());

        SELECT 1 AS Success, 201 AS StatusCode, N'Đã tiếp nhận yêu cầu tư vấn. Delta Travel sẽ liên hệ với bạn trong thời gian sớm nhất!' AS Message,
               SCOPE_IDENTITY() AS MaLienHe;
    END TRY
    BEGIN CATCH
        SELECT 0 AS Success, 500 AS StatusCode, ERROR_MESSAGE() AS Message;
    END CATCH;
END;
GO

-- ==========================================================================================
-- D6. API PUBLIC: LẤY DANH SÁCH BANNER QUẢNG CÁO TRANG CHỦ (UC-15)
-- Backend Endpoint đề xuất: GET /api/banners
-- ==========================================================================================
IF OBJECT_ID(N'dbo.sp_api_GetBanners', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_api_GetBanners;
GO
CREATE PROCEDURE dbo.sp_api_GetBanners
    @ViTri NVARCHAR(50) = N'TrangChu_Hero'
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        MaBanner,
        TieuDe,
        HinhAnh,
        LienKet,
        ViTri,
        ThuTuHienThi
    FROM dbo.BANNER_QUANGCAO
    WHERE TrangThai = 1
      AND (ViTri = @ViTri OR @ViTri IS NULL)
      AND (NgayBatDau IS NULL OR NgayBatDau <= GETDATE())
      AND (NgayKetThuc IS NULL OR NgayKetThuc >= GETDATE())
    ORDER BY ThuTuHienThi ASC, NgayTao DESC;
END;
GO

PRINT N'==> Đã khởi tạo hoàn tất toàn bộ Bộ Stored Procedures dành riêng cho Web Backend API!';
GO

-- PHẦN 10: HỆ THỐNG MÃ ƯU ĐÃI (VOUCHER / PROMO CODE) TRÊN MICROSOFT SQL SERVER

-- ==========================================================================================

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


PRINT N'==========================================================================================';
PRINT N'🎉 CHÚC MỪNG: BẠN ĐÃ TRIỂN KHAI THÀNH CÔNG 100% CSDL TOUR DU LỊCH TRÊN MICROSOFT SQL SERVER!';
PRINT N'   ĐÃ TÍCH HỢP ĐẦY ĐỦ BỘ HÀM STORED PROCEDURES PHỤC VỤ WEB API CHO BACKEND!';
PRINT N'==========================================================================================';
GO