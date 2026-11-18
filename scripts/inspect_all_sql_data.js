const sql = require('mssql');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: process.env.DELTA_MSSQL_PASSWORD || '',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true }
};

async function inspectAll() {
  const pool = await sql.connect(config);
  
  console.log('=== DANHMUC ===');
  const dm = await pool.request().query('SELECT * FROM dbo.DANHMUC');
  console.log(dm.recordset);

  console.log('=== TOUR ===');
  const tours = await pool.request().query('SELECT * FROM dbo.TOUR');
  console.log(tours.recordset);

  console.log('=== CHUYENKHOIHANH ===');
  const chuyen = await pool.request().query('SELECT * FROM dbo.CHUYENKHOIHANH');
  console.log(chuyen.recordset);

  console.log('=== HINHANH_TOUR count ===');
  const imgs = await pool.request().query('SELECT MaTour, COUNT(*) as c FROM dbo.HINHANH_TOUR GROUP BY MaTour');
  console.log(imgs.recordset);

  console.log('=== LICH_TRINH_DETAIL count ===');
  const details = await pool.request().query('SELECT MaTour, COUNT(*) as c FROM dbo.LICH_TRINH_DETAIL GROUP BY MaTour');
  console.log(details.recordset);

  await pool.close();
}

inspectAll().catch(console.error);
