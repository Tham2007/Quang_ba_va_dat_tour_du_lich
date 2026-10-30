-- LEGACY / DESTRUCTIVE: SQL Server only. Drops and recreates TourDuLichDB.
-- Do not run against production or the PostgreSQL database used by API/api.
-- ==========================================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU: WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN
-- Tác giả: Senior Database Architect / DBA
-- File: 01_create_database.sql
-- Mục đích: Khởi tạo CSDL TourDuLichDB với cấu hình tối ưu hiệu năng và hỗ trợ tiếng Việt có dấu
-- ==========================================================================================

USE master;
GO

-- 1. Kiểm tra nếu Database đã tồn tại thì ngắt kết nối và xóa sạch để tạo mới
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
