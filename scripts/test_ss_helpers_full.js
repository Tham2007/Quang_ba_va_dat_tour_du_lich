const mssql = require('mssql');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: process.env.DELTA_MSSQL_PASSWORD || '',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
};

async function run() {
  const pool = await mssql.connect(config);
  console.log('[OK] Connected to SQL Server!');

  // Test updating Tour 1 price and title
  const tx = new mssql.Transaction(pool);
  await tx.begin();
  try {
    const req = new mssql.Request(tx);
    req.input('maTour', mssql.Int, 1);
    req.input('gia', mssql.Decimal(18, 2), 3890000);
    req.input('ten', mssql.NVarChar(200), 'Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ - Hang Sửng Sốt');
    await req.query('UPDATE dbo.TOUR SET GiaKhuyenNghi = @gia, TenTour = @ten WHERE MaTour = @maTour');
    await tx.commit();
    console.log('[PASS] Updated Tour 1 directly on SQL Server');
  } catch(e) {
    await tx.rollback();
    throw e;
  }

  // Check audit log
  const al = await pool.request().query('SELECT TOP 3 * FROM dbo.AUDITLOG ORDER BY ThoiGian DESC');
  console.log('[PASS] Recent Audit logs in SQL Server:', al.recordset);

  await pool.close();
}

run().catch(console.error);
