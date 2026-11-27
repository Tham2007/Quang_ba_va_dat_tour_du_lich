/**
 * Tool tự động chạy Migration cập nhật CSDL SQL Server lên 16 bảng chuẩn 3NF
 * Kết nối: sql8020.site4now.net / Database: db_ad0b71_dattour
 * 
 * Cách dùng:
 *   node scripts/apply_sqlserver_migration.js <mat_khau_sql_server>
 * hoặc:
 *   $env:DELTA_MSSQL_PASSWORD="mat_khau"; node scripts/apply_sqlserver_migration.js
 */

const mssql = require('mssql');
const fs = require('fs');
const path = require('path');

const password = process.argv[2] || process.env.DELTA_MSSQL_PASSWORD || process.env.SQL_SERVER_PASS || process.env.MSSQL_PASSWORD;

if (!password) {
  console.error('\n❌ LỖI: Chưa có mật khẩu kết nối SQL Server!');
  console.log('👉 Vui lòng chạy lệnh kèm mật khẩu:');
  console.log('   node scripts/apply_sqlserver_migration.js <mat_khau_cua_ban>\n');
  process.exit(1);
}

const config = {
  user: process.env.DELTA_MSSQL_USER || 'db_ad0b71_dattour_admin',
  password: password,
  server: process.env.DELTA_MSSQL_SERVER || 'sql8020.site4now.net',
  port: 1433,
  database: process.env.DELTA_MSSQL_DATABASE || 'db_ad0b71_dattour',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 25000,
    requestTimeout: 60000
  }
};

async function run() {
  console.log('\n======================================================');
  console.log('🔄 Đang kết nối tới máy chủ Microsoft SQL Server...');
  console.log(`   Host: ${config.server}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  console.log('======================================================\n');

  let pool;
  try {
    pool = await mssql.connect(config);
    console.log('✅ Kết nối thành công tới SQL Server!\n');
  } catch (err) {
    console.error('❌ Kết nối thất bại:', err.message);
    process.exit(1);
  }

  const migrationPath = path.resolve(__dirname, '../database/database/migrations/sqlserver/004_update_schema_to_16_tables.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

  // Tách các khối lệnh bởi GO
  const batches = sqlContent
    .split(/^\s*GO\s*(?:--.*)?$/im)
    .map(b => b.trim())
    .filter(b => b.length > 0);

  console.log(`🚀 Bắt đầu thực thi ${batches.length} khối lệnh T-SQL Migration...`);

  let successCount = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      await pool.request().query(batch);
      successCount++;
      process.stdout.write(`  [${i + 1}/${batches.length}] Đã thực thi thành công...\r`);
    } catch (batchErr) {
      console.error(`\n⚠️ Cảnh báo tại khối lệnh ${i + 1}:`, batchErr.message);
    }
  }

  console.log(`\n\n🎉 Đã thực thi xong ${successCount}/${batches.length} khối lệnh Migration!\n`);

  // Kiểm tra xác nhận danh sách bảng hiện có trong database
  const checkResult = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'
    ORDER BY TABLE_NAME;
  `);

  const tables = checkResult.recordset.map(r => r.TABLE_NAME);
  console.log('📋 Danh sách bảng hiện có trong CSDL SQL Server:', tables);

  // Kiểm tra các cột mới được thêm
  const colCheck = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' 
      AND (
        (TABLE_NAME = 'NGUOIDUNG' AND COLUMN_NAME = 'VaiTro') OR
        (TABLE_NAME = 'CHUYENKHOIHANH' AND COLUMN_NAME = 'SoChoGiuCho') OR
        (TABLE_NAME = 'DATTOUR' AND COLUMN_NAME = 'ThoiHanGiuCho') OR
        (TABLE_NAME = 'THANHTOAN' AND COLUMN_NAME = 'LoaiGiaoDich')
      );
  `);
  console.log('\n🔍 Các cột nghiệp vụ mới đã xác nhận tồn tại:');
  console.table(colCheck.recordset);

  await pool.close();
  console.log('✅ Hoàn tất đóng kết nối SQL Server an toàn.\n');
}

run().catch(console.error);
