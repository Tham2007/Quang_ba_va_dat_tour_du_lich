const sql = require('mssql');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: process.env.DELTA_MSSQL_PASSWORD || '',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true }
};

async function testPool() {
  const pool = await sql.connect(config);
  console.log('[OK] Connected to SQL Server!');
  
  // Test query on TOUR
  const res = await pool.request().query('SELECT MaTour, TenTour, GiaKhuyenNghi, TrangThai FROM dbo.TOUR');
  console.log('Tours:', res.recordset);

  // Test query on CHUYENKHOIHANH
  const scheds = await pool.request().query('SELECT TOP 3 MaChuyen, MaTour, NgayKhoiHanh, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen FROM dbo.CHUYENKHOIHANH');
  console.log('Schedules:', scheds.recordset);

  await pool.close();
}

testPool().catch(console.error);
