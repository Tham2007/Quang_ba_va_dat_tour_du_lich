-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 02_create_tables_3nf.sql
-- Mục đích: Khởi tạo cấu trúc bảng CSDL chuẩn hóa 3NF hoàn chỉnh (16 Bảng nghiệp vụ)
-- ==========================================================================================

USE TourDuLichDB;
GO

-- 1. BẢNG NGUOIDUNG (Tài khoản người dùng hệ thống)
-- Phân quyền quản trị 3 cấp độ: Admin (Quản trị viên), NhanVien (Điều hành/Kế toán), KhachHang (Khách hàng)
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
