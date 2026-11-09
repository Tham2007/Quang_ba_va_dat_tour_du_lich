const mssql = require("mssql");

const config = {
  user: "db_ad0b71_dattour_admin",
  password: "Phamtham312007@",
  server: "sql8020.site4now.net",
  port: 1433,
  database: "db_ad0b71_dattour",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 10000
  }
};

async function main() {
  const pool = await mssql.connect(config);
  console.log("Connected to SmarterASP.NET SQL Server!");

  // 1. Tích hợp dữ liệu/chức năng của API_PHIENDANGNHAP vào bảng NGUOIDUNG (TokenHash, CsrfHash, HetHan)
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.NGUOIDUNG') AND name = 'TokenHash')
      BEGIN
        ALTER TABLE dbo.NGUOIDUNG ADD 
          TokenHash char(64) NULL,
          CsrfHash char(64) NULL,
          HetHan datetime2 NULL;
        PRINT 'Đã tích hợp các trường bảo mật phiên (TokenHash, CsrfHash, HetHan) vào bảng NGUOIDUNG.';
      END
    `);
    console.log("[OK] Tích hợp NGUOIDUNG hoàn tất.");
  } catch (err) {
    console.warn("Lỗi khi cập nhật NGUOIDUNG:", err.message);
  }

  // 2. Tích hợp dữ liệu/chức năng của API_TOUR_COST_ITEM vào bảng TOUR (ChiPhiChiTiet)
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TOUR') AND name = 'ChiPhiChiTiet')
      BEGIN
        ALTER TABLE dbo.TOUR ADD 
          ChiPhiChiTiet nvarchar(max) NULL;
        PRINT 'Đã tích hợp trường cơ cấu khoản mục chi phí (ChiPhiChiTiet) vào bảng TOUR.';
      END
    `);
    console.log("[OK] Tích hợp TOUR hoàn tất.");
  } catch (err) {
    console.warn("Lỗi khi cập nhật TOUR:", err.message);
  }

  // 3. Tích hợp dữ liệu/chức năng của API_YEUCAU_DATTOUR vào bảng DATTOUR (KhoaYeuCau, DauVanTay)
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DATTOUR') AND name = 'KhoaYeuCau')
      BEGIN
        ALTER TABLE dbo.DATTOUR ADD 
          KhoaYeuCau varchar(64) NULL,
          DauVanTay char(64) NULL;
        PRINT 'Đã tích hợp các trường chống trùng lặp đơn (KhoaYeuCau, DauVanTay) vào bảng DATTOUR.';
      END
    `);
    console.log("[OK] Tích hợp DATTOUR hoàn tất.");
  } catch (err) {
    console.warn("Lỗi khi cập nhật DATTOUR:", err.message);
  }

  // 4. Xóa hoàn toàn 3 bảng thừa: API_YEUCAU_DATTOUR, API_TOUR_COST_ITEM, API_PHIENDANGNHAP
  const tablesToDrop = [
    "API_YEUCAU_DATTOUR",
    "API_TOUR_COST_ITEM",
    "API_PHIENDANGNHAP"
  ];

  for (const tbl of tablesToDrop) {
    try {
      await pool.request().query(`
        IF OBJECT_ID('dbo.${tbl}', 'U') IS NOT NULL
        BEGIN
          DROP TABLE dbo.${tbl};
          PRINT 'Đã xóa bảng ${tbl}';
        END
      `);
      console.log(`[OK] Đã xóa bảng ${tbl}`);
    } catch (err) {
      console.error(`Lỗi khi xóa bảng ${tbl}:`, err.message);
    }
  }

  // 5. Kiểm tra và xác nhận danh sách bảng sau khi dọn dẹp
  const check = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  console.log("\n=======================================================");
  console.log(`TỔNG SỐ BẢNG HIỆN TẠI TRONG CƠ SỞ DỮ LIỆU: ${check.recordset.length} BẢNG`);
  console.log("DANH SÁCH BẢNG:");
  check.recordset.forEach((r, i) => console.log(`  ${i + 1}. ${r.TABLE_NAME}`));
  console.log("=======================================================\n");

  await pool.close();
}

main().catch(console.error);

