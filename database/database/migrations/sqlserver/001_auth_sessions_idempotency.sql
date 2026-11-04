-- Non-destructive STAGING migration for authenticated SQL Server booking API.
-- Keep the original 12 business tables unchanged. Two infrastructure tables are added.
-- Apply with SSMS connected to TourDuLichDB, only after DBA review + backup.
-- No USE/DROP. Safe to re-run for tables already created.
IF OBJECT_ID(N'dbo.API_PHIENDANGNHAP', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.API_PHIENDANGNHAP (
    TokenHash CHAR(64) NOT NULL,
    MaNguoiDung INT NOT NULL,
    CsrfHash CHAR(64) NOT NULL,
    HetHan DATETIME2(0) NOT NULL,
    CONSTRAINT PK_API_PHIENDANGNHAP PRIMARY KEY (TokenHash),
    CONSTRAINT FK_API_PHIENDANGNHAP_NGUOIDUNG FOREIGN KEY (MaNguoiDung)
      REFERENCES dbo.NGUOIDUNG(MaNguoiDung)
  );
  CREATE INDEX IX_API_PHIEN_USER_EXP ON dbo.API_PHIENDANGNHAP(MaNguoiDung, HetHan);
END;
GO
IF OBJECT_ID(N'dbo.API_YEUCAU_DATTOUR', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.API_YEUCAU_DATTOUR (
    MaNguoiDung INT NOT NULL,
    KhoaYeuCau UNIQUEIDENTIFIER NOT NULL,
    DauVanTay CHAR(64) NOT NULL,
    MaDatTour INT NULL,
    TaoLuc DATETIME2(0) NOT NULL CONSTRAINT DF_API_YEUCAU_TaoLuc DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_API_YEUCAU_DATTOUR PRIMARY KEY (MaNguoiDung, KhoaYeuCau),
    CONSTRAINT FK_API_YEUCAU_USER FOREIGN KEY (MaNguoiDung)
      REFERENCES dbo.NGUOIDUNG(MaNguoiDung),
    CONSTRAINT FK_API_YEUCAU_DATTOUR FOREIGN KEY (MaDatTour)
      REFERENCES dbo.DATTOUR(MaDatTour)
  );
END;
GO
