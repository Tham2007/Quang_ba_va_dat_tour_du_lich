-- DELTA TRAVEL / 09-11-2026
-- STRICTLY READ-ONLY SQL Server 2019/2022 schema preflight.
-- Execute from SSMS with a read-only account in the intended database.
-- No INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE, EXEC, or persistent objects.
SET NOCOUNT ON;
SELECT DB_NAME() AS database_name, @@SERVERNAME AS connected_server,
       SYSDATETIME() AS inspected_local_time;
-- 12 business tables and 3 optional API infrastructure tables.
WITH expected AS (
  SELECT CAST(v.table_name AS SYSNAME) AS table_name,v.category
  FROM (VALUES
    (N'NGUOIDUNG',N'BUSINESS'),(N'DANHMUC',N'BUSINESS'),
    (N'TOUR',N'BUSINESS'),(N'HINHANH_TOUR',N'BUSINESS'),
    (N'LICH_TRINH_DETAIL',N'BUSINESS'),(N'CHUYENKHOIHANH',N'BUSINESS'),
    (N'DATTOUR',N'BUSINESS'),(N'CHITIET_HANHKHACH',N'BUSINESS'),
    (N'THANHTOAN',N'BUSINESS'),(N'DANHGIA',N'BUSINESS'),
    (N'BAIVIET_QUANGBA',N'BUSINESS'),(N'AUDITLOG',N'BUSINESS'),
    (N'API_PHIENDANGNHAP',N'OPTIONAL_INFRA'),
    (N'API_YEUCAU_DATTOUR',N'OPTIONAL_INFRA'),
    (N'API_TOUR_COST_ITEM',N'OPTIONAL_INFRA')
  ) v(table_name,category)
)
SELECT e.category,e.table_name,
       CASE WHEN t.object_id IS NULL THEN N'MISSING' ELSE N'FOUND' END AS [status],
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id=t.object_id) AS column_count
FROM expected e
LEFT JOIN sys.tables t ON t.name=e.table_name AND SCHEMA_NAME(t.schema_id)=N'dbo'
ORDER BY e.category,e.table_name;
-- Full dbo table inventory. Extra tables are reported, never removed.
SELECT s.name AS schema_name,t.name AS table_name,t.create_date,t.modify_date
FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
WHERE s.name=N'dbo'
ORDER BY t.name;
-- Check critical baseline columns and disputed extended columns; no data reads.
WITH expected_cols AS (
 SELECT v.table_name,v.column_name,v.origin
 FROM (VALUES
 (N'NGUOIDUNG',N'MaNguoiDung',N'BASE'),(N'NGUOIDUNG',N'Email',N'BASE'),
 (N'NGUOIDUNG',N'MatKhau',N'BASE'),(N'NGUOIDUNG',N'VaiTro',N'EXTENDED'),
 (N'NGUOIDUNG',N'TokenHash',N'EMBEDDED_OPTION'),
 (N'NGUOIDUNG',N'CsrfHash',N'EMBEDDED_OPTION'),
 (N'NGUOIDUNG',N'HetHan',N'EMBEDDED_OPTION'),
 (N'TOUR',N'MaTour',N'BASE'),(N'TOUR',N'MaDanhMuc',N'BASE'),
 (N'TOUR',N'GiaKhuyenNghi',N'BASE'),(N'TOUR',N'Slug',N'EXTENDED'),
 (N'TOUR',N'Duration',N'EXTENDED'),(N'TOUR',N'ChiPhiChiTiet',N'EMBEDDED_OPTION'),
 (N'CHUYENKHOIHANH',N'MaChuyen',N'BASE'),
 (N'CHUYENKHOIHANH',N'SoChoToiDa',N'BASE'),
 (N'CHUYENKHOIHANH',N'SoChoDaDat',N'BASE'),
 (N'DATTOUR',N'MaDatTour',N'BASE'),(N'DATTOUR',N'MaKhachHang',N'BASE'),
 (N'DATTOUR',N'MaChuyen',N'BASE'),(N'DATTOUR',N'KhoaYeuCau',N'EMBEDDED_OPTION'),
 (N'DATTOUR',N'DauVanTay',N'EMBEDDED_OPTION'),
 (N'API_PHIENDANGNHAP',N'TokenHash',N'OPTIONAL_INFRA'),
 (N'API_YEUCAU_DATTOUR',N'KhoaYeuCau',N'OPTIONAL_INFRA'),
 (N'API_TOUR_COST_ITEM',N'MaKhoanChi',N'OPTIONAL_INFRA')
 ) v(table_name,column_name,origin)
)
SELECT e.table_name,e.column_name,e.origin,
 CASE WHEN c.column_id IS NULL THEN N'MISSING' ELSE N'FOUND' END AS [status],
 ty.name AS data_type,c.max_length,c.is_nullable
FROM expected_cols e
LEFT JOIN sys.tables t ON t.name=e.table_name AND SCHEMA_NAME(t.schema_id)=N'dbo'
LEFT JOIN sys.columns c ON c.object_id=t.object_id AND c.name=e.column_name
LEFT JOIN sys.types ty ON ty.user_type_id=c.user_type_id
ORDER BY e.table_name,e.origin,e.column_name;
-- Only read PK / FK definitions, no changes.
SELECT N'PK' AS constraint_type,s.name AS schema_name,t.name AS table_name,
       kc.name AS constraint_name,CAST(NULL AS NVARCHAR(128)) AS referenced_table
FROM sys.key_constraints kc
JOIN sys.tables t ON kc.parent_object_id=t.object_id
JOIN sys.schemas s ON t.schema_id=s.schema_id
WHERE kc.[type]='PK' AND s.name=N'dbo'
UNION ALL
SELECT N'FK',s.name,t.name,fk.name,OBJECT_NAME(fk.referenced_object_id)
FROM sys.foreign_keys fk
JOIN sys.tables t ON fk.parent_object_id=t.object_id
JOIN sys.schemas s ON t.schema_id=s.schema_id
WHERE s.name=N'dbo'
ORDER BY table_name,constraint_type,constraint_name;
-- Stored procedures / triggers may be required for booking; existence != correctness.
SELECT o.name,o.type_desc,SCHEMA_NAME(o.schema_id) AS schema_name
FROM sys.objects o
WHERE o.[type] IN ('P','TR') AND
 (o.name LIKE N'%TaoDon%' OR o.name LIKE N'%HuyDon%' OR
  o.name LIKE N'%Booking%' OR o.name LIKE N'%DatTour%')
ORDER BY o.type_desc,o.name;
